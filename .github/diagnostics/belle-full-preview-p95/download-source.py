"""Fetch the pinned source-art ZIP; never fetch a substitute or rebuild it."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request

ARTIFACT_ID = 15182411775
RUN_ID = 45960190700
CANDIDATE = "9d2162e39188dcd0e42565f398b736734e481f73"
EXPECTED_BYTES = 204251647
EXPECTED_SHA256 = "9e3cc0edeaf7a6fe4c95b7618b3c82cf0eeb9cb183439e141e73c2204fd5fbce"


def verify_metadata(metadata):
    assert metadata["id"] == ARTIFACT_ID
    assert metadata["name"] == "polyhaven-opaque-review"
    assert metadata["expired"] is False, "Pinned source artifact expired"
    assert metadata["workflow_run"]["id"] == RUN_ID
    assert metadata["workflow_run"]["head_sha"] == CANDIDATE
    assert metadata["size_in_bytes"] == EXPECTED_BYTES
    assert metadata["digest"] == "sha256:" + EXPECTED_SHA256


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, hdrs, newurl):
        return None


def main():
    assert len(sys.argv) == 2, "Supply a new source-input directory"
    inputs = Path(sys.argv[1]).resolve()
    inputs.mkdir(parents=False, exist_ok=False)
    endpoint = f"https://api.github.com/repos/robjasper2084/Jungle-Lotto/actions/artifacts/{ARTIFACT_ID}"
    headers = {
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(urllib.request.Request(endpoint, headers=headers), timeout=60) as response:
        metadata = json.load(response)
    (inputs / "source-artifact-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    verify_metadata(metadata)
    try:
        opener.open(urllib.request.Request(endpoint + "/zip", headers=headers), timeout=60)
        raise AssertionError("Expected the GitHub artifact redirect")
    except urllib.error.HTTPError as error:
        assert error.code == 302, "Pinned artifact redirect failed"
        location = error.headers["Location"]
    parsed = urllib.parse.urlsplit(location)
    assert parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
    archive = inputs / "source-artifact.zip"
    # The signed destination receives no GitHub credentials. Keep partial bytes
    # and the original error if the single download fails; never retry silently.
    with urllib.request.urlopen(location, timeout=60) as response, archive.open("xb") as target:
        shutil.copyfileobj(response, target)
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    assert archive.stat().st_size == EXPECTED_BYTES
    assert digest.hexdigest() == EXPECTED_SHA256
    print("Pinned source-art archive verified:", ARTIFACT_ID, EXPECTED_BYTES, EXPECTED_SHA256)


if __name__ == "__main__":
    main()
