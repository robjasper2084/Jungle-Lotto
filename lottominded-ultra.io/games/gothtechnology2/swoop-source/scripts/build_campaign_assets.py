"""Reusable metre-scale campaign props, with Higgsfield art packed into the blend/GLBs."""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'art'/'route-campaign'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
steel=bpy.data.materials.new('Campaign_frame');steel.diffuse_color=(.075,.11,.12,1);steel.use_nodes=True
bs=steel.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=steel.diffuse_color;bs.inputs['Metallic'].default_value=.45;bs.inputs['Roughness'].default_value=.72
def textured(name):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(root/(name+'.jpg')));n.image.pack();m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.88;return m
def cube(name,loc,scale,parent):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(steel);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;return o
def panel(name,w,h,bottom,depth,mat,parent,back=False):
 # Blender Z up, front faces -Y. Both faces use independent UVs so lettering stays readable.
 v=[(-w/2,depth,bottom),(w/2,depth,bottom),(w/2,depth,bottom+h),(-w/2,depth,bottom+h)]
 if back:v=[v[1],v[0],v[3],v[2]]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new()
 for i,p in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=p
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.parent=parent
manifest=[]
for index,(key,label) in enumerate([('lottomind','LottoMind_Billboard'),('gothtechnology','GothTechnology_Billboard'),('detroit-dreams','Detroit_Dreams_Mural')]):
 parent=bpy.data.objects.new(label,None);bpy.context.collection.objects.link(parent);mat=textured(key)
 w,h,bottom=(6.4,3.6,1.5) if index<2 else (3.698,2.08,0)
 if index<2:
  cube(label+'_frame',(0,0,bottom+h/2),(w+.16,.2,h+.16),parent)
  for x in [-2.1,2.1]:cube(label+'_support',(x,0,(bottom+h)/2),(.17,.17,bottom+h),parent)
  panel(label+'_front',w,h,bottom,-.112,mat,parent);panel(label+'_back',w,h,bottom,.112,mat,parent,True)
 else:panel(label,w,h,bottom,0,mat,parent)
 bpy.ops.object.select_all(action='DESELECT');parent.select_set(True)
 for child in parent.children:child.select_set(True)
 bpy.context.view_layer.objects.active=parent
 bpy.ops.export_scene.gltf(filepath=str(root/(label+'.glb')),export_format='GLB',use_selection=True,export_yup=True)
 bpy.ops.export_scene.fbx(filepath=str(root/(label+'.fbx')),use_selection=True,apply_unit_scale=True,axis_forward='-Z',axis_up='Y',bake_anim=False,path_mode='COPY',embed_textures=True)
 manifest.append({'asset':label,'width':w,'artHeight':h,'bottom':bottom,'units':'metres','forward':'-Y in Blender / +Z in glTF','art':key+'.jpg','triangles':sum(sum(len(p.vertices)-2 for p in c.data.polygons) for c in parent.children if c.type=='MESH')})
 parent.location.x=index*9
bpy.ops.wm.save_as_mainfile(filepath=str(root/'Swoop_Campaign_Props.blend'))
(root/'blender-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest))
