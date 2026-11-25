import json
from pathlib import Path
import unittest
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
