import hashlib
import importlib.util
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

from stabilize_motion_atlases import stabilize_manifest


ROOT = Path(__file__).resolve().parents[1]
JOBS_PATH = ROOT / "assets" / "sprite-production" / "higgsfield-v3" / "jobs.json"
MANIFEST_PATH = ROOT / "assets" / "motion-atlases" / "motion-atlas-manifest.json"
QA_PATH = ROOT / "assets" / "motion-atlases" / "motion-semantic-qa.json"
ALPHA_THRESHOLD = 24
GRID_GUTTER = 12

PACKER_SPEC = importlib.util.spec_from_file_location(
    "higgsfield_v2_packer", ROOT / "scripts" / "pack-higgsfield-v2.py"
)
PACKER = importlib.util.module_from_spec(PACKER_SPEC)
PACKER_SPEC.loader.exec_module(PACKER)

AERIAL_MOTIONS = {
    "JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "LANDING", "AIR_ATTACK"
}
DIRECT_LOCOMOTION = {
    "KALYX": {"WALK_BACK", "DASH_FORWARD", "DASH_BACK"},
    "AMARA_VALENTINE": {"RUN_BACK", "RUN_FORWARD", "DASH_FORWARD"},
}
AMARA_GRID_SELECTIONS = {
    "RUN_FORWARD": [0, 1, 2, 3, 4, 9],
    "DASH_FORWARD": [0, 1, 2, 7, 8, 4],
}
AERIAL_GRID_SELECTIONS = {
    "JUMP_START": [0, 1, 2, 3, 6, 7],
    "JUMP_RISE": [1, 2, 3, 4, 5, 6],
    "JUMP_PEAK": [1, 2, 3, 4, 5, 6],
    "JUMP_FALL": [1, 2, 3, 4, 5, 6],
    "LANDING": [0, 1, 2, 4, 5, 7],
    "AIR_ATTACK": [1, 2, 3, 4, 5, 6],
}
MOTION_CLASSES = {
    "IDLE": "grounded-idle",
    "READY_STANCE": "grounded-guard",
    "CROUCH_IDLE": "crouched-idle",
    "CROUCH_WALK": "crouched-locomotion",
    "WALK_FORWARD": "grounded-locomotion",
    "WALK_BACK": "grounded-locomotion",
    "RUN_FORWARD": "grounded-run",
    "RUN_BACK": "grounded-run",
    "DASH_FORWARD": "forward-burst",
    "DASH_BACK": "backward-burst",
    "JUMP_START": "takeoff",
    "JUMP_RISE": "aerial-rise",
    "JUMP_PEAK": "aerial-peak",
    "JUMP_FALL": "aerial-fall",
    "LANDING": "landing-recovery",
    "AIR_ATTACK": "aerial-strike",
    "LIGHT_PUNCH": "light-strike",
    "HEAVY_PUNCH": "heavy-strike",
    "LIGHT_KICK": "light-strike",
    "HEAVY_KICK": "heavy-strike",
    "CROUCH_ATTACK": "low-strike",
    "COMBO_1": "combo-string",
    "COMBO_2": "combo-string",
    "SPECIAL_START": "special-start",
    "SPECIAL_PROJECTILE": "special-release",
    "SPECIAL_RECOVER": "special-recovery",
    "SUPER_CHARGE": "power-charge",
    "SUPER_RELEASE": "super-release",
    "THROW_GRAB": "throw-grab",
    "THROW_FINISH": "throw-release",
    "BLOCK_HIGH": "standing-block",
    "BLOCK_LOW": "crouched-block",
    "HURT_LIGHT": "light-reaction",
    "HURT_HEAVY": "heavy-reaction",
    "KNOCKDOWN": "knockdown",
    "GET_UP": "get-up",
    "TAUNT": "taunt",
    "VICTORY": "victory",
    "DEFEAT": "defeat",
}


def alpha_hash(frame: Image.Image) -> str:
    return hashlib.sha256(frame.getchannel("A").tobytes()).hexdigest()


def component_distance(first: dict, second: dict) -> int:
    dx = max(first["min_x"] - second["max_x"] - 1, second["min_x"] - first["max_x"] - 1, 0)
    dy = max(first["min_y"] - second["max_y"] - 1, second["min_y"] - first["max_y"] - 1, 0)
    return max(dx, dy)


def pixel_components(mask: np.ndarray) -> list[dict]:
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    components = []
    for start_y, start_x in zip(*np.where(mask & ~seen), strict=True):
        if seen[start_y, start_x]:
            continue
        queue = deque([(int(start_y), int(start_x))])
        seen[start_y, start_x] = True
        pixels = []
        min_x = max_x = int(start_x)
        min_y = max_y = int(start_y)
        while queue:
            y, x = queue.pop()
            pixels.append((y, x))
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
        components.append({
            "area": len(pixels),
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
            "width": max_x - min_x + 1,
            "height": max_y - min_y + 1,
            "pixels": np.asarray(pixels, dtype=np.int32),
        })
    return components


def remove_detached_annotations(frame: Image.Image, *, strict: bool = False) -> Image.Image:
    rgba = np.asarray(frame.convert("RGBA"), dtype=np.uint8).copy()
    mask = rgba[:, :, 3] > ALPHA_THRESHOLD
    components = pixel_components(mask)
    if not components:
        raise ValueError("Generated frame contains no visible subject")
    main = max(components, key=lambda component: component["area"])
    keep = np.zeros(mask.shape, dtype=bool)
    for component in components:
        distance = component_distance(main, component)
        area_ratio = component["area"] / main["area"]
        slender = (
            component["width"] >= 18 and component["width"] > component["height"] * 4
        ) or (
            component["height"] >= 18 and component["height"] > component["width"] * 4
        )
        related = component is main or (
            not strict
            and not slender
            and (distance <= 8 or area_ratio >= 0.02)
        )
        if related:
            pixels = component["pixels"]
            keep[pixels[:, 0], pixels[:, 1]] = True
    rgba[:, :, 3] = np.where(keep, rgba[:, :, 3], 0)
    return Image.fromarray(rgba, "RGBA")


def clean_frame(
    frame: Image.Image,
    *,
    remove_annotations: bool = False,
    strict_annotations: bool = False,
    remove_seams: bool = False,
) -> Image.Image:
    cleaned = frame.convert("RGBA")
    if remove_seams:
        cleaned = PACKER.remove_edge_grid_seams(cleaned)
    if remove_annotations:
        cleaned = remove_detached_annotations(cleaned, strict=strict_annotations)
    return cleaned


def split_fixed_horizontal(source: Path) -> list[Image.Image]:
    image = Image.open(source).convert("RGBA")
    frames = []
    for index in range(6):
        left = round(index * image.width / 6)
        right = round((index + 1) * image.width / 6)
        if index > 0:
            left += 5
        if index < 5:
            right -= 5
        panel = image.crop((left, 0, right, image.height))
        frames.append(PACKER.chroma_key(panel))
    return frames


def split_fixed_grid(source: Path, columns: int, rows: int) -> list[Image.Image]:
    image = Image.open(source).convert("RGBA")
    frames = []
    for row in range(rows):
        for column in range(columns):
            left = round(column * image.width / columns) + (GRID_GUTTER if column else 0)
            right = round((column + 1) * image.width / columns) - (
                GRID_GUTTER if column < columns - 1 else 0
            )
            top = round(row * image.height / rows) + (GRID_GUTTER if row else 0)
            bottom = round((row + 1) * image.height / rows) - (
                GRID_GUTTER if row < rows - 1 else 0
            )
            frames.append(PACKER.chroma_key(image.crop((left, top, right, bottom))))
    return frames


def split_variable_grid(source: Path) -> list[Image.Image]:
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.uint8)
    dark = rgb.max(axis=2) < 90
    y_intervals = PACKER.panel_intervals(
        image.height,
        PACKER.panel_divider_runs(dark.mean(axis=1), image.height),
    )
    frames = []
    for top, bottom in y_intervals:
        x_intervals = PACKER.panel_intervals(
            image.width,
            PACKER.panel_divider_runs(dark[top:bottom].mean(axis=0), image.width),
        )
        for left, right in x_intervals:
            crop_left = left + (GRID_GUTTER if left else 0)
            crop_right = right - (GRID_GUTTER if right < image.width else 0)
            crop_top = top + (GRID_GUTTER if top else 0)
            crop_bottom = bottom - (GRID_GUTTER if bottom < image.height else 0)
            frames.append(PACKER.chroma_key(image.crop((crop_left, crop_top, crop_right, crop_bottom))))
    if len(frames) != 10:
        raise ValueError(f"Expected ten variable-grid frames in {source.name}, found {len(frames)}")
    return frames


def detect_grid_columns(source: Path) -> int:
    row_counts = PACKER.source_figure_counts(source)
    if len(row_counts) != 2 or row_counts[0] != row_counts[1] or row_counts[0] not in {3, 4}:
        raise ValueError(f"Could not identify a 3- or 4-column sprite grid in {source.name}")
    return row_counts[0]


def generated_frames(character_id: str, motion_name: str, entry: dict) -> list[Image.Image]:
    source = ROOT / entry["rawPath"]
    if character_id != "AMARA_VALENTINE" and motion_name in AERIAL_GRID_SELECTIONS:
        columns = detect_grid_columns(source)
        candidates = split_fixed_grid(source, columns, 2)
        frames = (
            [candidates[index] for index in AERIAL_GRID_SELECTIONS[motion_name]]
            if columns == 4
            else candidates
        )
    elif entry.get("layout") == "3x2" or character_id != "AMARA_VALENTINE":
        frames = split_fixed_grid(source, 3, 2)
    elif character_id == "AMARA_VALENTINE" and motion_name in AMARA_GRID_SELECTIONS:
        candidates = split_variable_grid(source)
        frames = [candidates[index] for index in AMARA_GRID_SELECTIONS[motion_name]]
    elif character_id == "AMARA_VALENTINE":
        frames = split_fixed_horizontal(source)
    else:
        frames = PACKER.split_sheet(source)
    if character_id == "KALYX" and motion_name == "LANDING":
        cleared = []
        for frame in frames:
            rgba = np.asarray(frame.convert("RGBA"), dtype=np.uint8).copy()
            rgba[:round(frame.height * 0.18), :, 3] = 0
            cleared.append(Image.fromarray(rgba, "RGBA"))
        frames = cleared
    remove_annotations = (
        (character_id == "KALYX" and motion_name == "LANDING")
        or (
            character_id == "AMARA_VALENTINE"
            and motion_name in DIRECT_LOCOMOTION["AMARA_VALENTINE"]
        )
    )
    strict_annotations = (
        character_id == "AMARA_VALENTINE"
        and (
            motion_name in DIRECT_LOCOMOTION["AMARA_VALENTINE"]
            or motion_name == "AIR_ATTACK"
        )
    )
    remove_annotations = remove_annotations or strict_annotations
    frames = [
        clean_frame(
            frame,
            remove_annotations=remove_annotations,
            strict_annotations=strict_annotations,
        )
        for frame in frames
    ]
    for index, frame in enumerate(frames, start=1):
        PACKER.validate_transparency(frame, f"{character_id}/frame-{index}", max_coverage=0.70)
    normalized = [
        clean_frame(
            frame,
            remove_annotations=remove_annotations,
            strict_annotations=strict_annotations,
        )
        for frame in PACKER.normalize_frames(frames)
    ]
    if len(normalized) != 6 or len({alpha_hash(frame) for frame in normalized}) != 6:
        raise ValueError(f"{character_id} generation did not produce six unique silhouettes")
    return normalized


def semantic_rule(motion_name: str) -> dict:
    quiet = motion_name in {"IDLE", "CROUCH_IDLE"}
    return {
        "poseClass": MOTION_CLASSES[motion_name],
        "bodyOnly": True,
        "figureCount": 1,
        "anchor": "bottom-center",
        "minUniqueSilhouettes": 3 if quiet else 5,
        "maxEdgePixelRatio": 0.015,
        "maxOpaqueAreaRatioToIdle": 1.7,
        "maxLargeComponents": 5,
        "maxIsolatedDarkLinePixels": 0,
    }


def main() -> None:
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sheet_paths = {
        motion["sheet"]
        for character in manifest["characters"].values()
        for motion in character["motions"].values()
    }
    sheets = {path: Image.open(ROOT / path).convert("RGBA") for path in sheet_paths}

    for character_id, character in manifest["characters"].items():
        for motion_name, motion in character["motions"].items():
            sheet = sheets[motion["sheet"]]
            for target in motion["frames"]:
                box = (target["x"], target["y"], target["x"] + target["w"], target["y"] + target["h"])
                cleaned = clean_frame(
                    sheet.crop(box),
                    remove_annotations=(
                        character_id == "DETROIT_LENS_NOIR"
                        and motion_name == "DEFEAT"
                    ),
                    remove_seams=True,
                )
                sheet.paste((0, 0, 0, 0), box)
                sheet.alpha_composite(cleaned, (target["x"], target["y"]))

    imported = 0
    for character_id, motions in jobs["characters"].items():
        character = manifest["characters"][character_id]
        for motion_name, entry in motions.items():
            frames = generated_frames(character_id, motion_name, entry)
            motion = character["motions"][motion_name]
            sheet = sheets[motion["sheet"]]
            for frame, target in zip(frames, motion["frames"], strict=True):
                box = (target["x"], target["y"], target["x"] + target["w"], target["y"] + target["h"])
                sheet.paste((0, 0, 0, 0), box)
                sheet.alpha_composite(frame, (target["x"], target["y"]))
            motion["source"] = "higgsfield-v3-aerial-locomotion"
            motion["higgsfieldJobId"] = entry["jobId"]
            motion["uniqueFrames"] = 6
            motion.pop("repair", None)
            motion.pop("repairSourceFrames", None)
            imported += 1

    qa_motions = {}
    for character_id, character in manifest["characters"].items():
        for motion_name, motion in character["motions"].items():
            motion["semantic"] = {
                "version": 2,
                "bodyOnly": True,
                "figureCount": 1,
                "anchor": "bottom-center",
                "poseClass": MOTION_CLASSES[motion_name],
            }
            qa_motions[f"{character_id}/{motion_name}"] = semantic_rule(motion_name)

    for path, image in sheets.items():
        image.save(ROOT / path, "WEBP", quality=94, method=6, exact=True)

    manifest["spriteQualityVersion"] = 2
    manifest["blackArtifactCleanup"] = "source-grid-isolation-and-component-cleanup-v3"
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    stabilize_manifest(ROOT, MANIFEST_PATH)
    QA_PATH.write_text(json.dumps({
        "version": 2,
        "pipeline": "semantic-sprite-quality-v2",
        "generatedMotions": {
            "aerial": sorted(AERIAL_MOTIONS),
            "directLocomotion": {key: sorted(value) for key, value in DIRECT_LOCOMOTION.items()},
        },
        "motions": qa_motions,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {imported} Higgsfield v3 motions and cleaned {len(sheets)} runtime atlases")


if __name__ == "__main__":
    main()
