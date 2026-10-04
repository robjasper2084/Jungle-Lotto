"""Original Higgsfield key art and the same four game riders, animated in Blender.
No source assets are modified. Output is an editable .blend and three five-second shots.
"""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/cinematics'
bpy.ops.wm.open_mainfile(filepath=str(ART/'Swoop_Detroit_Cinematics.blend'))
FPS=24;END=120
def root(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def camera(name,start,end,focus,lens=38):
 bpy.ops.object.camera_add(location=start);o=bpy.context.object;o.name=name;o.data.lens=lens;o.data.clip_end=1000
 c=o.constraints.new('TRACK_TO');c.target=focus;c.track_axis='TRACK_NEGATIVE_Z';c.up_axis='UP_Y'
 for f,p in [(1,start),(END,end)]:o.location=p;o.keyframe_insert('location',frame=f)
 return o
def import_glb(path,name,at,scale=1):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before;r=root(name)
 for o in list(objects):
  if o.name.startswith('Icosphere'):objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 for o in objects:
  if not o.parent:o.parent=r
 r.location=at;r.scale=(scale,)*3;return r,objects
base=bpy.data.scenes['01 / One wheel. One companion.'];group=base.copy();group.name='05 / Original group ride';bpy.context.window.scene=group
# Copy object graphs, including parents, to keep the original dog/studio film editable.
copies={o:o.copy() for o in list(group.objects)}
for old,new in copies.items():group.collection.objects.link(new)
for old,new in copies.items():
 if old.parent:new.parent=copies.get(old.parent,old.parent)
 for c in new.constraints:
  if hasattr(c,'target') and c.target in copies:c.target=copies[c.target]
for old in copies:
 for c in list(old.users_collection):
  if c==group.collection:c.objects.unlink(old)
# Scene.copy shares the original collections; explicitly build a fresh collection tree.
fresh=bpy.data.collections.new('Original key art group / independent objects');bpy.context.scene.collection.children.link(fresh)
for old,new in copies.items():
 for c in list(new.users_collection):c.objects.unlink(new)
 fresh.objects.link(new)
for c in list(group.collection.children):
 if c!=fresh:group.collection.children.unlink(c)
rig=next(o for o in group.objects if o.name.startswith('Ride blocking root'))
man=next(o for o in group.objects if o.name.startswith('Original suited rider'));man.location.x=-.6
wheel=next(o for o in group.objects if o.name.startswith('Original electric unicycle'));wheel.location.x=-.6
dog=next(o for o in group.objects if o.name.startswith('Actual Boerboel'));dog.location.x=2.45
pack=Path('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack/exports/glb')
for name,x,y,scale in [('DS_Hoodie_Woman_01',1.0,.3,.86),('DS_Mascot_Suit_01',-.8,3,.75),('DS_Mascot_Hoodie_01',.5,3.5,.75)]:
 human,_=import_glb(pack/name/(name+'_LOD1.glb'),name+' original artwork rider',(x,y,.296*scale));human.parent=rig
 wheel,_=import_glb(pack/'DS_EUC_01/DS_EUC_01_LOD0.glb',name+' wheel',(x,y,0),scale);wheel.parent=rig
for o in group.objects:
 if o.type=='LIGHT':o.data=o.data.copy();o.data.energy*=.45;o.data.color=(.45,.65,1)
group.world=group.world.copy();group.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.025
focus=root('Group ride focus');focus.parent=rig;focus.location=(.6,.8,1.1)
cameras={'group-track':camera('Group front tracking',(3,-7,2.0),(3,-15,2.2),focus,32),'group-arc':camera('Group side crane',(-5,-5,2.3),(4,-13,3.0),focus,30)}
poster=bpy.data.scenes.new('06 / Original startup artwork');bpy.context.window.scene=poster;poster.render.engine='BLENDER_EEVEE';poster.eevee.taa_render_samples=8;poster.view_settings.view_transform='Standard';poster.world=bpy.data.worlds.new('Artwork black surround');poster.world.color=(0,0,0)
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,0));plane=bpy.context.object;plane.name='Exact original Higgsfield startup image';plane.scale=(8,4.5,1)
m=bpy.data.materials.new('Original Higgsfield key art / unaltered');m.use_nodes=True;n=m.node_tree.nodes;n.clear();tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'public/art/swoop-rivals-master.png'));tex.image.pack();em=n.new('ShaderNodeEmission');out=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(tex.outputs['Color'],em.inputs[0]);m.node_tree.links.new(em.outputs[0],out.inputs[0]);plane.data.materials.append(m)
bpy.ops.object.camera_add(location=(0,0,11.1));card=bpy.context.object;card.name='Full group artwork slow dolly';card.data.type='ORTHO';poster.camera=card
for f,size,x in [(1,16,0),(END,14.9,.45)]:card.data.ortho_scale=size;card.data.keyframe_insert('ortho_scale',frame=f);card.location.x=x;card.keyframe_insert('location',frame=f)
scenes={'original-art':(poster,card),**{name:(group,c) for name,c in cameras.items()}}
for s in [poster,group]:
 s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.fps=FPS;s.frame_start=1;s.frame_end=END;s.render.image_settings.file_format='PNG';s['reference']='public/art/swoop-rivals-master.png / Higgsfield job 8ec69595-706f-44b2-a5e3-c93f40d298df';s['duration_seconds']=5
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'Swoop_Original_Group_Startup.blend'))
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'preview'
for name,(s,c) in scenes.items():
 bpy.context.window.scene=s;s.camera=c
 if mode=='preview':s.frame_set(60);s.render.filepath=str(ART/(name+'-preview.png'));bpy.ops.render.render(write_still=True)
 else:
  folder=ART/name;folder.mkdir(exist_ok=True);s.render.filepath=str(folder/'frame-');bpy.ops.render.render(animation=True)
print('ORIGINAL_GROUP_STARTUP_OK / '+mode)
