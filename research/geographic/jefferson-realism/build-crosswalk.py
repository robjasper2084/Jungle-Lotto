#!/usr/bin/env python3
"""Join source footprints to original game polygons without changing game data.
Requires shapely (analysis dependency only). Usage:
python build-crosswalk.py /absolute/path/to/jefferson-research
"""
from __future__ import annotations
import json, math, hashlib, sys
from pathlib import Path
from datetime import datetime, timezone
from shapely.geometry import shape, Polygon, LineString
from shapely.ops import transform

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
GAME=ROOT/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game'
INPUT=Path(sys.argv[1])
ORIGIN=(-83.00175,42.34680)
SCALE=111320
SX=SCALE*math.cos(math.radians(ORIGIN[1]))
def project(lon,lat,z=None):return ((lon-ORIGIN[0])*SX,-(lat-ORIGIN[1])*SCALE)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(s):return str(s or '').strip()
def validpoly(r):
 p=Polygon(r)
 return p if p.is_valid else p.buffer(0)
cityfile=INPUT/'building-footprints-complete.geojson'
signalsfile=INPUT/'traffic-signals.geojson'
city=json.loads(cityfile.read_text())
signals=json.loads(signalsfile.read_text())
axis=[]
for f in signals['features']:
 p=f['properties'];lon,lat=f['geometry']['coordinates']
 if 'JEFFERSON' in p['road1'].upper() and -83.04444<=lon<=-83.0015:
  axis.append({'id':p['int_id'],'road':p['road2'],'point':project(lon,lat)})
axis.sort(key=lambda x:x['point'][0])
corridor=LineString([x['point'] for x in axis])
endx=min(x['point'][0] for x in axis);startx=max(x['point'][0] for x in axis)
records=[]
for f in city['features']:
 p=f['properties']
 if p.get('demolished') is not None:continue
 poly=transform(project,shape(f['geometry']))
 if not poly.is_valid:poly=poly.buffer(0)
 if poly.is_empty or poly.area<=0:continue
 if poly.centroid.x<endx-75 or poly.centroid.x>startx+75 or poly.distance(corridor)>150:continue
 records.append((f,poly))
allmap=[]
inputs=[]
for name,path in [('map','public/belle/map.json'),('districts','src/belle/detroitDistricts.json')]:
 p=GAME/path;inputs.append({'path':str(p.relative_to(ROOT)),'sha256':digest(p)})
 for b in json.loads(p.read_text())['buildings']:
  poly=validpoly(b['points'])
  if poly.centroid.x<endx-75 or poly.centroid.x>startx+75 or poly.distance(corridor)>150:continue
  allmap.append((name,b,poly))
results=[]
for source,b,poly in allmap:
 candidates=[]
 for f,cp in records:
  if not poly.intersects(cp):continue
  inter=poly.intersection(cp).area
  if not inter:continue
  iou=inter/poly.union(cp).area
  candidates.append((iou,poly.centroid.distance(cp.centroid),f,cp))
 candidates.sort(key=lambda x:x[0],reverse=True)
 best=candidates[0] if candidates else None
 rec={'gameSource':source,'gameId':b['id'],'gameName':b.get('name'),'gameHeightM':b['height'],'gameFootprint':b['points'],'gameCentroidM':[round(poly.centroid.x,3),round(poly.centroid.y,3)],'roadDistanceM':round(poly.distance(corridor),3),'status':'unmatched','candidates':[]}
 for iou,cd,f,cp in candidates[:3]:
  p=f['properties'];rec['candidates'].append({'sourceObjectId':p['OBJECTID'],'sourceBuildingId':p['building_i'],'address':clean(p['address']),'sourceName':clean(p['ref_name']),'iou':round(iou,6),'centroidDistanceM':round(cd,3),'stories':p.get('stories'),'medianHeightRaw':p.get('median_hgt'),'medianHeightUnit':'unverified','yearBuiltRaw':p.get('year_built')})
 if best:
  iou,cd,f,cp=best
  runnerup=candidates[1][0] if len(candidates)>1 else 0
  if iou>=.65 and cd<=20 and iou-runnerup>=.15:rec['status']='accepted-spatial-match'
  else:rec['status']='ambiguous-or-low-overlap'
 results.append(rec)
# Reject nonunique matches. Retain source duplicates explicitly, not as independent buildings.
bySource={}
for r in results:
 if r['status']=='accepted-spatial-match':bySource.setdefault(r['candidates'][0]['sourceBuildingId'],[]).append(r)
for key,rs in bySource.items():
 if len(rs)>1:
  ids=set(r['gameId'] for r in rs)
  for r in rs:r['status']='duplicate-game-layer' if len(ids)==1 else 'ambiguous-many-game-to-one-source'
matched={r['candidates'][0]['sourceBuildingId'] for r in results if r['status']=='accepted-spatial-match'}
sourceFeatures=[]
for f,cp in records:
 p=f['properties']
 sourceFeatures.append({'sourceObjectId':p['OBJECTID'],'sourceBuildingId':p['building_i'],'address':clean(p['address']),'sourceName':clean(p['ref_name']),'centroidM':[round(cp.centroid.x,3),round(cp.centroid.y,3)],'roadDistanceM':round(cp.distance(corridor),3),'matched':p['building_i'] in matched,'stories':p.get('stories'),'medianHeightRaw':p.get('median_hgt'),'medianHeightUnit':'unverified','demolished':p.get('demolished'),'geometry':f['geometry']})
districts=json.loads((GAME/'src/belle/detroitDistricts.json').read_text())
roadPoints=[p for r in districts['roads'] if r['name']=='Jefferson' for p in r['points']]
west=min(p[0] for p in roadPoints)
westPt=min(roadPoints,key=lambda p:p[0]);downstream=[r for r in sourceFeatures if r['centroidM'][0]<west]
output={'schema':1,'title':'Jefferson real-building spatial crosswalk; no facade or survey acceptance implied','projection':{'originLonLat':ORIGIN,'metresPerDegreeLatitude':SCALE,'x':'east','z':'south','formula':'x=111320*cos(originLat*pi/180)*(lon-originLon); z=-111320*(lat-originLat)'},'sourceInputs':inputs+[{'path':cityfile.name,'sha256':digest(cityfile),'sourceQueries':json.loads((INPUT/'building-footprints-queries.json').read_text()),'featureCount':len(city['features'])},{'path':signalsfile.name,'sha256':digest(signalsfile),'sourceQuery':(INPUT/'traffic-signals.url.txt').read_text().strip()}],'selection':{'name':'East Jefferson at East Grand Boulevard west to Woodward','referenceLine':'Ordered City inventory intersection centers; approximate frontage selection axis, not surveyed road geometry','maximumFootprintToAxisDistanceM':150,'centroidEndpointMarginM':75,'demolishedFilter':'Exclude every record whose demolished field is not null','acceptance':{'minimumIntersectionOverUnion':.65,'minimumLeadOverSecondCandidate':.15,'maximumCentroidDistanceM':20,'oneToOneRequired':True},'heightPolicy':'Original game heights retained. Source median_hgt units unverified; never converted or used for model height. Spatial match does not verify facade, roof, current condition or current tenancy.'},'corridorAxis':axis,'coverage':{'sourceFootprintsInCorridor':len(sourceFeatures),'gameFootprintsInCorridor':len(results),'acceptedMatches':sum(r['status']=='accepted-spatial-match' for r in results),'statusCounts':{k:sum(r['status']==k for r in results) for k in sorted(set(r['status'] for r in results))},'existingJeffersonWesternEndpointM':westPt,'downtownWoodwardEndM':axis[0]['point'],'approximateMissingCenterlineDistanceM':round(LineString([axis[0]['point'],westPt]).length,1),'sourceFootprintsWestOfExistingStreet':len(downstream)},'gameBuildings':sorted(results,key=lambda r:r['gameCentroidM'][0],reverse=True),'sourceFootprints':sorted(sourceFeatures,key=lambda r:r['centroidM'][0],reverse=True)}
(HERE/'crosswalk.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps(output['coverage'],indent=2))
for r in output['gameBuildings']:
 if r['status']=='accepted-spatial-match':
  c=r['candidates'][0];print(r['gameId'],r.get('gameName') or '',c['address'],c['sourceName'],'iou',c['iou'],'height',r['gameHeightM'],'distance',r['roadDistanceM'])
