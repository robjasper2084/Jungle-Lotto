"""2000 Mack photo-reference reconstruction. Metres; +Z faces Mack in glTF.
Primary references and approximations are documented in mack-studio.md.
Run in a separate Blender background process; never alters an open user scene.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent.parent/'public'/'exports'/'atwater'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.75):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
cream=mat('Cream glazed block',(.67,.62,.47));orange=mat('Terracotta orange base',(.72,.21,.035));green=mat('Olive green corrugated fascia',(.20,.29,.105),.25);trim=mat('Green seam highlights',(.30,.38,.18),.3)
black=mat('Black steel',(.035,.045,.042),.65);roof=mat('Flat weathered roof',(.19,.205,.19));floor=mat('Studio polished concrete',(.35,.37,.34),.1,.56);white=mat('Ivory lettering',(.91,.91,.83));yellow=mat('Safety yellow',(.88,.61,.08));glass=mat('Smoked glazing',(.09,.14,.15),.45,.25);steel=mat('Galvanized metal',(.43,.47,.45),.7);light=mat('Warm lighting',(.96,.79,.48));light.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.96,.79,.48,1);light.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.7
bins={}
def box(name,x,y,z,w,h,d,m,bevel=0):
 verts,faces=bins.setdefault(m,([],[]));n=len(verts)
 if 'block joint' in name:
  verts.extend([(x-w/2,-z-d/2,y-h/2),(x+w/2,-z-d/2,y-h/2),(x+w/2,-z-d/2,y+h/2),(x-w/2,-z-d/2,y+h/2)]);faces.append((n,n+1,n+2,n+3));return
 verts.extend([(x+dx*w/2,-z+dz*d/2,y+dy*h/2) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]])
 faces.extend([tuple(n+i for i in reversed(f)) for f in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]])
def rod(name,a,b,r,m):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def text(name,label,x,y,z,size,m):
 bpy.ops.object.text_add(location=(x,-z,y),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.body=label;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.004;o.data.materials.append(m);bpy.ops.object.convert(target='MESH');return o
# Mapped 48.533 x 43.912 metre main building. Exterior shell has a 12-foot
# loading opening, retained as the studio's shared visitor entrance.
W=48.533;D=43.912;F=D/2
box('Foundation skirt',0,-.70,0,W,1.4,D,cream)
box('Interior slab',0,.025,0,W,.05,D,floor)
for x in [-W/2,W/2]:box('Side block wall',x,3.05,0,.26,6.1,D,cream)
box('Rear block wall',0,3.05,-F,W,6.1,.26,cream)
for x in [-1,1]:
 width=W/2-1.83;cx=x*(1.83+width/2)
 box('Front cream block',cx,3.05,F,width,6.1,.26,cream)
 box('Orange front plinth',cx,.53,F+.025,width,1.06,.29,orange)
box('Loading door lintel',0,5.5,F,3.66,1.2,.26,cream)
for x in [-W/2,W/2]:box('Orange side plinth',x,.53,0,.29,1.06,D,orange)
box('Orange rear plinth',0,.53,-F,W,1.06,.29,orange)
box('Flat roof deck',0,6.08,0,W,.18,D,roof)
for z in [-F,F]:
 box('Green roof fascia',0,6.53,z,W,.96,.18,green)
 for i in range(163):box('Corrugated vertical seam',-W/2+i*.2995,6.53,z+(.10 if z>0 else -.10),.028,.9,.045,trim)
for x in [-W/2,W/2]:
 box('Green side fascia',x,6.53,0,.18,.96,D,green)
 for i in range(148):box('Corrugated side seam',x+(.10 if x>0 else -.10),6.53,-F+i*.298,.045,.9,.028,trim)
# Fine block joints, merged by material on export. No per-block draw calls.
joint=mat('Recessed block joints',(.49,.47,.38))
for row in range(1,29):
 y=row*.21
 for side in [-1,1]:
  width=W/2-1.84;cx=side*(1.84+width/2);box('Horizontal block joint',cx,y,F+.136,width,.007,.007,joint)
 for i in range(121):
  x=-W/2+i*.403+(row%2)*.2015
  if abs(x)>1.87:box('Vertical block joint',x,y-.105,F+.138,.006,.203,.008,joint)
# Existing small office entrance and canopy. Loading door remains open for play.
box('Office entrance',-14,1.13,F+.18,1.15,2.26,.10,green)
box('Office glazed pane',-14,1.57,F+.25,.72,.64,.02,glass)
box('Black door canopy',-14,2.53,F+.66,3.15,.16,1.45,black)
text('Address','2000',-14,2.64,F+1.4,.27,white)
for x in [-17.6,-10.5]:
 box('Security window',x,1.82,F+.18,.92,.8,.08,glass)
 for dx in [-.3,-.1,.1,.3]:box('Window security bars',x+dx,1.82,F+.24,.025,.85,.025,black)
for y in [4.95,5.1,5.25,5.4,5.55,5.7,5.85]:box('Raised green shutter slat',0,y,F+.20,3.6,.135,.06,green)
for x in [-2.13,2.13,-15.4,-12.6]:rod('Protective yellow bollard',(x,0,F+1),(x,1.1,F+1),.09,yellow)
for x in [-21,-8,5,17,22]:
 box('Facade light housing',x,5.18,F+.24,.4,.2,.24,black);box('Facade light lens',x,5.11,F+.36,.30,.04,.10,light)
box('GothTech studio sign',-13,6.53,F+.16,18,.83,.06,white)
text('GothTech studio lettering','GOTHTECH STUDIO',-13,6.3,F+.205,.69,black)
text('Studio address','2000 MACK',17,6.34,F+.205,.46,white)
text('Entrance wayfinding','SERENGETI  /  GOTHTECH',0,4.53,F+.28,.24,white)
text('Gallery lobby sign','SERENGETI GALLERIES',-12,4.75,16,.39,white)
text('Store lobby sign','GOTHTECH STORE',12,4.75,16,.48,white)
# Interior studio work area behind the two retained retail/gallery collections.
for x in [-14,0,14]:
 box('Studio work table',x,.77,-12,5,.12,1.3,cream)
 for dx in [-2,2]:box('Table support',x+dx,.38,-12,.10,.76,1.05,black)
 box('Studio equipment',x,1.16,-12.1,1.25,.65,.12,black)
for x in [-20,0,20]:
 for z in [-16,-4,12]:box('Warehouse ceiling luminaire',x,5.8,z,2.8,.08,.22,light)
for x,z in [(-16,-15),(10,-9),(15,9)]:
 box('Roof HVAC',x,6.65,z,2.6,1.0,1.8,steel,.05)
 for j in range(7):box('HVAC grille',x-1.31,6.3+j*.105,z,.03,.035,1.5,black)
# Two rear loading bays and their dock buffers.
for x in [-12,10]:
 box('Rear loading shutter',x,2.6,-F-.15,3.65,4.7,.08,green)
 for dx in [-2.1,2.1]:box('Dock buffer',x+dx,.7,-F-.35,.35,1.4,.40,black)
# Deliberately original gallery mural; do not copy the photographed artist's wall.
palette=[mat('Mural '+str(i),c) for i,c in enumerate([(.72,.12,.18),(.88,.55,.07),(.06,.46,.46),(.47,.25,.60)])]
box('Gallery mural ground',-W/2-.15,3.48,0,.045,4.9,D-3,black)
for i in range(16):
 z=-19+i*2.5; box('Original abstract mural',-W/2-.18,3+math.sin(i)*.7,z,.035,2.3,1.8,palette[i%4])
for m,(verts,faces) in bins.items():
 mesh=bpy.data.meshes.new(m.name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(m.name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m)
# Join static objects per material. The exported shell stays under 25 draw calls.
for m in list(bpy.data.materials):
 items=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.active_material==m]
 if not items:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();bpy.context.object.name=m.name
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Mack_GothTech_Studio.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'mack-gothtech-studio.glb'),export_format='GLB')
print('MACK_STUDIO_EXPORT',sum(len(o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),'faces')
