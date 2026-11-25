"""Fetch only named, user-supplied Poly Haven source revisions; never publish."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.parse
import urllib.request

UA = "DigitalStatic-BelleIsle-AssetReview/1.0"
ALLOWED = {"api.polyhaven.com", "dl.polyhaven.org", "dl.polyhaven.com"}
MAX_SOURCE_BYTES = 300 * 1024**2
MANIFEST = Path(__file__).with_name("polyhaven-review.json")

def relative(name):
    p = PurePosixPath(name)
    if "\\" in name or p.is_absolute() or not p.parts or any(x in ("..", ".") for x in p.parts):
        raise ValueError("Unsafe dependency path")
    return p

def checked_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or p.hostname not in ALLOWED or p.username or p.password or p.port not in (None, 443):
        raise ValueError("Unexpected source host: " + str(p.hostname))
    return url

def request(url):
    # Reject redirection outside the official hosts before following it.
    class Redirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            checked_url(newurl)
            return super().redirect_request(req, fp, code, msg, headers, newurl)
    return urllib.request.build_opener(Redirect()).open(
        urllib.request.Request(checked_url(url), headers={"User-Agent": UA}), timeout=120)

def download(entry, target, remaining):
    size = int(entry["size"])
    if not 0 < size <= remaining:
        raise ValueError("Source byte budget exceeded")
    target.parent.mkdir(parents=True, exist_ok=True)
    md5, sha = hashlib.md5(), hashlib.sha256()
    count = 0
    with request(entry["url"]) as response, target.open("wb") as out:
        while True:
            chunk = response.read(1024*1024)
            if not chunk:
                break
            count += len(chunk)
            if count > size:
                raise ValueError("Source exceeds declared length")
            md5.update(chunk)
            sha.update(chunk)
            out.write(chunk)
    if count != size or md5.hexdigest() != entry["md5"].lower():
        raise ValueError("Source transfer integrity failed")
    return sha.hexdigest(), count

def fingerprint(rows):
    return hashlib.sha256("".join(f"{name}\t{digest}\n" for name, digest in sorted(rows)).encode()).hexdigest()

def acquire(asset, dest):
    asset_id = asset["id"]
    with request("https://api.polyhaven.com/files/" + urllib.parse.quote(asset_id, safe="")) as response:
        raw = response.read(4*1024**2 + 1)
    if len(raw) > 4*1024**2:
        raise ValueError("API metadata too large")
    root = json.loads(raw)["blend"]["4k"]["blend"]
    entries = {asset_id + "_4k.blend":root}
    for name, entry in root["include"].items():
        p = relative(name).as_posix()
        if p in entries or not p.startswith("textures/"):
            raise ValueError("Unexpected dependency " + p)
        entries[p] = entry
    if len(entries) != asset["members"]:
        raise ValueError("Downloaded member list no longer matches uploaded archive")
    rows = []
    total = 0
    for name, entry in sorted(entries.items()):
        digest, count = download(entry, dest / relative(name), MAX_SOURCE_BYTES-total)
        rows.append((name,digest))
        total += count
    actual = fingerprint(rows)
    if actual != asset["fingerprint"]:
        raise ValueError("Official source revision differs from the user's uploaded archive; do not substitute")
    return {"id":asset_id,"verified":True,"fingerprint":actual,"members":dict(rows),"sourceBytes":total}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()
    plan = json.loads(MANIFEST.read_text())
    records = []
    args.report.parent.mkdir(parents=True, exist_ok=True)
    for asset in plan["assets"]:
        if not asset["variants"]:
            records.append({"id":asset["id"],"status":"deferred; no source substitution or runtime placement"})
            continue
        try:
            records.append(acquire(asset,args.sources/asset["id"]))
        except Exception as e:
            records.append({"id":asset["id"],"verified":False,"error":str(e)})
        args.report.write_text(json.dumps(records,indent=2)+"\n")
    if any(r.get("verified") is False for r in records):
        raise SystemExit("One or more uploaded-source fingerprints failed; review report")
