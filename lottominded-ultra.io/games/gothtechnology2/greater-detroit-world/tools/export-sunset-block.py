"""Run in Blender background mode with Street at Sunset.blend open and the output directory after --."""
import bpy, sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[sys.argv.index('--')+1])
out.mkdir(parents=True, exist_ok=True)
names = ('building', 'building2', 'building4', 'building5')
objects = [bpy.data.objects[name] for name in names]
# Keep their UVs, pivots, and assigned image materials. Translate and scale each
# to a common centred, ground-level unit box for fitting to measured footprints.
for index, obj in enumerate(objects):
    mesh = obj.data.copy()
    world = obj.matrix_world.copy()
    points = [world @ vertex.co for vertex in mesh.vertices]
    lo = Vector(map(min, zip(*points)))
    hi = Vector(map(max, zip(*points)))
    span = hi-lo
    for v, p in zip(mesh.vertices, points):
        v.co = ((p.x-lo.x)/span.x-.5, (p.y-lo.y)/span.y-.5, (p.z-lo.z)/span.z)
    obj.data = mesh
    obj.parent = None
    obj.matrix_world.identity()
    from mathutils import Matrix
    obj.matrix_world = Matrix.Identity(4)
    obj.name = 'SunsetBlock'+str(index+1)
    print(obj.name, tuple(span), flush=True)
for img in bpy.data.images:
    if img.packed_file and img.has_data and max(img.size)>512:
        size = list(img.size)
        img.scale(*(max(1,round(v*512/max(size))) for v in size))
# Clear auto-render alpha from the original scene; camera and lighting belong to the game.
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(out/'street-at-sunset.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=76,export_yup=True)
