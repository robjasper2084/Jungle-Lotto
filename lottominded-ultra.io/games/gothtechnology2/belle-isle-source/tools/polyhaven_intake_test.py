import json
from pathlib import Path
import unittest
from polyhaven_acquire import relative, fingerprint, checked_url, MANIFEST

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

if __name__=="__main__":
    unittest.main()
