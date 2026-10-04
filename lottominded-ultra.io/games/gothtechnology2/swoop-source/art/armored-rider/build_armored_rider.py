"""Model fitted, bone-weighted protective gear from the approved six-view reference."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

folder=Path(__file__).resolve().parent
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
base=next(o for o in bpy.context.scene.objects if o.type=='MESH')
root=arm.parent
gear=bpy.data.collections['Armored rider / editable protective gear']

def material(name,color,rough=.55,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    return m
cloth=material('Charcoal technical nylon',(.025,.030,.032),.88)
noise=cloth.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=230;noise.inputs['Roughness'].default_value=.8
bump=cloth.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.0015
cloth.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);cloth.node_tree.links.new(bump.outputs['Normal'],cloth.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
shell=material('Olive graphite protective shell',(.045,.061,.047),.58,.16)
edge=material('Black rubber padding',(.013,.018,.019),.77)
metal=material('Brushed titanium fasteners',(.32,.35,.34),.32,.85)
visor=material('Smoke riding visor',(.023,.052,.060),.19,.52)
red=material('Muted red safety trim',(.36,.035,.023),.44,.1)
original=base.data.materials[0].copy();original.name='Dark riding garments / original UV detail'
bs=next(n for n in original.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
for socket in bs.inputs:
    for link in list(socket.links):original.node_tree.links.remove(link)
bs.inputs['Base Color'].default_value=(.024,.030,.027,1);bs.inputs['Roughness'].default_value=.87
bs.inputs['Emission Color'].default_value=(0,0,0,1);bs.inputs['Emission Strength'].default_value=0
weave=original.node_tree.nodes.new('ShaderNodeTexNoise');weave.inputs['Scale'].default_value=210
fibre=original.node_tree.nodes.new('ShaderNodeBump');fibre.inputs['Strength'].default_value=.11;fibre.inputs['Distance'].default_value=.001
original.node_tree.links.new(weave.outputs['Fac'],fibre.inputs['Height']);original.node_tree.links.new(fibre.outputs['Normal'],bs.inputs['Normal'])
base.data.materials.clear();base.data.materials.append(original);base.name='Armored Rider / fitted nylon clothing'
parts=[]
def fitted(o,name,mat,bone=None):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    gear.objects.link(o);o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    if bone:
        # Gear shares the same skin skeleton so SkeletonUtils.clone and riding IK stay compatible.
        g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
        mod=o.modifiers.new('Rider skeleton','ARMATURE');mod.object=arm
        o.parent=arm
    parts.append(o);return o
def ellipsoid(name,loc,scale,mat,bone,segments=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=loc)
    o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return fitted(o,name,mat,bone)
def block(name,loc,scale,mat,bone,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    be=o.modifiers.new('Rounded molded edges','BEVEL');be.width=bevel;be.segments=3
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=be.name)
    return fitted(o,name,mat,bone)
def bar(name,a,b,width,depth,mat,bone):
    midpoint=(Vector(a)+Vector(b))*.5
    o=block(name,midpoint,(width,depth,(Vector(b)-Vector(a)).length),mat,bone, min(.007,width*.25))
    o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler();return o
def panel(name,outline,y,thickness,mat,bone):
    n=len(outline);vertices=[(x,y,z) for x,z in outline]+[(x,y+thickness,z) for x,z in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update();o=bpy.data.objects.new(name,me);gear.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    be=o.modifiers.new('Armor edge radius','BEVEL');be.width=.009;be.segments=3;bpy.ops.object.modifier_apply(modifier=be.name)
    return fitted(o,name,mat,bone)
def midpoint(bone,t=.5):
    b=arm.data.bones[bone];return b.head_local.lerp(b.tail_local,t)

# Closed helmet, low smoke visor, chin guard, vent inserts and tiny red seams.
ellipsoid('Helmet / compact shell',(0,.018,1.705),(.143,.150,.157),edge,'Head',32)
# Curved visor fitted to the shell, with distinct upper and lower rims.
verts=[]
for z in [1.663,1.752]:
    for i in range(25):
        a=-1.01+2.02*i/24;verts.append((math.sin(a)*.145,.018-math.cos(a)*.153,z))
me=bpy.data.meshes.new('Curved visor');me.from_pydata(verts,[],[(i,i+1,i+26,i+25) for i in range(24)]);me.update()
o=bpy.data.objects.new('Helmet / curved smoke visor',me);gear.objects.link(o);fitted(o,o.name,visor,'Head')
for z in [1.657,1.758]:
    for i in range(12):
        a=-1.02+2.04*i/12;b=-1.02+2.04*(i+1)/12
        bar('Helmet / visor gasket',(math.sin(a)*.146,.018-math.cos(a)*.155,z),(math.sin(b)*.146,.018-math.cos(b)*.155,z),.008,.008,edge,'Head')
panel('Helmet / angular chin shield',[(-.085,1.646),(.085,1.646),(.069,1.597),(0,1.58),(-.069,1.597)],-.150,.035,edge,'Head')
for s in [-1,1]:
    block('Helmet / temple rail',(s*.13,-.014,1.71),(.024,.136,.035),edge,'Head',.007)
    block('Helmet / vent',(s*.062,-.158,1.622),(.034,.009,.014),metal,'Head',.004)
    bar('Helmet / red safety seam',(s*.108,.051,1.775),(s*.123,.065,1.685),.006,.008,red,'Head')

# Fitted X-shaped spine plate with layered lower vertebrae.
outline=[(-.154,1.47),(-.099,1.49),(-.064,1.401),(0,1.367),(.064,1.401),(.099,1.49),(.154,1.47),(.114,1.329),(.080,1.257),(.14,1.157),(.09,1.115),(0,1.188),(-.09,1.115),(-.14,1.157),(-.08,1.257),(-.114,1.329)]
panel('Back / thick impact foam',[(x*1.09,1.30+(z-1.30)*1.05) for x,z in outline],.139,.031,edge,'Spine')
panel('Back / sculpted X protector',outline,.17,.033,shell,'Spine')
panel('Back / center spine shield',[(-.047,1.44),(.047,1.44),(.067,1.33),(.043,1.225),(-.043,1.225),(-.067,1.33)],.205,.022,edge,'Spine')
for i in range(4):
    z=1.143-i*.068;w=.092+i*.012
    panel('Lumbar / articulated plate '+str(i+1),[(-w,z+.029),(w,z+.029),(w*.9,z-.033),(0,z-.047),(-w*.9,z-.033)],.161,.026,shell,'Spine02')
    for s in [-1,1]:ellipsoid('Lumbar / rivet',(s*w*.72,.192,z),(.005,.004,.005),metal,'Spine02',12)
for s in [-1,1]:
    bar('Harness / back shoulder',(s*.127,.19,1.47),(s*.168,.158,1.25),.029,.021,edge,'Spine')
    bar('Harness / front shoulder',(s*.12,-.145,1.46),(s*.13,-.18,1.19),.033,.014,edge,'Spine')
    block('Harness / front buckle',(s*.129,-.189,1.365),(.045,.015,.047),metal,'Spine',.007)
    block('Jacket / chest pocket',(s*.09,-.143,1.306),(.117,.029,.137),cloth,'Spine',.012)
bar('Jacket / zipper',(0,-.177,1.087),(0,-.156,1.494),.007,.007,metal,'Spine')
block('Waist / harness belt',(0,.013,1.044),(.336,.316,.045),edge,'Hips',.012)
block('Waist / buckle',(0,-.162,1.044),(.065,.017,.04),metal,'Hips',.007)

for side,s in [('Left',1),('Right',-1)]:
    upper=side+'Arm';fore=side+'ForeArm';hand=side+'Hand';leg=side+'Leg';foot=side+'Foot'
    shoulder=midpoint(upper,.12)
    ellipsoid(side+' shoulder / foam',shoulder+Vector((s*.027,.006,.016)),(.092,.096,.102),edge,upper)
    ellipsoid(side+' shoulder / molded cup',shoulder+Vector((s*.060,-.013,.018)),(.048,.097,.071),shell,upper)
    elbow=arm.data.bones[fore].head_local
    ellipsoid(side+' elbow / protector',elbow+Vector((s*.026,-.012,0)),(.055,.046,.065),shell,fore)
    bracer=midpoint(fore,.57)
    o=block(side+' forearm / impact guard',bracer+Vector((0,-.041,0)),(.095,.083,.188),shell,fore,.022)
    o.rotation_euler=(arm.data.bones[fore].tail_local-arm.data.bones[fore].head_local).to_track_quat('Z','Y').to_euler()
    for t in [.30,.80]:
        c=midpoint(fore,t);o=block(side+' forearm / retention strap',c,(.104,.087,.022),edge,fore,.006)
        o.rotation_euler=(arm.data.bones[fore].tail_local-arm.data.bones[fore].head_local).to_track_quat('Z','Y').to_euler()
    ellipsoid(side+' glove / knuckle guard',midpoint(hand,.5)+Vector((0,-.027,0)),(.048,.026,.031),shell,hand)
    knee=arm.data.bones[leg].head_local
    ellipsoid(side+' knee / impact padding',knee+Vector((0,-.037,0)),(.081,.057,.098),edge,leg)
    ellipsoid(side+' knee / molded armor',knee+Vector((0,-.072,.009)),(.067,.033,.077),shell,leg)
    shin=midpoint(leg,.50)
    block(side+' boot / shin plate',shin+Vector((0,-.045,-.033)),(.095,.050,.239),edge,leg,.020)
    for t in [.39,.65,.81]:
        c=midpoint(leg,t);block(side+' boot / closure strap',c+Vector((0,-.083,0)),(.115,.019,.024),shell,leg,.006)
        block(side+' boot / latch',c+Vector((s*.045,-.095,0)),(.024,.013,.023),metal,leg,.004)
    f=midpoint(foot,.45)
    ellipsoid(side+' boot / leather shaft',(f.x,.01,.22),(.071,.074,.151),edge,leg)
    ellipsoid(side+' boot / reinforced toe',(f.x,-.08,.062),(.076,.136,.054),edge,foot)
    bar(side+' boot / toe reinforcement',(f.x-.052,f.y-.037,f.z+.014),(f.x+.052,f.y-.037,f.z+.014),.012,.012,edge,foot)

# Pack the generated reference into the editable project.
im=bpy.data.images.load(str(folder/'higgsfield-six-view.png'));im.pack()
ref=bpy.data.objects.new('Higgsfield / approved six-view reference',None);bpy.data.collections['Armored rider / source references'].objects.link(ref)
ref.empty_display_type='IMAGE';ref.data=im;ref.empty_display_size=3;ref.location=(-2,.55,1.05);ref.rotation_euler=(math.pi/2,0,0);ref.hide_render=True
root['status']='Completed fitted armored rider';root['reference_job']='a6d70847-f8e8-4654-bb67-11b4fd45bb32';root['forward_axis']='-Y'
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'DS_Armored_Rider_01.blend'))

# Export one joined skin mesh to keep mobile draw calls low; the .blend retains editable parts.
bpy.ops.object.select_all(action='DESELECT')
for o in [base,*parts]:o.select_set(True)
bpy.context.view_layer.objects.active=base;bpy.ops.object.join();base.name='Armored_Rider_Surface'
bpy.ops.object.select_all(action='DESELECT');base.select_set(True);arm.select_set(True);root.select_set(True)
out=folder.parents[1]/'public/exports/glb/DS_Armored_Rider_01';out.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/'DS_Armored_Rider_01_LOD1.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True)

# Render a clear three-angle modeling preview.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20
scene.render.resolution_x=1080;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
if not scene.world:scene.world=bpy.data.worlds.new('Rider preview studio')
scene.world.color=(.18,.18,.18)
for loc,power,size in [((3,-4,5),750,4),((-3,-2,3),500,3),((1,3,4),850,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.name='Preview floor';ground.data.materials.append(material('Preview floor',(.14,.16,.16),.85))
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=2.22
for view,loc in [('front',(2.8,-5,2.3)),('rear',(-2.8,5,2.3)),('profile',(5,0,1.55))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,.96))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(folder/(view+'-preview.png'));bpy.ops.render.render(write_still=True)
report={'reference_job':root['reference_job'],'mesh_vertices':len(base.data.vertices),'triangles':sum(len(p.vertices)-2 for p in base.data.polygons),'bones':len(arm.data.bones),'editable_gear_parts':len(parts),'glb_bytes':(out/'DS_Armored_Rider_01_LOD1.glb').stat().st_size}
(folder/'model-report.json').write_text(json.dumps(report,indent=2));print('ARMORED_RIDER_COMPLETE',json.dumps(report))
