"""Blender Unlimited-style derivative of the approved Higgsfield boat.
Usage: blender -b --python build-hydroplane.py -- INPUT.glb OUTPUT.glb SOURCE.blend
Original design, not a replica of a named racing team or certified H1 boat.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
source,output,blend=sys.argv[sys.argv.index('--')+1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
core=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bm=bmesh.new();bm.from_mesh(core.data)
# Retain the generated centre hull, replacing outboards, wake, cockpit and bow
# with the sponson/capsule/turbine arrangement of an Unlimited hydroplane.
bmesh.ops.delete(bm,geom=[v for v in bm.verts if abs(v.co.x)>.145 or v.co.y<-.38 or v.co.y>.27],context='VERTS')
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.to_mesh(core.data);bm.free()
core.scale=(5.2,9.2,4.5);core.rotation_mode='XYZ';core.rotation_euler.z=math.pi;core.location.z=.25
bpy.context.view_layer.objects.active=core;core.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
def mat(name,color,metal=0,rough=.35,alpha=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha);p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Alpha'].default_value=alpha
 if alpha<1:m.surface_render_method='DITHERED'
 return m
black=mat('Hydro graphite composite',(.024,.032,.043),.5,.27);red=mat('Hydro racing red',(.65,.013,.022),.3,.25);rubber=mat('Hydro cockpit charcoal',(.008,.012,.018),0,.7);silver=mat('Hydro titanium',(.38,.41,.44),.8,.3);glass=mat('Hydro canopy glazing',(.08,.17,.21),.1,.13,.20);screen=mat('Hydro reactive display',(.01,.02,.025),0,.8)
core.name='Higgsfield_hydro_centre_hull';core.data.materials.clear();core.data.materials.append(black)
def p(v):return (v[0],-v[2],v[1])
def mesh(name,verts,faces,material):
 m=bpy.data.meshes.new(name);m.from_pydata([p(v) for v in verts],[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
def box(name,loc,size,material,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p(loc));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  m=o.modifiers.new('Manufactured edge','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def tube(name,points,r,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for dest,v in zip(s.points,points):dest.co=(*p(v),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
def loft(name,sections,material):
 # Rectangular chine sections: z, half beam, lower chine, deck height, centre X.
 verts=[]
 for z,w,low,high,x in sections:verts.extend([(x-w,high,z),(x+w,high,z),(x+w*.84,low,z),(x-w*.84,low,z)])
 faces=[(3,2,1,0)]
 for k in range(len(sections)-1):
  for i in range(4):a=k*4+i;b=k*4+(i+1)%4;faces.append((a,b,b+4,a+4))
 n=len(verts);faces.append(tuple(range(n-4,n)))
 return mesh(name,verts,[tuple(reversed(f)) for f in faces],material)
for side in [-1,1]:
 x=side*1.55
 loft('Forward planing sponson',[(-1.15,.34,-.08,.35,x),(-.6,.51,-.15,.48,x),(1.8,.51,-.12,.57,x),(3.5,.42,.05,.62,x),(4.60,.035,.45,.53,x)],black)
 loft('Red sponson deck',[(-1.1,.25,.35,.38,x),(-.5,.38,.48,.51,x),(1.8,.38,.57,.60,x),(3.5,.30,.62,.65,x),(4.53,.018,.53,.55,x)],red)
 tube('Outer sheer silver',[(x+side*.34,.22,-1.1),(x+side*.51,.26,-.6),(x+side*.51,.30,1.8),(x+side*.42,.38,3.5),(x+side*.03,.49,4.5)],.012,silver)
 loft('Aft shoe',[(-4.35,.25,-.12,.13,side*.85),(-2.4,.36,-.08,.33,side*.85),(-.8,.35,-.04,.35,side*.85)],black)
 box('Wing support',(side*1.18,1.12,-3.25),(.065,1.94,.48),red,.025)
 # Swept bridge panels connect the generated central hull to the sponsons.
 loft('Tunnel deck',[(-1.0,.50,.25,.32,side*.87),(1.4,.52,.34,.41,side*.87),(2.7,.38,.34,.39,side*.90)],black)
box('Canard',(0,.43,3.25),(2.25,.065,.45),silver,.025)
wing=box('Rear stabilizer',(0,2.10,-3.32),(3.82,.09,.70),black,.035);wing.rotation_euler.x=.055
box('Red wing leading edge',(0,2.13,-3.02),(3.80,.04,.07),red,.018)
for side in [-1,1]:box('Wing end plate',(side*1.92,2.10,-3.34),(.04,.39,.80),red,.025)
# Smooth turbine cowling and rear exhaust; all dimensions are metres.
verts=[];segments=20
for z,w,h in [(-3.36,.36,.58),(-2.9,.57,.96),(-1.25,.57,1.16),(-.65,.42,.78)]:
 for j in range(segments):a=2*math.pi*j/segments;verts.append((math.cos(a)*w,.42+math.sin(a)*h*.5,z))
faces=[]
for k in range(3):
 for j in range(segments):a=k*segments+j;b=k*segments+(j+1)%segments;faces.append((a,b,b+segments,a+segments))
faces.extend([tuple(reversed(range(segments))),tuple(range(3*segments,4*segments))]);cow=mesh('Turbine cowling',verts,faces,black)
for f in cow.data.polygons:f.use_smooth=True
box('Red engine spine',(0,.99,-1.85),(.12,.04,1.9),red,.02)
for r,depth,material in [(.30,.15,silver),(.235,.17,rubber)]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=p((0,.47,-3.48)),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(material)
box('Rudder',(0,-.31,-4.30),(.035,.69,.34),silver,.005)
tube('Propeller shaft',[(0,-.12,-3.1),(0,-.28,-4.23)],.04,silver)
for a in [0,2*math.pi/3,4*math.pi/3]:
 o=box('Propeller blade',(.12*math.cos(a),-.28+.12*math.sin(a),-4.1),(.30,.055,.11),silver,.02);o.rotation_euler.y=-a
# Single seat and enclosed safety capsule, forward of the turbine.
box('Cockpit floor',(0,.26,.72),(.88,.10,2.4),rubber)
box('Seat',(0,.45,.42),(.64,.21,.66),red,.09)
box('Seat back',(0,.80,.03),(.62,.64,.16),red,.08)
box('Seat insert',(0,.83,.13),(.43,.47,.05),rubber,.03)
box('Head restraint',(0,1.12,.02),(.40,.22,.16),rubber,.05)
box('Dashboard',(0,.72,1.47),(.86,.37,.24),black,.04)
panel=mesh('Cockpit_Display',[(-.39,.57,1.338),(.39,.57,1.338),(.39,.87,1.338),(-.39,.87,1.338)],[(3,2,1,0)],screen);panel.data.uv_layers.new()
for i,uv in enumerate([(1,1),(0,1),(0,0),(1,0)]):panel.data.uv_layers.active.data[i].uv=uv
canopy_sections=[(-.30,.45,.42),(.05,.57,1.38),(1.15,.55,1.48),(2.0,.40,1.06),(2.50,.04,.45)]
verts=[];steps=12
for z,w,height in canopy_sections:
 for i in range(steps+1):a=math.pi*i/steps;verts.append((w*math.cos(a),.35+(height-.35)*math.sin(a),z))
faces=[]
for k in range(len(canopy_sections)-1):
 for i in range(steps):a=k*(steps+1)+i;faces.append((a,a+1,a+steps+2,a+steps+1))
canopy=mesh('Canopy_Glass',verts,faces,glass)
for face in canopy.data.polygons:face.use_smooth=True
for z,w,h in [canopy_sections[0],canopy_sections[1],canopy_sections[-1]]:tube('Capsule hoop',[(w*math.cos(math.pi*i/12),.35+(h-.35)*math.sin(math.pi*i/12),z) for i in range(13)],.023,red)
for side in [-1,1]:tube('Canopy edge',[(side*w,.35,z) for z,w,h in canopy_sections],.025,red)
bpy.ops.object.empty_add(type='PLAIN_AXES',location=p((0,.73,1.00)));helm=bpy.context.object;helm.name='Helm_Wheel'
bpy.ops.mesh.primitive_torus_add(major_radius=.16,minor_radius=.018,major_segments=32,minor_segments=8,location=helm.location,rotation=(math.pi/2,0,0));o=bpy.context.object;o.data.materials.append(rubber);o.parent=helm;o.matrix_parent_inverse=helm.matrix_world.inverted()
for a in [math.pi/2,7*math.pi/6,11*math.pi/6]:
 o=tube('Wheel spoke',[(0,.73,1),(.14*math.cos(a),.73+.14*math.sin(a),1)],.013,silver);o.parent=helm;o.matrix_parent_inverse=helm.matrix_world.inverted()
for name,loc in [('Driver_Eye',(0,1.18,.20)),('Driver_Hip',(0,.59,.38))]:bpy.ops.object.empty_add(type='PLAIN_AXES',location=p(loc));bpy.context.object.name=name
for side,color,label in [(-1,(.9,.02,.02),'Nav_Port'),(1,(.01,.8,.25),'Nav_Starboard')]:box(label,(side*1.52,.67,1.8),(.07,.04,.08),mat(label,color),.01)
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for material in [black,red,rubber,silver]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.parent and len(o.data.materials)==1 and o.data.materials[0]==material]
 if objs:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=material.name
os.makedirs(os.path.dirname(output),exist_ok=True);os.makedirs(os.path.dirname(blend),exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=blend);bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_apply=True,export_yup=True)
print('HYDRO_EXPORT',json.dumps({'bytes':os.path.getsize(output),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')}))
