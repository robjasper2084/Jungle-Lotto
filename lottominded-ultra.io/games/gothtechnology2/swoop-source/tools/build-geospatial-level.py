"""Build an editable metre-scale Blender scene from the game's exact geometry."""
import bpy,json,math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'art/geospatial/runtime-geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['origin_GPS']=data['origin']['gps'];scene['origin_landmark']=data['origin']['name']
scene['elevation_note']='Origin floor = 120.55 ft City of Detroit datum in historical 2013 design; estimates are documented in placements.json.'
colors={'terrain':(.18,.24,.12,1),'deck':(.38,.37,.34,1),'abutment':(.33,.32,.29,1),'wall':(.48,.46,.41,1),'building':(.39,.35,.31,1),'path':(.06,.07,.07,1),'ramp':(.13,.15,.15,1)}
colors.update({'beam':(.31,.31,.29,1),'parapet':(.45,.44,.41,1),'approach':(.38,.37,.34,1),'roadway':(.08,.09,.095,1),'sidewalk':(.48,.47,.44,1),'metal':(.09,.14,.15,1)})
collections={};materials={}
for kind,color in colors.items():
    coll=bpy.data.collections.new(kind.title());scene.collection.children.link(coll);collections[kind]=coll
    mat=bpy.data.materials.new(kind.title());mat.diffuse_color=color;mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;materials[kind]=mat
for item in data['items']:
    p=item['vertices'];idx=item['indices'];mesh=bpy.data.meshes.new(item['name'])
    mesh.from_pydata([(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)]);mesh.update()
    obj=bpy.data.objects.new(item['name'],mesh);collections[item['kind']].objects.link(obj);obj.data.materials.append(materials[item['kind']]);obj['source']=item['source'];obj['geospatial_origin']=data['origin']['name']
origin=bpy.data.objects.new('ORIGIN - Gratiot trail center',None);scene.collection.objects.link(origin);origin.empty_display_type='ARROWS';origin.empty_display_size=10;origin['GPS']=data['origin']['gps']
# Top-down inspection camera follows geographic north (the local game axes are rotated).
corners=[obj.matrix_world@Vector(v) for obj in scene.objects if obj.type=='MESH' for v in obj.bound_box]
east=[.5*p.x+.8660254*p.y for p in corners];north=[-.8660254*p.x+.5*p.y for p in corners]
ce,cn=(min(east)+max(east))/2,(min(north)+max(north))/2
bpy.ops.object.camera_add(location=(.5*ce-.8660254*cn,.8660254*ce+.5*cn,1800));camera=bpy.context.object;camera.name='Map audit camera';camera.rotation_euler=(0,0,math.radians(60));camera.data.type='ORTHO';camera.data.ortho_scale=max(max(east)-min(east),max(north)-min(north))*1.08;scene.camera=camera
bpy.ops.object.light_add(type='SUN',location=(100,100,400));bpy.context.object.rotation_euler=(.4,-.3,.2);bpy.context.object.data.energy=3
camera.data.clip_end=5000
scene.world.color=(.5,.5,.5)
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.background_type='WORLD';scene.world.color=(.035,.055,.06)
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'art/geospatial/blender-overview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.clip_end=10000
        area.spaces.active.region_3d.view_distance=1800
        area.spaces.active.region_3d.view_location=(0,250,0)
target=ROOT/'art/blender/DS_Dequindre_Geospatial_Level.blend';target.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(target))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type=='MESH':obj.select_set(True)
export=ROOT/'public/exports/geospatial/DS_Dequindre_Geospatial_Level.glb';export.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_extras=True)
fbx=ROOT/'art/fbx/DS_Dequindre_Geospatial_Level.fbx';fbx.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.fbx(filepath=str(fbx),use_selection=True,object_types={'MESH'},apply_unit_scale=True,axis_forward='-Z',axis_up='Y',bake_anim=False)
print('GEOSPATIAL_EXPORT_COMPLETE',target,export,fbx)
