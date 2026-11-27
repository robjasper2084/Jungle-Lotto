import importlib.util
import io
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("restore_build", Path(__file__).with_name("restore-build.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchiveControls(unittest.TestCase):
    def archive(self, names):
        memory = io.BytesIO()
        with zipfile.ZipFile(memory, "w") as archive:
            for name in names:
                archive.writestr(name, b"original bytes")
        memory.seek(0)
        return zipfile.ZipFile(memory)

    def test_reject_path_traversal_and_ambiguous_members(self):
        for name in ("../outside", "/absolute", "a/../outside", "a\\outside", "a//outside"):
            with self.subTest(name=name), self.archive([name]) as archive:
                with self.assertRaises(AssertionError):
                    module.checked_entries(archive)

    def test_reject_duplicate_paths(self):
        with self.archive(["same", "same"]) as archive:
            with self.assertRaises(AssertionError):
                module.checked_entries(archive)

    def test_reject_symlink_and_special_files(self):
        for mode in (stat.S_IFLNK, stat.S_IFIFO, stat.S_IFCHR):
            memory = io.BytesIO()
            with zipfile.ZipFile(memory, "w") as archive:
                info = zipfile.ZipInfo("bad")
                info.external_attr = (mode | 0o644) << 16
                archive.writestr(info, b"target")
            memory.seek(0)
            with zipfile.ZipFile(memory) as archive, self.assertRaises(AssertionError):
                module.checked_entries(archive)

    def test_restore_retains_every_byte_and_refuses_mixing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            zipped = root / "build.zip"
            with zipfile.ZipFile(zipped, "w") as archive:
                archive.writestr("index.html", b"original index")
                archive.writestr("assets/main.js", b"original script")
            rows = module.restore(zipped, root / "dist")
            self.assertEqual(len(rows), 2)
            self.assertEqual((root / "dist/assets/main.js").read_bytes(), b"original script")
            with self.assertRaises(AssertionError):
                module.restore(zipped, root / "dist")

    def test_full_filename_prefix_order_matches_original_node_inventory_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            zipped = root / "prefix-order.zip"
            names = ["belle/vehicles/corleo/manifest.json", "belle/vehicles/corleo-professional.glb",
                     "belle/vehicles/corleo-maverick.glb", "a/x.bin", "a.json"]
            with zipfile.ZipFile(zipped, "w") as archive:
                for name in names:
                    archive.writestr(name, ("original bytes for " + name).encode())
            rows = module.restore(zipped, root / "dist")
            import json
            expected_names = sorted(names)
            self.assertNotEqual(sorted(names, key=Path), expected_names, "Fixture must expose component sorting")
            self.assertEqual([row["file"] for row in rows], expected_names)
            node = subprocess.run(["node", "--input-type=module", "-e",
                                   "import {pathToFileURL} from 'node:url'; const {inventory}=await import(pathToFileURL(process.argv[2]).href); console.log(JSON.stringify(await inventory(process.argv[3]),null,2));",
                                   "preflight-inventory-cross-language-control", str(Path(__file__).with_name("contract.mjs")), str(root / "dist")],
                                  capture_output=True)
            self.assertEqual(node.returncode, 0, node.stderr.decode())
            python_bytes = (json.dumps(rows, indent=2, ensure_ascii=False) + "\n").encode()
            self.assertEqual(python_bytes, node.stdout, "Exact Node/Python inventory bytes must agree")


if __name__ == "__main__":
    unittest.main()
