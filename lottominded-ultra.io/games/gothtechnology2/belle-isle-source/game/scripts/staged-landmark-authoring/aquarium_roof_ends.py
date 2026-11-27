#!/usr/bin/env python3
"""Close the two demonstrated open roof ends without rewriting existing mesh data.

The authored height/profile remain estimates. This repairs continuity of that
study, not a surveyed or historically verified upper facade. No runtime code,
material, texture, collider, LOD selection or shadow flag is changed here.
"""
import argparse
import copy
import hashlib
import json
import math
import struct
from pathlib import Path

ROOF = 'Roof/PatinatedCopperPanels__copper'
ORIGINALS = {
    'Aquarium_Arched_Entrance_Study.glb': '26447779b20c5bbd2ab1ee6eb3dc1489333722e045400697c40a32cae3c69b93',
    'Aquarium_Arched_Entrance_Study_LOD1.glb': '51d265f0a664ac896c8c23eb50b51f39ff52eeb2adbbc252ed16340c419e3ad9',
    'Aquarium_Arched_Entrance_Study_LOD2.glb': '4295c700ff745bf9c413d78f3e58997f2abc5da22665ee4515bedcd72db3c554',
}


def end_geometry(profile, wall_top, ends):
    """Two outward-wound fans over the existing concave-down roof profile.

    Separate boundary vertices preserve every original roof vertex normal.
    A fan from the bottom-left corner covers each convex 27-point polygon.
    """
    profile = sorted(set(tuple(p) for p in profile))
    if len(profile) != 25 or any(y <= wall_top for _, y in profile):
        raise ValueError('Expected the original 24-segment roof above the wall')
    if len(ends) != 2 or not ends[0] < 0 < ends[1]:
        raise ValueError('Expected the original two longitudinal endpoints')
    if not all(math.isfinite(v) for p in profile for v in p):
        raise ValueError('Non-finite roof profile')
    vertices, faces = [], []
    for z in ends:
        offset = len(vertices)
        vertices.extend([[profile[0][0], wall_top, z], [profile[-1][0], wall_top, z]])
        vertices.extend([[x, y, z] for x, y in reversed(profile)])
        for i in range(1, len(profile) + 1):
            triangle = [offset, offset + i, offset + i + 1]
            faces.append(triangle if z > 0 else [triangle[0], triangle[2], triangle[1]])
    return vertices, faces


def read_glb(raw):
    if struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise ValueError('Invalid GLB header')
    length, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Expected JSON first')
    doc = json.loads(raw[20:20 + length])
    size, kind = struct.unpack_from('<II', raw, 20 + length)
    binary = raw[28 + length:]
    if kind != 0x004E4942 or len(binary) != size or doc['buffers'] != [{'byteLength': size}]:
        raise ValueError('Expected one exact embedded binary buffer')
    return doc, binary


def accessor_bytes(doc, binary, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    columns = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    if a.get('sparse') or a['componentType'] not in (5125, 5126):
        raise ValueError('Unexpected original accessor')
    width = 4 * columns
    if view.get('buffer', 0) != 0 or view.get('byteStride', width) != width:
        raise ValueError('Unexpected original layout')
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    return binary[start:start + a['count'] * width]


def encode_glb(doc, binary):
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
    encoded += b' ' * (-len(encoded) % 4)
    if len(binary) % 4:
        raise ValueError('Binary must remain aligned')
    return (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) +
            struct.pack('<II', len(encoded), 0x4E4F534A) + encoded +
            struct.pack('<II', len(binary), 0x004E4942) + binary)


def append_roof_ends(raw, filename):
    if hashlib.sha256(raw).hexdigest() != ORIGINALS[filename]:
        raise ValueError('Refusing a changed or already-patched original: ' + filename)
    doc, binary = read_glb(raw)
    roof = next(mesh for mesh in doc['meshes'] if mesh['name'] == ROOF)
    if len(roof['primitives']) != 1:
        raise ValueError('Expected the original single copper primitive')
    primitive = roof['primitives'][0]
    if set(primitive['attributes']) != {'POSITION'} or primitive.get('mode', 4) != 4:
        raise ValueError('Unexpected original roof attributes')
    material = doc['materials'][primitive['material']]
    if material['name'] != 'copper' or material['alphaMode'] != 'OPAQUE' or material['doubleSided']:
        raise ValueError('Expected the original opaque, single-sided copper')
    positions = accessor_bytes(doc, binary, primitive['attributes']['POSITION'])
    indices = accessor_bytes(doc, binary, primitive['indices'])
    points = list(struct.iter_unpack('<3f', positions))
    ends = sorted(set(p[2] for p in points))
    profiles = [sorted(set(p[:2] for p in points if p[2] == z)) for z in ends]
    if len(ends) != 2 or profiles[0] != profiles[1] or len(points) != 96 or len(indices) != 144 * 4:
        raise ValueError('Unexpected original roof geometry')
    wall_tops = []
    for mesh in doc['meshes']:
        if mesh['name'].startswith(('Facade/FrontBrickAboveWindows', 'Facade/RearWall', 'Facade/ArchSpandrels')):
            a = mesh['primitives'][0]['attributes']['POSITION']
            wall_tops.append(max(p[1] for p in struct.iter_unpack('<3f', accessor_bytes(doc, binary, a))))
    if not wall_tops or len(set(wall_tops)) != 1:
        raise ValueError('Expected the unchanged common front/rear wall top')
    added_points, added_faces = end_geometry(profiles[0], wall_tops[0], ends)
    combined_points = positions + b''.join(struct.pack('<3f', *p) for p in added_points)
    combined_indices = indices + b''.join(struct.pack('<3I', *(len(points) + i for i in f)) for f in added_faces)
    all_points = list(struct.iter_unpack('<3f', combined_points))
    # Keep the complete original binary buffer, views and accessors as an exact
    # prefix. Only this primitive is redirected to the combined append-only data.
    for key, payload, count, bounds in [
        ('POSITION', combined_points, len(all_points),
         ([min(p[i] for p in all_points) for i in range(3)], [max(p[i] for p in all_points) for i in range(3)])),
        ('indices', combined_indices, len(combined_indices) // 4, ([0], [len(all_points) - 1])),
    ]:
        old_index = primitive['indices'] if key == 'indices' else primitive['attributes'][key]
        a = copy.deepcopy(doc['accessors'][old_index])
        a.update(bufferView=len(doc['bufferViews']), byteOffset=0, count=count, min=bounds[0], max=bounds[1])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(payload)})
        if key == 'indices':
            primitive['indices'] = len(doc['accessors'])
        else:
            primitive['attributes'][key] = len(doc['accessors'])
        doc['accessors'].append(a)
        binary += payload
    doc['buffers'][0]['byteLength'] = len(binary)
    return encode_glb(doc, binary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-assets', type=Path, required=True)
    parser.add_argument('--output-assets', type=Path, required=True)
    args = parser.parse_args()
    if args.source_assets.resolve() == args.output_assets.resolve():
        parser.error('Use a separate output directory; retain the exact original files')
    # Check and generate every input before writing any output.
    outputs = {name: append_roof_ends((args.source_assets / name).read_bytes(), name) for name in ORIGINALS}
    args.output_assets.mkdir(parents=True, exist_ok=True)
    for name, raw in outputs.items():
        (args.output_assets / name).write_bytes(raw)
        print(name, len(raw), hashlib.sha256(raw).hexdigest())


if __name__ == '__main__':
    main()
