"""Distant Detroit skyline from OSM footprints, with RenCen floor bands.
Approximate exterior LOD, not a survey-grade/photogrammetric reconstruction.
Coordinates shared with Belle Isle. No added gameplay collision.
"""
import bpy,math,json,pathlib,xml.etree.ElementTree as ET
from mathutils.geometry import tessellate_polygon
from mathutils import Vector
R=pathlib.Path(__file__).resolve().parents[1];D=json.loads((R/'game/public/belle/map.json').read_text());O=D['origin']
bpy.ops.wm.read_factory_settings(use_empty=True)
def project(lon,lat):return ((lon-O[0])*111320*math.cos(O[1]*math.pi/180),(lat-O[1])*111320)
def material(n,c,metal=0,rough=.65):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
mats=[material('Detroit limestone',(.43,.39,.32)),material('Detroit brick',(.32,.20,.13)),material('Detroit reflective blue glass',(.12,.23,.30),.5,.25),material('RenCen silver floor bands',(.35,.40,.43),.65,.38),material('Detroit riverbank',(.21,.25,.20))]
verts=[[] for _ in mats];faces=[[] for _ in mats]
def prism(points,low,high,mi):
 if len(points)>2 and points[0]==points[-1]:points=points[:-1]
 if len(points)<3:return
 n=len(points);v=verts[mi];f=faces[mi];offset=len(v);v.extend([(x,y,low)for x,y in points]+[(x,y,high)for x,y in points]);area=sum(points[i][0]*points[(i+1)%n][1]-points[(i+1)%n][0]*points[i][1]for i in range(n))
 for i in range(n):j=(i+1)%n;face=(offset+i,offset+j,offset+n+j,offset+n+i);f.append(face if area>0 else face[::-1])
 ring=[Vector((x,y,high))for x,y in points]
 for tri in tessellate_polygon([ring]):
  indices=tuple(offset+n+(p if isinstance(p,int)else ring.index(p))for p in tri);f.append(indices if area>0 else indices[::-1])
def number(t,k,default=0):
 try:return float(t.get(k,str(default)).split(' ')[0])
 except:return default
root=ET.parse(R/'research/detroit-skyline.osm').getroot();nodes={n.get('id'):project(float(n.get('lon')),float(n.get('lat')))for n in root.findall('node')};features=[]
for w in root.findall('way'):
 t={x.get('k'):x.get('v')for x in w.findall('tag')}
 if not('building'in t or 'building:part'in t):continue
 p=[nodes[n.get('ref')]for n in w.findall('nd')if n.get('ref')in nodes]
 if len(p)<4 or p[0]!=p[-1]:continue
 h=number(t,'height',number(t,'building:levels',3)*3.6);low=number(t,'min_height');cx=sum(x for x,y in p[:-1])/(len(p)-1);cy=sum(y for x,y in p[:-1])/(len(p)-1)
 if not(-4500<cx<-1750 and -3000<cy<800):continue
 features.append(dict(id=w.get('id'),tags=t,p=p,h=h,low=low,cx=cx,cy=cy))
# Parent footprints may duplicate their detailed building parts. Retain just their low podium.
def inside(x,y,p):
 c=False
 for i in range(len(p)-1):
  a,b=p[i],p[i+1]
  if (a[1]>y)!=(b[1]>y)and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
 return c
parts=[f for f in features if 'building:part'in f['tags']];inventory=[]
for f in features:
 t,p,h,low=f['tags'],f['p'],f['h'],f['low'];name=t.get('name',f['id']);nearRen=math.hypot(f['cx']-project(-83.03978,42.328964)[0],f['cy']-project(-83.03978,42.328964)[1])<220
 children=[a for a in parts if a['id']!=f['id'] and inside(a['cx'],a['cy'],p)]if'building:part'not in t else[]
 if children:h=min(h,max(3,min(a['low']for a in children)))
 if h<=low:continue
 glass=t.get('building:material')=='glass' or nearRen and h>60 or 'Blue Cross'in name or 'Hudson'in name
 mi=2 if glass else 1 if any(s in name for s in ['Guardian','Stott'])or t.get('building:material')=='brick' else 0
 if h<12 and not nearRen:continue
 # Preserve the recognizable stepped crowns of the two masonry landmarks where OSM is a single footprint.
 if not children and ('Penobscot Building (1928)'in name or name=='Guardian Building'):
  prism(p,2+low,2+h*.76,mi)
  for a,b,scale in[(.76,.88,.81),(.88,.96,.61),(.96,1,.39)]:prism([(f['cx']+(x-f['cx'])*scale,f['cy']+(y-f['cy'])*scale)for x,y in p],2+h*a,2+h*b,mi)
 else:prism(p,2+low,2+h,mi)
 if nearRen and h>90:
  expanded=[(f['cx']+(x-f['cx'])*1.004,f['cy']+(y-f['cy'])*1.004)for x,y in p]
  for z in range(int(low)+3,int(h),4):prism(expanded,2+z,2+z+.38,3)
 if h>70:inventory.append({'name':name,'id':f['id'],'x':round(f['cx'],2),'z':round(-f['cy'],2),'height':h})
# Far bank extends the existing mainland toward downtown; no river-covering plane.
river=ET.parse(R/'research/ambassador-bridge.osm').getroot()
rn={n.get('id'):project(float(n.get('lon')),float(n.get('lat'))) for n in river.findall('node')}
rw={w.get('id'):[n.get('ref') for n in w.findall('nd')] for w in river.findall('way')}
# OSM Detroit River relation 5678328: real bank outlines keep both tower
# foundations on their respective shores, instead of ending the US bank early.
us=[]
for wid in ['1099749840','1099749839','3773735']:
 us.extend([rn[n] for n in reversed(rw[wid]) if n in rn])
shore=[D['mainland'][0],D['mainland'][3],[-2000,1280],[-2700,1720],[-3400,2110],[-4500,2700]]+[(x,-y) for x,y in us]+[[-8500,-1200]]
prism([(x,-z)for x,z in shore],-1,1.98,4)
canada=[rn[n] for n in rw['23740587'] if n in rn and rn[n][1]>-8000]
if len(canada)>2:prism(canada+[(canada[-1][0],-10000),(2500,-10000),(2500,-3500)],-1,1.98,4)
exec((R/'tools/ambassador_skyline.py').read_text())
for i,m in enumerate(mats):
 mesh=bpy.data.meshes.new(m.name);mesh.from_pydata(verts[i],[],faces[i]);mesh.update();o=bpy.data.objects.new('Detroit Skyline • '+m.name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m)
bpy.ops.object.select_all(action='SELECT');bpy.ops.wm.save_as_mainfile(filepath=str(R/'authoring/Detroit_Skyline.blend'));bpy.ops.export_scene.gltf(filepath=str(R/'game/public/belle/detroit-skyline.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True);bpy.ops.export_scene.fbx(filepath=str(R/'UnityProject/Assets/BelleIsle/Detroit_Skyline.fbx'),use_selection=True,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,add_leaf_bones=False)
(R/'research/skyline-inventory.json').write_text(json.dumps(inventory,indent=2));print('SKYLINE_DONE',len(features),'mapped footprints;',sum(len(v)for v in verts),'vertices;',len(mats),'batches')
