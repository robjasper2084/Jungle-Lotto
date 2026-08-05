from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "assets" / "art"


def crop_atlas() -> None:
    image = Image.open(ROOT / "board-pieces-atlas.png").convert("RGBA")
    if image.size != (1536, 1024):
        raise ValueError(f"Unexpected board atlas size: {image.size}")

    for directory in ("tokens", "gateways", "ventures"):
        (ROOT / directory).mkdir(exist_ok=True)

    for index in range(6):
        image.crop((index * 256, 0, (index + 1) * 256, 256)).save(
            ROOT / "tokens" / f"token-{index + 1:02d}.png"
        )

    for index in range(6):
        image.crop((index * 256, 256, (index + 1) * 256, 512)).save(
            ROOT / "gateways" / f"gateway-{index + 1:02d}.png"
        )
    for index in range(2):
        image.crop((index * 256, 512, (index + 1) * 256, 768)).save(
            ROOT / "gateways" / f"gateway-{index + 7:02d}.png"
        )

    for index in range(4):
        x = (index + 2) * 256
        image.crop((x, 512, x + 256, 768)).save(
            ROOT / "ventures" / f"venture-level-{index + 1}.png"
        )

    image.crop((512, 704, 1024, 1024)).save(ROOT / "guardian-vault.png")


if __name__ == "__main__":
    crop_atlas()
    print("Wrote 19 transparent board-art crops.")
