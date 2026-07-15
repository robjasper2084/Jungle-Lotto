import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

from stabilize_motion_atlases import stabilize_manifest


ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_ROOT = ROOT / "assets" / "sprite-production" / "higgsfield-v2"
JOBS_PATH = PRODUCTION_ROOT / "jobs.json"
ATLAS_ROOT = ROOT / "assets" / "motion-atlases"
MANIFEST_PATH = ATLAS_ROOT / "motion-atlas-manifest.json"
PREVIEW_ROOT = ROOT / "output" / "motion-v3-previews"


def load_packer():
    path = ROOT / "scripts" / "pack-higgsfield-v2.py"
    spec = importlib.util.spec_from_file_location("higgsfield_packer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def alpha_hash(image: Image.Image) -> str:
    return hashlib.sha1(image.tobytes()).hexdigest()


def motion_frames(packer, path: Path, label: str) -> list[Image.Image]:
    keyed = packer.split_sheet(path)
    for index, frame in enumerate(keyed, start=1):
        packer.validate_transparency(frame, f"{label}/frame-{index}")
    frames = packer.normalize_frames(keyed)
    for index, frame in enumerate(frames, start=1):
        packer.validate_internal_splits(frame, f"{label}/frame-{index}")
    if len({alpha_hash(frame) for frame in frames}) < 5:
        raise ValueError(f"{label} has fewer than five unique normalized frames")
    return frames


def save_preview(character: str, patches: dict[str, list[Image.Image]]) -> None:
    cell = 192
    label_width = 172
    preview = Image.new("RGBA", (label_width + cell * 6, cell * len(patches)), (16, 16, 18, 255))
    draw = ImageDraw.Draw(preview)
    for row, (motion, frames) in enumerate(patches.items()):
        draw.text((10, row * cell + 12), motion, fill=(255, 214, 109, 255))
        for column, frame in enumerate(frames):
            preview.alpha_composite(frame, (label_width + column * cell, row * cell))
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW_ROOT / f"{character.lower().replace('_', '-')}.webp", "WEBP", quality=92, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", choices=("KALYX", "MASTER_EZRA"), required=True)
    parser.add_argument("--motion", action="append", required=True)
    args = parser.parse_args()

    packer = load_packer()
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    job_motions = jobs["characters"][args.character]["motions"]
    manifest_motions = manifest["characters"][args.character]["motions"]
    slug = args.character.lower().replace("_", "-")
    raw_root = PRODUCTION_ROOT / "raw" / slug
    patches = {}

    for motion in dict.fromkeys(args.motion):
        if motion not in job_motions or motion not in manifest_motions:
            raise SystemExit(f"Unknown motion for {args.character}: {motion}")
        raw_path = raw_root / f"{motion.lower()}.png"
        patches[motion] = motion_frames(packer, raw_path, f"{args.character}/{motion}")

    atlases = {}
    for motion, frames in patches.items():
        motion_data = manifest_motions[motion]
        sheet_path = ROOT / motion_data["sheet"]
        atlas = atlases.setdefault(sheet_path, Image.open(sheet_path).convert("RGBA"))
        for frame, target in zip(frames, motion_data["frames"], strict=True):
            atlas.alpha_composite(frame, (target["x"], target["y"]))
        motion_data["uniqueFrames"] = len({alpha_hash(frame) for frame in frames})
        motion_data["source"] = "higgsfield-v3-body-vfx"
        motion_data["higgsfieldJobId"] = job_motions[motion]["jobId"]

    for sheet_path, atlas in atlases.items():
        atlas.save(sheet_path, "WEBP", quality=92, method=6, exact=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    stabilize_manifest(ROOT, MANIFEST_PATH)
    save_preview(args.character, patches)
    print(f"Patched {len(patches)} motions for {args.character}")


if __name__ == "__main__":
    main()
