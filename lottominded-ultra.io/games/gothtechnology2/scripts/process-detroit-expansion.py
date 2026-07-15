import importlib.util
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "assets" / "sprite-production" / "higgsfield-v2" / "expansion-sources"
STAGE_ROOT = ROOT / "assets" / "user-stage"
EFFECT_ROOT = ROOT / "assets" / "user-effects"


def load_packer():
    path = ROOT / "scripts" / "pack-higgsfield-v2.py"
    spec = importlib.util.spec_from_file_location("higgsfield_packer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def process_stage(source_name: str, output_name: str) -> None:
    STAGE_ROOT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE_ROOT / source_name) as source:
        frame = ImageOps.fit(source.convert("RGB"), (1600, 900), method=Image.Resampling.LANCZOS)
        frame.save(STAGE_ROOT / output_name, "WEBP", quality=88, method=6)


def process_tablet() -> None:
    packer = load_packer()
    EFFECT_ROOT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE_ROOT / "detroit-lens-tablet.png") as source:
        keyed = packer.chroma_key(source.convert("RGB"))
    alpha = keyed.getchannel("A")
    if alpha.getbbox() is None:
        raise ValueError("DETROIT_LENS/tablet contains no foreground")
    corners = ((0, 0), (keyed.width - 1, 0), (0, keyed.height - 1), (keyed.width - 1, keyed.height - 1))
    if any(alpha.getpixel(point) > 24 for point in corners):
        raise ValueError("DETROIT_LENS/tablet retained its source background")
    box = packer.alpha_bbox(keyed)
    prop = keyed.crop(box)
    scale = min(456 / prop.width, 456 / prop.height)
    prop = prop.resize(
        (max(1, round(prop.width * scale)), max(1, round(prop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(prop, ((512 - prop.width) // 2, (512 - prop.height) // 2))
    canvas.save(EFFECT_ROOT / "detroit-lens-tablet.webp", "WEBP", quality=94, method=6, exact=True)


def main() -> None:
    process_tablet()
    process_stage("detroit-midnight-mile.png", "detroit-midnight-mile.webp")
    process_stage("motor-city-assembly.png", "motor-city-assembly.webp")
    print("Processed Detroit Lens tablet and two 1600x900 stages")


if __name__ == "__main__":
    main()
