import json
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_ROOT = ROOT / "assets" / "sprite-production" / "higgsfield-v3"
JOBS_PATH = PRODUCTION_ROOT / "jobs.json"


def slug(value: str) -> str:
    return value.lower().replace("_", "-")


def main() -> None:
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    downloaded = 0
    for character_id, motions in jobs["characters"].items():
        target_dir = PRODUCTION_ROOT / "raw" / slug(character_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        for motion_name, entry in motions.items():
            default_target = target_dir / f"{slug(motion_name)}.png"
            target = ROOT / entry.get("rawPath", default_target.relative_to(ROOT).as_posix())
            target.parent.mkdir(parents=True, exist_ok=True)
            entry["rawPath"] = target.relative_to(ROOT).as_posix()
            if not target.exists() or target.stat().st_size < 100_000:
                request = urllib.request.Request(entry["resultUrl"], headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(request, timeout=90) as response:
                    target.write_bytes(response.read())
                downloaded += 1
            entry["rawBytes"] = target.stat().st_size
            print(f"{character_id}/{motion_name}: {entry['rawBytes']} bytes")
    JOBS_PATH.write_text(json.dumps(jobs, indent=2) + "\n", encoding="utf-8")
    print(f"Downloaded {downloaded} regenerated Higgsfield strips")


if __name__ == "__main__":
    main()
