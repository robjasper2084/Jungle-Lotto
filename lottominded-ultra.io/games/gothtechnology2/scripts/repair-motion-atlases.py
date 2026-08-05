import hashlib
import json
from pathlib import Path

from PIL import Image, ImageFilter

from stabilize_motion_atlases import stabilize_manifest


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "motion-atlases" / "motion-atlas-manifest.json"
QA_PATH = ROOT / "assets" / "motion-atlases" / "motion-semantic-qa.json"
CELL_SIZE = 192
ALPHA_THRESHOLD = 24
PADDING = 5


def pose(source_motion: str, frame: int, *, angle: float = 0, scale_x: float = 1, scale_y: float = 1,
         shift_x: int = 0, shift_y: int = 0) -> dict:
    return {
        "motion": source_motion,
        "frame": frame,
        "angle": angle,
        "scaleX": scale_x,
        "scaleY": scale_y,
        "shiftX": shift_x,
        "shiftY": shift_y,
    }


REPAIRS = {
    "KALYX": {
        "WALK_BACK": {
            "poseClass": "grounded-locomotion",
            "frames": [pose("WALK_FORWARD", i) for i in [5, 4, 3, 2, 1, 0]],
        },
        "DASH_FORWARD": {
            "poseClass": "forward-burst",
            "frames": [pose("RUN_FORWARD", i, angle=a, scale_y=0.96, shift_x=x)
                       for i, a, x in zip(range(6), [-2, -4, -6, -5, -3, -1], [-4, -2, 0, 3, 5, 7], strict=True)],
        },
        "DASH_BACK": {
            "poseClass": "backward-burst",
            "frames": [pose("RUN_BACK", i, angle=a, scale_y=0.96, shift_x=x)
                       for i, a, x in zip(range(6), [2, 4, 6, 5, 3, 1], [6, 4, 1, -2, -4, -6], strict=True)],
        },
        "JUMP_START": {
            "poseClass": "takeoff",
            "frames": [
                pose("IDLE", 4), pose("CROUCH_ATTACK", 0, scale_y=0.92),
                pose("AIR_ATTACK", 0), pose("AIR_ATTACK", 1), pose("AIR_ATTACK", 4), pose("AIR_ATTACK", 5),
            ],
        },
        "JUMP_RISE": {
            "poseClass": "aerial-rise",
            "frames": [pose("AIR_ATTACK", i) for i in [0, 1, 4, 2, 3, 5]],
        },
        "JUMP_PEAK": {
            "poseClass": "aerial-peak",
            "frames": [pose("AIR_ATTACK", i) for i in [1, 2, 3, 4, 0, 5]],
        },
        "JUMP_FALL": {
            "poseClass": "aerial-fall",
            "frames": [pose("AIR_ATTACK", i) for i in [2, 3, 4, 0, 1, 5]],
        },
        "LANDING": {
            "poseClass": "landing-recovery",
            "frames": [
                pose("AIR_ATTACK", 4), pose("CROUCH_ATTACK", 0), pose("CROUCH_ATTACK", 1),
                pose("READY_STANCE", 0), pose("IDLE", 0), pose("IDLE", 1),
            ],
        },
    },
    "MASTER_EZRA": {
        "JUMP_START": {
            "poseClass": "takeoff",
            "frames": [
                pose("CROUCH_IDLE", 0), pose("AIR_ATTACK", 0), pose("AIR_ATTACK", 1),
                pose("AIR_ATTACK", 2), pose("AIR_ATTACK", 3), pose("AIR_ATTACK", 4),
            ],
        },
        "JUMP_RISE": {
            "poseClass": "aerial-rise",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip(range(6), [-3, -5, -6, -5, -3, -1], strict=True)],
        },
        "JUMP_PEAK": {
            "poseClass": "aerial-peak",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip([1, 2, 3, 4, 0, 5], [-3, -5, -4, -2, -1, 1], strict=True)],
        },
        "JUMP_FALL": {
            "poseClass": "aerial-fall",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip([2, 3, 4, 0, 1, 5], [5, 4, 3, 2, 1, 0], strict=True)],
        },
        "LANDING": {
            "poseClass": "landing-recovery",
            "frames": [
                pose("AIR_ATTACK", 4), pose("CROUCH_IDLE", 0), pose("CROUCH_IDLE", 1),
                pose("READY_STANCE", 0), pose("IDLE", 0), pose("IDLE", 1),
            ],
        },
        "SUPER_CHARGE": {
            "poseClass": "power-charge",
            "frames": [pose("SPECIAL_START", i, scale_x=1 + i * 0.008) for i in range(6)],
        },
        "THROW_FINISH": {
            "poseClass": "throw-release",
            "frames": [pose("COMBO_2", i) for i in range(6)],
        },
    },
    "DETROIT_LENS_NOIR": {
        "SPECIAL_START": {
            "poseClass": "companion-command",
            "frames": [pose("SPECIAL_PROJECTILE", i) for i in range(6)],
        },
        "SUPER_CHARGE": {
            "poseClass": "power-charge",
            "frames": [pose("SPECIAL_PROJECTILE", i, scale_x=1 + i * 0.006) for i in range(6)],
        },
        "SUPER_RELEASE": {
            "poseClass": "eye-laser-release",
            "frames": [pose("HEAVY_PUNCH", i, angle=a) for i, a in zip(range(6), [1, 0, -1, -2, -1, 0], strict=True)],
        },
        "THROW_GRAB": {
            "poseClass": "throw-grab",
            "frames": [pose("COMBO_1", i) for i in range(6)],
        },
    },
    "AMARA_VALENTINE": {
        "RUN_BACK": {
            "poseClass": "grounded-run",
            "frames": [pose("WALK_BACK", i, angle=a, scale_y=0.94, shift_x=x)
                       for i, a, x in zip(range(6), [2, 4, 5, 4, 2, 0], [4, 2, 0, -2, -4, -5], strict=True)],
        },
        "RUN_FORWARD": {
            "poseClass": "grounded-run",
            "frames": [pose("DASH_BACK", i, angle=a, scale_y=0.95, shift_x=x)
                       for i, a, x in zip(range(6), [-1, -3, -5, -4, -2, 0], [-3, -1, 2, 4, 5, 6], strict=True)],
        },
        "DASH_FORWARD": {
            "poseClass": "forward-burst",
            "frames": [pose("DASH_BACK", i, angle=a, scale_y=0.94, shift_x=x)
                       for i, a, x in zip(range(6), [-2, -4, -7, -6, -3, 0], [-5, -2, 1, 4, 6, 8], strict=True)],
        },
        "JUMP_START": {
            "poseClass": "takeoff",
            "frames": [
                pose("IDLE", 0), pose("CROUCH_IDLE", 0), pose("AIR_ATTACK", 0),
                pose("AIR_ATTACK", 1), pose("AIR_ATTACK", 2), pose("AIR_ATTACK", 3),
            ],
        },
        "JUMP_RISE": {
            "poseClass": "aerial-rise",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip(range(6), [-2, -4, -6, -5, -3, -1], strict=True)],
        },
        "JUMP_PEAK": {
            "poseClass": "aerial-peak",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip([1, 2, 3, 4, 0, 5], [-3, -5, -4, -2, -1, 1], strict=True)],
        },
        "JUMP_FALL": {
            "poseClass": "aerial-fall",
            "frames": [pose("AIR_ATTACK", i, angle=a) for i, a in zip([2, 3, 4, 0, 1, 5], [5, 4, 3, 2, 1, 0], strict=True)],
        },
        "LANDING": {
            "poseClass": "landing-recovery",
            "frames": [
                pose("AIR_ATTACK", 4), pose("CROUCH_IDLE", 0), pose("CROUCH_IDLE", 1),
                pose("READY_STANCE", 0), pose("IDLE", 0), pose("IDLE", 1),
            ],
        },
        "CROUCH_ATTACK": {
            "poseClass": "low-strike",
            "frames": [
                pose("CROUCH_IDLE", 0), pose("LIGHT_KICK", 0), pose("LIGHT_KICK", 1),
                pose("LIGHT_KICK", 2), pose("LIGHT_KICK", 3), pose("CROUCH_IDLE", 1),
            ],
        },
        "HEAVY_KICK": {
            "poseClass": "heavy-strike",
            "frames": [pose("LIGHT_KICK", i, angle=a, scale_x=1.04) for i, a in zip(range(6), [0, -2, -4, -3, -1, 0], strict=True)],
        },
        "SPECIAL_PROJECTILE": {
            "poseClass": "love-projectile-release",
            "frames": [pose("SUPER_RELEASE", i) for i in range(6)],
        },
        "SPECIAL_START": {
            "poseClass": "love-projectile-start",
            "frames": [pose("SUPER_RELEASE", i) for i in [5, 4, 3, 2, 1, 0]],
        },
        "SPECIAL_RECOVER": {
            "poseClass": "special-recovery",
            "frames": [pose("READY_STANCE", i) for i in range(6)],
        },
        "KNOCKDOWN": {
            "poseClass": "knockdown",
            "frames": [pose("HURT_HEAVY", i, angle=a, shift_y=y)
                       for i, a, y in zip([0, 1, 0, 1, 0, 1], [0, 18, 36, 54, 72, 88], [0, 0, 2, 4, 6, 8], strict=True)],
        },
        "DEFEAT": {
            "poseClass": "defeat",
            "frames": [pose("HURT_HEAVY", i, angle=a, shift_y=y)
                       for i, a, y in zip([0, 1, 0, 1, 0, 1], [8, 24, 42, 60, 78, 90], [0, 0, 2, 4, 6, 8], strict=True)],
        },
        "GET_UP": {
            "poseClass": "get-up",
            "frames": [pose("HURT_HEAVY", i, angle=a, shift_y=y)
                       for i, a, y in zip([1, 0, 1, 0, 1, 0], [90, 72, 54, 36, 18, 0], [8, 6, 4, 2, 0, 0], strict=True)],
        },
    },
}


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()
    if not bounds:
        raise ValueError("Source frame contains no visible pixels")
    return bounds


def remove_dark_background_artifacts(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    pixels = list(rgba.getdata())
    colored = Image.new("L", rgba.size, 0)
    colored.putdata([255 if alpha > ALPHA_THRESHOLD and max(red, green, blue) > 22 else 0
                     for red, green, blue, alpha in pixels])
    near_subject = colored.filter(ImageFilter.MaxFilter(7))
    proximity = list(near_subject.getdata())
    cleaned = []
    for index, (red, green, blue, alpha) in enumerate(pixels):
        if alpha > 0 and max(red, green, blue) <= 22 and proximity[index] == 0:
            cleaned.append((0, 0, 0, 0))
        else:
            cleaned.append((red, green, blue, alpha))
    rgba.putdata(cleaned)
    return rgba


def source_frame(manifest: dict, sheets: dict[str, Image.Image], character_id: str, source: dict) -> Image.Image:
    motion = manifest["characters"][character_id]["motions"][source["motion"]]
    frame = motion["frames"][source["frame"]]
    sheet = sheets[motion["sheet"]]
    crop = sheet.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
    if character_id in {"MASTER_EZRA", "AMARA_VALENTINE"}:
        crop = remove_dark_background_artifacts(crop)
    return crop


def compose_body_only(frame: Image.Image, spec: dict) -> Image.Image:
    subject = frame.crop(alpha_bounds(frame))
    width = max(1, round(subject.width * spec["scaleX"]))
    height = max(1, round(subject.height * spec["scaleY"]))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    if spec["angle"]:
        subject = subject.rotate(spec["angle"], resample=Image.Resampling.BICUBIC, expand=True)
        subject = subject.crop(alpha_bounds(subject))
    max_extent = CELL_SIZE - PADDING * 2
    fit = min(1, max_extent / subject.width, max_extent / subject.height)
    if fit < 1:
        subject = subject.resize((max(1, round(subject.width * fit)), max(1, round(subject.height * fit))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CELL_SIZE, CELL_SIZE), (0, 0, 0, 0))
    x = round((CELL_SIZE - subject.width) / 2 + spec["shiftX"])
    y = round(CELL_SIZE - PADDING - subject.height + spec["shiftY"])
    x = max(PADDING, min(CELL_SIZE - PADDING - subject.width, x))
    y = max(PADDING, min(CELL_SIZE - PADDING - subject.height, y))
    canvas.alpha_composite(subject, (x, y))
    return canvas


def alpha_hash(frame: Image.Image) -> str:
    return hashlib.sha256(frame.getchannel("A").tobytes()).hexdigest()


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sheet_paths = {
        motion["sheet"]
        for character in manifest["characters"].values()
        for motion in character["motions"].values()
    }
    original_sheets = {path: Image.open(ROOT / path).convert("RGBA") for path in sheet_paths}
    repaired_sheets = {path: image.copy() for path, image in original_sheets.items()}
    qa_motions = {}

    for character_id, repairs in REPAIRS.items():
        character = manifest["characters"][character_id]
        for motion_name, repair in repairs.items():
            motion = character["motions"][motion_name]
            frames = [compose_body_only(source_frame(manifest, original_sheets, character_id, spec), spec)
                      for spec in repair["frames"]]
            if len({alpha_hash(frame) for frame in frames}) != 6:
                raise ValueError(f"{character_id}/{motion_name} did not produce six unique silhouettes")
            target_sheet = repaired_sheets[motion["sheet"]]
            for frame, target in zip(frames, motion["frames"], strict=True):
                target_sheet.paste((0, 0, 0, 0), (target["x"], target["y"], target["x"] + CELL_SIZE, target["y"] + CELL_SIZE))
                target_sheet.alpha_composite(frame, (target["x"], target["y"]), (0, 0, CELL_SIZE, CELL_SIZE))
            motion["source"] = "derived-body-only-v1"
            motion["repair"] = "semantic-body-only-v1"
            motion["uniqueFrames"] = 6
            motion["semantic"] = {
                "version": 1,
                "bodyOnly": True,
                "figureCount": 1,
                "anchor": "bottom-center",
                "poseClass": repair["poseClass"],
            }
            motion["repairSourceFrames"] = [f"{spec['motion']}:{spec['frame']}" for spec in repair["frames"]]
            qa_motions[f"{character_id}/{motion_name}"] = {
                "poseClass": repair["poseClass"],
                "bodyOnly": True,
                "figureCount": 1,
                "minUniqueSilhouettes": 6,
                "maxEdgePixelRatio": 0.012,
                "maxOpaqueAreaRatioToIdle": 1.65,
            }

    for path, image in repaired_sheets.items():
        image.save(ROOT / path, "WEBP", quality=94, method=6, exact=True)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    stabilize_manifest(ROOT, MANIFEST_PATH)
    QA_PATH.write_text(json.dumps({
        "version": 1,
        "repair": "semantic-body-only-v1",
        "motions": qa_motions,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Repaired {len(qa_motions)} motion sequences across {len(REPAIRS)} fighters")


if __name__ == "__main__":
    main()
