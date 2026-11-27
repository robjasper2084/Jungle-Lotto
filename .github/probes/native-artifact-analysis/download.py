"""Download one manifest-pinned existing Actions artifact. Never starts a run."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"
REPO = "robjasper2084/Jungle-Lotto"
MAX_METADATA = 2 * 1024 * 1024
MAX_ARCHIVE = 640 * 1024 * 1024
TOTAL_SECONDS = 300

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class StorageRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        checked_storage_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def checked_storage_url(url):
    p = urllib.parse.urlparse(url)
    host = (p.hostname or "").lower()
    assert p.scheme == "https" and not p.username and not p.password, "Unsafe artifact redirect"
    assert any(host.endswith(s) for s in (".blob.core.windows.net", ".amazonaws.com", ".actions.githubusercontent.com", ".githubusercontent.com")), "Unrecognized artifact storage host"
    return url

def read_bounded(response, maximum, deadline):
    data = bytearray()
    while True:
        assert time.monotonic() < deadline, "Artifact request exceeded total download deadline"
        block = response.read(min(1024 * 1024, maximum + 1 - len(data)))
        assert time.monotonic() < deadline, "Artifact request exceeded total download deadline"
        if not block:
            return bytes(data)
        data.extend(block)
        assert len(data) <= maximum, "Artifact metadata exceeded byte limit"

def main():
    assert len(sys.argv) == 3, "Expected manifest path and output directory"
    manifest = json.loads(Path(sys.argv[1]).read_text())
    expected = manifest["capture"]
    assert expected["repository"] == REPO
    assert expected["attempt"] == 1
    expected_sha = expected["archiveSha256"]
    assert isinstance(expected_sha, str) and len(expected_sha) == 64 and all(c in "0123456789abcdef" for c in expected_sha), "Missing or malformed immutable archive SHA-256 pin"
    token = os.environ.get("GH_TOKEN")
    assert token, "Read-only Actions token is required"
    deadline = time.monotonic() + TOTAL_SECONDS
    auth = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "retained-native-artifact-analysis"}
    opener = urllib.request.build_opener(NoRedirect)
    metadata_url = API + "/repos/" + REPO + "/actions/artifacts/" + str(expected["artifactId"])
    with opener.open(urllib.request.Request(metadata_url, headers=auth), timeout=45) as response:
        metadata_bytes = read_bounded(response, MAX_METADATA, deadline)
    metadata = json.loads(metadata_bytes)
    assert metadata["id"] == expected["artifactId"]
    assert metadata["name"] == expected["artifactName"]
    assert metadata["expired"] is False
    assert metadata["workflow_run"]["id"] == expected["runId"]
    assert metadata["workflow_run"]["head_sha"] == expected["head"]
    assert metadata["size_in_bytes"] == expected["archiveBytes"]
    assert 0 < metadata["size_in_bytes"] <= MAX_ARCHIVE
    run_url = API + "/repos/" + REPO + "/actions/runs/" + str(expected["runId"])
    with opener.open(urllib.request.Request(run_url, headers=auth), timeout=45) as response:
        run_bytes = read_bounded(response, MAX_METADATA, deadline)
    run = json.loads(run_bytes)
    assert run["id"] == expected["runId"] and run["run_attempt"] == expected["attempt"]
    assert run["head_sha"] == expected["head"]
    assert run["status"] == "completed", "Source capture is not final"
    assert run["conclusion"] == expected["conclusion"], "Source result changed"
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "artifact.zip"
    assert not archive.exists(), "The analysis must download the artifact only once"
    archive_url = metadata_url + "/zip"
    try:
        direct = opener.open(urllib.request.Request(archive_url, headers=auth), timeout=45)
    except urllib.error.HTTPError as error:
        assert error.code in (301, 302, 303, 307, 308), "Artifact download was rejected"
        location = checked_storage_url(error.headers["Location"])
        error.close()
        # Deliberately create a new request without the GitHub authorization header.
        direct = urllib.request.build_opener(StorageRedirect).open(
            urllib.request.Request(location, headers={"User-Agent": "retained-native-artifact-analysis"}), timeout=45)
    digest = hashlib.sha256()
    size = 0
    with direct as response, archive.open("xb") as target:
        while True:
            assert time.monotonic() < deadline, "Artifact download exceeded total deadline"
            block = response.read(1024 * 1024)
            assert time.monotonic() < deadline, "Artifact download exceeded total deadline"
            if not block:
                break
            size += len(block)
            assert size <= MAX_ARCHIVE and size <= expected["archiveBytes"], "Artifact ZIP exceeded pinned byte count"
            digest.update(block)
            target.write(block)
    assert size == expected["archiveBytes"], "Artifact ZIP size differs from immutable metadata"
    sha = digest.hexdigest()
    declared_digest = metadata.get("digest")
    if declared_digest is not None:
        assert declared_digest == "sha256:" + sha, "Artifact ZIP digest differs from GitHub metadata"
    assert sha == expected_sha, "Artifact ZIP differs from the immutable archive SHA-256 pin"
    archive.chmod(0o444)
    (output / "artifact-metadata.json").write_bytes(metadata_bytes)
    (output / "source-run.json").write_bytes(run_bytes)
    receipt = {"repository": REPO, "runId": expected["runId"], "attempt": 1,
               "head": expected["head"], "artifactId": expected["artifactId"],
               "artifactName": expected["artifactName"], "archiveBytes": size, "archiveSha256": sha,
               "githubDigest": declared_digest, "sourceConclusion": run["conclusion"],
               "metadataSha256": hashlib.sha256(metadata_bytes).hexdigest(),
               "runMetadataSha256": hashlib.sha256(run_bytes).hexdigest(),
               "nativeRunStarted": False, "browserStarted": False, "releaseAcceptance": False}
    (output / "download-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("FROZEN_ARTIFACT_DOWNLOAD=" + json.dumps(receipt, separators=(",", ":")), flush=True)

if __name__ == "__main__":
    main()
