"""Small offline integrity/HTTP fixtures. No real network, artifact or browser."""

import copy
from dataclasses import replace
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error

import transport as t


TOKEN = "fixture-token-never-log"
SIGNED = "https://productionresultssa12.blob.core.windows.net/actions-results/fixture.zip?sig=fixture-signed-secret"
BODY = b"PK\x03\x04fixture-archive-body"
PIN = replace(t.PIN, bytes=len(BODY), sha256=t.sha256(BODY))
PART_BYTES = 7


def metadata(pin=PIN):
    repository = {"id": t.REPOSITORY_ID, "full_name": pin.repository}
    artifact = {"id": pin.artifact_id, "name": "full-preview-p95-attribution",
                "url": t.artifact_endpoint(pin), "archive_download_url": t.artifact_endpoint(pin) + "/zip",
                "expired": False, "size_in_bytes": pin.bytes, "digest": "sha256:" + pin.sha256,
                "workflow_run": {"id": pin.run_id, "head_sha": pin.head, "head_branch": t.BRANCH,
                                 "repository_id": t.REPOSITORY_ID, "head_repository_id": t.REPOSITORY_ID}}
    run = {"id": pin.run_id, "head_sha": pin.head, "head_branch": t.BRANCH, "status": "completed",
           "conclusion": "failure", "repository": repository, "head_repository": repository.copy()}
    return artifact, run


class Response(io.BytesIO):
    def __init__(self, body=b"", status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers or {}

    def getcode(self):
        return self.status


class FailingBody(Response):
    def __init__(self):
        super().__init__(BODY)
        self.reads = 0

    def read(self, size=-1):
        self.reads += 1
        if self.reads > 1:
            raise OSError(TOKEN + " " + SIGNED)
        return super().read(3)


class Opener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        if not self.responses:
            raise AssertionError("Unexpected additional HTTP request")
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response


def client_for(body=BODY, artifact=None, run=None, response=None):
    default_artifact, default_run = metadata()
    opener = Opener([Response(json.dumps(artifact or default_artifact).encode()),
                     Response(json.dumps(run or default_run).encode()),
                     Response(status=302, headers={"Location": SIGNED}),
                     response or Response(body)])
    return t.HttpClient(TOKEN, opener), opener


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def fixture(self, name="out"):
        client, opener = client_for()
        directory = self.root / name
        manifest = t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
        return directory, manifest, opener

    def assert_no_secrets(self, directory):
        for path in directory.iterdir():
            if path.suffix in (".json", ".jsonl"):
                text = path.read_text()
                self.assertNotIn(TOKEN, text)
                self.assertNotIn("fixture-signed-secret", text)
                self.assertNotIn(SIGNED, text)

    def test_production_pins_and_exact_fixed_part_ranges(self):
        self.assertEqual(t.PIN.artifact_id, 15190968508)
        self.assertEqual(t.PIN.run_id, 45983706110)
        self.assertEqual(t.PIN.head, "2806fbd4f9b445177b0fd37c6a417ec844312d30")
        self.assertEqual(t.PIN.bytes, 556392705)
        self.assertEqual(t.PIN.sha256, "2f3d33a7057b941cf2433d3e53bf9a8437f373d04ddf64fe18cfcb9886d39776")
        self.assertEqual([min(t.PART_BYTES, t.PIN.bytes - i) for i in range(0, t.PIN.bytes, t.PART_BYTES)],
                         [268435456, 268435456, 19521793])

    def test_metadata_rejects_each_wrong_identity_expiry_size_digest_or_run(self):
        artifact, run = metadata()
        t.verify_metadata(artifact, run, PIN)
        mutations = [
            lambda a, r: a.update(id=1), lambda a, r: a.update(expired=True),
            lambda a, r: a.update(size_in_bytes=PIN.bytes + 1), lambda a, r: a.update(digest="sha256:" + "0" * 64),
            lambda a, r: a.update(archive_download_url="https://example.org/zip"),
            lambda a, r: a.update(url="https://example.org/metadata"),
            lambda a, r: a["workflow_run"].update(id=1), lambda a, r: a["workflow_run"].update(head_sha="a" * 40),
            lambda a, r: a["workflow_run"].update(repository_id=1),
            lambda a, r: a["workflow_run"].update(head_repository_id=1),
            lambda a, r: a["workflow_run"].update(head_branch="other"),
            lambda a, r: r.update(id=1), lambda a, r: r.update(head_sha="b" * 40),
            lambda a, r: r.update(status="in_progress"), lambda a, r: r.update(head_branch="other"),
            lambda a, r: r["repository"].update(full_name="another/repo"),
            lambda a, r: r["head_repository"].update(id=1),
        ]
        for mutation in mutations:
            a, r = copy.deepcopy((artifact, run))
            mutation(a, r)
            with self.subTest(mutation=mutation), self.assertRaises(t.TransportError):
                t.verify_metadata(a, r, PIN)

    def test_complete_transport_preserves_exact_bytes_and_all_metadata(self):
        directory, manifest, opener = self.fixture()
        self.assertEqual((directory / "original-artifact.zip").read_bytes(), BODY)
        self.assertFalse((directory / "original-artifact.zip.partial").exists())
        self.assertEqual(b"".join((directory / row["file"]).read_bytes() for row in manifest["parts"]), BODY)
        self.assertEqual([row["offset"] for row in manifest["parts"]], list(range(0, len(BODY), PART_BYTES)))
        self.assertEqual(manifest["verifiedBeforeSplit"], {"bytes": len(BODY), "sha256": t.sha256(BODY)})
        self.assertEqual(manifest["metadata"], dict(zip(("artifact", "run"), metadata())))
        self.assertEqual(manifest["reconstruction"], t.verify_parts(directory, manifest, PIN, PART_BYTES))
        self.assertTrue(manifest["transportOnly"])
        self.assertFalse(manifest["nativeExecution"] or manifest["buildExecution"] or manifest["extracted"])
        self.assertEqual(len(opener.requests), 4)
        for request in opener.requests[:3]:
            self.assertEqual(request.get_header("Authorization"), "Bearer " + TOKEN)
        self.assertIsNone(opener.requests[3].get_header("Authorization"))
        self.assert_no_secrets(directory)

    def test_wrong_size_hash_truncation_or_extra_bytes_never_create_parts(self):
        for name, body, code in [("short", BODY[:-1], "TRUNCATED_ARCHIVE_BYTES"),
                                 ("long", BODY + b"excess", "EXTRA_ARCHIVE_BYTES"),
                                 ("corrupt", b"X" + BODY[1:], "ARCHIVE_SHA256_MISMATCH")]:
            client, _ = client_for(body)
            directory = self.root / name
            with self.subTest(name=name), self.assertRaisesRegex(t.TransportError, code):
                t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
            self.assertEqual(list(directory.glob("original-artifact.part-*.bin")), [])
            self.assertFalse((directory / "manifest.json").exists())
            self.assertFalse((directory / "original-artifact.zip").exists())
            self.assertTrue((directory / "original-artifact.zip.partial").exists())
            failure = json.loads((directory / "failure.json").read_text())
            self.assertEqual(failure["state"]["stage"], "download")
            self.assertEqual(failure["errorCode"], code)
            self.assert_no_secrets(directory)

    def test_stream_failure_retains_partial_bytes_without_exception_secrets(self):
        client, _ = client_for(response=FailingBody())
        directory = self.root / "failed-stream"
        with self.assertRaisesRegex(t.TransportError, "ARCHIVE_STREAM_FAILED_OSError"):
            t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
        self.assertEqual((directory / "original-artifact.zip.partial").read_bytes(), BODY[:3])
        failure = json.loads((directory / "failure.json").read_text())
        self.assertEqual(failure["state"]["receivedBytes"], 3)
        self.assertEqual(failure["state"]["receivedSha256"], t.sha256(BODY[:3]))
        self.assert_no_secrets(directory)

    def test_bad_metadata_stops_before_any_download(self):
        artifact, run = metadata()
        artifact["expired"] = True
        client, opener = client_for(artifact=artifact, run=run)
        directory = self.root / "expired"
        with self.assertRaisesRegex(t.TransportError, "ARTIFACT_EXPIRED"):
            t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
        self.assertEqual(len(opener.requests), 2)
        self.assertEqual(list(directory.glob("*.bin")), [])
        self.assertFalse((directory / "original-artifact.zip.partial").exists())

    def test_each_storage_redirect_has_no_github_authorization(self):
        second = "https://objects.githubusercontent.com/path?token=fixture-signed-secret"
        opener = Opener([Response(status=302, headers={"Location": SIGNED}),
                         Response(status=307, headers={"Location": second}), Response(BODY)])
        client = t.HttpClient(TOKEN, opener)
        response = client.open_archive(PIN)
        self.assertEqual(response.read(), BODY)
        response.close()
        self.assertEqual(opener.requests[0].get_header("Authorization"), "Bearer " + TOKEN)
        self.assertTrue(all(r.get_header("Authorization") is None for r in opener.requests[1:]))

    def test_untrusted_redirect_schemes_hosts_credentials_ports_and_fragments_rejected(self):
        bad = ["http://productionresultssa12.blob.core.windows.net/a?sig=x", "//objects.githubusercontent.com/a",
               "https://evil.example/a", "https://productionresultssa12.blob.core.windows.net.evil.example/a",
               "https://user:secret@productionresultssa12.blob.core.windows.net/a",
               "https://productionresultssa12.blob.core.windows.net:444/a",
               "https://productionresultssa12.blob.core.windows.net/a#token", "https://api.github.com/repos/a/b",
               "https://127.0.0.1/a", "file:///tmp/secret", "https://productionresultssa12.blob.core.windows.net:bad/a"]
        for url in bad:
            opener = Opener([Response(status=302, headers={"Location": url})])
            with self.subTest(url=url), self.assertRaises(t.TransportError):
                t.HttpClient(TOKEN, opener).open_archive(PIN)
            self.assertEqual(len(opener.requests), 1)

    def test_metadata_redirect_is_not_followed_and_network_errors_are_sanitized(self):
        opener = Opener([Response(status=302, headers={"Location": SIGNED})])
        with self.assertRaisesRegex(t.TransportError, "METADATA_HTTP_STATUS_302"):
            t.HttpClient(TOKEN, opener).get_json(t.artifact_endpoint(PIN))
        self.assertEqual(len(opener.requests), 1)
        client = t.HttpClient(TOKEN, Opener([urllib.error.URLError(TOKEN + " " + SIGNED)]))
        directory = self.root / "failed-open"
        with self.assertRaisesRegex(t.TransportError, "HTTP_OPEN_FAILED_URLError"):
            t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
        self.assert_no_secrets(directory)

    def test_manifest_mutations_reject_reordering_duplicates_offsets_paths_and_identity(self):
        directory, original, _ = self.fixture()
        mutations = [lambda m: m["parts"].pop(), lambda m: m["parts"].append(copy.deepcopy(m["parts"][0])),
                     lambda m: m["parts"].reverse(), lambda m: m["parts"][1].update(file=m["parts"][0]["file"]),
                     lambda m: m["parts"][0].update(file="../original-artifact.part-000.bin"),
                     lambda m: m["parts"][0].update(file="/tmp/original-artifact.part-000.bin"),
                     lambda m: m["parts"][1].update(offset=0), lambda m: m["parts"][1].update(offset=8),
                     lambda m: m["parts"][0].update(bytes=0), lambda m: m["parts"][0].update(sha256="0" * 64),
                     lambda m: m["original"].update(head="0" * 40), lambda m: m.update(partSize=8),
                     lambda m: m.pop("verifiedBeforeSplit"), lambda m: m["parts"][0].update(extra="unexpected"),
                     lambda m: m.update(version=True), lambda m: m["parts"][0].update(offset=False),
                     lambda m: m["parts"][0].update(bytes=True), lambda m: m.update(partSize=True)]
        for mutation in mutations:
            manifest = copy.deepcopy(original)
            mutation(manifest)
            with self.subTest(mutation=mutation), self.assertRaises(t.TransportError):
                t.verify_parts(directory, manifest, PIN, PART_BYTES)

    def test_reconstruction_rejects_missing_extra_corrupt_oversized_or_symlink_parts(self):
        for mode in ("missing", "extra", "corrupt", "long", "short", "symlink"):
            directory, manifest, _ = self.fixture(mode)
            first = directory / manifest["parts"][0]["file"]
            if mode == "missing": first.unlink()
            if mode == "extra": (directory / "original-artifact.part-999.bin").write_bytes(b"extra")
            if mode == "corrupt": first.write_bytes(b"X" + first.read_bytes()[1:])
            if mode == "long": first.write_bytes(first.read_bytes() + b"x")
            if mode == "short": first.write_bytes(first.read_bytes()[:-1])
            if mode == "symlink":
                data = first.read_bytes(); first.unlink()
                other = directory / "other"; other.write_bytes(data); first.symlink_to(other)
            with self.subTest(mode=mode), self.assertRaises(t.TransportError):
                t.verify_parts(directory, manifest, PIN, PART_BYTES)

    def test_forged_part_hash_cannot_bypass_reconstructed_original_hash(self):
        directory, manifest, _ = self.fixture()
        first = directory / manifest["parts"][0]["file"]
        data = b"X" + first.read_bytes()[1:]
        first.write_bytes(data)
        manifest["parts"][0]["sha256"] = t.sha256(data)
        with self.assertRaisesRegex(t.TransportError, "RECONSTRUCTED_ARCHIVE_MISMATCH"):
            t.verify_parts(directory, manifest, PIN, PART_BYTES)

    def test_preexisting_outputs_and_part_files_are_never_overwritten(self):
        directory = self.root / "existing"
        directory.mkdir()
        sentinel = directory / "manifest.json"
        sentinel.write_bytes(b"preserve me")
        client, opener = client_for()
        with self.assertRaises(FileExistsError):
            t.transport(directory, TOKEN, client=client, pin=PIN, part_bytes=PART_BYTES)
        self.assertEqual(sentinel.read_bytes(), b"preserve me")
        self.assertEqual(len(opener.requests), 0)
        self.assertEqual(list(directory.iterdir()), [sentinel])


if __name__ == "__main__":
    unittest.main(verbosity=2)
