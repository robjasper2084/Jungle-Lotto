import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
from polyhaven_acquire import relative, fingerprint, checked_url, MANIFEST
from polyhaven_texture_budget import GlbByteBudgetError, export_with_budget, resolution_attempts

class IntakeTest(unittest.TestCase):
    def test_source_manifest(self):
        plan=json.loads(MANIFEST.read_text())
        self.assertEqual(len(plan["assets"]),11)
        self.assertEqual(len({a["fingerprint"] for a in plan["assets"]}),11)
        self.assertEqual(len([a for a in plan["assets"] if a["variants"]]),5)
        for a in plan["assets"]:
            self.assertRegex(a["fingerprint"],r"^[0-9a-f]{64}$")
            self.assertEqual(a["source"],"https://polyhaven.com/a/"+a["id"])
            for v in a["variants"]:
                self.assertEqual(len(v["objects"]),3)
                self.assertFalse(any("geometry_nodes" in name or "_geo" in name for name in v["objects"]))
                self.assertEqual(v["triangles"],sorted(v["triangles"],reverse=True))

    def test_fingerprint_is_deterministic(self):
        self.assertEqual(fingerprint([("a","1"),("b","2")]),fingerprint([("b","2"),("a","1")]))
        self.assertNotEqual(fingerprint([("a","1")]),fingerprint([("a","2")]))

    def test_path_and_host_guard(self):
        self.assertEqual(relative("textures/x.png").as_posix(),"textures/x.png")
        for p in ("../a","textures/../../a","/a","a\\b"):
            with self.assertRaises(ValueError): relative(p)
        self.assertEqual(checked_url("https://dl.polyhaven.org/a"),"https://dl.polyhaven.org/a")
        for p in ("http://dl.polyhaven.org/a","https://evil.example/a","https://dl.polyhaven.org@evil.example/a"):
            with self.assertRaises(ValueError): checked_url(p)

class AcquisitionReportTest(unittest.TestCase):
    @staticmethod
    def source_asset(asset_id, body):
        digest = hashlib.sha256(body).hexdigest()
        expected = hashlib.sha256(f"{asset_id}_4k.blend\t{digest}\n".encode()).hexdigest()
        return {"id":asset_id,"members":1,"fingerprint":expected,"variants":[{"name":"review"}]}

    def run_cli(self, assets, source_bytes=None):
        # Run the actual command with a temporary manifest and mocked HTTP only.
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        script = root / "polyhaven_acquire.py"
        script.write_bytes(Path(__file__).with_name("polyhaven_acquire.py").read_bytes())
        script.with_name("polyhaven-review.json").write_text(json.dumps({"assets":assets}))
        report = root / "reports" / "source-report.json"
        sources = root / "sources"
        payloads = {}
        for asset_id, body in (source_bytes or {}).items():
            url = "https://dl.polyhaven.org/" + asset_id + ".blend"
            metadata = {"url":url,"size":len(body),"md5":hashlib.md5(body).hexdigest(),"include":{}}
            payloads["https://api.polyhaven.com/files/" + asset_id] = json.dumps(
                {"blend":{"4k":{"blend":metadata}}}).encode()
            payloads[url] = body
        requested, progress = [], []
        def open_source(request, **kwargs):
            url = request.full_url
            requested.append(url)
            if url.startswith("https://api.polyhaven.com/files/"):
                progress.append(json.loads(report.read_text()) if report.exists() else None)
            return io.BytesIO(payloads[url])
        exit_code = None
        with patch("urllib.request.build_opener") as opener, patch.object(sys, "argv", [
            str(script), "--sources", str(sources), "--report", str(report)
        ]):
            opener.return_value.open.side_effect = open_source
            try:
                runpy.run_path(str(script), run_name="__main__")
            except SystemExit as error:
                exit_code = error.code
        return json.loads(report.read_text()), exit_code, requested, progress, sources

    def test_cli_includes_trailing_deferred_assets(self):
        body = b"verified source fixture"
        assets = [self.source_asset("rock", body),
                  {"id":"shrub","variants":[]}, {"id":"tree","variants":[]}]
        records, code, requested, _, sources = self.run_cli(assets, {"rock":body})
        self.assertIsNone(code)
        self.assertEqual([r["id"] for r in records], ["rock", "shrub", "tree"])
        self.assertTrue(records[0]["verified"])
        self.assertEqual([r["status"] for r in records[1:]], [
            "deferred; no source substitution or runtime placement"] * 2)
        self.assertEqual(len(requested), 2)
        self.assertEqual((sources / "rock" / "rock_4k.blend").read_bytes(), body)

    def test_cli_creates_all_deferred_and_empty_reports(self):
        for assets in ([], [{"id":"shrub","variants":[]}, {"id":"tree","variants":[]}]):
            with self.subTest(assets=assets):
                records, code, requested, _, _ = self.run_cli(assets)
                self.assertIsNone(code)
                self.assertEqual([r["id"] for r in records], [a["id"] for a in assets])
                self.assertTrue(all(r["status"].startswith("deferred;") for r in records))
                self.assertEqual(requested, [])

    def test_cli_preserves_failure_progress_and_nonzero_exit(self):
        bodies = {"first":b"first source", "failed":b"changed source", "last":b"last source"}
        assets = [self.source_asset(name, body) for name, body in bodies.items()]
        assets[1]["fingerprint"] = "0" * 64
        assets.append({"id":"deferred","variants":[]})
        records, code, requested, progress, _ = self.run_cli(assets, bodies)
        self.assertEqual(code, "One or more uploaded-source fingerprints failed; review report")
        self.assertEqual([r["id"] for r in records], ["first", "failed", "last", "deferred"])
        self.assertTrue(records[0]["verified"])
        self.assertFalse(records[1]["verified"])
        self.assertIn("Official source revision differs", records[1]["error"])
        self.assertTrue(records[2]["verified"])
        self.assertEqual(progress, [None, records[:1], records[:2]])
        self.assertEqual(len(requested), 6)

class TextureBudgetTest(unittest.TestCase):
    def test_high_tier_prefers_largest_passing_resolution(self):
        high={"name":"high","maxTexture":2048,"maxBytes":16777216}
        seen=[]
        def attempt(limit):
            seen.append(limit)
            if limit>1536:
                raise GlbByteBudgetError("GLB byte budget")
            return {"bytes":15000000,"triangles":1164}
        result=export_with_budget(high,attempt)
        self.assertEqual(seen,[2048,1536])
        self.assertEqual(result["effectiveTextureLimit"],1536)
        self.assertEqual(result["triangles"],1164)
        self.assertEqual([a["status"] for a in result["textureAttempts"]],["over-budget","review"])
        self.assertEqual(high["maxBytes"],16777216)
        self.assertEqual(high["maxTexture"],2048)

    def test_fail_closed_and_keep_other_tiers(self):
        high={"name":"high","maxTexture":2048}
        seen=[]
        def oversize(limit):
            seen.append(limit)
            raise GlbByteBudgetError("over")
        with self.assertRaises(GlbByteBudgetError):
            export_with_budget(high,oversize)
        self.assertEqual(seen,[2048,1536,1280,1024])
        self.assertEqual(resolution_attempts({"name":"automatic","maxTexture":1024}),(1024,))
        self.assertEqual(resolution_attempts({"name":"smooth","maxTexture":512}),(512,))

    def test_material_failures_are_not_retried(self):
        seen=[]
        def invalid(limit):
            seen.append(limit)
            raise ValueError("PBR maps missing")
        with self.assertRaisesRegex(ValueError,"PBR maps missing"):
            export_with_budget({"name":"high","maxTexture":2048},invalid)
        self.assertEqual(seen,[2048])

if __name__=="__main__":
    unittest.main()
