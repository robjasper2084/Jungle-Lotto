from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SEED_OUTPUT = ROOT / "assets" / "sprite-production" / "seeds"
SOURCES = {
    "kalyx": ROOT / "assets" / "approved-poses" / "kalyx-idle-ready.webp",
    "ezra": ROOT / "assets" / "approved-poses" / "ezra-idle-ready.webp",
}


def main() -> None:
    SEED_OUTPUT.mkdir(parents=True, exist_ok=True)
    for character, source_path in SOURCES.items():
        with Image.open(source_path).convert("RGBA") as source:
            idle = source.crop((0, 0, 384, 384))
            idle_path = SEED_OUTPUT / f"{character}-approved-idle.png"
            idle.save(idle_path, optimize=True)

            generator_seed = Image.new("RGBA", idle.size, (224, 224, 224, 255))
            generator_seed.alpha_composite(idle)
            generator_path = SEED_OUTPUT / f"{character}-approved-idle-generator.png"
            generator_seed.convert("RGB").save(generator_path, optimize=True)

            print(f"wrote {idle_path}")
            print(f"wrote {generator_path}")


if __name__ == "__main__":
    main()
