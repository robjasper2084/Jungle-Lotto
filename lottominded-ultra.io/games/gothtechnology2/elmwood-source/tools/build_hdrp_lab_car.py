"""Convert the user's HDRP Lab coupe to a black, parked browser asset.

Keeps the licensed source mesh, reconstructs portable PBR materials from the
publisher's prefab assignments, and removes hidden interior detail. No Unity
scripts or HDRP shaders are executed or shipped to the browser.
"""
import bpy, bmesh, json, math
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/elmwood/hdrp-lab-car'
PUB=ROOT/'public/elmwood/models'
bpy.ops.wm.open_mainfile(filepath=str(ART/'source-import.blend'))
bpy.context.preferences.filepaths.save_version=0
mapping=json.loads((ART/'material-mapping.json').read_text())

def material(name, color, roughness, metal=0, coat=0, emission=0):
    m=bpy.data.materials.new('HDRPLab_'+name);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1)
    b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=roughness
    b.inputs['Coat Weight'].default_value=coat;b.inputs['Coat Roughness'].default_value=.14
    b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1)
    return m

mats={
 'paint':material('ObsidianBlackPaint',(.004,.005,.007),.3,.35,.4),
 'glass':material('SmokedGlass',(.018,.033,.043),.12,.45,.9),
 'rubber':material('TireRubber',(.012,.014,.017),.88),
 'trim':material('BlackTrim',(.022,.025,.028),.44,.35),
 'chrome':material('SatinAlloy',(.3,.33,.36),.25,.95),
 'darkmetal':material('GraphiteAlloy',(.055,.063,.075),.3,.85),
 'interior':material('CharcoalInterior',(.018,.019,.021),.87),
 'red':material('RedTailLens',(.3,.009,.012),.22,.25,.7,.12),
 'light':material('HeadlampLens',(.62,.71,.78),.18,.4,.6,.15),
}
def choose(name):
    source=' '.join(mapping.get(name,[]))
    if name.startswith(('Lab_Int','Lab_Door')):return 'interior'
    if 'Wheels' in name:return 'rubber' if name.endswith('_04') else 'darkmetal'
    if 'Rear_Lights' in name or 'Rear_Bumper_Red' in name:return 'red'
    if 'Head_Lights' in name:return 'light' if any(x in name for x in ('03','04','05','06','07')) else 'chrome'
    if 'Window' in name and 'Rubber' not in name:return 'glass'
    if 'Mirror' in source:return 'chrome'
    if 'Glass' in source:return 'glass'
    if 'Pearl' in source:return 'paint'
    if 'Chrome' in source and 'Black' not in source:return 'chrome'
    if 'Metal' in source:return 'darkmetal'
    return 'trim'

original=0;kept=[]
for o in list(bpy.context.scene.objects):
    if o.type!='MESH':continue
    count=sum(len(p.vertices)-2 for p in o.data.polygons);original+=count
    # Closed hood, doors, trunk and opaque smoked windows hide these components.
    if o.name.startswith(('Lab_Int','Lab_Door','Lab_Engine')):
        bpy.data.objects.remove(o,do_unlink=True);continue
    # Publisher FBX stores body/rim vertices in centimetre car space. Animated
    # opening pivots in the FBX rest hierarchy are not the closed Unity prefab.
    # Only the tyre meshes use local wheel coordinates and need their pivot.
    world=o.matrix_world.copy() if 'Wheels' in o.name and o.name.endswith('_04') else Matrix.Scale(.01,4)
    o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(world)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003);bm.to_mesh(o.data);bm.free()
    kind=choose(o.name);o.data.materials.clear();o.data.materials.append(mats[kind])
    for p in o.data.polygons:p.material_index=0;p.use_smooth=True
    budget=32000 if o.name=='Lab_Body_Kit' else 7500 if kind=='paint' else 2500 if 'Wheels' in o.name else 1800
    if count>budget:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Browser silhouette budget','DECIMATE');mod.ratio=budget/count
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
    bpy.context.view_layer.objects.active=o
    normal=o.modifiers.new('Area weighted panel normals','WEIGHTED_NORMAL');normal.keep_sharp=True;normal.weight=50
    bpy.ops.object.modifier_apply(modifier=normal.name)
    kept.append(o)
# The publisher's prefab reuses the two left wheel meshes for the right side.
for o in list(kept):
    if 'Wheels_FL' in o.name or 'Wheels_RL' in o.name:
        copy=o.copy();copy.data=o.data.copy();copy.name=o.name.replace('_FL','_FR').replace('_RL','_RR')
        bpy.context.collection.objects.link(copy);copy.data.transform(Matrix.Diagonal((-1,1,1,1)))
        copy.data.flip_normals();kept.append(copy)
for o in list(bpy.context.scene.objects):
    if o not in kept:bpy.data.objects.remove(o,do_unlink=True)
points=[v.co for o in kept for v in o.data.vertices]
lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points)for i in range(3)]
offset=Vector((-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]))
# glTF Y-up export maps the FBX nose (-Y in Blender) to runtime +Z.
for o in kept:
    o.data.transform(Matrix.Translation(offset))
# Merge by portable material: nine draw calls rather than 109 objects per car.
for kind,mat in mats.items():
    group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='HDRPLab_'+kind
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.update()
dims=[hi[i]-lo[i]for i in range(3)]
assert 1.8<dims[0]<2.2 and 4.5<dims[1]<5.1 and 1.3<dims[2]<1.6, dims
tri=lambda:sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
record={'id':'hdrp-lab-car-black','label':'HDRP Lab coupe · black','dimensionsM':dims,
 'triangles':tri(),'sourceTriangles':original,'wheelbaseM':2.88,
 'glb':'models/hdrp-lab-car-black.glb',
 'confidence':'Actual URPLabStudio HDRP Lab Car Free 2.0 mesh, converted in Blender; black portable PBR materials and simplified closed-body geometry.',
 'sourceUrl':'https://assetstore.unity.com/packages/3d/vehicles/land/hdrp-lab-car-free-realistic-car-model-185778',
 'license':'Unity Asset Store EULA; embedded game asset, not a standalone redistributable model.'}
record['vertices']=sum(len(o.data.vertices)for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'hdrp-lab-car-black.blend'))
bpy.ops.export_scene.gltf(filepath=str(PUB/'hdrp-lab-car-black.glb'),export_format='GLB',export_animations=False,export_apply=True)
bpy.ops.export_scene.fbx(filepath=str(ART/'hdrp-lab-car-black.fbx'),use_selection=True,axis_forward='-Z',axis_up='Y',bake_anim=False)
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Distant silhouette','DECIMATE');mod.ratio=.3;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
    normal=o.modifiers.new('LOD panel normals','WEIGHTED_NORMAL');normal.keep_sharp=True;normal.weight=50
    bpy.ops.object.modifier_apply(modifier=normal.name)
record['lod1Triangles']=tri()
bpy.ops.export_scene.gltf(filepath=str(PUB/'hdrp-lab-car-black-lod1.glb'),export_format='GLB',export_animations=False,export_apply=True)
(ART/'conversion.json').write_text(json.dumps(record,indent=2))
print('CONVERTED',json.dumps(record))
