"""Add explicit work-in-progress/model-preview labels to Blender review renders."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--scene', type=Path, required=True)
parser.add_argument('--output', type=Path, help='Render directory; defaults to the scene JSON directory')
parser.add_argument('--font-dir', type=Path, help='Optional directory containing DejaVuSans.ttf and DejaVuSans-Bold.ttf')
args = parser.parse_args()
output = args.output or args.scene.parent

def font(size, bold=False):
    filename = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    return ImageFont.truetype(str(args.font_dir / filename) if args.font_dir else filename, size)

count = 0
for config in json.loads(args.scene.read_text())['cameras']:
    source = output / (config['name'] + '-raw.png')
    if not source.exists():
        continue
    picture = Image.open(source).convert('RGB')
    draw = ImageDraw.Draw(picture)
    draw.rectangle((0, 0, picture.width, 82), fill='#17232d')
    draw.rectangle((0, 0, 8, 82), fill='#e6b852')
    draw.text((28, 13), 'WORK IN PROGRESS · 3D MODEL PREVIEW', font=font(15, True), fill='#e6c574')
    draw.text((28, 39), config['title'], font=font(23, True), fill='#ffffff')
    draw.rectangle((0, picture.height - 58, picture.width, picture.height), fill='#17232d')
    draw.text((28, picture.height - 46), 'Blender preview; game lighting and surroundings still under review', font=font(17), fill='#f0f3f4')
    draw.text((28, picture.height - 22), 'Actual current game meshes + mapped road locations · Original modeled facades and signal fixtures', font=font(13), fill='#b9c5cc')
    target = output / (config['name'] + '.jpg')
    picture.save(target, quality=94)
    print(target.resolve())
    count += 1
if not count:
    parser.error('No rendered camera images found; run the Blender renderer first')
