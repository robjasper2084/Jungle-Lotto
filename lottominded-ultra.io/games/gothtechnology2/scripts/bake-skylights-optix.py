"""Original outdoor lighting maps, rendered by local Blender Cycles / NVIDIA OptiX.
Run Blender --background --python scripts/bake-skylights-optix.py -- --output <folder>.
Nothing changes the interactive Blender scene or graphics-driver preferences.
"""
import bpy, json, math, sys, time
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
folder=Path(args[args.index('--output')+1]).resolve()
folder.mkdir(parents=True,exist_ok=True)
reports=[]
for name,ground,aerosol in [('detroit-skylight',(0.13,0.14,0.14,1),.6),('elmwood-skylight',(0.095,0.125,0.065,1),.7)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.engine='CYCLES'
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.refresh_devices()
    devices=[d for d in prefs.devices if d.type=='OPTIX']
    if not devices: raise RuntimeError('No NVIDIA OptiX device; refusing an unreported CPU fallback')
    for d in prefs.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU';scene.cycles.samples=64
    scene.cycles.use_denoising=False
    world=bpy.data.worlds.new(name+' procedural daylight');scene.world=world;world.use_nodes=True
    nodes=world.node_tree.nodes;nodes.clear()
    sky=nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING'
    sky.sun_elevation=math.radians(38);sky.sun_rotation=math.radians(140)
    sky.sun_disc=False;sky.altitude=180;sky.air_density=1.1;sky.aerosol_density=aerosol;sky.ozone_density=1.05
    background=nodes.new('ShaderNodeBackground');background.inputs['Strength'].default_value=.3
    output=nodes.new('ShaderNodeOutputWorld')
    world.node_tree.links.new(sky.outputs[0],background.inputs['Color'])
    world.node_tree.links.new(background.outputs[0],output.inputs[0])
    # A broad rough ground plane supplies pavement/grass bounce below the horizon.
    bpy.ops.mesh.primitive_plane_add(size=10000,location=(0,0,0))
    plane=bpy.context.object;plane.name='Original neutral ground bounce'
    material=bpy.data.materials.new('Original ground reflectance');material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=ground;bsdf.inputs['Roughness'].default_value=.95
    plane.data.materials.append(material)
    bpy.ops.object.camera_add(location=(0,0,1.7));camera=bpy.context.object
    camera.data.type='PANO';camera.data.panorama_type='EQUIRECTANGULAR'
    camera.rotation_euler=(math.pi/2,0,0);scene.camera=camera
    scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='HDR';scene.render.filepath=str(folder/(name+'.hdr'))
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
    started=time.perf_counter();bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))
    reports.append({'asset':name,'engine':'Blender Cycles / NVIDIA OptiX','device':[d.name for d in devices],
                    'samples':64,'size':[1024,512],'seconds':round(time.perf_counter()-started,2),
                    'bytes':(folder/(name+'.hdr')).stat().st_size,
                    'provenance':'Original procedural sky and rough ground bounce; no location scan or photograph'})
(folder/'report.json').write_text(json.dumps(reports,indent=2),encoding='utf8')
print('NVIDIA_LIGHTING_COMPLETE',json.dumps(reports))
