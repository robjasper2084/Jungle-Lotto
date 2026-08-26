import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from stabilize_motion_atlases import stabilize_manifest


ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_ROOT = ROOT / "assets" / "sprite-production" / "higgsfield-v2"
JOBS_PATH = PRODUCTION_ROOT / "jobs.json"
ATLAS_ROOT = ROOT / "assets" / "motion-atlases"
MANIFEST_PATH = ATLAS_ROOT / "motion-atlas-manifest.json"
PREVIEW_ROOT = ROOT / "output" / "motion-v3-previews"
KALYX_AERIAL_MOTIONS = {
    "JUMP_START",
    "JUMP_RISE",
    "JUMP_PEAK",
    "JUMP_FALL",
    "LANDING",
    "AIR_ATTACK",
}


def load_packer():
    path = ROOT / "scripts" / "pack-higgsfield-v2.py"
    spec = importlib.util.spec_from_file_location("higgsfield_packer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def alpha_hash(image: Image.Image) -> str:
    return hashlib.sha1(image.tobytes()).hexdigest()


def solid_divider_runs(projection: np.ndarray) -> list[tuple[int, int]]:
    indices = np.where(projection >= 0.98)[0]
    if not len(indices):
        return []
    runs = []
    start = previous = int(indices[0])
    for raw_index in (*indices[1:], None):
        index = None if raw_index is None else int(raw_index)
        if index is not None and index == previous + 1:
            previous = index
            continue
        if 1 <= previous - start + 1 <= 24 and start > 2 and previous < len(projection) - 3:
            runs.append((start, previous + 1))
        if index is not None:
            start = previous = index
    return runs


def split_master_ezra_grid(packer, path: Path) -> list[Image.Image]:
    counts = packer.source_figure_counts(path)
    if len(counts) != 2 or any(count not in {3, 4} for count in counts):
        raise ValueError(f"MASTER_EZRA source grid is not 3/4 columns by two rows: {counts}")
    with Image.open(path) as source_image:
        source = packer.resize_source_for_runtime(source_image.convert("RGB"))
    row_boundary = packer.detect_row_boundary(source)
    y_edges = (0, row_boundary, source.height)
    frames = []
    for row, column_count in enumerate(counts):
        top = y_edges[row] + packer.SOURCE_PANEL_GUTTER
        bottom = y_edges[row + 1] - packer.SOURCE_PANEL_GUTTER
        for column in range(column_count):
            left = round(column * source.width / column_count) + packer.SOURCE_PANEL_GUTTER
            right = round((column + 1) * source.width / column_count) - packer.SOURCE_PANEL_GUTTER
            panel = source.crop((left, top, right, bottom))
            frames.append(packer.remove_edge_grid_seams(packer.chroma_key(panel, neutral_cleanup=False)))
    if len(frames) > packer.FRAME_COUNT:
        indices = [
            round(index * (len(frames) - 1) / (packer.FRAME_COUNT - 1))
            for index in range(packer.FRAME_COUNT)
        ]
        frames = [frames[index] for index in indices]
    return frames


def split_detroit_grid(packer, path: Path) -> list[Image.Image]:
    with Image.open(path) as source_image:
        source = packer.resize_source_for_runtime(source_image.convert("RGB"))

    rgb = np.asarray(source, dtype=np.uint8)
    dark = rgb.max(axis=2) < 90
    row_dividers = solid_divider_runs(dark.mean(axis=1))
    if not row_dividers:
        return packer.split_sheet(path)

    row_intervals = packer.panel_intervals(source.height, row_dividers)
    frames = []
    for top, bottom in row_intervals:
        column_dividers = solid_divider_runs(dark[top:bottom].mean(axis=0))
        column_intervals = packer.panel_intervals(source.width, column_dividers)
        if len(column_intervals) < 3:
            return packer.split_sheet(path)
        for left, right in column_intervals:
            left += packer.SOURCE_PANEL_GUTTER
            right -= packer.SOURCE_PANEL_GUTTER
            top_inset = top + packer.SOURCE_PANEL_GUTTER
            bottom_inset = bottom - packer.SOURCE_PANEL_GUTTER
            panel = source.crop((left, top_inset, right, bottom_inset))
            frames.append(packer.remove_edge_grid_seams(packer.chroma_key(panel, neutral_cleanup=False)))
    if len(frames) < packer.FRAME_COUNT:
        raise ValueError(f"Detroit grid yielded only {len(frames)} complete panels")
    if len(frames) > packer.FRAME_COUNT:
        indices = [
            round(index * (len(frames) - 1) / (packer.FRAME_COUNT - 1))
            for index in range(packer.FRAME_COUNT)
        ]
        frames = [frames[index] for index in indices]
    return frames


def split_amara_strip(packer, path: Path) -> list[Image.Image]:
    with Image.open(path) as source_image:
        source = packer.resize_source_for_runtime(source_image.convert("RGB"))
    rgb = np.asarray(source, dtype=np.uint8).copy()
    dark = rgb.max(axis=2) < 90

    # Some source strips contain black panel guides through the body. Restore
    # those thin runs from neighboring pixels before separating silhouettes.
    red = rgb[:, :, 0].astype(np.int16)
    green = rgb[:, :, 1].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    background = (
        (green > 72)
        & (np.minimum(green - red, green - blue) > 18)
        & (green > red * 1.08)
        & (green > blue * 1.08)
    )
    foreground = ~background
    segmentation_rgb = rgb.copy()
    render_rgb = rgb.copy()
    horizontal_dividers = packer.panel_divider_runs(dark.mean(axis=1), rgb.shape[0])
    vertical_dividers = packer.panel_divider_runs(dark.mean(axis=0), rgb.shape[1])
    for start, end in horizontal_dividers:
        above = foreground[max(0, start - 8):start].mean(axis=0) > 0.2
        below = foreground[end:min(rgb.shape[0], end + 8)].mean(axis=0) > 0.2
        bridge = foreground[max(0, start - 1)] & foreground[min(rgb.shape[0] - 1, end)]
        crosses_body = float((above & below).mean()) >= 0.025 and bool(bridge.any())
        clear_start = max(0, start - 4)
        clear_end = min(rgb.shape[0], end + 4)
        segmentation_rgb[clear_start:clear_end] = (0, 255, 0)
        if not crosses_body:
            render_rgb[clear_start:clear_end] = (0, 255, 0)
            continue
        before = max(0, clear_start - 1)
        after = min(rgb.shape[0] - 1, clear_end)
        span = clear_end - clear_start + 1
        for offset, y in enumerate(range(clear_start, clear_end), start=1):
            amount = offset / span
            blended = np.clip(
                rgb[before].astype(np.float32) * (1 - amount) + rgb[after].astype(np.float32) * amount,
                0,
                255,
            ).astype(np.uint8)
            render_rgb[y] = np.where(bridge[:, None], blended, np.array((0, 255, 0), dtype=np.uint8))
    for start, end in vertical_dividers:
        left = foreground[:, max(0, start - 8):start].mean(axis=1) > 0.2
        right = foreground[:, end:min(rgb.shape[1], end + 8)].mean(axis=1) > 0.2
        bridge = foreground[:, max(0, start - 1)] & foreground[:, min(rgb.shape[1] - 1, end)]
        crosses_body = float((left & right).mean()) >= 0.025 and bool(bridge.any())
        clear_start = max(0, start - 4)
        clear_end = min(rgb.shape[1], end + 4)
        segmentation_rgb[:, clear_start:clear_end] = (0, 255, 0)
        if not crosses_body:
            render_rgb[:, clear_start:clear_end] = (0, 255, 0)
            continue
        before = max(0, clear_start - 1)
        after = min(rgb.shape[1] - 1, clear_end)
        span = clear_end - clear_start + 1
        for offset, x in enumerate(range(clear_start, clear_end), start=1):
            amount = offset / span
            blended = np.clip(
                rgb[:, before].astype(np.float32) * (1 - amount) + rgb[:, after].astype(np.float32) * amount,
                0,
                255,
            ).astype(np.uint8)
            render_rgb[:, x] = np.where(bridge[:, None], blended, np.array((0, 255, 0), dtype=np.uint8))
    for target in (segmentation_rgb, render_rgb):
        target[:6] = (0, 255, 0)
        target[-6:] = (0, 255, 0)
        target[:, :6] = (0, 255, 0)
        target[:, -6:] = (0, 255, 0)

    segmented = packer.chroma_key(Image.fromarray(segmentation_rgb, "RGB"), neutral_cleanup=False)
    keyed = packer.chroma_key(Image.fromarray(render_rgb, "RGB"), neutral_cleanup=False)
    reduced_size = (
        max(1, segmented.width // packer.COMPONENT_SCALE),
        max(1, segmented.height // packer.COMPONENT_SCALE),
    )
    rendered_alpha = keyed.getchannel("A").resize(reduced_size, Image.Resampling.NEAREST)
    rendered_components = [
        component
        for component in packer.connected_components(np.asarray(rendered_alpha) > 24)
        if component["area"] > 500
        and component["width"] > 12
        and component["height"] > 28
        and component["width"] < rendered_alpha.width * 0.68
    ]
    x_intervals = packer.panel_intervals(keyed.width, vertical_dividers)
    y_intervals = packer.panel_intervals(keyed.height, horizontal_dividers)
    if len(x_intervals) == packer.FRAME_COUNT and len(y_intervals) == 1:
        complete_figures = []
        for left, right in x_intervals:
            candidates = [
                component for component in rendered_components
                if left <= component["center_x"] * packer.COMPONENT_SCALE < right
            ]
            if not candidates:
                break
            complete_figures.append(max(candidates, key=lambda component: component["area"]))
        if len(complete_figures) == packer.FRAME_COUNT:
            padding = 3 * packer.COMPONENT_SCALE
            return [
                packer.remove_edge_grid_seams(keyed.crop((
                    max(0, component["min_x"] * packer.COMPONENT_SCALE - padding),
                    max(0, component["min_y"] * packer.COMPONENT_SCALE - padding),
                    min(keyed.width, (component["max_x"] + 1) * packer.COMPONENT_SCALE + padding),
                    min(keyed.height, (component["max_y"] + 1) * packer.COMPONENT_SCALE + padding),
                )))
                for component in complete_figures
            ]

    reduced_alpha = segmented.getchannel("A").resize(reduced_size, Image.Resampling.NEAREST)
    mask = np.asarray(reduced_alpha) > 24
    components = [
        component
        for component in packer.connected_components(mask)
        if component["area"] > 500
        and component["width"] > 12
        and component["height"] > 28
        and component["width"] < mask.shape[1] * 0.55
    ]
    if len(components) < packer.FRAME_COUNT:
        raise ValueError(f"Amara source yielded only {len(components)} complete figures")
    largest = max(component["area"] for component in components)
    figures = [component for component in components if component["area"] >= largest * 0.28]
    if len(figures) < packer.FRAME_COUNT:
        figures = sorted(components, key=lambda component: component["area"], reverse=True)[:packer.FRAME_COUNT]

    for component in figures:
        component["center_y"] = (component["min_y"] + component["max_y"]) / 2
    overlaps_x = any(
        min(left["max_x"], right["max_x"]) - max(left["min_x"], right["min_x"]) + 1
        >= min(left["width"], right["width"]) * 0.25
        for index, left in enumerate(figures)
        for right in figures[index + 1:]
    )
    if overlaps_x:
        by_y = sorted(figures, key=lambda component: component["center_y"])
        gaps = [right["center_y"] - left["center_y"] for left, right in zip(by_y, by_y[1:])]
        split = gaps.index(max(gaps)) + 1
        ordered = sorted(by_y[:split], key=lambda component: component["center_x"])
        ordered.extend(sorted(by_y[split:], key=lambda component: component["center_x"]))
    else:
        ordered = sorted(figures, key=lambda component: component["center_x"])

    padding = 3 * packer.COMPONENT_SCALE
    frames = []
    for component in ordered:
        left = max(0, component["min_x"] * packer.COMPONENT_SCALE - padding)
        top = max(0, component["min_y"] * packer.COMPONENT_SCALE - padding)
        right = min(keyed.width, (component["max_x"] + 1) * packer.COMPONENT_SCALE + padding)
        bottom = min(keyed.height, (component["max_y"] + 1) * packer.COMPONENT_SCALE + padding)
        frames.append(packer.remove_edge_grid_seams(keyed.crop((left, top, right, bottom))))
    if len(frames) > packer.FRAME_COUNT:
        indices = [
            round(index * (len(frames) - 1) / (packer.FRAME_COUNT - 1))
            for index in range(packer.FRAME_COUNT)
        ]
        frames = [frames[index] for index in indices]
    return frames


def motion_frames(packer, path: Path, label: str) -> list[Image.Image]:
    if label.startswith("MASTER_EZRA/"):
        keyed = split_master_ezra_grid(packer, path)
    elif label.startswith("DETROIT_LENS/"):
        keyed = split_detroit_grid(packer, path)
    elif label.startswith("AMARA_VALENTINE/"):
        keyed = split_amara_strip(packer, path)
    else:
        keyed = packer.split_sheet(path)
    for index, frame in enumerate(keyed, start=1):
        is_amara = label.startswith("AMARA_VALENTINE/")
        packer.validate_transparency(
            frame,
            f"{label}/frame-{index}",
            max_coverage=0.72 if is_amara else 0.55,
            max_rectangularity=0.86 if is_amara else 0.78,
        )
    frames = packer.normalize_frames(keyed)
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


def update_full_preview(packer, character: str, patches: dict[str, list[Image.Image]]) -> None:
    slug = character.lower().replace("_", "-")
    preview_path = PRODUCTION_ROOT / "previews" / f"{slug}-all-motions.webp"
    if not preview_path.exists():
        return
    preview = Image.open(preview_path).convert("RGBA")
    motions = [motion for group in packer.CATEGORIES.values() for motion in group]
    columns = 9
    for motion, frames in patches.items():
        base = motions.index(motion) * 3
        for offset, frame_index in enumerate((0, 2, 5)):
            cursor = base + offset
            x = (cursor % columns) * packer.CELL_SIZE
            y = (cursor // columns) * packer.CELL_SIZE
            preview.paste((22, 22, 24, 255), (x, y, x + packer.CELL_SIZE, y + packer.CELL_SIZE))
            preview.alpha_composite(frames[frame_index], (x, y))
    preview.save(preview_path, "WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", choices=("KALYX", "MASTER_EZRA", "DETROIT_LENS", "AMARA_VALENTINE"), required=True)
    parser.add_argument("--motion", action="append", required=True)
    parser.add_argument("--source", default="higgsfield-v4-body-only")
    parser.add_argument("--generation-provider")
    parser.add_argument("--generation-id")
    args = parser.parse_args()

    packer = load_packer()
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    job_motions = jobs["characters"][args.character]["motions"]
    manifest_character = "DETROIT_LENS_NOIR" if args.character == "DETROIT_LENS" else args.character
    manifest_motions = manifest["characters"][manifest_character]["motions"]
    slug = args.character.lower().replace("_", "-")
    raw_root = PRODUCTION_ROOT / "raw" / slug
    patches = {}

    for motion in dict.fromkeys(args.motion):
        if motion not in job_motions or motion not in manifest_motions:
            raise SystemExit(f"Unknown motion for {args.character}: {motion}")
        raw_path = raw_root / f"{motion.lower()}.png"
        if args.character == "KALYX" and motion in KALYX_AERIAL_MOTIONS:
            counts = packer.source_figure_counts(raw_path)
            valid_grid = counts == [3, 3]
            if not valid_grid:
                raise ValueError(f"{args.character}/{motion} has an invalid pose grid: {counts}")
        patches[motion] = motion_frames(packer, raw_path, f"{args.character}/{motion}")

    atlases = {}
    for motion, frames in patches.items():
        motion_data = manifest_motions[motion]
        sheet_path = ROOT / motion_data["sheet"]
        atlas = atlases.setdefault(sheet_path, Image.open(sheet_path).convert("RGBA"))
        for frame, target in zip(frames, motion_data["frames"], strict=True):
            atlas.paste((0, 0, 0, 0), (target["x"], target["y"], target["x"] + target["w"], target["y"] + target["h"]))
            atlas.alpha_composite(frame, (target["x"], target["y"]))
        motion_data["uniqueFrames"] = len({alpha_hash(frame) for frame in frames})
        motion_data["source"] = args.source
        if args.generation_id:
            motion_data.pop("higgsfieldJobId", None)
            motion_data["generationProvider"] = args.generation_provider or "ChatGPT Image"
            motion_data["generationId"] = args.generation_id
        else:
            motion_data["higgsfieldJobId"] = job_motions[motion]["jobId"]
            motion_data.pop("generationProvider", None)
            motion_data.pop("generationId", None)

    for sheet_path, atlas in atlases.items():
        atlas.save(sheet_path, "WEBP", quality=92, method=6, exact=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    stabilize_manifest(ROOT, MANIFEST_PATH)
    save_preview(args.character, patches)
    update_full_preview(packer, args.character, patches)
    print(f"Patched {len(patches)} motions for {args.character}")


if __name__ == "__main__":
    main()
