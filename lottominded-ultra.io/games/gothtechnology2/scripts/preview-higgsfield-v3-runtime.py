import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
JOBS_PATH = ROOT / "assets" / "sprite-production" / "higgsfield-v3" / "jobs.json"
MANIFEST_PATH = ROOT / "assets" / "motion-atlases" / "motion-atlas-manifest.json"
OUTPUT_PATH = ROOT / "output" / "higgsfield-v3-runtime-review.png"
FRAME_WIDTH = 224
FRAME_HEIGHT = 224
LABEL_HEIGHT = 22
MOTION_COLUMNS = 3
PREVIEW_SCALE = 1.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", action="append")
    parser.add_argument("--motion", action="append")
    parser.add_argument("--output")
    args = parser.parse_args()

    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    selected_characters = set(args.character or manifest["characters"])
    selected_motions = set(args.motion or ())
    entries = []
    for character_id, character in manifest["characters"].items():
        if character_id not in selected_characters:
            continue
        for motion_name in character["motions"]:
            if selected_motions and motion_name not in selected_motions:
                continue
            entries.append((character_id, motion_name))
    columns = max(1, min(MOTION_COLUMNS, len(entries)))
    tile_width = FRAME_WIDTH * 6
    tile_height = FRAME_HEIGHT + LABEL_HEIGHT
    rows = (len(entries) + columns - 1) // columns
    canvas = Image.new("RGBA", (tile_width * columns, tile_height * rows), "#11161d")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    sheets = {}

    for entry_index, (character_id, motion_name) in enumerate(entries):
        motion = manifest["characters"][character_id]["motions"][motion_name]
        sheet = sheets.setdefault(motion["sheet"], Image.open(ROOT / motion["sheet"]).convert("RGBA"))
        tile_x = entry_index % columns * tile_width
        tile_y = entry_index // columns * tile_height
        for frame_index, frame in enumerate(motion["frames"]):
            content = frame["content"]
            source = sheet.crop((
                frame["x"] + content["x"],
                frame["y"] + content["y"],
                frame["x"] + content["x"] + content["w"],
                frame["y"] + content["y"] + content["h"],
            ))
            width = max(1, round(source.width * content["scale"] * PREVIEW_SCALE))
            height = max(1, round(source.height * content["scale"] * PREVIEW_SCALE))
            source = source.resize((width, height), Image.Resampling.LANCZOS)
            frame_x = tile_x + frame_index * FRAME_WIDTH
            x = frame_x + (FRAME_WIDTH - width) // 2
            y = tile_y + FRAME_HEIGHT - height
            canvas.alpha_composite(source, (x, y))
            draw.line((frame_x, tile_y + FRAME_HEIGHT - 1, frame_x + FRAME_WIDTH, tile_y + FRAME_HEIGHT - 1), fill="#40505d")
        draw.text((tile_x + 5, tile_y + FRAME_HEIGHT + 5), f"{character_id} / {motion_name}", fill="#f4f7fa", font=font)

    output_path = Path(args.output) if args.output else OUTPUT_PATH
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output_path, optimize=True)
    print(output_path)


if __name__ == "__main__":
    main()
