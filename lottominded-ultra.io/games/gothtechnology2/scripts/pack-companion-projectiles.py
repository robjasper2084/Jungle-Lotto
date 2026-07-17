import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RAW_ROOT = ROOT / "assets" / "sprite-production" / "higgsfield-v2" / "raw" / "companions"
OUTPUT_ROOT = ROOT / "assets" / "user-assists"
PREVIEW_PATH = ROOT / "output" / "companion-projectiles-preview.webp"
CELL_SIZE = 256
COMPANIONS = {
    "KALYX_SHADOW_RAVEN": {
        "input": "kalyx-shadow-raven-attack-raw.png",
        "output": "kalyx-shadow-raven-strike.webp",
        "jobId": "ffc65c52-d86d-430c-8672-81971d98b75e",
    },
    "EZRA_ARCANE_OWL": {
        "input": "ezra-owl-dive-attack-raw.png",
        "output": "ezra-arcane-owl-strike.webp",
        "jobId": "5e4cc919-1233-4998-9b0f-7a263125c485",
    },
}


def load_packer():
    path = ROOT / "scripts" / "pack-higgsfield-v2.py"
    spec = importlib.util.spec_from_file_location("higgsfield_packer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    packer = load_packer()
    preview = Image.new("RGBA", (CELL_SIZE * 6, CELL_SIZE * len(COMPANIONS)), (14, 16, 20, 255))
    draw = ImageDraw.Draw(preview)
    manifest = {
        "version": 1,
        "provider": "Higgsfield Nano Banana Pro",
        "cellWidth": CELL_SIZE,
        "cellHeight": CELL_SIZE,
        "frameRate": 14,
        "companions": {},
    }

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    for row, (name, config) in enumerate(COMPANIONS.items()):
        source = RAW_ROOT / config["input"]
        counts = packer.source_figure_counts(source)
        if counts != [3, 3]:
            raise ValueError(f"{name} must contain exactly 3 poses per row; found {counts}")
        frames = packer.normalize_frames(packer.split_sheet(source))
        if len({hashlib.sha1(frame.tobytes()).hexdigest() for frame in frames}) != 6:
            raise ValueError(f"{name} must contain six unique normalized frames")
        atlas = Image.new("RGBA", (CELL_SIZE * 6, CELL_SIZE), (0, 0, 0, 0))
        for column, frame in enumerate(frames):
            packer.validate_transparency(frame, f"{name}/frame-{column + 1}")
            packer.validate_internal_splits(frame, f"{name}/frame-{column + 1}")
            point = (column * CELL_SIZE, 0)
            atlas.alpha_composite(frame, point)
            preview.alpha_composite(frame, (point[0], row * CELL_SIZE))
        output = OUTPUT_ROOT / config["output"]
        atlas.save(output, "WEBP", quality=94, method=6, exact=True)
        draw.text((8, row * CELL_SIZE + 8), name.replace("_", " "), fill=(255, 214, 109, 255))
        manifest["companions"][name] = {
            "sheet": f"assets/user-assists/{config['output']}",
            "frames": 6,
            "uniqueFrames": 6,
            "sourceFigureCounts": counts,
            "jobId": config["jobId"],
        }
        print(f"Packed {name} into {output} ({output.stat().st_size} bytes)")

    (OUTPUT_ROOT / "companion-projectiles.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    preview.save(PREVIEW_PATH, "WEBP", quality=94, method=6)
    print(PREVIEW_PATH)


if __name__ == "__main__":
    main()
