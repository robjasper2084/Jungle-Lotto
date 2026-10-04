"""Editable Blender camera animation with the actual Swoop game models.
No plugins or model purchases. Originals are read only; output stays in art/cinematics.
Usage: blender -b --python-exit-code 1 --python scripts/build_startup_cinematics.py -- [preview|ride|studio|lotto|arcade|all]
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/cinematics';ART.mkdir(parents=True,exist_ok=True)
PACK=Path('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack')
bpy.ops.wm.read_factory_settings(use_empty=True)
FPS=24;FRAMES=120

def mat(name,color,rough=.55,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m
def box(name,at,size,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def root(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def glb(path,name,at=(0,0,0),scale=1):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before
 for o in list(objects):
  if o.name.startswith('Icosphere'):objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 r=root(name)
 for o in objects:
  if not o.parent:o.parent=r
 r.location=at;r.scale=(scale,)*3;return r,objects
def library(name):
 with bpy.data.libraries.load(str(ROOT/'art/studio-retail'/(name+'.blend')),link=False) as (a,b):b.objects=a.objects
 for o in b.objects:
  if o and o.type not in ['CAMERA','LIGHT']:bpy.context.collection.objects.link(o)
def light(at,power,size,target=(0,0,1),color=(1,.9,.75)):
 bpy.ops.object.light_add(type='AREA',location=at);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def camera(name,start,end,target,lens=42):
 bpy.ops.object.camera_add(location=start);o=bpy.context.object;o.name=name;o.data.lens=lens;o.data.clip_end=1000;o.data.dof.use_dof=True;o.data.dof.focus_object=target;o.data.dof.aperture_fstop=5.6
 c=o.constraints.new('TRACK_TO');c.target=target;c.track_axis='TRACK_NEGATIVE_Z';c.up_axis='UP_Y'
 for frame,p in [(1,start),(FRAMES,end)]:o.location=p;o.keyframe_insert('location',frame=frame)
 bpy.context.scene.camera=o;return o
def scene(name):
 s=bpy.data.scenes.new(name);bpy.context.window.scene=s;s.render.engine='BLENDER_EEVEE';s.eevee.taa_render_samples=16;s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100;s.render.fps=FPS;s.frame_start=1;s.frame_end=FRAMES;s.render.image_settings.file_format='PNG';s.render.film_transparent=False;s.view_settings.view_transform='AgX'
 s.world=bpy.data.worlds.new(name+' atmosphere');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.23,.30,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
 return s
ride=scene('01 / One wheel. One companion.')
road=mat('Cut concrete',(.22,.25,.25),.68);wall=mat('Cut retaining wall',(.27,.29,.30),.81);teal=mat('Electric teal',(.08,.62,.56),emit=3)
texture=road.node_tree.nodes.new('ShaderNodeTexNoise');texture.inputs['Scale'].default_value=95;texture.inputs['Detail'].default_value=3;bump=road.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.022;road.node_tree.links.new(texture.outputs['Fac'],bump.inputs['Height']);road.node_tree.links.new(bump.outputs['Normal'],road.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
sky=ride.world.node_tree.nodes.new('ShaderNodeTexSky');sky.sky_type='HOSEK_WILKIE';sky.sun_direction=Vector((-.5,.8,.12)).normalized();ride.world.node_tree.links.new(sky.outputs['Color'],ride.world.node_tree.nodes['Background'].inputs['Color']);ride.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.10
box('Greenway cinema set',(0,0,-.075),(14,85,.15),road)
box('Retaining wall',(5,0,1.15),(.35,75,2.3),wall)
for y in range(-30,35,5):box('Inlaid route marker',(-2.5,y,.006),(.1,1.6,.014),teal)
towers,_=glb(ROOT/'public/exports/atwater/renaissance-center.glb','Actual Renaissance Center model',(-12,105,0),.19)
rig=root('Ride blocking root');rig['direction']='Forward -Y; camera tracks the original rider and short-tailed Boerboel.'
human,humans=glb(PACK/'exports/glb/DS_Man_01/DS_Man_01_LOD1.glb','Original suited rider',(0,0,.296*.86));human.parent=rig
wheel,wheels=glb(PACK/'exports/glb/DS_EUC_01/DS_EUC_01_LOD0.glb','Original electric unicycle',scale=.86);wheel.parent=rig
dog,dogs=glb(ROOT/'public/exports/polish/DS_Boerboel_Polished.glb','Actual Boerboel with polished gait',(1.3,-.15,.012));dog.parent=rig
for arm in [o for o in dogs if o.type=='ARMATURE']:
 arm.animation_data_clear();arm.animation_data_create();a=bpy.data.actions.get('Dog_Trot');track=arm.animation_data.nla_tracks.new();strip=track.strips.new('Original grounded trot',1,a);strip.repeat=4
 if 'tail' in arm.pose.bones:
  c=arm.pose.bones['tail'].constraints.new('LIMIT_ROTATION');c.use_limit_x=c.use_limit_y=c.use_limit_z=True;c.owner_space='LOCAL'
for o in wheels:
 if o.animation_data:o.animation_data_clear()
for frame,y in [(1,3),(FRAMES,-6)]:rig.location=(0,y,0);rig.keyframe_insert('location',frame=frame)
focus=root('Rider and companion focus');focus.parent=rig;focus.location=(.5,0,1.03)
camera('Rider tracking crane',(2.5,-3,1.35),(1.7,-12,2.15),focus,38)
light((-3,-8,8),2200,8);light((4,5,5),3400,6,color=(.35,.7,1));light((0,3,3),650,4)
studio=scene('02 / 2000 Mack production studio');library('Mack_Production_Studio')
focus=root('Cyclorama camera focus');focus.location=(0,13,1.6)
camera('Studio dolly',(-5,-1,3.8),(3,4,3.0),focus,26)
light((0,10,5.8),4500,9,target=focus.location,color=(.82,.95,1));light((-8,9,4.8),2300,5,target=focus.location);light((8,14,5),2000,5,target=focus.location)
lotto=scene('03 / LottoMind storefront interior');library('LottoMind_Store')
focus=root('App kiosk and counter focus');focus.location=(0,2,1.3)
camera('LottoMind store dolly',(3,-6.5,2.2),(-1,-5.5,1.8),focus,25)
light((0,-3,3.6),1400,7,target=focus.location,color=(.85,.94,1));light((-3,3,3.7),950,4,target=focus.location)
arcade=scene('04 / The 1980s cabinet wall')
charcoal=mat('Arcade charcoal',(.028,.039,.044),.45);box('Arcade floor',(0,0,-.04),(30,30,.08),charcoal)
for x,name in [(-1.25,'Arcade_2084_Static_Wave'),(0,'Arcade_Robot_Rahbe'),(1.25,'Arcade_Underground')]:
 before=set(bpy.data.objects);library(name)
 for o in set(bpy.data.objects)-before:o.location.x+=x
focus=root('Joystick deck focus');focus.location=(0,0,1.1)
camera('Cabinet glide',(-3.6,-5.6,2.4),(3.6,-5.6,1.65),focus,43)
light((0,-3,4.5),1100,5,color=(.45,.85,1));light((-4,2,4),1500,4,color=(1,.32,.65));light((4,2,4),1200,4,color=(.4,1,.75))
for s in [ride,studio,lotto,arcade]:
 s.timeline_markers.new(s.name,frame=1);s.timeline_markers.new('Edit point / five seconds',frame=FRAMES);s['duration_seconds']=5;s['role']='Blender-authored game-asset trailer footage';s.frame_set(1)
bpy.context.window.scene=ride
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'Swoop_Detroit_Cinematics.blend'))
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv and len(sys.argv)>sys.argv.index('--')+1 else 'preview'
selected={'ride':ride,'studio':studio,'lotto':lotto,'arcade':arcade}
if mode=='preview':
 for name,s in selected.items():
  bpy.context.window.scene=s;s.frame_set(60);s.render.filepath=str(ART/(name+'-preview.png'));bpy.ops.render.render(write_still=True)
else:
 for name,s in selected.items():
  if mode not in ['all',name]:continue
  folder=ART/name;folder.mkdir(exist_ok=True);bpy.context.window.scene=s;s.render.filepath=str(folder/'frame-');bpy.ops.render.render(animation=True)
print('SWOOP_BLENDER_CINEMATICS_OK / '+mode)
