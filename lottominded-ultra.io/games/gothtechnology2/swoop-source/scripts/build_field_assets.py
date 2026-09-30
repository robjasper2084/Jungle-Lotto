"""Original free Blender geometry: tufts, clover, stone, drain. Metres, ground pivots."""
import bpy, math, random, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'art'/'swoop-field-pack'
root.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
def material(name,color,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.85;bs.inputs['Metallic'].default_value=metal
    return m
green=material('Grass_blade',(0.24,.34,.105));dry=material('Dry_blade',(.38,.33,.16));clover=material('Clover_leaf',(.14,.28,.09));stone=material('Field_stone',(.27,.29,.26));iron=material('Drain_iron',(.07,.085,.08),.65)
def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    for p in data.polygons:p.use_smooth=True
    return o
for name,seed,mat,n in [('GrassTuft',19,green,24),('DryTuft',71,dry,16)]:
    rng=random.Random(seed);verts=[];faces=[]
    for i in range(n):
        a=rng.random()*math.tau;r=rng.random()*.17;x=math.cos(a)*r;y=math.sin(a)*r;h=.09+rng.random()*.17;w=.009+rng.random()*.008;bend=.03+rng.random()*.055
        start=len(verts)
        for t in [0,.45,.8,1]:
            cx=x+math.cos(a)*bend*t*t;cy=y+math.sin(a)*bend*t*t;half=w*(1-t)*.5
            verts.extend([(cx-math.sin(a)*half,cy+math.cos(a)*half,h*t),(cx+math.sin(a)*half,cy-math.cos(a)*half,h*t)])
        for k in range(3):faces.extend([(start+k*2,start+k*2+1,start+k*2+3),(start+k*2,start+k*2+3,start+k*2+2)])
    mesh(name,verts,faces,mat)
verts=[];faces=[];rng=random.Random(6)
for i in range(7):
    x=rng.uniform(-.16,.16);y=rng.uniform(-.16,.16);z=rng.uniform(.025,.055)
    for a in [0,math.tau/3,math.tau*2/3]:
        start=len(verts);cx=x+math.cos(a)*.027;cy=y+math.sin(a)*.027;verts.append((cx,cy,z+.003))
        for j in range(8):
            b=j*math.tau/8;verts.append((cx+math.cos(b)*.026,cy+math.sin(b)*.021,z))
        for j in range(8):faces.append((start,start+1+j,start+1+(j+1)%8))
mesh('CloverPatch',verts,faces,clover)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,0,.12));o=bpy.context.object;o.name='FieldStone';o.scale=(.22,.16,.13);o.data.materials.append(stone);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
parts=[]
for x in [-.22,.22]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,0,.018));o=bpy.context.object;o.scale=(.025,.6,.036);parts.append(o)
for y in [-.29,.29]+[i*.08 for i in range(-3,4)]:
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y,.018));o=bpy.context.object;o.scale=(.44,.027,.036);parts.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='TrailDrain';o.data.materials.append(iron);bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# All individual assets share the origin, kept separate for instancing and prefab export.
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'Swoop_Field_Assets.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'field-assets.glb'),export_format='GLB',use_selection=True,export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(root/'field-assets.fbx'),use_selection=True,apply_unit_scale=True,axis_forward='-Z',axis_up='Y',bake_anim=False)
summary={o.name:{'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'dimensions':list(o.dimensions)} for o in bpy.context.scene.objects if o.type=='MESH'}
(root/'blender-manifest.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary))
