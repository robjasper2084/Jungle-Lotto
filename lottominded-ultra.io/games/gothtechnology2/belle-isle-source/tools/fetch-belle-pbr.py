"""Fetch pinned 1K CC0 authoring maps from Poly Haven's public API.

Run:
  python tools/fetch-belle-pbr.py --manifest authoring/environment/bridge-pbr-sources.json
Writes ONLY ignored authoring/environment/cache; no live game/API dependency.
A source file is verified against its API MD5 when supplied, and SHA-256 is
recorded for repeatable authoring. Never infer these are calibrated real scans.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

UA = "DigitalStatic-BelleIsle-AssetAuthoring/1.0 (CC0 offline authoring)"
ALIASES = {"diffuse": {"diff", "diffuse", "albedo", "basecolor"},
           "normal": {"norgl", "normalgl", "normal"},
           "arm": {"arm", "aoroughmetal", "occlusionroughnessmetallic"}}
EXTS = {"diffuse": ("jpg", "png"), "normal": ("png", "jpg"),
        "arm": ("png", "jpg")}
MAX_DOWNLOAD = 12 * 1024 * 1024

def get(url: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.netloc not in {
        "api.polyhaven.com", "dl.polyhaven.org", "cdn.polyhaven.com"
    }:
        raise RuntimeError("Unapproved source host: " + url)
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        cap = int(response.headers.get("Content-Length", "0") or 0)
        if cap > MAX_DOWNLOAD:
            raise RuntimeError("Texture exceeds 12MiB: " + url)
        data = response.read(MAX_DOWNLOAD + 1)
    if not data or len(data) > MAX_DOWNLOAD:
        raise RuntimeError("Texture missing/oversized: " + url)
    return data

def records(tree, keys=()):
    if isinstance(tree, dict):
        if isinstance(tree.get("url"), str):
            yield keys, tree
            return
        for key, value in tree.items():
            yield from records(value, keys + (str(key),))

def choose(meta: dict, role: str) -> dict:
    def normalize(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())
    candidates = []
    for keys, record in records(meta):
        tags = [normalize(k) for k in keys]
        component = normalize(str(record.get("component", "")))
        if component:
            tags.insert(0, component)
        if not any(t in ALIASES[role] for t in tags):
            continue
        # Avoid DX normal maps: Three.js/glTF expects OpenGL +Y normals.
        if role == "normal" and any("dx" in t for t in tags):
            continue
        url = record["url"]
        if str(record.get("resolution", "")).lower() not in ("", "1k") or (
            "1k" not in tags and "_1k." not in url.lower() and "/1k/" not in url.lower()
        ):
            continue
        ext = urllib.parse.urlparse(url).path.rsplit(".", 1)[-1].lower()
        if ext not in EXTS[role]:
            continue
        size = int(record.get("size") or record.get("size_bytes") or 0)
        if size > MAX_DOWNLOAD:
            continue
        candidates.append((EXTS[role].index(ext), size or MAX_DOWNLOAD, url, record))
    if not candidates:
        raise RuntimeError("Poly Haven metadata has no 1k " + role + " map")
    return sorted(candidates, key=lambda c: (c[0], c[1], c[2]))[0][-1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="authoring/environment/bridge-pbr-sources.json")
    ap.add_argument("--out", default="authoring/environment/cache")
    args = ap.parse_args()
    cfg = json.loads(Path(args.manifest).read_text(encoding="utf8"))
    output = Path(args.out)
    result = {"provider": cfg["provider"], "license": "CC0", "resolution": "1k",
              "materials": [], "liveGameLoads": False}
    for mat in cfg["materials"]:
        slug = mat["slug"]
        if not re.fullmatch(r"[a-z0-9_]+", slug):
            raise RuntimeError("Invalid Poly Haven asset slug: " + slug)
        info = json.loads(get("https://api.polyhaven.com/files/" + slug))
        entry = {"name": mat["name"], "slug": slug, "page": mat["page"], "maps": {}}
        directory = output / mat["name"]
        directory.mkdir(parents=True, exist_ok=True)
        for role in ("diffuse", "normal", "arm"):
            record = choose(info, role)
            url = record["url"]
            raw = get(url)
            expected = record.get("md5")
            actual_md5 = hashlib.md5(raw).hexdigest()
            if expected and actual_md5.lower() != str(expected).lower():
                raise RuntimeError("MD5 mismatch: " + slug + " " + role)
            ext = urllib.parse.urlparse(url).path.rsplit(".", 1)[-1].lower()
            dest = directory / (role + "." + ext)
            dest.write_bytes(raw)
            entry["maps"][role] = {
                "file": str(dest.as_posix()), "url": url,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw), "md5": actual_md5
            }
        result["materials"].append(entry)
    output.mkdir(parents=True, exist_ok=True)
    (output / "sources.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"materials": len(result["materials"]), "output": str(output),
                      "bytes": sum(f["bytes"] for a in result["materials"] for f in a["maps"].values())}))

if __name__ == "__main__":
    main()
