"""Restore only the immutable artifact emitted by this workflow's pinned build job."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import urllib.error
import urllib.request
import zipfile


def digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for part in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def checked_entries(archive):
    seen = set()
    total = 0
    entries = archive.infolist()
    assert 0 < len(entries) <= 10000, "Unexpected build archive count"
    for info in entries:
        name = info.filename.rstrip("/") if info.is_dir() else info.filename
        path = PurePosixPath(name)
        assert name and not path.is_absolute() and ".." not in path.parts
        assert "\\" not in name and str(path) == name and name not in seen
        mode = info.external_attr >> 16
        assert stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), "Nonregular build archive member"
        assert not stat.S_ISLNK(mode)
        seen.add(name)
        total += info.file_size
        assert total <= 1024 * 1024 * 1024, "Unexpected build expansion"
    return entries


def restore(archive, dist):
    dist.mkdir(parents=True, exist_ok=True)
    assert not any(dist.iterdir()), "Refuse to mix build files"
    with zipfile.ZipFile(archive) as zipped:
        entries = checked_entries(zipped)
        for info in entries:
            destination = dist / info.filename
            if info.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Reading to EOF verifies each member's original ZIP CRC.
            with zipped.open(info) as source, destination.open("xb") as target:
                while part := source.read(1024 * 1024):
                    target.write(part)
    rows = [{"file": path.relative_to(dist).as_posix(), "bytes": path.stat().st_size, "sha256": digest_file(path)}
            for path in dist.rglob("*") if path.is_file()]
    return sorted(rows, key=lambda row: row["file"])


def main():
    pin = json.loads(Path(__file__).with_name("pins.json").read_text())
    assert pin["state"] == "fixed-source-reviewed" and pin["buildMode"] == "same-run-original-staged-build"
    workspace = Path(os.environ["GITHUB_WORKSPACE"])
    evidence = workspace / "evidence"
    dist = workspace / "app/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/dist"
    evidence.mkdir(parents=True, exist_ok=True)
    binding = {
        "id": int(os.environ["PREFLIGHT_BUILD_ARTIFACT_ID"]),
        "runId": int(os.environ["GITHUB_RUN_ID"]),
        "sha256": os.environ["PREFLIGHT_BUILD_ARTIFACT_SHA256"],
        "inventorySha256": os.environ["PREFLIGHT_BUILD_INVENTORY_SHA256"],
        "indexSha256": os.environ["PREFLIGHT_BUILD_INDEX_SHA256"],
        "diagnosticHead": os.environ["DIAGNOSTIC_EXPECTED_HEAD"],
    }
    assert binding["id"] > 0 and binding["runId"] > 0
    for key in ("sha256", "inventorySha256", "indexSha256"):
        assert len(binding[key]) == 64 and all(c in "0123456789abcdef" for c in binding[key])
    assert len(binding["diagnosticHead"]) == 40 and all(c in "0123456789abcdef" for c in binding["diagnosticHead"])
    endpoint = f'https://api.github.com/repos/{pin["repository"]}/actions/artifacts/{binding["id"]}'
    headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    with urllib.request.urlopen(urllib.request.Request(endpoint, headers=headers), timeout=60) as response:
        metadata = json.load(response)
    (evidence / "artifact-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    assert metadata["id"] == binding["id"] and metadata["name"] == pin["artifactName"] and not metadata["expired"]
    assert metadata["workflow_run"]["id"] == binding["runId"] and metadata["workflow_run"]["head_sha"] == binding["diagnosticHead"]
    assert metadata["digest"] == "sha256:" + binding["sha256"]
    assert 0 < metadata["size_in_bytes"] <= 1024 * 1024 * 1024

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            return None

    try:
        urllib.request.build_opener(NoRedirect).open(urllib.request.Request(endpoint + "/zip", headers=headers), timeout=60)
        raise AssertionError("Expected artifact redirect")
    except urllib.error.HTTPError as error:
        assert error.code == 302
        location = error.headers["Location"]
    assert location.startswith("https://")
    archive = Path(os.environ["RUNNER_TEMP"]) / "view-preflight-immutable-build.zip"
    # GitHub credentials are never forwarded to the signed storage URL.
    downloaded = 0
    with urllib.request.urlopen(location, timeout=60) as response, archive.open("xb") as target:
        while part := response.read(1024 * 1024):
            downloaded += len(part)
            assert downloaded <= metadata["size_in_bytes"], "Artifact exceeded its immutable metadata length"
            target.write(part)
    assert downloaded == metadata["size_in_bytes"] and digest_file(archive) == binding["sha256"]
    files = restore(archive, dist)
    inventory_bytes = (json.dumps(files, indent=2, ensure_ascii=False) + "\n").encode()
    assert hashlib.sha256(inventory_bytes).hexdigest() == binding["inventorySha256"], "Build job's complete inventory changed"
    assert digest_file(dist / "index.html") == binding["indexSha256"]
    marker = json.loads((dist / "staged-landmark-proof-build.json").read_text())
    assert marker["sourceSha"] == pin["head"] and marker["indexSha256"] == binding["indexSha256"] and marker["stagedFlag"] == "VITE_STAGED_BELLE_ARCHITECTURE=1"
    (evidence / "dist-manifest.json").write_bytes(inventory_bytes)
    provenance = {"binding": binding, "zipSha256": binding["sha256"], "zipBytes": downloaded,
                  "sourceHead": pin["head"], "sourceTree": pin["tree"], "allMembersCrcVerified": True, "files": len(files),
                  "archiveRetainedBy": "immutable upstream Actions artifact; duplicate ZIP omitted from native evidence"}
    (evidence / "artifact-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print("Verified same-run fixed-source artifact:", binding["id"], len(files), "files; SHA256", binding["sha256"])


if __name__ == "__main__":
    main()
