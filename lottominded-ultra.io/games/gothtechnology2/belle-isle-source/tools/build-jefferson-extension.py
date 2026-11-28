#!/usr/bin/env python3
"""Prepare additive Jefferson corridor geometry from qualified public source data.

Requires Python + Shapely. Existing map/roads/buildings are read-only. Source
median_hgt is not converted because its unit has not been independently verified.
Usage: python tools/build-jefferson-extension.py /absolute/source-directory
"""
from __future__ import annotations
import hashlib, heapq, json, math, sys
from pathlib import Path
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, LineString, Point, box
from shapely.strtree import STRtree
from shapely import constrained_delaunay_triangles
from shapely.ops import transform, unary_union, polygonize, substring

BASE=Path(__file__).resolve().parents[1]
REPO=BASE.parents[3]
SOURCE=Path(sys.argv[1])
OUT=BASE/'game/src/belle/jeffersonExtension.json'
RECEIPT=REPO/'research/geographic/jefferson-realism/extension-receipt.json'
MAP=BASE/'game/public/belle/map.json'
DIST=BASE/'game/src/belle/detroitDistricts.json'
mapdata=json.loads(MAP.read_text());districts=json.loads(DIST.read_text())
O=mapdata['origin'];LAT=111320;LON=LAT*math.cos(math.radians(O[1]))
def project(lon,lat,z=None):return ((lon-O[0])*LON,-(lat-O[1])*LAT)
def rnd(p):return [round(float(p[0]),5),round(float(p[1]),5)]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(s):return str(s or '').strip()
def ringpoly(r):
 p=Polygon(r)
 return p if p.is_valid else p.buffer(0)
def nodekey(p):return tuple(round(v,3)for v in p[:2])
def polys(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 if g.geom_type=='MultiPolygon':return list(g.geoms)
 return [p for c in g.geoms for p in polys(c)] if hasattr(g,'geoms') else []
def lines(g):
 if g.is_empty:return []
 if g.geom_type=='LineString':return [g]
 return [p for c in g.geoms for p in lines(c)] if hasattr(g,'geoms') else []
def serializePoly(p):return [list(map(rnd,p.exterior.coords))]+[list(map(rnd,r.coords))for r in p.interiors]

streetfile=SOURCE/'city-streets-grand-to-downtown.geojson'
buildingfile=SOURCE/'building-footprints-complete.geojson'
signalfile=SOURCE/'traffic-signals.geojson'
streets=json.loads(streetfile.read_text())['features'];buildings=json.loads(buildingfile.read_text())['features']
signals=json.loads(signalfile.read_text())['features']
woodward=next(f for f in signals if f['properties']['road2']=='M-1(WOODWARD)')
woodpoint=project(*woodward['geometry']['coordinates'])
originalRoads=districts['roads']
seam=min([p for r in originalRoads if r['name']=='Jefferson'for p in r['points']],key=lambda p:p[0])
seamX=seam[0]

# Use source line topology to select the actual contiguous Jefferson path.
print('Preparing street topology',flush=True)
sourceLines=[];graph={}
for f in streets:
 p=f['properties'];geometry=f['geometry']
 for part in lines(transform(project,__import__('shapely').geometry.shape(geometry))):
  if part.length<.01:continue
  sourceLines.append((f,part))
  if clean(p['STREETNAME'])!='Jefferson':continue
  coords=list(part.coords);a,b=nodekey(coords[0]),nodekey(coords[-1]);idx=len(sourceLines)-1
  graph.setdefault(a,[]).append((b,part.length,idx));graph.setdefault(b,[]).append((a,part.length,idx))
print('Selecting contiguous Jefferson path',flush=True)
start=min(graph,key=lambda p:Point(p).distance(Point(seam)))
end=min(graph,key=lambda p:Point(p).distance(Point(woodpoint)))
assert Point(start).distance(Point(seam))<.05,('Unqualified east seam',start,seam)
assert Point(end).distance(Point(woodpoint))<25,('Woodward graph endpoint too far',end,woodpoint)
queue=[(0,start)];distance={start:0};prev={}
while queue:
 d,node=heapq.heappop(queue)
 if d!=distance[node]:continue
 if node==end:break
 for other,cost,idx in graph[node]:
  trial=d+cost
  if trial<distance.get(other,math.inf):distance[other]=trial;prev[other]=(node,idx);heapq.heappush(queue,(trial,other))
assert end in distance,'No continuous source Jefferson route'
path=[];node=end
while node!=start:
 previous,idx=prev[node];path.append((previous,node,idx));node=previous
path.reverse()
mainpoints=[];roadrows=[];selectedids=set();sourceFids={str(r['id']).removeprefix('city-')for r in originalRoads if str(r['id']).startswith('city-')}
for a,b,idx in path:
 f,line=sourceLines[idx];coords=list(line.coords)
 if nodekey(coords[0])!=a:coords.reverse()
 if not mainpoints:coords[0]=tuple(seam)
 if mainpoints and Point(coords[0]).distance(Point(mainpoints[-1]))<.02:coords[0]=tuple(mainpoints[-1])
 mainpoints.extend(coords if not mainpoints else coords[1:])
 fid=str(f['properties']['FID']);selectedids.add(fid)
 if fid in sourceFids:
  # Path begins at the exact old endpoint; an already-present source edge must
  # not be silently redrawn as an overlapping extension.
  raise AssertionError('Extension path includes an existing road source '+fid)
 roadrows.append({'id':'city-jefferson-extension-'+fid,'sourceId':fid,'name':'Jefferson','width':14,'widthEvidence':'Authored 14 m width copied from existing Jefferson road type; not surveyed lane width','points':list(map(rnd,coords)),'kind':'mainline'})
print('Selected mainline',len(path),flush=True)
mainline=LineString(mainpoints)
routeNodes={nodekey(p)for p in mainpoints}
# The shortest path follows the southern carriageway through the interchange.
# Retain the independently corroborated northern surface carriageway as well.
# City FIDs are exact source geometry; Esri's June 7, 2025 operator aerial
# confirms the divided-road arrangement, without supplying surveyed lane widths.
parallelIds=['32465','31966','32385','32702','32633','32076','32085','32903','32175','31927','33430','33738']
parallelPoint=None
for fid in parallelIds:
 matches=[(f,line)for f,line in sourceLines if str(f['properties']['FID'])==fid]
 assert len(matches)==1,('Parallel carriageway source missing/ambiguous',fid)
 f,line=matches[0];assert clean(f['properties']['STREETNAME'])=='Jefferson' and clean(f['properties']['STREETTYPE'])=='Ave'
 assert fid not in selectedids and fid not in sourceFids
 coords=list(line.coords)
 if parallelPoint is None:
  if Point(coords[-1]).distance(mainline)<Point(coords[0]).distance(mainline):coords.reverse()
  assert Point(coords[0]).distance(mainline)<.02,('Parallel carriageway lost source join',fid)
 else:
  if nodekey(coords[-1])==nodekey(parallelPoint):coords.reverse()
  assert nodekey(coords[0])==nodekey(parallelPoint),('Parallel carriageway is disconnected',fid)
  coords[0]=parallelPoint
 parallelPoint=coords[-1];routeNodes.update(nodekey(p)for p in coords);selectedids.add(fid)
 roadrows.append({'id':'city-jefferson-extension-'+fid,'sourceId':fid,'name':'Jefferson','width':14,'widthEvidence':'Authored 14 m width matching the other mapped carriageway; not surveyed lane width','points':list(map(rnd,coords)),'kind':'parallel-mainline','geometryEvidence':'Exact City street centerline, corroborated by Esri operator aerial acquired 2025-06-07; see photographic-evidence.md'})
existingLines=[LineString(r['points'])for r in originalRoads if len(r['points'])>1]+[LineString(r['points'])for r in mapdata['roads']if len(r['points'])>1]
existingLineIndex=STRtree(existingLines)
# Source-connected cross-street stubs are limited to 90 m of arc length. No
# extrapolated intersection or artificial evenly-spaced grid is introduced.
crossRejected=[]
for f,line in sourceLines:
 p=f['properties'];fid=str(p['FID']);name=clean(p['STREETNAME'])
 if name=='Jefferson' or fid in selectedids or fid in sourceFids:continue
 coords=list(line.coords);a,b=nodekey(coords[0]),nodekey(coords[-1])
 if a not in routeNodes and b not in routeNodes:continue
 if b in routeNodes and a not in routeNodes:coords.reverse()
 elif a in routeNodes and b in routeNodes:
  crossRejected.append({'sourceId':fid,'reason':'Both endpoints connect to Jefferson; omitted potential ramp/chord'});continue
 if 'Fwy' in clean(p.get('STREETTYPE')):
  crossRejected.append({'sourceId':fid,'reason':'Freeway vertical alignment is not qualified'});continue
 stub=substring(LineString(coords),0,min(90,line.length))
 stub=stub.intersection(box(-1e5,-1e5,seamX+.01,1e5))
 for partIndex,part in enumerate(lines(stub)):
  if part.length<3:continue
  nearby=existingLineIndex.query(part.buffer(.03))
  overlap=part.intersection(unary_union([existingLines[int(i)].buffer(.03)for i in nearby])).length if len(nearby) else 0
  if overlap>.1:
   crossRejected.append({'sourceId':fid,'reason':'Overlaps an existing road centerline','overlapM':round(overlap,4)});continue
  roadrows.append({'id':f'city-jefferson-extension-{fid}-{partIndex}','sourceId':fid,'name':name,'width':10,'widthEvidence':'Authored 10 m local cross-street width; source has no width/lane field','points':list(map(rnd,part.coords)),'kind':'cross-street','scopeLimitM':90})

# The existing complete 198-node riverbank way spans this extension. It is a
# verified outer member of the Detroit River water multipolygon. Polygonize it
# against an inland coverage envelope, then select the component containing the
# official Jefferson centerline. The river-side edge comes entirely from OSM.
print('Preparing source shoreline',flush=True)
osmfile=BASE/'research/detroit-skyline.osm';xml=ET.parse(osmfile).getroot()
nodes={n.get('id'):project(float(n.get('lon')),float(n.get('lat')))for n in xml.findall('node')}
ways={w.get('id'):w for w in xml.findall('way')}
relation=next(r for r in xml.findall('relation')if r.get('id')=='5678328')
assert any(m.get('ref')=='30353979' and m.get('role')=='outer' for m in relation.findall('member'))
shoreRefs=[n.get('ref')for n in ways['30353979'].findall('nd')]
assert all(n in nodes for n in shoreRefs)
shore=LineString([nodes[n]for n in shoreRefs])
mainbounds=mainline.bounds
coverage=box(mainbounds[0]-170,mainbounds[1]-230,seamX+30,mainbounds[3]+520)
clipped=shore.intersection(coverage)
assert not clipped.is_empty,'Source shoreline does not intersect extension envelope'
# Shapely union nodes the source shore at exact coverage-boundary intersections.
cells=list(polygonize(unary_union([coverage.boundary,clipped])))
inland=[p for p in cells if p.covers(mainline.interpolate(.5,normalized=True))]
assert len(inland)==1,('Could not establish unique inland shoreline side',len(inland))
landmask=inland[0]
assert mainline.difference(landmask.buffer(.02)).length<.02,'A route segment crosses the source riverbank'
originalLand=unary_union([Polygon(p[0],p[1:])for p in districts['land']]+[Polygon(mapdata['mainland'])])
originalFlat=unary_union([Polygon(p[0],p[1:])for p in districts['flat']]+[Polygon(mapdata['mainland'])])
newLand=landmask.difference(originalLand)
newFlat=landmask.difference(originalFlat)
# Terrain registration may use land; rendering should use flat. Both are
# additive differences, so the original source arrays need not be modified.
landRings=[serializePoly(p)for p in polys(newLand)if p.area>.01]
flatRings=[serializePoly(p)for p in polys(newFlat)if p.area>.01]

# Reproduce the existing skyline generator's rendered-footprint eligibility.
print('Qualifying original skyline',flush=True)
features=[]
def num(tags,key,default=0):
 try:return float(tags.get(key,str(default)).split(' ')[0])
 except (ValueError,AttributeError):return default
for wid,w in ways.items():
 tags={t.get('k'):t.get('v')for t in w.findall('tag')}
 if 'building' not in tags and 'building:part' not in tags:continue
 refs=[n.get('ref')for n in w.findall('nd')]
 if len(refs)<4 or refs[0]!=refs[-1] or any(n not in nodes for n in refs):continue
 ring=[nodes[n]for n in refs];poly=ringpoly(ring)
 if poly.is_empty:continue
 # The original generator uses mean vertex position, not area centroid.
 cx=sum(p[0]for p in ring[:-1])/(len(ring)-1);cz=sum(p[1]for p in ring[:-1])/(len(ring)-1)
 if not(-4500<cx<-1750 and -800<cz<3000):continue
 features.append({'id':wid,'tags':tags,'polygon':poly,'h':num(tags,'height',num(tags,'building:levels',3)*3.6),'low':num(tags,'min_height'),'cx':cx,'cz':cz})
parts=[f for f in features if 'building:part'in f['tags']];rendered=[];rencen=project(-83.03978,42.328964)
for f in features:
 children=[p for p in parts if p['id']!=f['id'] and f['polygon'].contains(Point(p['cx'],p['cz']))]if 'building:part'not in f['tags']else[]
 h=min(f['h'],max(3,min(p['low']for p in children)))if children else f['h']
 near=math.hypot(f['cx']-rencen[0],f['cz']-rencen[1])<220
 if h<=f['low']or(h<12 and not near):continue
 rendered.append(f)
print('Qualifying new buildings',len(rendered),flush=True)
oldBuildings=[(b['id'],ringpoly(b['points']))for b in mapdata['buildings']+districts['buildings']]
existingPoly=unary_union([p for _,p in oldBuildings]);skylinePoly=unary_union([f['polygon']for f in rendered])
newBuildings=[];excluded=[];newPolys=[]
for f in buildings:
 props=f['properties'];sid=str(props['building_i'])
 if props.get('demolished')is not None:continue
 geom=transform(project,__import__('shapely').geometry.shape(f['geometry']))
 if not geom.is_valid:geom=geom.buffer(0)
 if geom.is_empty or geom.centroid.x>=seamX or geom.centroid.x<mainbounds[0]-100 or geom.distance(mainline)>150:continue
 reason=None;extra={}
 if geom.difference(landmask).area>.02:reason='Source footprint is not fully within qualified land coverage'
 elif geom.intersection(existingPoly).area>.01:
  reason='Overlaps original game building footprint';extra['overlappingGameIds']=[i for i,p in oldBuildings if geom.intersection(p).area>.01]
 elif geom.intersection(skylinePoly).area>.01:
  reason='Already represented by original skyline geometry';extra['overlappingSkylineIds']=[p['id']for p in rendered if geom.intersection(p['polygon']).area>.01]
 elif any(geom.intersection(p).area>.01 for p in newPolys):reason='Overlaps another accepted source footprint'
 if reason:
  excluded.append({'sourceBuildingId':sid,'address':clean(props['address']),'reason':reason,**extra});continue
 stories=props.get('stories');qualifiedStories=isinstance(stories,(int,float))and math.isfinite(stories)and 1<=stories<=80
 height=round(stories*3.3,3)if qualifiedStories else 3.3
 heightEvidence=f'Estimated from source stories ({stories}) × 3.3 m; not measured roof height'if qualifiedStories else 'Authored 3.3 m one-storey fallback; source stories absent or unqualified'
 verifiedHeightSource=None
 if sid=='8423552':
  height=21.34
  heightEvidence='Primary HAER district inventory reports Palms Apartment House height as 70 feet; converted with 0.3048 m/ft and rounded to 0.01 m'
  verifiedHeightSource={'url':'https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf','printedPage':43,'pdfPage':44,'reportedHeight':70,'reportedUnit':'ft','conversionMetresPerFoot':.3048,'reportedStories':'six stories plus basement','scope':'Reported historical overall building height, not a new survey'}
 for partIndex,poly in enumerate(polys(geom)):
  newBuildings.append({'id':f'jefferson-city-{sid}-{partIndex}','sourceBuildingId':sid,'sourceObjectId':props['OBJECTID'],'address':clean(props['address']),'name':clean(props['ref_name'])or clean(props['address']),'points':list(map(rnd,poly.exterior.coords)),'holes':[list(map(rnd,r.coords))for r in poly.interiors],'height':height,'heightEvidence':heightEvidence,'verifiedHeightSource':verifiedHeightSource,'sourceStories':stories,'sourceMedianHeightRaw':props.get('median_hgt'),'sourceMedianHeightUnit':'unverified','facadeEvidence':'Mapped footprint only; no facade photo acceptance implied'})
  if poly.interiors:
   # Triangulate the rounded runtime polygon with constrained boundary edges.
   # Every whole triangle must be covered, and their union must reproduce the
   # polygon exactly; centroid-only filtering is deliberately insufficient.
   row=newBuildings[-1]
   rounded=Polygon(row['points'],row['holes'])
   triangles=list(constrained_delaunay_triangles(rounded).geoms)
   assert all(rounded.covers(t)for t in triangles),'A collision triangle crosses the courtyard or exterior'
   collisionPieces=triangles[:]
   # The existing collider supports concave simple rings. Merge shared-edge
   # neighbours whenever their union stays a single hole-free polygon, keeping
   # the original boundary vertices and avoiding forty per-window-like solids.
   changed=True
   while changed:
    changed=False
    for i in range(len(collisionPieces)):
     for j in range(i+1,len(collisionPieces)):
      a,b=collisionPieces[i],collisionPieces[j]
      if a.boundary.intersection(b.boundary).length<1e-7:continue
      merged=a.union(b)
      if merged.geom_type!='Polygon' or merged.interiors:continue
      collisionPieces[i]=merged;collisionPieces.pop(j);changed=True;break
     if changed:break
   collisionUnion=unary_union(collisionPieces)
   difference=collisionUnion.symmetric_difference(rounded).area
   assert difference==0,('Collision decomposition changed rounded footprint',difference)
   row['collisionParts']=[list(map(rnd,t.exterior.coords))for t in collisionPieces]
   row['courtyardWitnesses']=[rnd(Polygon(r).representative_point().coords[0])for r in row['holes']]
   row['collisionDecomposition']={'method':'Constrained Delaunay triangles fully covered by rounded polygon, then exact shared-edge merges into simple hole-free rings','symmetricDifferenceAreaM2':difference,'originalAreaM2':rounded.area,'collisionAreaM2':collisionUnion.area}
  newPolys.append(poly)

# Do not draw a walkable-looking verge through retained building walls. This
# only controls new sidewalk rendering; the exact road and colliders remain.
solidFootprints=existingPoly.union(unary_union(newPolys))
for road in roadrows:
 sidewalk=LineString(road['points']).buffer(road['width']/2+1.8,cap_style=2)
 if sidewalk.intersection(solidFootprints).area>.01:
  road['sidewalk']=False
  road['sidewalkEvidence']='Omitted authored verge because it overlaps a retained mapped building footprint; carriageway geometry is unchanged'

protected=[{'path':str(p.relative_to(REPO)),'sha256':sha(p)}for p in [MAP,DIST,osmfile,BASE/'tools/build-skyline.py']]
sourceMeta=[{'name':p.name,'sha256':sha(p)}for p in [streetfile,buildingfile,signalfile]]
data={'schema':1,'scope':'Additive East Jefferson extension from original western street endpoint to Woodward','origin':O,'seam':seam,'destination':{'name':'Jefferson / Woodward','point':rnd(end),'sourceSignalPoint':rnd(woodpoint),'sourceSignalId':woodward['properties']['int_id']},'groundHeightM':2,'land':landRings,'flat':flatRings,'roads':roadrows,'buildings':newBuildings,'provenance':{'sources':sourceMeta,'protectedInputs':protected,'streetQuery':(SOURCE/'city-streets-query.txt').read_text().strip(),'buildingQueries':json.loads((SOURCE/'building-footprints-queries.json').read_text()),'shoreline':{'source':'OpenStreetMap contributors','wayId':'30353979','riverRelationId':'5678328','file':str(osmfile.relative_to(REPO)),'nodeCount':len(shoreRefs),'sourceUrl':'https://www.openstreetmap.org/way/30353979','license':'ODbL','coverageBoundsM':list(coverage.bounds),'method':'Exact riverbank clipped by authored coverage envelope; inland polygon contains official street path; existing land/flat subtracted'},'roadWidthPolicy':'Existing authored width conventions only; source provides no surveyed widths/lanes','buildingHeightPolicy':'Palms: primary HAER reported 70 ft, converted to 21.34 m. Other buildings: source stories × 3.3 m estimate; 3.3 m fallback when stories unqualified. Source median_hgt left unconverted.','seamSnapM':round(Point(start).distance(Point(seam)),6),'validationStatus':'Source preparation only; gameplay/native-rendering/release gates not completed'}}
print('Writing extension',flush=True)
OUT.write_text(json.dumps(data,separators=(',',':'))+'\n')
receipt={'schema':1,'output':str(OUT.relative_to(REPO)),'sha256':sha(OUT),'counts':{'mainlineRoads':sum(r['kind']=='mainline'for r in roadrows),'parallelCarriagewayRoads':sum(r['kind']=='parallel-mainline'for r in roadrows),'crossStreetRoads':sum(r['kind']=='cross-street'for r in roadrows),'buildingParts':len(newBuildings),'buildingHoles':sum(len(b['holes'])for b in newBuildings),'collisionParts':sum(len(b.get('collisionParts',[b['points']]))for b in newBuildings),'landPolygons':len(landRings),'flatPolygons':len(flatRings),'skylineFootprintsConsidered':len(rendered)},'routeLengthM':round(mainline.length,3),'sourceInputs':sourceMeta,'protectedInputs':protected,'courtyards':[{'buildingId':b['id'],'sourceBuildingId':b['sourceBuildingId'],'witnesses':b['courtyardWitnesses'],'parts':len(b['collisionParts']),'decomposition':b['collisionDecomposition']}for b in newBuildings if b.get('collisionParts')],'crossStreetsOmitted':crossRejected,'buildingsOmitted':excluded,'roadOriginalSourceIds':sorted(selectedids),'allOriginalInputsUnchanged':True,'nativePerformanceAccepted':False,'visualAcceptanceComplete':False}
RECEIPT.parent.mkdir(parents=True,exist_ok=True);RECEIPT.write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({**receipt['counts'],'routeLengthM':receipt['routeLengthM'],'outputBytes':OUT.stat().st_size,'omittedBuildings':len(excluded)},indent=2))
