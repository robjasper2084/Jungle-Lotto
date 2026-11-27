"""Transport one immutable completed artifact; never extract or execute it.

Usage: GH_TOKEN=... python3 transport.py NEW_OUTPUT_DIR
Tests: python3 transport_test.py
The command-line interface has no artifact, source, digest or part-size override.
"""

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request


PART_BYTES = 256 * 1024 * 1024
READ_BYTES = 1024 * 1024
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 5
REPOSITORY_ID = 1216655619
BRANCH = "upgrade-redesign-perf-261-full-trace-20261127"


@dataclass(frozen=True)
class ArtifactPin:
    repository: str = "robjasper2084/Jungle-Lotto"
    run_id: int = 45983706110
    head: str = "2806fbd4f9b445177b0fd37c6a417ec844312d30"
    artifact_id: int = 15190968508
    bytes: int = 556392705
    sha256: str = "2f3d33a7057b941cf2433d3e53bf9a8437f373d04ddf64fe18cfcb9886d39776"

    def identity(self):
        return {"repository": self.repository, "runId": self.run_id,
                "head": self.head, "artifactId": self.artifact_id,
                "bytes": self.bytes, "sha256": self.sha256}


PIN = ArtifactPin()


class TransportError(Exception):
    """Only fixed, credential-free codes are allowed in persisted failures."""


def require(condition, code):
    if not condition:
        raise TransportError(code)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def artifact_endpoint(pin=PIN):
    return f"https://api.github.com/repos/{pin.repository}/actions/artifacts/{pin.artifact_id}"


def run_endpoint(pin=PIN):
    return f"https://api.github.com/repos/{pin.repository}/actions/runs/{pin.run_id}"


def verify_metadata(artifact, run, pin=PIN):
    require(isinstance(artifact, dict) and isinstance(run, dict), "METADATA_NOT_OBJECT")
    require(artifact.get("id") == pin.artifact_id, "ARTIFACT_ID_MISMATCH")
    require(artifact.get("expired") is False, "ARTIFACT_EXPIRED_OR_UNKNOWN")
    require(artifact.get("size_in_bytes") == pin.bytes, "ARTIFACT_SIZE_MISMATCH")
    require(artifact.get("digest") == "sha256:" + pin.sha256, "ARTIFACT_DIGEST_MISMATCH")
    require(artifact.get("archive_download_url") == artifact_endpoint(pin) + "/zip", "ARTIFACT_DOWNLOAD_ENDPOINT_MISMATCH")
    require(artifact.get("url") == artifact_endpoint(pin), "ARTIFACT_METADATA_ENDPOINT_MISMATCH")
    workflow = artifact.get("workflow_run")
    require(isinstance(workflow, dict), "ARTIFACT_WORKFLOW_MISSING")
    require(workflow.get("id") == pin.run_id, "ARTIFACT_RUN_MISMATCH")
    require(workflow.get("head_sha") == pin.head, "ARTIFACT_HEAD_MISMATCH")
    require(workflow.get("head_branch") == BRANCH, "ARTIFACT_BRANCH_MISMATCH")
    for key in ("repository_id", "head_repository_id"):
        require(workflow.get(key) == REPOSITORY_ID, "ARTIFACT_REPOSITORY_MISMATCH")
    require(run.get("id") == pin.run_id, "RUN_ID_MISMATCH")
    require(run.get("head_sha") == pin.head, "RUN_HEAD_MISMATCH")
    require(run.get("head_branch") == BRANCH, "RUN_BRANCH_MISMATCH")
    require(run.get("status") == "completed", "RUN_NOT_COMPLETED")
    for key in ("repository", "head_repository"):
        repo = run.get(key)
        require(isinstance(repo, dict) and repo.get("id") == REPOSITORY_ID
                and repo.get("full_name") == pin.repository, "RUN_REPOSITORY_MISMATCH")


def parsed_https(url):
    try:
        parsed = urllib.parse.urlsplit(url)
        valid = (parsed.scheme == "https" and parsed.hostname
                 and not parsed.username and not parsed.password
                 and parsed.port in (None, 443) and not parsed.fragment)
    except (TypeError, ValueError):
        raise TransportError("INVALID_HTTPS_URL") from None
    require(valid, "INVALID_HTTPS_URL")
    return parsed


def storage_host_allowed(host):
    # Standard GitHub Actions results storage and GitHub-owned artifact CDNs.
    # A host is accepted only when received as a redirect from the pinned API
    # request or another accepted storage host. No credentials follow redirects.
    return bool(
        re.fullmatch(r"productionresultssa[0-9]+\.blob\.core\.windows\.net", host)
        or re.fullmatch(r"(?:[a-z0-9-]+\.)*actions\.githubusercontent\.com", host)
        or host in ("objects.githubusercontent.com", "release-assets.githubusercontent.com")
        or re.fullmatch(r"github-production-[a-z0-9-]+\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com", host)
    )


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HttpClient:
    def __init__(self, token, opener=None):
        require(isinstance(token, str) and token and "\r" not in token and "\n" not in token,
                "GH_TOKEN_MISSING_OR_INVALID")
        self._token = token
        self._opener = opener or urllib.request.build_opener(NoRedirect)
        self.observations = []

    def _open(self, url, authenticated):
        parsed = parsed_https(url)
        if authenticated:
            require(parsed.hostname == "api.github.com" and not parsed.query,
                    "AUTHENTICATED_HOST_OR_QUERY_REJECTED")
        else:
            require(storage_host_allowed(parsed.hostname), "STORAGE_HOST_REJECTED")
        headers = {"User-Agent": "belle-immutable-artifact-transport"}
        if authenticated:
            headers.update({"Authorization": "Bearer " + self._token,
                            "Accept": "application/vnd.github+json",
                            "X-GitHub-Api-Version": "2022-11-28"})
        else:
            headers["Accept"] = "application/octet-stream"
        try:
            response = self._opener.open(urllib.request.Request(url, headers=headers), timeout=60)
        except urllib.error.HTTPError as error:
            response = error
        except Exception as error:
            raise TransportError("HTTP_OPEN_FAILED_" + type(error).__name__) from None
        code = response.getcode()
        # Never retain URLs, query strings, Location headers or exception text.
        self.observations.append({"host": parsed.hostname, "status": code,
                                  "githubAuthorizationSent": authenticated})
        return response

    def get_json(self, url):
        response = self._open(url, True)
        try:
            require(response.getcode() == 200, "METADATA_HTTP_STATUS_" + str(response.getcode()))
            body = response.read(MAX_JSON_BYTES + 1)
            require(len(body) <= MAX_JSON_BYTES, "METADATA_TOO_LARGE")
            value = json.loads(body)
            require(isinstance(value, dict), "METADATA_NOT_OBJECT")
            return value
        except TransportError:
            raise
        except Exception as error:
            raise TransportError("METADATA_READ_FAILED_" + type(error).__name__) from None
        finally:
            response.close()

    def open_archive(self, pin=PIN):
        url = artifact_endpoint(pin) + "/zip"
        for redirect in range(MAX_REDIRECTS + 1):
            response = self._open(url, redirect == 0)
            if response.getcode() == 200:
                return response
            code, location = response.getcode(), response.headers.get("Location")
            response.close()
            require(code in (301, 302, 303, 307, 308), "ARCHIVE_HTTP_STATUS_" + str(code))
            require(redirect < MAX_REDIRECTS, "REDIRECT_LIMIT_EXCEEDED")
            require(isinstance(location, str) and location, "REDIRECT_LOCATION_MISSING")
            # Absolute HTTPS only: relative or scheme-relative URLs are rejected.
            parsed = parsed_https(location)
            require(storage_host_allowed(parsed.hostname), "STORAGE_HOST_REJECTED")
            url = location
        raise TransportError("REDIRECT_LIMIT_EXCEEDED")


def write_json_new(path, value):
    with path.open("x", encoding="utf-8") as target:
        json.dump(value, target, indent=2)
        target.write("\n")


def regular_file(path):
    try:
        info = path.lstat()
    except FileNotFoundError:
        raise TransportError("PART_FILE_MISSING") from None
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink(), "NONREGULAR_FILE_REJECTED")
    return info


def read_hash(source, expected_bytes, sink=None, progress=None):
    digest, count = hashlib.sha256(), 0
    while True:
        # Read one additional byte to detect an oversized response/file without
        # retaining an unbounded unexpected body. Keep those actual partial bytes.
        block = source.read(min(READ_BYTES, expected_bytes + 1 - count))
        if not block:
            break
        require(isinstance(block, bytes), "NONBYTE_STREAM_REJECTED")
        if sink is not None:
            sink.write(block)
        count += len(block)
        digest.update(block)
        if progress is not None:
            progress.update({"receivedBytes": count, "receivedSha256": digest.hexdigest()})
        require(count <= expected_bytes, "EXTRA_ARCHIVE_BYTES")
    require(count == expected_bytes, "TRUNCATED_ARCHIVE_BYTES")
    return {"bytes": count, "sha256": digest.hexdigest()}


def download_archive(client, output, pin, progress):
    partial = output / "original-artifact.zip.partial"
    response = client.open_archive(pin)
    try:
        with partial.open("xb") as target:
            receipt = read_hash(response, pin.bytes, target, progress)
        require(receipt["sha256"] == pin.sha256, "ARCHIVE_SHA256_MISMATCH")
    except TransportError:
        raise
    except Exception as error:
        raise TransportError("ARCHIVE_STREAM_FAILED_" + type(error).__name__) from None
    finally:
        response.close()
    archive = output / "original-artifact.zip"
    # Link is exclusive: an unexpected existing destination is never replaced.
    os.link(partial, archive)
    partial.unlink()
    return archive, receipt


def split_verified_archive(archive, output, verified, pin=PIN, part_bytes=PART_BYTES):
    require(verified == {"bytes": pin.bytes, "sha256": pin.sha256}, "ARCHIVE_NOT_VERIFIED")
    require(type(part_bytes) is int and part_bytes > 0, "INVALID_PART_SIZE")
    require(regular_file(archive).st_size == pin.bytes, "ARCHIVE_SIZE_CHANGED")
    parts, offset, original = [], 0, hashlib.sha256()
    with archive.open("rb") as source:
        while offset < pin.bytes:
            number = len(parts)
            name = f"original-artifact.part-{number:03d}.bin"
            size = min(part_bytes, pin.bytes - offset)
            digest, written = hashlib.sha256(), 0
            with (output / name).open("xb") as target:
                while written < size:
                    block = source.read(min(READ_BYTES, size - written))
                    require(block, "ARCHIVE_TRUNCATED_DURING_SPLIT")
                    target.write(block)
                    written += len(block)
                    digest.update(block)
                    original.update(block)
            parts.append({"file": name, "offset": offset, "bytes": written, "sha256": digest.hexdigest()})
            offset += written
        require(source.read(1) == b"", "ARCHIVE_GREW_DURING_SPLIT")
    require(original.hexdigest() == pin.sha256, "ARCHIVE_CHANGED_DURING_SPLIT")
    return parts


def verify_parts(directory, manifest, pin=PIN, part_bytes=PART_BYTES):
    """Reconstruct the original digest by streaming canonical parts, without unzip.

    This writes no reconstruction file and does not replace any supplied file.
    The production CLI always uses PIN and PART_BYTES; fixture injection is for tests.
    """
    require(type(part_bytes) is int and part_bytes > 0, "INVALID_PART_SIZE")
    require(type(manifest.get("version")) is int and manifest.get("version") == 1
            and manifest.get("original") == pin.identity(), "MANIFEST_IDENTITY_MISMATCH")
    require(type(manifest.get("partSize")) is int and manifest.get("partSize") == part_bytes, "MANIFEST_PART_SIZE_MISMATCH")
    require(manifest.get("verifiedBeforeSplit") == {"bytes": pin.bytes, "sha256": pin.sha256}, "PRE_SPLIT_VERIFICATION_MISSING")
    rows = manifest.get("parts")
    count = (pin.bytes + part_bytes - 1) // part_bytes
    require(isinstance(rows, list) and len(rows) == count, "PART_COUNT_MISMATCH")
    expected_names = {f"original-artifact.part-{i:03d}.bin" for i in range(count)}
    actual_names = {path.name for path in directory.glob("original-artifact.part-*.bin")}
    require(actual_names == expected_names, "PART_FILE_SET_MISMATCH")
    original, offset = hashlib.sha256(), 0
    for i, row in enumerate(rows):
        require(isinstance(row, dict) and set(row) == {"file", "offset", "bytes", "sha256"}, "PART_SCHEMA_MISMATCH")
        require(row["file"] == f"original-artifact.part-{i:03d}.bin", "PART_NAME_OR_ORDER_MISMATCH")
        size = min(part_bytes, pin.bytes - offset)
        require(type(row["offset"]) is int and type(row["bytes"]) is int
                and row["offset"] == offset and row["bytes"] == size and size > 0, "PART_RANGE_MISMATCH")
        require(isinstance(row["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", row["sha256"]), "PART_DIGEST_MALFORMED")
        path = directory / row["file"]
        require(regular_file(path).st_size == size, "PART_FILE_SIZE_MISMATCH")
        digest = hashlib.sha256()
        with path.open("rb") as source:
            read = 0
            while True:
                block = source.read(min(READ_BYTES, size + 1 - read))
                if not block:
                    break
                read += len(block)
                require(read <= size, "EXTRA_PART_BYTES")
                digest.update(block)
                original.update(block)
        require(read == size, "TRUNCATED_PART_BYTES")
        require(digest.hexdigest() == row["sha256"], "PART_SHA256_MISMATCH")
        offset += read
    require(offset == pin.bytes and original.hexdigest() == pin.sha256, "RECONSTRUCTED_ARCHIVE_MISMATCH")
    return {"bytes": offset, "sha256": original.hexdigest(), "parts": count,
            "verified": True, "method": "ordered-part-byte-stream"}


def transport(output, token, *, client=None, pin=PIN, part_bytes=PART_BYTES):
    output = Path(output)
    output.mkdir(parents=False, exist_ok=False, mode=0o700)
    state = {"stage": "starting", "receivedBytes": 0}
    log_path = output / "transport-log.jsonl"
    with log_path.open("x", encoding="utf-8"):
        pass

    def log(event, **fields):
        with log_path.open("a", encoding="utf-8") as target:
            target.write(json.dumps({"event": event, **fields}, sort_keys=True) + "\n")

    log("started", original=pin.identity(), transportOnly=True)
    http = None
    try:
        http = client or HttpClient(token)
        state["stage"] = "metadata"
        artifact = http.get_json(artifact_endpoint(pin))
        write_json_new(output / "artifact-metadata.json", artifact)
        run = http.get_json(run_endpoint(pin))
        write_json_new(output / "run-metadata.json", run)
        verify_metadata(artifact, run, pin)
        log("metadata-verified", artifactId=pin.artifact_id, runId=pin.run_id)
        state["stage"] = "download"
        archive, verified = download_archive(http, output, pin, state)
        log("original-archive-verified", **verified)
        state["stage"] = "split"
        parts = split_verified_archive(archive, output, verified, pin, part_bytes)
        manifest = {"version": 1, "transportOnly": True, "nativeExecution": False,
                    "buildExecution": False, "extracted": False,
                    "scope": "Byte transport of one already completed immutable diagnostic artifact; no new measurement or acceptance claim.",
                    "original": pin.identity(), "metadata": {"artifact": artifact, "run": run},
                    "partSize": part_bytes, "verifiedBeforeSplit": verified, "parts": parts,
                    "httpObservations": http.observations}
        state["stage"] = "reconstruction"
        manifest["reconstruction"] = verify_parts(output, manifest, pin, part_bytes)
        write_json_new(output / "manifest.json", manifest)
        log("complete", reconstruction=manifest["reconstruction"])
        return manifest
    except Exception as error:
        code = str(error) if isinstance(error, TransportError) else "UNEXPECTED_" + type(error).__name__
        # Never serialize third-party exception messages: they may contain a
        # signed URL, request headers or a token. Preserve stage and received bytes.
        failure = {"version": 1, "transportOnly": True, "passed": False,
                   "original": pin.identity(), "state": state, "errorCode": code,
                   "httpObservations": http.observations if http is not None else [],
                   "partialFilesPreserved": True, "nativeExecution": False,
                   "buildExecution": False, "extracted": False}
        write_json_new(output / "failure.json", failure)
        log("failed", stage=state["stage"], errorCode=code, receivedBytes=state["receivedBytes"])
        raise TransportError(code) from None


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 transport.py NEW_OUTPUT_DIR", file=sys.stderr)
        return 2
    try:
        manifest = transport(Path(sys.argv[1]), os.environ.get("GH_TOKEN", ""))
    except Exception as error:
        code = str(error) if isinstance(error, TransportError) else "UNEXPECTED_" + type(error).__name__
        print(json.dumps({"transportOnly": True, "passed": False, "errorCode": code}))
        return 1
    print(json.dumps({"transportOnly": True, "passed": True,
                      "artifactId": PIN.artifact_id, "bytes": PIN.bytes,
                      "sha256": PIN.sha256, "parts": len(manifest["parts"])}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
