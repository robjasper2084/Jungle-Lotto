"""Render exported Jefferson meshes with Blender, preserving model geometry.

Run with Blender 4.3+: blender -b -t 8 --python THIS_FILE -- --scene SCENE.json
This is a model inspection render, not a capture of the game renderer.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--scene', type=Path, required=True)
parser.add_argument('--output', type=Path, help='Defaults to the scene JSON directory')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--view', help='Render one named camera instead of all exported views')
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
args = parser.parse_args(argv)
if args.samples < 1:
    parser.error('--samples must be positive')
output = (args.output or args.scene.parent).resolve()
output.mkdir(parents=True, exist_ok=True)
scene_data = json.loads(args.scene.read_text())
cameras = [c for c in scene_data['cameras'] if not args.view or c['name'] == args.view]
if not cameras:
    parser.error('No exported camera matches --view')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}
for entry in scene_data['meshes']:
    data = entry['material']
    key = data['name']
    if key not in materials:
        material = bpy.data.materials.new(key)
        material.use_nodes = True
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = data['roughness']
        shader.inputs['Metallic'].default_value = data['metalness']
        color = nodes.new('ShaderNodeVertexColor')
        color.layer_name = 'SourceColor'
        multiply = nodes.new('ShaderNodeMixRGB')
        multiply.blend_type = 'MULTIPLY'
        multiply.inputs[0].default_value = 1
        multiply.inputs[1].default_value = (*data['color'], 1)
        material.node_tree.links.new(color.outputs['Color'], multiply.inputs[2])
        material.node_tree.links.new(multiply.outputs[0], shader.inputs['Base Color'])
        if data.get('emission'):
            material.node_tree.links.new(multiply.outputs[0], shader.inputs['Emission Color'])
            shader.inputs['Emission Strength'].default_value = .6
        materials[key] = material
    positions = entry['positions']
    vertices = list(zip(positions[::3], positions[1::3], positions[2::3]))
    indices = entry['indices'] if entry['indices'] is not None else list(range(len(vertices)))
    faces = list(zip(indices[::3], indices[1::3], indices[2::3]))
    mesh = bpy.data.meshes.new(entry['name'])
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(materials[key])
    obj = bpy.data.objects.new(entry['name'], mesh)
    bpy.context.collection.objects.link(obj)
    colors = mesh.color_attributes.new(name='SourceColor', type='FLOAT_COLOR', domain='POINT')
    colors.data.foreach_set('color', entry['colors'])
    if entry.get('uv'):
        uv = mesh.uv_layers.new(name='SourceUV')
        source = entry['uv']
        uv.data.foreach_set('uv', [v for loop in mesh.loops for v in source[loop.vertex_index * 2:loop.vertex_index * 2 + 2]])

# Neutral staging ground and lighting. Exported buildings and fixtures are not
# reshaped; the game shader patches and surrounding city are not reproduced.
bpy.ops.mesh.primitive_plane_add(size=1200, location=(0, 0, 1.87))
ground = bpy.context.object
ground.name = 'Preview ground context'
material = bpy.data.materials.new('Preview ground')
material.use_nodes = True
material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.22, .26, .20, 1)
material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .95
ground.data.materials.append(material)
bpy.ops.object.light_add(type='SUN', location=(40, -60, 120))
sun = bpy.context.object
sun.rotation_euler = tuple(math.radians(v) for v in (24, -30, -25))
sun.data.energy = 2.4
sun.data.angle = math.radians(8)
scene = bpy.context.scene
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.63, .73, .88, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .55
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False  # Works on Blender builds without OIDN.
scene.cycles.max_bounces = 3
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transparent_max_bounces = 2
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .3
bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
for config in cameras:
    camera.location = config['position']
    camera.rotation_euler = (Vector(config['target']) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = config['lens']
    camera.data.clip_end = 2000
    scene.render.filepath = str(output / (config['name'] + '-raw.png'))
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output / (args.scene.stem.removesuffix('-scene') + '-model-preview.blend')))
