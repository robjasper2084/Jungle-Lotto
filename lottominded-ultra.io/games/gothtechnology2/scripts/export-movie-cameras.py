"""Optimize the authored Higgsfield camera shells without changing grip or recoil motion."""
import bpy, json
from pathlib import Path
PACK = Path(__file__).resolve().parents[1]
ART = PACK / 'swoop-source/art/movie-cameras-20261018'
SOURCE = ART / 'Higgsfield_Cinema_Weapons.blend'
report = []
for kind in ['static', 'heart', 'bass']:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    root = bpy.data.objects['PRP_' + kind]
    objects = [root, *root.children_recursive]
    # Merge same-parent static mesh parts. Materials remain distinct glTF primitives;
    # moving recoil nodes, grips and attachments retain their authored transforms.
    for parent in [o for o in objects if o.type == 'EMPTY']:
        meshes = [o for o in parent.children if o.type == 'MESH' and not o.animation_data]
        if len(meshes) < 2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes: obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    objects = [root, *root.children_recursive]
    action = bpy.data.actions['Fire_' + kind]
    animated = next(o for o in objects if o.animation_data and o.animation_data.action == action)
    slot = animated.animation_data.action_slot
    animated.animation_data_clear()
    animated.animation_data_create()
    track = animated.animation_data.nla_tracks.new()
    track.name = 'Fire_' + kind
    strip = track.strips.new(track.name, int(action.frame_range[0]), action)
    strip.action_slot = slot
    strip.extrapolation = 'HOLD'
    root.location = (0, 0, 0)
    scene = bpy.context.scene
    scene.frame_start = int(action.frame_range[0])
    scene.frame_end = int(action.frame_range[1])
    scene.render.fps = 30
    scene.frame_set(scene.frame_start)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    out = PACK / ('swoop-source/public/exports/polish/royale-equipment/' + kind + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_frame_range=True, export_cameras=False, export_lights=False, export_yup=True)
    report.append({'weapon':kind,'bytes':out.stat().st_size,'action':track.name})
(ART / 'provenance.json').write_text(json.dumps({'higgsfieldProject':'eb66baf3-02f8-4fb3-a901-fce871398078',
    'revision':4,'operation':'movie-camera-shells-20261018-v1','exports':report}, indent=2))
print('CAMERA_EXPORTS', json.dumps(report))
