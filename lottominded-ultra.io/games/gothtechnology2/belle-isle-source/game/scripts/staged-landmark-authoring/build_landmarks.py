#!/usr/bin/env python3
"""Generate offline, source-aligned landmark modeling studies; DO NOT deploy as production assets.
Pure geometric authoring; no web imagery or unlicensed texture pixels. Requires trimesh/numpy/Pillow.
Scene local coordinates: x=u, y=height above game ground, z=-v, except fountain x=side z=along.
"""
import json, math, hashlib
from collections import defaultdict
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals
from aquarium_roof_ends import end_geometry

ROOT=Path(__file__).resolve().parent
for d in ('models','previews','qa','source'): (ROOT/d).mkdir(exist_ok=True)
MAT = {
 'steel':([220,227,224,255],.58,.46,'OPAQUE'),
 'glass':([99,162,181,154],.0,.11,'BLEND'),
 'greenGlass':([140,181,151,167],.0,.17,'BLEND'),
 'brick':([139,93,65,255],0,.9,'OPAQUE'),
 'limestone':([195,177,141,255],0,.85,'OPAQUE'),
 'copper':([60,119,102,255],.45,.55,'OPAQUE'),
 'darkIron':([67,78,76,255],.68,.48,'OPAQUE'),
 'marble':([219,216,197,255],0,.68,'OPAQUE'),
 'marbleEdge':([185,181,165,255],0,.75,'OPAQUE'),
 'water':([82,158,174,190],.0,.10,'BLEND'),
 'asphalt':([74,76,75,255],0,.95,'OPAQUE'),
 'sidewalk':([154,151,141,255],0,.87,'OPAQUE'),
 'stripe':([229,219,174,255],0,.80,'OPAQUE'),
 'grass':([87,111,79,255],0,.99,'OPAQUE'),
}

class Study:
 def __init__(self, name): self.name=name; self.groups=defaultdict(list); self.notes={}
 def put(self, category, mesh):
  if mesh is None or len(mesh.faces)==0: return
  mesh.process(validate=True)
  if not np.all(np.isfinite(mesh.vertices)) or mesh.area <=0: raise ValueError('invalid mesh '+category)
  self.groups[category].append(mesh)
 def box(self, group, pos, size):
  if min(size)<.001: return
  m=trimesh.creation.box(extents=size);m.apply_translation(pos);self.put(group,m)
 def cyl(self,group,pos,radius,height,segments=48):
  if radius<=0 or height<=0: raise ValueError('invalid cylinder')
  m=trimesh.creation.cylinder(radius=radius,height=height,sections=segments);
  m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]));m.apply_translation(pos);self.put(group,m)
 def ring(self,group,outer,inner,height,segments=72):
  if not (outer>inner>0 and height>0):raise ValueError('Invalid ring')
  verts=[]
  for r,y in [(outer,0),(outer,height),(inner,0),(inner,height)]:
   for k in range(segments):
    t=2*math.pi*k/segments;verts.append([r*math.cos(t),y,r*math.sin(t)])
  faces=[]
  for k in range(segments):
   j=(k+1)%segments
   # Four concentric rings: outer bottom/top then inner bottom/top.
   for a,b in ((0,1),(1,3),(3,2),(2,0)):
    aa=a*segments+k;bb=a*segments+j;cc=b*segments+j;dd=b*segments+k
    faces.extend([[aa,bb,cc],[aa,cc,dd]])
  m=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=True)
  m.fix_normals();self.put(group,m)
 def rod(self,group,a,b,r=.035,sections=6):
  a,b=np.asarray(a,dtype=float),np.asarray(b,dtype=float);d=b-a; dist=np.linalg.norm(d)
  if dist < .01: return
  m=trimesh.creation.cylinder(radius=r,height=dist,sections=sections)
  m.apply_transform(trimesh.geometry.align_vectors([0,0,1],d/dist));m.apply_translation((a+b)/2);self.put(group,m)
 def quad(self, group, pts):
  # Surface intentionally double-sided in the PBR material; glazing has no collision role.
  m=trimesh.Trimesh(vertices=np.asarray(pts,dtype=float),faces=np.array([[0,1,2],[0,2,3]]),process=False)
  self.put(group,m)
 def arc(self,group,inner,outer,spring,z,thick,steps=16):
  # A true architectural arch with empty center, not a mapped photograph.
  for i in range(steps):
   a=math.pi*i/steps;b=math.pi*(i+1)/steps
   p=[(inner*math.cos(a),spring+inner*math.sin(a)),(outer*math.cos(a),spring+outer*math.sin(a)),(outer*math.cos(b),spring+outer*math.sin(b)),(inner*math.cos(b),spring+inner*math.sin(b))]
   v=np.array([[x,y,z-thick/2] for x,y in p]+[[x,y,z+thick/2] for x,y in p]);f=[]
   f.extend([[0,2,1],[0,3,2],[4,5,6],[4,6,7]])
   for k in range(4):
    j=(k+1)%4;f.extend([[k,j,4+j],[k,4+j,4+k]])
   m=trimesh.Trimesh(vertices=v,faces=f,process=True);m.fix_normals();self.put(group,m)
 def wall_box(self,group,a,b,y,height,thickness,outset=0,inset=0):
  # A rigid wall strip along the retained collision boundary in (u,v).
  # The original material, vertical extent and physical strip thickness stay fixed.
  a,b=np.array(a,dtype=float),np.array(b,dtype=float);d=b-a;length=np.linalg.norm(d)
  if length<=2*inset:raise ValueError('Wall strip shorter than preserved frame inset')
  direction=d/length;center=(a+b)/2
  normal=np.array([-direction[1],direction[0]])
  if np.dot(normal,np.array([-13.5,.3])-center)>0:normal=-normal
  center=center+normal*outset
  m=trimesh.creation.box(extents=[length-2*inset,height,thickness])
  m.apply_transform(trimesh.transformations.rotation_matrix(math.atan2(d[1],d[0]),[0,1,0]))
  m.apply_translation([center[0],y,-center[1]]);self.put(group,m)
 def flat_plate(self,group,outline,y,thickness):
  # Keep every perimeter corner; a centroid fan adds detail without decimation.
  p=np.array([[u,-v] for u,v in outline],dtype=float);count=len(p);center=p.mean(axis=0)
  verts=[[x,y-thickness/2,z] for x,z in p]+[[x,y+thickness/2,z] for x,z in p]+[[center[0],y-thickness/2,center[1]],[center[0],y+thickness/2,center[1]]]
  faces=[]
  for i in range(count):
   j=(i+1)%count;faces.extend([[2*count,j,i],[2*count+1,count+i,count+j],[i,j,count+j],[i,count+j,count+i]])
  m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
  m.fix_normals();self.put(group,m)
 def export(self, name, selected=None):
  scene=trimesh.Scene();sizes={}
  for label,items in sorted(self.groups.items()):
   if selected is not None and label.split('|')[0] not in selected: continue
   matlabel=label.split('|')[-1];m=trimesh.util.concatenate(items)
   color,metal,rough,alpha=MAT[matlabel]
   material=PBRMaterial(name=matlabel,baseColorFactor=color,metallicFactor=metal,roughnessFactor=rough,alphaMode=alpha,doubleSided=alpha=='BLEND')
   m.visual=TextureVisuals(material=material)
   m.metadata['component']=label.rsplit('|',1)[0]
   scene.add_geometry(m,node_name=label.replace('|','__'),geom_name=label.replace('|','__'))
   sizes[label]={'vertices':len(m.vertices),'triangles':len(m.faces),'bounds':np.round(m.bounds,3).tolist(),'watertight':bool(m.is_watertight),'windingConsistent':bool(m.is_winding_consistent)}
  path=ROOT/'models'/name
  path.write_bytes(scene.export(file_type='glb'))
  return {'file':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,
          'bounds_m':np.round(scene.bounds,3).tolist(),'pieces':sizes,'total_triangles':sum(v['triangles'] for v in sizes.values()),'total_mesh_groups':len(sizes)}

def greenhouse():
 a=Study('Anna Scripps Whitcomb Conservatory')
 # 85 ft upper dome is a published approximate height above its local base.
 # 20 dome sectors is also consistent with 2025 refurbishment documentation.
 R=10.15; y0=8.4; h=25.9-y0; sector=20; layers=8
 def cap(radius,sinAngle): return [radius*math.cos(sinAngle), y0+h*math.sin(sinAngle)]
 def pos(t,phi): return [R*math.cos(phi)*math.cos(t),y0+h*math.sin(phi),R*math.cos(phi)*math.sin(t)]
 for i in range(sector):
  t0=2*math.pi*i/sector;t1=2*math.pi*(i+1)/sector
  for j in range(layers):
   p0=(math.pi/2-.12)*j/layers;p1=(math.pi/2-.12)*(j+1)/layers
   a.quad('PalmHouse/DomeGlazing|glass',[pos(t0,p0),pos(t1,p0),pos(t1,p1),pos(t0,p1)])
  for j in range(layers):
   pp=(math.pi/2-.12)*j/layers; qq=(math.pi/2-.12)*(j+1)/layers
   a.rod('PalmHouse/DomeRadialRibs|steel',pos(t0,pp),pos(t0,qq),.058)
 for j in (0,2,4,6,8):
  phi=(math.pi/2-.12)*j/layers
  for k in range(sector):a.rod('PalmHouse/DomeHorizontalRings|steel',pos(k*2*math.pi/sector,phi),pos((k+1)*2*math.pi/sector,phi),.05)
 a.cyl('PalmHouse/LanternCap|steel',(0,25.1,0),2.0,1.55,20)

 for i in range(64):
  t0=2*math.pi*i/64;t1=2*math.pi*(i+1)/64
  a.rod('PalmHouse/DomeBaseCoping|steel',(R*math.cos(t0),y0,R*math.sin(t0)),(R*math.cos(t1),y0,R*math.sin(t1)),.115,8)
 # Glazed drum has panels rather than a solid sealed cylinder.
 for i in range(sector):
  t0=2*math.pi*i/sector;t1=2*math.pi*(i+1)/sector
  pt=lambda th,y:[R*math.cos(th),y,R*math.sin(th)]
  a.quad('PalmHouse/DrumGlass|glass',[pt(t0,3.5),pt(t1,3.5),pt(t1,8.3),pt(t0,8.3)])
  a.rod('PalmHouse/DrumFrames|steel',pt(t0,3.5),pt(t0,8.3),.075)

 for i in range(64):
  t0=2*math.pi*i/64;t1=2*math.pi*(i+1)/64
  a.rod('PalmHouse/DrumCoping|steel',(R*math.cos(t0),3.45,R*math.sin(t0)),(R*math.cos(t1),3.45,R*math.sin(t1)),.085,8)
 # Long greenhouse wings; footprint extent guided by the existing 82m map span.
 for side in (-1,1):
  zmin,zmax=(11.0,41.7) if side==1 else (-40.95,-11.0)
  N=10; width=5.1; ylow=2.5; yroof=5.45
  zlist=np.linspace(zmin,zmax,N+1)
  for i in range(N):
   zl,zr=zlist[i],zlist[i+1]
   for x in (-width,width):a.quad('Wings/SideGlass|greenGlass',[[x,0.35,zl],[x,0.35,zr],[x,yroof,zr],[x,yroof,zl]])
   for j in range(8):
    x0=-width+j*2*width/8; x1=-width+(j+1)*2*width/8
    roof=lambda x,z:[x, yroof+2.1*(1-(x/width)**2),z]
    a.quad('Wings/CurvedRoofGlass|glass',[roof(x0,zl),roof(x1,zl),roof(x1,zr),roof(x0,zr)])
  for z in zlist:
   for x in (-width,width):a.rod('Wings/VerticalRibs|steel',[x,.2,z],[x,yroof,z],.055)
   for j in range(8):
    x0=-width+j*2*width/8;x1=-width+(j+1)*2*width/8
    a.rod('Wings/CurvedRoofRibs|steel',[x0,yroof+2.1*(1-(x0/width)**2),z],[x1,yroof+2.1*(1-(x1/width)**2),z],.047)
  a.box('Wings/SillRails|steel',(0,.3,(zmin+zmax)/2),(2*width,.22,zmax-zmin))
  a.box('Wings/EndGlazing|greenGlass',(0,2.85,zmax if side==1 else zmin),(9.95,5.1,.032))
 # Conservatory west vestibule: use the retained local wall segments rather
 # than the study's symmetric +/-4.6m width. All heights, strip thicknesses,
 # doorway parts, site placement and materials remain the authored values.
 alignment=json.loads((ROOT/'source'/'vestibule_alignment.json').read_text())
 if alignment['sourceMapBlobSha']!='e5c741279fe981b928c9fd4d58a72d72ae7cb017':raise ValueError('Unexpected vestibule alignment source')
 walls={w['wallIndex']:w for w in alignment['vestibuleWalls']}
 north=[walls[60]['b'],walls[60]['a'],walls[62]['b'],walls[63]['b'],walls[64]['b']]
 south=[walls[61]['a'],walls[61]['b'],walls[59]['a'],walls[58]['a'],walls[57]['a']]
 def clipped_east(segment):
  aa,bb=np.array(segment['a']),np.array(segment['b']);t=(-11-aa[0])/(bb[0]-aa[0])
  if not 0<=t<=1:raise ValueError('Vestibule inner edge left the source segment')
  return (aa+(bb-aa)*t).tolist()
 north_end=clipped_east(walls[65]);south_end=clipped_east(walls[56])
 for chain in (north,south):
  for aa,bb in zip(chain,chain[1:]):
   a.wall_box('Vestibule/WestFacadePiers|steel',aa,bb,3.25,6.5,.17)
   a.wall_box('Vestibule/GlassSideLights|glass',aa,bb,1.9,2.95,.048,outset=.08,inset=.135)
 for aa,bb in ((north[-1],north_end),(south[-1],south_end)):
  a.wall_box('Vestibule/SideGlass|glass',aa,bb,3.1,6.2,.052)
 a.box('Vestibule/DoorHeader|steel',(-17,4.82,0),(.22,3.4,3.38))
 a.box('Vestibule/DoorJambs|steel',(-17,1.6,-1.68),(.25,3.2,.06))
 a.box('Vestibule/DoorJambs|steel',(-17,1.6,1.68),(.25,3.2,.06))
 footprint=[north_end,*reversed(north),*south,south_end]
 # Preserve the original roof's 0.2m west overhang and fixed u=-11 inner edge.
 roof=[[-11+(u+11)*(6.2/6),v] for u,v in footprint]
 a.flat_plate('Vestibule/TransparentRoof|glass',roof,6.3,.075)
 a.box('Vestibule/FlushThreshold|sidewalk',(-18.8,.04,0),(5.6,.08,3.3))
 # The west end lies across the retained Palm House -> Show House connection.
 # Keep one closed glazing solid around that opening, with no coincident box
 # interfaces that would add extra alpha layers. The far exterior pane is exact.
 connector=json.loads((ROOT/'source'/'showhouse_connector_alignment.json').read_text())
 if connector['sourceMapBlobSha']!=alignment['sourceMapBlobSha']:raise ValueError('Unexpected Show House connector source')
 pane=connector['retainedWestPane'];opening=connector['openingTopY']
 bounds=connector['connectorWalls'];verts=[]
 for x in (pane['centerU']-pane['thickness']/2,pane['centerU']+pane['thickness']/2):
  zs=[]
  for wall in bounds:
   aa,bb=wall['a'],wall['b'];t=(x-aa[0])/(bb[0]-aa[0])
   if not 0<=t<=1:raise ValueError('Show House pane left the retained connector segment')
   zs.append(-(aa[1]+t*(bb[1]-aa[1])))
  zl,zr=sorted(zs);outer_l,outer_r=pane['outerZ'];bottom,top=pane['bottomY'],pane['topY']
  if not outer_l<zl<zr<outer_r or not bottom<opening<top:raise ValueError('Invalid Show House connector opening')
  verts.extend([[x,y,z] for z,y in [(outer_l,bottom),(zl,bottom),(zl,opening),(zr,opening),(zr,bottom),(outer_r,bottom),(outer_r,top),(outer_l,top)]])
 # Six triangles fill each concave face without entering the open connector.
 face=[(0,1,2),(0,2,7),(2,3,6),(2,6,7),(3,4,5),(3,5,6)]
 faces=[list(t) for t in face]+[[a+8,c+8,b+8] for a,b,c in face]
 for i in range(8):
  j=(i+1)%8;faces.extend([[i,j+8,j],[i,i+8,j+8]])
 west=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
 west.fix_normals()
 if not west.is_watertight or not west.is_winding_consistent or west.volume<=0:raise ValueError('Show House connector glazing is not a closed solid')
 a.put('ShowHouse/EndGlazing|greenGlass',west)
 a.box('ShowHouse/EndGlazing|greenGlass',(22.7,3.1,0),(.055,5.8,17.6))
 for z in (-9.0,9.0):a.box('ShowHouse/SideGlazing|greenGlass',(16.9,3.1,z),(11.6,5.8,.054))
 for x in np.linspace(11.1,22.7,9):
  a.rod('ShowHouse/RoofTrusses|steel',(x,5.85,-9),(x,7.95,0),.052);a.rod('ShowHouse/RoofTrusses|steel',(x,7.95,0),(x,5.85,9),.052)
 a.quad('ShowHouse/SlopedRoofGlass|glass',[[11.1,5.85,-9],[22.7,5.85,-9],[22.7,7.95,0],[11.1,7.95,0]])
 a.quad('ShowHouse/SlopedRoofGlass|glass',[[11.1,7.95,0],[22.7,7.95,0],[22.7,5.85,9],[11.1,5.85,9]])
 a.notes={'entranceCenterLocal':[ -17, 0, 0 ],'entranceGapLocalZ':[-1.7,1.7],
  'domeHeightM':25.9,'domeHeightEvidence':'approximate 85 ft published; other dimensions estimated',
  'domeSectorCount':20,'wingsEndV':[-40.95,41.7],
  'vestibuleAlignment':{'sourceHead':alignment['sourceHead'],'sourceMapBlobSha':alignment['sourceMapBlobSha'],'wallIndices':[56,57,58,59,60,61,62,63,64,65],'existingColliderAndInteriorUnchanged':True,'heightsAndMaterialsUnchanged':True},
  'showHouseConnector':{'sourceHead':connector['sourceHead'],'sourceMapBlobSha':connector['sourceMapBlobSha'],'wallIndices':[17,32],'westPaneU':pane['centerU'],'openingTopY':opening,'paneThickness':pane['thickness'],'existingColliderAndInteriorUnchanged':True,'exteriorGlazingAndMaterialsUnchanged':True}}
 return a

def aquarium():
 a=Study('Belle Isle Aquarium')
 # Long brick building, 76m corridor, portal at z=+38 per existing layout.
 for x in (-6.80,6.80):
  # True side-window voids rather than windows concealed in a solid brick box.
  a.box('Facade/LongBrickWallBelowWindows|brick',(x,1.225,0),(.42,2.45,76.0))
  a.box('Facade/LongBrickWallAboveWindows|brick',(x,(4.95+7.6)/2,0),(.42,7.6-4.95,76.0))
  windows=[(float(z)-1.175,float(z)+1.175) for z in np.linspace(-31,31,12)]
  gaps=[(-38.0,windows[0][0])]+[(windows[i][1],windows[i+1][0]) for i in range(11)]+[(windows[-1][1],38.0)]
  for zl,zr in gaps:
   if zr-zl>0:a.box('Facade/BrickWindowJambs|brick',(x,(2.45+4.95)/2,(zl+zr)/2),(.42,2.5,zr-zl))
 
 a.box('Facade/RearWall|brick',(0,3.8,-38),(13.6,7.6,.42))
 # The front facade is physically split around the open central arched portal.
 for side in (-1,1):
  # Preserve front window void 2.3 m wide at x=+/-4.7, y=2.525..4.875.
  xl,xr=(-6.8,-1.65) if side<0 else (1.65,6.8)
  xc=side*4.7;wl,wr=xc-1.15,xc+1.15
  a.box('Facade/FrontBrickBelowWindows|brick',((xl+xr)/2,1.2625,38),(xr-xl,2.525,.4))
  a.box('Facade/FrontBrickAboveWindows|brick',((xl+xr)/2,(4.875+7.6)/2,38),(xr-xl,7.6-4.875,.4))
  for l,r in ((xl,wl),(wr,xr)):
   if r>l:a.box('Facade/FrontBrickWindowJambs|brick',((l+r)/2,3.7,38),(r-l,2.35,.4))
 
 # The curved void from y=0..5.1 stays physically open. Spandrels are above the arch.
 spring=3.45; ri=1.65
 for i in range(24):
  x0=-ri+2*ri*i/24;x1=-ri+2*ri*(i+1)/24; xm=.5*(x0+x1)
  bottom=spring+math.sqrt(max(0,ri**2-xm**2))
  if 7.6-bottom>.02: a.box('Facade/ArchSpandrels|brick',(xm,(bottom+7.6)/2,38),((x1-x0)*1.01,7.6-bottom,.39))
 # Projecting stone entry with carved voussoirs and real depth.
 a.arc('Portal/StoneVoussoirs|limestone',ri,2.35,spring,38.8,1.35,22)
 for x in (-2.2,2.2):
  a.box('Portal/StoneColumns|limestone',(x,1.77,38.8),(.77,3.54,1.35))
  a.box('Portal/StoneBases|marbleEdge',(x,.42,39.0),(1.02,.84,1.78))
 a.box('Portal/EngravedSignStone|limestone',(0,6.25,38.82),(5.8,.55,1.5))
 a.cyl('Portal/AbstractNeptuneCartoucheUnverified|limestone',(0,7.38,38.85),.72,.42,24)
 # Stone tunnel in the passage, only jambs and arched ceiling (no door plane).
 for x in (-1.81,1.81):a.box('Portal/RecessJambs|limestone',(x,2.05,37.45),(.21,4.1,1.85))
 a.arc('Portal/InnerRecessArch|limestone',1.66,1.79,spring,37.45,1.8,16)
 # Original stairs profile from map, in local z=-v. Site's world base is y=2.
 stairs={'rise':.15,'count':4,'tread':.36,'width':4.2,'outsideStart':-41.04,'landingStart':-39.6,'landingEnd':-36.4,'insideEnd':-34.96}
 for i in range(stairs['count']):
  zl=41.04-i*.36; zr=zl-.36; ht=.15*(i+1)
  a.box('Entrance/OutsideSteps|marble', (0,ht/2,(zl+zr)/2), (4.2,ht,zl-zr))
 a.box('Entrance/FlatLanding|marble',(0,.3,38.0),(4.2,.60,3.20))
 for i in range(stairs['count']):
  zl=36.4-i*.36;zr=zl-.36; ht=.15*(3-i)
  if ht>0: a.box('Entrance/InsideSteps|marble',(0,ht/2,(zl+zr)/2),(4.2,ht,zl-zr))
 # Two guardrails over stair flights; do not place an opaque doorway or railing across the entrance gap.
 for x in (-2.05,2.05):
  a.rod('Entrance/Rails|darkIron',(x,.9,41),(x,1.55,37.0),.037)
  for z in (41,39.5,38): a.rod('Entrance/RailPosts|darkIron',(x,.0,z),(x,1.15,z),.035)
 # Copper-green standing seam barrel-vault roof (estimated geometry).
 rx=6.9; top=9.8; edge=7.65
 for i in range(24):
  x0=-rx+2*rx*i/24;x1=-rx+2*rx*(i+1)/24
  f=lambda x,z:[x,edge+(top-edge)*max(0,1-(x/rx)**2),z]
  a.quad('Roof/PatinatedCopperPanels|copper',[f(x0,-38.2),f(x0,38.2),f(x1,38.2),f(x1,-38.2)])
  if i%2==0:a.rod('Roof/StandingSeams|darkIron',f(x0,-38.2),f(x0,38.2),.026)
 # Close only the demonstrated open upper ends of the existing estimated roof.
 # Keep its profile/height, wall top, copper and all earlier vertices unchanged.
 profile=[f(-rx+2*rx*i/24,0)[:2] for i in range(25)]
 vertices,faces=end_geometry(profile,7.6,[-38.2,38.2])
 a.put('Roof/PatinatedCopperPanels|copper',trimesh.Trimesh(vertices=vertices,faces=faces,process=False))
 # Symmetric front window groups; rough placement derived from facade photo.
 for xc in (-4.7,4.7):
  a.box('Facade/FrontWindows|greenGlass',(xc,3.7,38.03),(2.30,2.35,.07))
  for d in (-.63,.0,.63): a.box('Facade/WindowMullions|darkIron',(xc+d,3.7,38.12),(.05,2.36,.05))
 # Side walls, spaced glazed bays; window trim recessed enough not to imply penetrable wall.
 for x in (-6.81,6.81):
  for z in np.linspace(-31,31,12):
   a.box('Facade/SideWindows|greenGlass',(x,3.7,z),(.07,2.5,2.35))
   a.box('Facade/WindowSills|limestone',(x,2.45,z),(.25,.16,2.55))
 a.notes={'entranceCenterLocal':[0,0,38],'physicalOpeningWidthM':3.3,'springHeightEstimatedM':spring,
 'stairs':stairs,'baroqueCarvings':'abstract placeholders, not scanned','roofHeightUnverified':True}
 return a

def scott():
 a=Study('Scott Fountain terrace')
 # Study complements - and MUST NOT duplicate - the existing 6-step distal cascades.
 terrace=[(31.3,.15),(30.7,.30),(30.1,.45),(29.5,.60),(28.9,.75),(28.3,.90)]
 for i,(radius,height) in enumerate(terrace):
  if i<len(terrace)-1:a.ring('Terrace/ConcentricTreads|marble',radius,terrace[i+1][0],height,72)
  else:a.cyl('Terrace/ConcentricTreads|marble',(0,height/2,0),radius,height,72)

 # Central inset basin and parapet: existing site model would remain authoritative.
 a.cyl('Terrace/RaisedBasinPlaceholder|marbleEdge',(0,1.08,0),17.06,.36,72)
 a.cyl('Terrace/WaterPlanePreview|water',(0,1.29,0),16.55,.045,64)
 # Stone stair flights are separated from plaza, extend outward from terrace edge.
 for side in (-1,1):
  for i in range(6):
   h=.15*(i+1); zc=side*(33.75-i*.65)
   a.box('Terrace/FrontApproachSteps|marble',(0,h/2,zc),(22.0,h,.65))
  for x in (-11.2,11.2):a.box('Terrace/StairSideParapets|marbleEdge',(x,.46,side*32.7),(.35,.92,4.5))
 # Coping and plinth are distinct materials that can be independently graded.
 a.cyl('Terrace/Coping|marbleEdge',(0,.92,0),28.45,.16,72)
 a.notes={'mappedUpperBasinRadiusM':17.06,'terraceRadiiAreEstimates':True,'derivedGroundHeightM':None,
 'distalCascadeExistingGame':'Six steps at radius 78.5m to 90m, do not duplicate them'}
 return a

def roads():
 a=Study('Conservatory Drive roadway detail example')
 coords=np.array([[1310.28,1098.38],[1315.08,1095.39],[1322.81,1091.35],[1331.93,1086.85],[1360.36,1074.83],[1366.32,1072.3]])
 origin=np.mean(coords,axis=0);local=coords-origin
 width=7.2 # EXISTING game authored width; sourceWidth=6.3 is not surveyed curb width.
 for i in range(len(local)-1):
  a2,b2=local[i],local[i+1];d=b2-a2;ln=np.linalg.norm(d);tangent=d/ln;normal=np.array([-tangent[1],tangent[0]])
  center=(a2+b2)/2;angle=-math.atan2(d[1],d[0])
  def roadbox(group,offset,w,y,h,start=0,end=None):
   if end is None:end=ln
   if end-start<=.01:return
   mesh=trimesh.creation.box(extents=[end-start,h,w]);mesh.apply_transform(trimesh.transformations.rotation_matrix(angle,[0,1,0]))
   s=(start+end)/2-ln/2
   mesh.apply_translation([center[0]+offset*normal[0]+s*tangent[0],y,center[1]+offset*normal[1]+s*tangent[1]])
   a.put(group,mesh)
  roadbox('Road/ExistingAuthoredWidth|asphalt',0,width,.025,.05)
  last=i==len(local)-2;ramp=min(2.4,ln*.35) if last else 0
  for side in (-1,1):
   sidewalk_offset=side*(width/2+1.04)
   roadbox('Road/EstimatedSidewalk|sidewalk',sidewalk_offset,1.75,.15,.22,0,ln-ramp)
   if last:
    # Sloped curb cut at an example endpoint, NOT asserted to be a surveyed crosswalk.
    start_r=ln-ramp; end_r=ln
    def p(st,lat,y):
     ds=st-ln/2
     return [float(center[0]+ds*tangent[0]+lat*normal[0]),y,float(center[1]+ds*tangent[1]+lat*normal[1])]
    lb,rb=sidewalk_offset-.875,sidewalk_offset+.875
    vs=np.array([p(start_r,lb,.04),p(start_r,rb,.04),p(end_r,lb,.04),p(end_r,rb,.04),
                 p(start_r,lb,.26),p(start_r,rb,.26),p(end_r,lb,.075),p(end_r,rb,.075)])
    faces=[[0,1,5],[0,5,4],[2,6,7],[2,7,3],[0,2,3],[0,3,1],
           [4,5,7],[4,7,6],[0,4,6],[0,6,2],[1,3,7],[1,7,5]]
    m=trimesh.Trimesh(vertices=vs,faces=faces,process=True);m.fix_normals();a.put('Road/ExampleCurbCutRamp|sidewalk',m)
    roadbox('Road/CurbEdges|marbleEdge',side*(width/2+.10),.14,.14,.12,0,ln-ramp)
   else:roadbox('Road/CurbEdges|marbleEdge',side*(width/2+.10),.14,.14,.12)
  # Center lane strip at slightly higher elevation, but no surveyed lane-marking claim.
  roadbox('Road/CenterStripeSample|stripe',0,.11,.059,.015)
 # Curbed intersection transition is an engineering sample only; no surveyed crossing is claimed.
 # Display a lowered curb at the end of the segment; separate from nearby road physics.
 a.notes={'roadId':'107230534','existingGameWidthM':7.2,'recordedSourceWidthM':6.3,
 'sidewalkWidthEstimatedM':1.75,'curbHeightEstimatedM':.12,'actualIntersectionCurbGeometryVerified':False,
 'centerWorldXZ':origin.tolist(),'renderOnlyStudy':True}
 return a

STUDIES=[('Conservatory_Architectural_Study.glb',greenhouse(),{'center_xz':[1330.8,1174.7],'yaw_rad':.313,'localZ':'-v','groundWorldY':2.0,'gameMapId':'107310050'}),
 ('Aquarium_Arched_Entrance_Study.glb',aquarium(),{'center_xz':[1363.78,1167.42],'yaw_rad':-2.828592653589793,'localZ':'-v','groundWorldY':2.0,'gameMapId':'107227742'}),
 ('Scott_Fountain_Terraces_Study.glb',scott(),{'center_xz':[199.34,1310.53],'yaw_rad':-1.18,'localZ':'along','groundWorldY':2.0,'gameMapId':'9146545'}),
 ('Conservatory_Drive_Street_Detail_Study.glb',roads(),{'center_xz':[1334.4633333333,1086.5166666667],'yaw_rad':0,'localZ':'worldZ','groundWorldY':2.0,'gameRoadId':'107230534'})]

LOD_GROUPS={
 'Conservatory_Architectural_Study.glb':{
  1:['PalmHouse/DomeGlazing','PalmHouse/DomeRadialRibs','PalmHouse/DomeHorizontalRings','PalmHouse/LanternCap','PalmHouse/DomeBaseCoping','PalmHouse/DrumGlass','PalmHouse/DrumFrames','PalmHouse/DrumCoping','Wings/SideGlass','Wings/CurvedRoofGlass','Wings/CurvedRoofRibs','Wings/SillRails','Wings/EndGlazing','Vestibule/WestFacadePiers','Vestibule/GlassSideLights','Vestibule/DoorHeader','Vestibule/DoorJambs','Vestibule/TransparentRoof','ShowHouse/EndGlazing','ShowHouse/SlopedRoofGlass'],
  2:['PalmHouse/DomeGlazing','PalmHouse/LanternCap','PalmHouse/DomeBaseCoping','PalmHouse/DrumGlass','Wings/SideGlass','Wings/CurvedRoofGlass','Wings/EndGlazing','Vestibule/WestFacadePiers','Vestibule/DoorHeader','Vestibule/TransparentRoof','ShowHouse/EndGlazing','ShowHouse/SlopedRoofGlass']},
 'Aquarium_Arched_Entrance_Study.glb':{
  1:['Facade/LongBrickWallBelowWindows','Facade/LongBrickWallAboveWindows','Facade/BrickWindowJambs','Facade/RearWall','Facade/FrontBrickBelowWindows','Facade/FrontBrickAboveWindows','Facade/FrontBrickWindowJambs','Facade/ArchSpandrels','Portal/StoneVoussoirs','Portal/StoneColumns','Portal/StoneBases','Portal/EngravedSignStone','Portal/RecessJambs','Portal/InnerRecessArch','Entrance/OutsideSteps','Entrance/FlatLanding','Entrance/InsideSteps','Roof/PatinatedCopperPanels','Facade/FrontWindows','Facade/SideWindows'],
  2:['Facade/LongBrickWallBelowWindows','Facade/LongBrickWallAboveWindows','Facade/BrickWindowJambs','Facade/RearWall','Facade/FrontBrickBelowWindows','Facade/FrontBrickAboveWindows','Facade/FrontBrickWindowJambs','Facade/ArchSpandrels','Portal/StoneVoussoirs','Portal/StoneColumns','Portal/EngravedSignStone','Entrance/OutsideSteps','Entrance/FlatLanding','Entrance/InsideSteps','Roof/PatinatedCopperPanels']},
 'Scott_Fountain_Terraces_Study.glb':{1:['Terrace/ConcentricTreads','Terrace/RaisedBasinPlaceholder','Terrace/WaterPlanePreview','Terrace/FrontApproachSteps','Terrace/StairSideParapets'],2:['Terrace/ConcentricTreads','Terrace/FrontApproachSteps','Terrace/RaisedBasinPlaceholder']},
 'Conservatory_Drive_Street_Detail_Study.glb':{1:['Road/ExistingAuthoredWidth','Road/EstimatedSidewalk','Road/CurbEdges','Road/ExampleCurbCutRamp'],2:['Road/ExistingAuthoredWidth']},
}

if __name__=='__main__':
 reports=[]
 for name,study,placement in STUDIES:
  variants=[]
  for lod in (0,1,2):
   output=name if lod==0 else name.replace('.glb',f'_LOD{lod}.glb')
   selected=None if lod==0 else set(LOD_GROUPS[name][lod])
   report=study.export(output,selected)
   report['lod']=lod
   report['selection']='all modeled components' if lod==0 else 'non-destructive scene subgroup selection; original authoring components unchanged'
   variants.append(report)
  reports.append({'site':study.name,'placement':placement,'authoringAssumptions':study.notes,'lods':variants})
 out={'schema':'belle-isle-landmark-art-studies/v2','baseGameMapCommit':'2a8901996e53b1f93474f3c2165e078b6dd16e57',
      'status':'offline_render_only_study','topologyMatchesOriginalAssets':False,'sourceFootprintGeometryCopiedExactly':False,
      'surveyVerticalAlignmentVerified':False,'collisionUpdated':False,'runtimeIntegrated':False,'productionDeployed':False,
      'models':reports}
 f=ROOT/'qa'/'model_report.json';f.write_text(json.dumps(out,indent=2)+'\n')
 print(json.dumps([(r['site'],[(v['lod'],v['total_triangles'],v['bytes']) for v in r['lods']]) for r in reports],indent=2))
