import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PACK_ROOT = ROOT / "assets" / "GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2"
FALLBACK_PACK_ROOT = (
    ROOT.parents[2]
    / "_jungle_lotto_refined"
    / "lottominded-ultra.io"
    / "games"
    / "gothtechnology2"
    / "assets"
    / "GOTHTECHNOLOGY_EXPANDED_SPRITE_PACK_V2"
)
SOURCE_MANIFEST = PACK_ROOT / "manifests" / "GOTHTECHNOLOGY_expanded_motion_manifest.json"
OUTPUT_ROOT = ROOT / "assets" / "motion-atlases"
OUTPUT_MANIFEST = OUTPUT_ROOT / "motion-atlas-manifest.json"
CELL_SIZE = 192
COLUMNS = 8
APPROVED_BOOT_MOTIONS = {"IDLE", "READY_STANCE"}
REBUILT_MOTIONS = {"KNOCKDOWN", "DEFEAT"}
MOTION_GROUPS = {
    "locomotion": {
        "WALK_FORWARD", "WALK_BACK", "RUN_FORWARD", "RUN_BACK",
        "DASH_FORWARD", "DASH_BACK", "JUMP_START", "JUMP_RISE",
        "JUMP_PEAK", "JUMP_FALL", "LANDING", "CROUCH_IDLE", "CROUCH_WALK",
    },
    "combat": {
        "CROUCH_ATTACK", "LIGHT_PUNCH", "HEAVY_PUNCH", "LIGHT_KICK",
        "HEAVY_KICK", "AIR_ATTACK", "THROW_GRAB", "THROW_FINISH",
        "COMBO_1", "COMBO_2", "SPECIAL_START", "SPECIAL_PROJECTILE",
        "SPECIAL_RECOVER", "SUPER_CHARGE", "SUPER_RELEASE",
    },
    "reaction": {
        "BLOCK_HIGH", "BLOCK_LOW", "HURT_LIGHT", "HURT_HEAVY",
        "KNOCKDOWN", "GET_UP", "TAUNT", "VICTORY", "DEFEAT",
    },
}


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = frame.getchannel("A").point(lambda value: 255 if value >= 12 else 0)
    return alpha.getbbox()


def normalized_frame(frame: Image.Image) -> Image.Image:
    bbox = alpha_bbox(frame)
    if not bbox:
        return Image.new("RGBA", (CELL_SIZE, CELL_SIZE))

    left, top, right, bottom = bbox
    content = frame.crop(bbox)
    max_width = CELL_SIZE - 12
    max_height = CELL_SIZE - 8
    scale = min(1, max_width / content.width, max_height / content.height)
    if scale < 1:
        content = content.resize(
            (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
            Image.Resampling.LANCZOS,
        )

    canvas = Image.new("RGBA", (CELL_SIZE, CELL_SIZE))
    x = (CELL_SIZE - content.width) // 2
    y = CELL_SIZE - content.height - 4
    canvas.alpha_composite(content, (x, y))
    return canvas


def frame_hash(frame: Image.Image) -> str:
    return hashlib.sha1(frame.tobytes()).hexdigest()


def repack_character(character_id: str, character: dict, prune_source: bool) -> tuple[dict, dict]:
    first_motion = next(iter(character["motions"].values()))
    source_path = PACK_ROOT / first_motion["sheet"]
    if not source_path.exists():
        source_path = FALLBACK_PACK_ROOT / first_motion["sheet"]
    if not source_path.exists():
        raise FileNotFoundError(f"Missing runtime source for {character_id}: {first_motion['sheet']}")
    source = Image.open(source_path).convert("RGBA")
    motion_metadata: dict[str, dict] = {}
    report = {
        "source": str(source_path).replace("\\", "/"),
        "source_bytes": source_path.stat().st_size,
        "out_of_bounds_frames": 0,
        "blank_frames": 0,
        "motions": {},
        "outputs": [],
    }

    packed_frame_count = 0
    character_slug = character_id.lower().replace("_", "-")
    for group_name, group_motions in MOTION_GROUPS.items():
        frame_sources = []
        for motion_name, motion in character["motions"].items():
            if motion_name not in group_motions:
                continue
            source_frames = motion["frames"]
            if motion_name == "KNOCKDOWN":
                source_frames = list(reversed(character["motions"]["GET_UP"]["frames"]))
            elif motion_name == "DEFEAT":
                source_frames = [
                    *character["motions"]["HURT_HEAVY"]["frames"],
                    *reversed(character["motions"]["GET_UP"]["frames"]),
                ]
            frame_sources.append((motion_name, motion, source_frames))

        valid_count = sum(
            1
            for _, _, source_frames in frame_sources
            for frame in source_frames
            if frame["x"] + frame["w"] <= source.width
            and frame["y"] + frame["h"] <= source.height
        )
        rows = math.ceil(valid_count / COLUMNS)
        atlas = Image.new("RGBA", (COLUMNS * CELL_SIZE, rows * CELL_SIZE))
        packed_index = 0
        output_name = f"{character_slug}-{group_name}.webp"
        output_path = OUTPUT_ROOT / output_name
        sheet_url = f"assets/motion-atlases/{output_name}"

        for motion_name, motion, source_frames in frame_sources:
            frames = []
            hashes = set()
            for source_frame in source_frames:
                right = source_frame["x"] + source_frame["w"]
                bottom = source_frame["y"] + source_frame["h"]
                if right > source.width or bottom > source.height:
                    report["out_of_bounds_frames"] += 1
                    continue

                crop = source.crop((source_frame["x"], source_frame["y"], right, bottom))
                normalized = normalized_frame(crop)
                if not alpha_bbox(normalized):
                    report["blank_frames"] += 1
                    continue

                x = (packed_index % COLUMNS) * CELL_SIZE
                y = (packed_index // COLUMNS) * CELL_SIZE
                atlas.alpha_composite(normalized, (x, y))
                hashes.add(frame_hash(normalized))
                frames.append({
                    "x": x,
                    "y": y,
                    "w": CELL_SIZE,
                    "h": CELL_SIZE,
                    "duration_ms": source_frame.get("duration_ms", 85),
                })
                packed_index += 1

            if not frames:
                raise RuntimeError(f"{character_id}/{motion_name} has no usable source frames")

            motion_metadata[motion_name] = {
                "sheet": sheet_url,
                "frameCount": len(frames),
                "uniqueFrames": len(hashes),
                "cellWidth": CELL_SIZE,
                "cellHeight": CELL_SIZE,
                "renderScale": 256 / CELL_SIZE,
                "sourceFacing": 1,
                "rebuiltFromRuntime": motion_name in REBUILT_MOTIONS,
                "frames": frames,
            }
            report["motions"][motion_name] = {
                "declared_frames": motion["frame_count"],
                "packed_frames": len(frames),
                "unique_frames": len(hashes),
            }

        atlas.save(output_path, "WEBP", quality=82, method=6, exact=True)
        with Image.open(output_path) as verification:
            verification.verify()
        report["outputs"].append({
            "path": str(output_path.relative_to(ROOT)).replace("\\", "/"),
            "bytes": output_path.stat().st_size,
            "dimensions": [atlas.width, atlas.height],
        })
        packed_frame_count += packed_index
        atlas.close()

    report["source_removed"] = False
    if prune_source and source_path.is_relative_to(ROOT):
        source.close()
        source_path.unlink()
        report["source_removed"] = True
    report["output_bytes"] = sum(output["bytes"] for output in report["outputs"])
    report["packed_frames"] = packed_frame_count

    return {
        "motions": motion_metadata,
    }, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--prune-source",
        action="store_true",
        help="remove each obsolete runtime PNG only after its compact atlas verifies",
    )
    args = parser.parse_args()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    with SOURCE_MANIFEST.open("r", encoding="utf-8") as source_file:
        source_manifest = json.load(source_file)

    output = {
        "version": 1,
        "cellSize": CELL_SIZE,
        "columns": COLUMNS,
        "bootMotions": sorted(APPROVED_BOOT_MOTIONS),
        "characters": {},
    }
    reports = {}
    for character_id, character in source_manifest["characters"].items():
        packed, report = repack_character(character_id, character, args.prune_source)
        output["characters"][character_id] = packed
        reports[character_id] = report

    with OUTPUT_MANIFEST.open("w", encoding="utf-8") as output_file:
        json.dump(output, output_file, indent=2)
        output_file.write("\n")

    total_source = sum(report["source_bytes"] for report in reports.values())
    total_output = sum(report["output_bytes"] for report in reports.values())
    print(json.dumps({
        "manifest": str(OUTPUT_MANIFEST.relative_to(ROOT)).replace("\\", "/"),
        "source_bytes": total_source,
        "output_bytes": total_output,
        "reduction_percent": round((1 - total_output / total_source) * 100, 1),
        "characters": reports,
    }, indent=2))


if __name__ == "__main__":
    main()
