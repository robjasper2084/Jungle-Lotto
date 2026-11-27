"""Offline contracts for the one pinned artifact downloader; no networking."""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error

TARGET = Path(__file__).with_name("download.py")
SOURCE = TARGET.read_bytes()
BLOB = hashlib.sha1(b"blob " + str(len(SOURCE)).encode("ascii") + b"\0" + SOURCE).hexdigest()
assert BLOB == "91a4d24bbfaf3b3118a5f37ba167372c45e5e553", "Downloader differs from reviewed immutable blob"
SPEC = importlib.util.spec_from_file_location("retained_download_fixture_target", TARGET)
D = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(D)

# A valid empty ZIP. Fixtures bind its exact bytes; no capture/browser data exists.
ZIP = bytes.fromhex("504b05060000000000000000000000000000000000000000")
TOKEN = "fixture-only-readonly-token"


class DownloadContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.manifest_path = self.root / "fixed.json"
        self.output = self.root / "evidence"
        self.expected = {
            "repository": D.REPO, "attempt": 1, "artifactId": 15193147198,
            "artifactName": "fixture-only-retained-artifact", "runId": 45987971947,
            "head": "a" * 40, "conclusion": "failure",
            "archiveBytes": len(ZIP), "archiveSha256": hashlib.sha256(ZIP).hexdigest(),
        }
        self.metadata = {
            "id": self.expected["artifactId"], "name": self.expected["artifactName"],
            "expired": False, "size_in_bytes": len(ZIP),
            "workflow_run": {"id": self.expected["runId"], "head_sha": self.expected["head"]},
            "digest": "sha256:" + self.expected["archiveSha256"],
        }
        self.source_run = {
            "id": self.expected["runId"], "run_attempt": 1,
            "head_sha": self.expected["head"], "status": "completed", "conclusion": "failure",
        }
        self.meta_url = D.API + "/repos/" + D.REPO + "/actions/artifacts/" + str(self.expected["artifactId"])
        self.run_url = D.API + "/repos/" + D.REPO + "/actions/runs/" + str(self.expected["runId"])
        self.location = "https://fixture.blob.core.windows.net/artifact.zip"
        self.second_location = "https://fixture.s3.amazonaws.com/artifact.zip"
        self.payload = ZIP
        self.api_requests = []
        self.storage_requests = []
        # Any accidental escape from the fake urllib openers fails immediately.
        for name in ("socket.create_connection", "socket.socket.connect",
                     "socket.socket.connect_ex", "socket.getaddrinfo"):
            self.enterContext(mock.patch(name, side_effect=AssertionError("Real networking is forbidden")))

    def api_open(self, request, timeout):
        self.api_requests.append(request.full_url)
        self.assertEqual(request.get_header("Authorization"), "Bearer " + TOKEN)
        self.assertEqual(timeout, 45)
        if request.full_url == self.meta_url:
            return io.BytesIO(json.dumps(self.metadata).encode())
        if request.full_url == self.run_url:
            return io.BytesIO(json.dumps(self.source_run).encode())
        if request.full_url == self.meta_url + "/zip":
            raise urllib.error.HTTPError(
                request.full_url, 302, "Found", {"Location": self.location}, io.BytesIO())
        raise AssertionError("Unexpected API request: " + request.full_url)

    def anonymous_request(self, request):
        headers = dict(request.header_items())
        self.assertFalse(any(key.lower() in ("authorization", "proxy-authorization") for key in headers))
        self.assertFalse(any(TOKEN in value for value in headers.values()))
        self.storage_requests.append({"url": request.full_url, "headers": headers})

    def storage_open(self, request, timeout):
        self.assertEqual(timeout, 45)
        self.assertEqual(request.full_url, self.location)
        self.anonymous_request(request)
        # Exercise the actual redirect handler, but never open a real socket.
        redirected = D.StorageRedirect().redirect_request(
            request, io.BytesIO(), 302, "Found",
            {"Location": self.second_location}, self.second_location)
        self.assertIsNotNone(redirected)
        self.assertEqual(redirected.full_url, self.second_location)
        self.anonymous_request(redirected)
        return io.BytesIO(self.payload)

    def opener(self, *handlers):
        if handlers == (D.NoRedirect,):
            result = mock.Mock()
            result.open.side_effect = self.api_open
            return result
        if handlers == (D.StorageRedirect,):
            result = mock.Mock()
            result.open.side_effect = self.storage_open
            return result
        raise AssertionError("Unexpected opener construction")

    def invoke(self):
        self.api_requests.clear()
        self.storage_requests.clear()
        self.manifest_path.write_text(json.dumps({"capture": self.expected}))
        with mock.patch.object(sys, "argv", ["download.py", str(self.manifest_path), str(self.output)]), \
             mock.patch.dict(os.environ, {"GH_TOKEN": TOKEN}), \
             mock.patch.object(D.urllib.request, "build_opener", side_effect=self.opener), \
             mock.patch("builtins.print"):
            D.main()

    def test_valid_binding_and_two_anonymous_storage_requests(self):
        self.invoke()
        self.assertEqual(self.api_requests, [self.meta_url, self.run_url, self.meta_url + "/zip"])
        self.assertEqual(len(self.storage_requests), 2)
        self.assertEqual((self.output / "artifact.zip").read_bytes(), ZIP)
        receipt = json.loads((self.output / "download-receipt.json").read_text())
        self.assertEqual(receipt["archiveSha256"], self.expected["archiveSha256"])
        self.assertEqual(receipt["archiveBytes"], len(ZIP))
        self.assertFalse(receipt["nativeRunStarted"])
        self.assertFalse(receipt["browserStarted"])
        self.assertFalse(receipt["releaseAcceptance"])

    def test_sha_pin_is_required_before_any_api(self):
        original = self.expected["archiveSha256"]
        for value in (None, "", "0" * 63, "A" * 64, "g" * 64):
            with self.subTest(value=value):
                self.expected["archiveSha256"] = value
                with self.assertRaisesRegex(AssertionError, "immutable archive SHA-256 pin"):
                    self.invoke()
                self.assertEqual(self.api_requests, [])
                self.assertEqual(self.storage_requests, [])
        del self.expected["archiveSha256"]
        with self.assertRaises(KeyError):
            self.invoke()
        self.assertEqual(self.api_requests, [])
        self.expected["archiveSha256"] = original

    def test_provenance_mismatches_stop_before_zip(self):
        original_metadata, original_run = copy.deepcopy(self.metadata), copy.deepcopy(self.source_run)
        mutations = (
            ("metadata", ("id",), 1),
            ("metadata", ("name",), "wrong-artifact"),
            ("metadata", ("expired",), True),
            ("metadata", ("size_in_bytes",), len(ZIP) + 1),
            ("metadata", ("workflow_run", "id"), 1),
            ("metadata", ("workflow_run", "head_sha"), "b" * 40),
            ("source_run", ("id",), 1),
            ("source_run", ("run_attempt",), 2),
            ("source_run", ("head_sha",), "b" * 40),
            ("source_run", ("status",), "in_progress"),
            ("source_run", ("conclusion",), "success"),
        )
        for name, path, value in mutations:
            with self.subTest(record=name, path=path):
                self.metadata, self.source_run = copy.deepcopy(original_metadata), copy.deepcopy(original_run)
                target = getattr(self, name)
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
                with self.assertRaises(AssertionError):
                    self.invoke()
                self.assertNotIn(self.meta_url + "/zip", self.api_requests)
                self.assertEqual(self.storage_requests, [])

    def test_changed_byte_rejects_even_without_github_digest(self):
        self.metadata["digest"] = None
        self.payload = ZIP[:-1] + bytes([ZIP[-1] ^ 1])
        with self.assertRaisesRegex(AssertionError, "immutable archive SHA-256 pin"):
            self.invoke()
        self.assertEqual(len(self.payload), self.expected["archiveBytes"])
        self.assertFalse((self.output / "download-receipt.json").exists())

    def test_unsafe_redirect_is_rejected_before_storage(self):
        for url in (
            "http://fixture.blob.core.windows.net/artifact.zip",
            "https://user:pass@fixture.blob.core.windows.net/artifact.zip",
            "https://example.com/artifact.zip",
            "https://fixture.blob.core.windows.net.evil.test/artifact.zip",
        ):
            with self.subTest(url=url):
                self.location = url
                with self.assertRaises(AssertionError):
                    self.invoke()
                self.assertEqual(self.storage_requests, [])
                self.assertFalse((self.output / "artifact.zip").exists())

    def test_metadata_cap_and_post_read_deadline(self):
        with mock.patch.object(D.time, "monotonic", return_value=0):
            with self.assertRaisesRegex(AssertionError, "byte limit"):
                D.read_bounded(io.BytesIO(b"abcd"), 3, 10)
        with mock.patch.object(D.time, "monotonic", side_effect=(0, 2)):
            with self.assertRaisesRegex(AssertionError, "deadline"):
                D.read_bounded(io.BytesIO(b"a"), 3, 1)

    def test_existing_archive_is_never_overwritten_or_requested_again(self):
        self.output.mkdir()
        archive = self.output / "artifact.zip"
        archive.write_bytes(b"keep-existing-evidence")
        with self.assertRaisesRegex(AssertionError, "only once"):
            self.invoke()
        self.assertEqual(archive.read_bytes(), b"keep-existing-evidence")
        self.assertNotIn(self.meta_url + "/zip", self.api_requests)
        self.assertEqual(self.storage_requests, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
