"""Restore one immutable CI artifact. Never build, patch, or substitute it."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import urllib.error
import urllib.request
import zipfile

ARTIFACT_ID = 15156381621
RUN_ID = 45901286856
CANDIDATE = "35895107296ea44ea4ccdac36072f98e3f3eea84"
EXPECTED_SHA256 = "2531e9b423bb49c54212f1a0b75e7449f0bb79a69509e99899ba76cef69d8c9e"
EXPECTED_BYTES = 176640312


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked_entries(archive):
    seen = set()
    for info in archive.infolist():
        path = PurePosixPath(info.filename)
        assert info.filename and not path.is_absolute() and ".." not in path.parts
        assert "\\" not in info.filename and info.filename not in seen
        assert not stat.S_ISLNK(info.external_attr >> 16)
        seen.add(info.filename)
    return seen


def main():
    workspace = Path(os.environ["GITHUB_WORKSPACE"])
    evidence = workspace / "evidence"
    dist = workspace / "app/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/dist"
    evidence.mkdir(parents=True, exist_ok=True)
    dist.mkdir(parents=True, exist_ok=True)
    assert not any(dist.iterdir()), "Refuse to mix the immutable build with existing files"
    endpoint = f"https://api.github.com/repos/robjasper2084/Jungle-Lotto/actions/artifacts/{ARTIFACT_ID}"
    headers = {
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    with urllib.request.urlopen(urllib.request.Request(endpoint, headers=headers), timeout=60) as response:
        metadata = json.load(response)
    (evidence / "artifact-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    assert metadata["id"] == ARTIFACT_ID and metadata["name"] == "sustained-profile-game"
    assert not metadata["expired"], "Pinned artifact expired; no rebuild or substitute allowed"
    assert metadata["workflow_run"]["id"] == RUN_ID
    assert metadata["workflow_run"]["head_sha"] == CANDIDATE
    assert metadata["digest"] == "sha256:" + EXPECTED_SHA256
    assert metadata["size_in_bytes"] == EXPECTED_BYTES

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        opener.open(urllib.request.Request(endpoint + "/zip", headers=headers), timeout=60)
        raise AssertionError("Expected GitHub artifact redirect")
    except urllib.error.HTTPError as error:
        assert error.code == 302
        location = error.headers["Location"]
    assert location.startswith("https://")
    archive = evidence / "immutable-input-build.zip"
    # Do not forward GitHub credentials to the signed artifact URL.
    with urllib.request.urlopen(location, timeout=60) as response, archive.open("wb") as target:
        shutil.copyfileobj(response, target)
    digest = file_digest(archive)
    assert digest == EXPECTED_SHA256
    assert archive.stat().st_size == EXPECTED_BYTES
    with zipfile.ZipFile(archive) as zipped:
        checked_entries(zipped)
        zipped.extractall(dist)
    assert (dist / "index.html").is_file() and (dist / "asset-manifest.json").is_file()
    manifest = []
    for path in sorted(dist.rglob("*")):
        if path.is_file():
            manifest.append({"file": path.relative_to(dist).as_posix(), "bytes": path.stat().st_size, "sha256": file_digest(path)})
    (evidence / "dist-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (evidence / "artifact-provenance.json").write_text(json.dumps({
        "artifactId": ARTIFACT_ID, "runId": RUN_ID, "zipSha256": digest,
        "bytes": EXPECTED_BYTES, "files": len(manifest), "candidate": CANDIDATE, "archive": archive.name,
        "applicationHead": "f7c008b14e391b9c07ea1f52fd913eb475f7b17e",
        "identicalSourceTree": "7648674a8c7f8af0f274b7fade51bf446e55ce4a",
    }, indent=2) + "\n")
    print("Pinned build verified:", len(manifest), "files; ZIP SHA256", digest)


if __name__ == "__main__":
    main()
