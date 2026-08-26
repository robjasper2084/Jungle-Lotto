import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
JOBS_PATH = ROOT / "assets" / "sprite-production" / "higgsfield-v3" / "jobs.json"
OUTPUT_PATH = ROOT / "output" / "higgsfield-v3-review.png"
THUMBNAIL = (288, 192)
LABEL_HEIGHT = 24
COLUMNS = 5


def main() -> None:
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    entries = [
        (character_id, motion_name, ROOT / entry["rawPath"])
        for character_id, motions in jobs["characters"].items()
        for motion_name, entry in motions.items()
    ]
    rows = (len(entries) + COLUMNS - 1) // COLUMNS
    canvas = Image.new("RGB", (COLUMNS * THUMBNAIL[0], rows * (THUMBNAIL[1] + LABEL_HEIGHT)), "#11161d")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, (character_id, motion_name, path) in enumerate(entries):
        image = Image.open(path).convert("RGB")
        image.thumbnail(THUMBNAIL, Image.Resampling.LANCZOS)
        column = index % COLUMNS
        row = index // COLUMNS
        cell_x = column * THUMBNAIL[0]
        cell_y = row * (THUMBNAIL[1] + LABEL_HEIGHT)
        x = cell_x + (THUMBNAIL[0] - image.width) // 2
        y = cell_y + (THUMBNAIL[1] - image.height) // 2
        canvas.paste(image, (x, y))
        draw.text((cell_x + 6, cell_y + THUMBNAIL[1] + 6), f"{character_id} / {motion_name}", fill="#f4f7fa", font=font)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT_PATH, optimize=True)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
