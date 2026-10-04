"""Bake a portable occlusion atlas using Blender's NVIDIA OptiX backend."""
import bpy, json, time
from pathlib import Path
from mathutils import Vector

folder=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(folder/'DS_Armored_Rider_01.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'
preferences=bpy.context.preferences.addons['cycles'].preferences
preferences.compute_device_type='OPTIX'
preferences.refresh_devices()
gpu=[d for d in preferences.devices if d.type=='OPTIX']
if not gpu: raise RuntimeError('No NVIDIA OptiX device available; no fallback bake was performed')
for device in preferences.devices: device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.cycles.samples=32
scene.render.bake.margin=8
arm=next(o for o in scene.objects if o.type=='ARMATURE')
root=arm.parent
meshes=[o for o in scene.objects if o.type=='MESH']
base=next(o for o in meshes if o.name.startswith('Armored Rider / fitted'))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=base
bpy.ops.object.join();base.name='Armored_Rider_Surface'
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008)
bpy.ops.object.mode_set(mode='OBJECT')
atlas=bpy.data.images.new('Night Sentinel / OptiX occlusion',width=1024,height=1024,alpha=False)
atlas.colorspace_settings.name='Non-Color'
for mat in base.data.materials:
    nodes=mat.node_tree.nodes
    bake=nodes.new('ShaderNodeTexImage');bake.image=atlas;bake.label='NVIDIA OptiX baked occlusion'
    nodes.active=bake
started=time.perf_counter()
bpy.ops.object.bake(type='AO')
elapsed=time.perf_counter()-started
atlas.filepath_raw=str(folder/'night-sentinel-occlusion.png');atlas.file_format='PNG';atlas.save();atlas.pack()
group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
for mat in base.data.materials:
    nodes=mat.node_tree.nodes
    tex=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image==atlas)
    output=nodes.new('ShaderNodeGroup');output.node_tree=group
    mat.node_tree.links.new(tex.outputs['Color'],output.inputs['Occlusion'])
base['baked_detail']='1024px NVIDIA OptiX ambient occlusion; no extra runtime geometry'
bpy.ops.object.select_all(action='DESELECT');base.select_set(True);arm.select_set(True);root.select_set(True)
out=folder.parents[1]/'public/exports/glb/DS_Armored_Rider_01/DS_Armored_Rider_01_LOD1.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'DS_Armored_Rider_01_Runtime.blend'))

# GPU render of the same exported model with a neutral studio background.
scene.render.resolution_x=1080;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
if not scene.world: scene.world=bpy.data.worlds.new('OptiX rider preview studio')
scene.world.color=(.12,.12,.12)
for loc,power,size in [((3,-4,5),550,4),((-3,-2,3),280,3),((1,3,4),650,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object
    light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=2.22
camera.location=(-2.8,5,2.3);camera.rotation_euler=(Vector((0,0,.96))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/'optix-rear-preview.png');bpy.ops.render.render(write_still=True)
report={'backend':'NVIDIA OptiX','devices':[d.name for d in gpu],'ao_resolution':1024,'samples':32,'bake_seconds':round(elapsed,2),'glb_bytes':out.stat().st_size,'bones':len(arm.data.bones)}
(folder/'nvidia-bake-report.json').write_text(json.dumps(report,indent=2))
print('OPTIX_RIDER_COMPLETE',json.dumps(report))
