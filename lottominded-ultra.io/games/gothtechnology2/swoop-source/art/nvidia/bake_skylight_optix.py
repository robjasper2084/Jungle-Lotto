"""Portable outdoor reflection lighting, authored locally using NVIDIA OptiX."""
import bpy, json, math, time
from pathlib import Path
folder=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.refresh_devices()
devices=[d for d in prefs.devices if d.type=='OPTIX']
if not devices: raise RuntimeError('NVIDIA OptiX GPU unavailable')
for d in prefs.devices:d.use=d.type=='OPTIX'
scene.cycles.device='GPU';scene.cycles.samples=64
world=bpy.data.worlds.new('Detroit outdoor skylight');scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;nodes.clear()
sky=nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING'
sky.sun_elevation=math.radians(38);sky.sun_rotation=math.radians(140)
sky.sun_disc=False;sky.altitude=180;sky.air_density=1.1;sky.aerosol_density=.75;sky.ozone_density=1.05
background=nodes.new('ShaderNodeBackground');background.inputs['Strength'].default_value=.3
output=nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(sky.outputs[0],background.inputs['Color']);world.node_tree.links.new(background.outputs[0],output.inputs[0])
bpy.ops.object.camera_add(location=(0,0,1.7));camera=bpy.context.object
camera.data.type='PANO';camera.data.panorama_type='EQUIRECTANGULAR';camera.rotation_euler=(math.pi/2,0,0);scene.camera=camera
scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='HDR';scene.render.filepath=str(folder/'detroit-skylight.hdr')
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
started=time.perf_counter();bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'Detroit_Skylight_OptiX.blend'))
report={'tool':'Blender Cycles / NVIDIA OptiX','gpu':[d.name for d in devices],'size':[1024,512],'samples':64,'seconds':round(time.perf_counter()-started,2),'bytes':(folder/'detroit-skylight.hdr').stat().st_size,'note':'Original procedural outdoor environment; no photogrammetry or real-world scan claim'}
(folder/'skylight-report.json').write_text(json.dumps(report,indent=2));print('OPTIX_SKYLIGHT_COMPLETE',json.dumps(report))
