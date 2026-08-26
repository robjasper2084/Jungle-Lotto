import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "motion-atlases" / "motion-atlas-manifest.json"
FRAME_SIZE = 192


def connected_components(mask: np.ndarray) -> list[dict]:
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    components = []
    for start_y, start_x in zip(*np.where(mask & ~seen), strict=True):
        if seen[start_y, start_x]:
            continue
        queue = deque([(int(start_y), int(start_x))])
        seen[start_y, start_x] = True
        area = 0
        min_x = max_x = int(start_x)
        min_y = max_y = int(start_y)
        while queue:
            y, x = queue.pop()
            area += 1
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)
            for next_y, next_x in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and mask[next_y, next_x]
                    and not seen[next_y, next_x]
                ):
                    seen[next_y, next_x] = True
                    queue.append((next_y, next_x))
        component_width = max_x - min_x + 1
        component_height = max_y - min_y + 1
        components.append(
            {
                "area": area,
                "width": component_width,
                "height": component_height,
                "density": area / (component_width * component_height),
            }
        )
    return components


def count_straight_alpha_dividers(alpha: np.ndarray) -> int:
    radius = 18
    count = 0
    height, width = alpha.shape
    for horizontal in (True, False):
        bridge = np.zeros(alpha.shape, dtype=bool)
        if horizontal:
            for y in range(radius, height - radius):
                above = alpha[y - radius:y].any(axis=0)
                below = alpha[y + 1:y + radius + 1].any(axis=0)
                bridge[y] = ~alpha[y] & above & below
        else:
            for x in range(radius, width - radius):
                left = alpha[:, x - radius:x].any(axis=1)
                right = alpha[:, x + 1:x + radius + 1].any(axis=1)
                bridge[:, x] = ~alpha[:, x] & left & right
        for component in connected_components(bridge):
            length = component["width"] if horizontal else component["height"]
            thickness = component["height"] if horizontal else component["width"]
            if length >= 44 and thickness <= 10 and length >= thickness * 8 and component["density"] >= 0.88:
                count += 1
    return count


def count_isolated_dark_line_pixels(rgba: np.ndarray) -> int:
    visible = rgba[:, :, 3] > 24
    dark = visible & (rgba[:, :, :3].max(axis=2) < 40)
    total = 0
    for component in connected_components(dark):
        length = max(component["width"], component["height"])
        thickness = min(component["width"], component["height"])
        if length >= 96 and thickness <= 8 and length >= thickness * 10 and component["density"] >= 0.85:
            total += component["area"]
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", action="append")
    parser.add_argument("--preview-dir")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    selected = set(args.character or manifest["characters"].keys())
    sheets = {}
    findings = []

    for character_id, character in manifest["characters"].items():
        if character_id not in selected:
            continue
        for motion_name, motion in character["motions"].items():
            sheet_path = ROOT / motion["sheet"]
            sheet = sheets.setdefault(sheet_path, Image.open(sheet_path).convert("RGBA"))
            for frame_index, frame in enumerate(motion["frames"], start=1):
                image = sheet.crop(
                    (
                        frame["x"],
                        frame["y"],
                        frame["x"] + frame["w"],
                        frame["y"] + frame["h"],
                    )
                ).resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.NEAREST)
                rgba = np.asarray(image, dtype=np.uint8)
                alpha_dividers = count_straight_alpha_dividers(rgba[:, :, 3] > 24)
                dark_line_pixels = count_isolated_dark_line_pixels(rgba)
                if alpha_dividers or dark_line_pixels:
                    if args.preview_dir:
                        preview_dir = ROOT / args.preview_dir
                        preview_dir.mkdir(parents=True, exist_ok=True)
                        preview = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (210, 214, 218, 255))
                        preview.alpha_composite(image)
                        preview.save(
                            preview_dir / f"{character_id.lower()}-{motion_name.lower()}-{frame_index}.png"
                        )
                    findings.append(
                        {
                            "character": character_id,
                            "motion": motion_name,
                            "frame": frame_index,
                            "alphaDividers": alpha_dividers,
                            "darkLinePixels": dark_line_pixels,
                        }
                    )

    print(json.dumps(findings, indent=2))
    if findings:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
