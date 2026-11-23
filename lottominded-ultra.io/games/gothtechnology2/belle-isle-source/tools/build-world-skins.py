"""Prepare Higgsfield images in Blender; encode bounded WebP runtime maps.

Run from game/: blender -b --factory-startup --python ../tools/build-world-skins.py
Requires downloaded sources in output/world-skins/raw and ffmpeg on PATH.
These are artistic detail maps, not measured/scanned PBR data.
"""
import bpy
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
import numpy as np

SOURCE = Path(__file__).resolve().parents[1]
GAME = SOURCE / 'game'
WORK = GAME / 'output/world-skins'
RUNTIME = GAME / 'public/belle/skins'
PREVIOUS = WORK / 'previous'
STAGING = WORK / 'prepared'
PLAN = json.loads((SOURCE / 'art/higgsfield-world-skins-plan.json').read_text())
RECORDS = json.loads((WORK / 'source-files.json').read_text())
FFMPEG = shutil.which('ffmpeg')
if not FFMPEG:
    raise RuntimeError('ffmpeg with libwebp is required')
for folder in (PREVIOUS, STAGING):
    folder.mkdir(parents=True, exist_ok=True)
for old in RUNTIME.iterdir():
    if old.is_file() and not (PREVIOUS / old.name).exists():
        shutil.copy2(old, PREVIOUS / old.name)


def pixels(path, size, data=False):
    image = bpy.data.images.load(str(path), check_existing=False)
    if data:
        image.colorspace_settings.name = 'Non-Color'
    image.scale(size, size)
    values = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(values)
    bpy.data.images.remove(image)
    return values.reshape(size, size, 4)[:, :, :3].copy()


def tile_edges(values, width=24):
    # Blend opposing edges into the same boundary without moving the interior.
    result = values.copy()
    for axis in (0, 1):
        v = np.swapaxes(result, 0, axis)
        for i in range(width):
            weight = (1 - i / width) ** 2
            a, b = v[i].copy(), v[-1-i].copy()
            average = (a + b) * .5
            v[i] = a * (1-weight) + average * weight
            v[-1-i] = b * (1-weight) + average * weight
    return result


def save_png(values, path, data=False):
    height, width = values.shape[:2]
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=False)
    image.colorspace_settings.name = 'Non-Color' if data else 'sRGB'
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(values, 0, 1)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(path)
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)


def encode(path, name, data=False):
    target = RUNTIME / (name + '.webp')
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(path),
                    '-c:v', 'libwebp', '-lossless', '1' if data else '0',
                    '-quality', '85', '-compression_level', '6', str(target)], check=True)
    return {'file': target.name, 'bytes': target.stat().st_size,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}


def down2(values):
    return (values[::2, ::2] + values[1::2, ::2] + values[::2, 1::2] + values[1::2, 1::2]) * .25


outputs, adjustments, swatches = [], {}, []
for item in PLAN['materials']:
    name = item['name']
    raw = WORK / 'raw' / (name + '.png')
    record = next(r for r in RECORDS if r['name'] == name)
    if hashlib.sha256(raw.read_bytes()).hexdigest() != record['sha256']:
        raise RuntimeError('Source checksum mismatch: ' + name)
    color = pixels(raw, 1024, data=name == 'water')
    if name == 'water':
        h = down2(color).mean(axis=2)
        h = tile_edges(h, 12)
        dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 2.5
        dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 2.5
        normal = np.stack((-dx, -dy, np.ones_like(h)), axis=2)
        normal /= np.linalg.norm(normal, axis=2, keepdims=True)
        normal = tile_edges(normal, 4)
        normal /= np.linalg.norm(normal, axis=2, keepdims=True)
        normal = normal * .5 + .5
        path = STAGING / 'water-normal.png'
        save_png(normal, path, data=True)
        outputs.append(encode(path, 'water-normal', data=True))
        swatches.append(np.repeat(np.repeat(normal, 2, axis=0), 2, axis=1))
        print('Prepared water normal', flush=True)
        continue
    # Match the previous material library's average pigment to preserve scene grading.
    previous = pixels(PREVIOUS / (name + '-color.webp'), 128)
    gain = np.clip(previous.mean(axis=(0, 1)) / np.maximum(.01, color.mean(axis=(0, 1))), .4, 2.5)
    color = tile_edges(np.clip(color * gain, 0, 1))
    adjustments[name] = [round(float(x), 5) for x in gain]
    path = STAGING / (name + '-color.png')
    save_png(color, path)
    outputs.append(encode(path, name + '-color'))
    small = down2(color)
    luma = small @ np.array([.2126, .7152, .0722], dtype=np.float32)
    height = np.clip(.5 + (luma - luma.mean()) / max(.02, float(luma.std())) * .11, .12, .88)
    detail = tile_edges(np.stack((.5 + (.5-height)*.7, height, np.zeros_like(height)), axis=2), 12)
    path = STAGING / (name + '-detail.png')
    save_png(detail, path, data=True)
    outputs.append(encode(path, name + '-detail', data=True))
    swatches.append(color)
    print('Prepared ' + name, flush=True)

# Technical contact sheet in plan order, six columns; row zero starts at the top.
sheet = np.full((5*256, 6*256, 3), .04, dtype=np.float32)
for i, swatch in enumerate(swatches):
    row, column = divmod(i, 6)
    reduced = down2(down2(swatch))
    sheet[(4-row)*256:(5-row)*256, column*256:(column+1)*256] = reduced
save_png(sheet, WORK / 'contact-sheet.png')

# Pack compressed maps into a portable, editable Blender material library.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for index, item in enumerate(PLAN['materials']):
    name = item['name']
    material = bpy.data.materials.new('Higgsfield / ' + name)
    material.use_nodes = True
    material.use_fake_user = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(RUNTIME / (name+'-color.webp' if name != 'water' else 'water-normal.webp')))
    tex.image.pack()
    if name == 'water':
        tex.image.colorspace_settings.name = 'Non-Color'
        normal = nodes.new('ShaderNodeNormalMap')
        links.new(tex.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
        bsdf.inputs['Base Color'].default_value = (.035, .16, .18, 1)
        bsdf.inputs['Roughness'].default_value = .12
    else:
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        detail = nodes.new('ShaderNodeTexImage')
        detail.image = bpy.data.images.load(str(RUNTIME / (name + '-detail.webp')))
        detail.image.colorspace_settings.name = 'Non-Color'
        detail.image.pack()
        split = nodes.new('ShaderNodeSeparateColor')
        links.new(detail.outputs['Color'], split.inputs['Color'])
        links.new(split.outputs['Red'], bsdf.inputs['Roughness'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = .015
        links.new(split.outputs['Green'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bpy.ops.mesh.primitive_plane_add(size=1.8, location=((index % 6)*2.1, -(index//6)*2.35, 0))
    swatch = bpy.context.object
    swatch.name = 'Swatch / ' + name
    swatch.data.materials.append(material)
    bpy.ops.object.text_add(location=(index%6*2.1-.9, -(index//6)*2.35-1.15, .01))
    label = bpy.context.object
    label.data.body = name.upper()
    label.data.size = .17
    label.name = 'Label / ' + name
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'art/world-skins.blend'))
report = {'provider': 'Higgsfield', 'model': 'gpt_image_2_6', 'quotedCredits': 29,
          'approvedCeiling': 500, 'sourceCount': len(RECORDS), 'runtimeCount': len(outputs),
          'colorDimensions': [1024, 1024], 'detailDimensions': [512, 512],
          'waterDimensions': [512, 512], 'previousBytes': sum(p.stat().st_size for p in PREVIOUS.glob('*.webp')),
          'runtimeBytes': sum(r['bytes'] for r in outputs), 'pigmentGains': adjustments,
          'processing': 'Blender resampling, bounded mean-pigment matching, opposite-edge blending; authored roughness and luminance-derived microheight. Water normal from wrapped height derivatives. FFmpeg WebP color quality 85; lossless data maps. No geometry changes or measured PBR claims.',
          'sources': RECORDS, 'outputs': outputs}
(WORK / 'preparation.json').write_text(json.dumps(report, indent=2), encoding='utf-8', newline='\n')
previous_provenance = json.loads((PREVIOUS / 'PROVENANCE.json').read_text())
previous_provenance['worldRefresh20261114'] = report
(RUNTIME / 'PROVENANCE.json').write_text(json.dumps(previous_provenance, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({k: report[k] for k in ['sourceCount', 'runtimeCount', 'previousBytes', 'runtimeBytes']}), flush=True)
