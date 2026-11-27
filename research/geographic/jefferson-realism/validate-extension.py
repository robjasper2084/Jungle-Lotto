#!/usr/bin/env python3
"""Independent geometry-integrity checks for prepared Jefferson extension data."""
import hashlib,json
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[3]
GAME=ROOT/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game'
FILE=GAME/'src/belle/jeffersonExtension.json'
d=json.loads(FILE.read_text());old=json.loads((GAME/'src/belle/detroitDistricts.json').read_text());m=json.loads((GAME/'public/belle/map.json').read_text())
oldBuildings=unary_union([Polygon(b['points'])for b in m['buildings']+old['buildings']])
oldLand=unary_union([Polygon(p[0],p[1:])for p in old['land']]+[Polygon(m['mainland'])])
oldFlat=unary_union([Polygon(p[0],p[1:])for p in old['flat']]+[Polygon(m['mainland'])])
land=unary_union([Polygon(p[0],p[1:])for p in d['land']]);flat=unary_union([Polygon(p[0],p[1:])for p in d['flat']])
newBuildings=[Polygon(b['points'],b['holes'])for b in d['buildings']]
assert land.is_valid and flat.is_valid
assert oldLand.intersection(land).area<.01
assert oldFlat.intersection(flat).area<.01
assert all(p.is_valid for p in newBuildings)
assert all(p.intersection(oldBuildings).area<.01 for p in newBuildings)
assert all(p.intersection(q).area<.01 for i,p in enumerate(newBuildings)for q in newBuildings[i+1:])
combined=oldLand.union(land)
for r in d['roads']:
 line=LineString(r['points'])
 assert line.difference(combined.buffer(.02)).length<.03
 assert line.buffer(r['width']/2).difference(combined.buffer(.02)).area<.01,(r['id'],'Road crosses qualified land edge')
 if r['kind']=='cross-street':assert line.length<=90.001
main=[r for r in d['roads']if r['kind']=='mainline']
assert main[0]['points'][0]==d['seam']
assert all(a['points'][-1]==b['points'][0]for a,b in zip(main,main[1:]))
parallel=[r for r in d['roads']if r['kind']=='parallel-mainline']
assert len(parallel)==12
assert all(a['points'][-1]==b['points'][0]for a,b in zip(parallel,parallel[1:]))
assert unary_union([LineString(r['points'])for r in main]).distance(Point(parallel[0]['points'][0]))<.02
for inp in d['provenance']['protectedInputs']:
 assert hashlib.sha256((ROOT/inp['path']).read_bytes()).hexdigest()==inp['sha256']
courtyards=[]
for b in d['buildings']:
 if not b['holes']:continue
 poly=Polygon(b['points'],b['holes']);parts=[Polygon(p)for p in b['collisionParts']]
 assert all(p.is_valid and not p.interiors for p in parts)
 union=unary_union(parts)
 assert union.symmetric_difference(poly).area==0
 assert all(poly.covers(p)for p in parts)
 for pt in b['courtyardWitnesses']:
  assert not union.covers(Point(pt)) and Polygon(b['points']).covers(Point(pt))
 courtyards.append({'buildingId':b['id'],'parts':len(parts),'witnesses':b['courtyardWitnesses'],'symmetricDifferenceAreaM2':union.symmetric_difference(poly).area})
palms=next(b for b in d['buildings']if b['id']=='jefferson-city-8423552-0')
assert palms['height']==21.34 and palms['verifiedHeightSource']['reportedHeight']==70
assert palms['verifiedHeightSource']['reportedUnit']=='ft'
assert all(b['sourceMedianHeightUnit']=='unverified'for b in d['buildings'])
audit={'schema':1,'result':'PASS','sha256':hashlib.sha256(FILE.read_bytes()).hexdigest(),'validated':{'mainlineSegments':len(main),'parallelCarriagewaySegments':sum(r['kind']=='parallel-mainline'for r in d['roads']),'crossStreetStubs':sum(r['kind']=='cross-street'for r in d['roads']),'buildingFootprints':len(newBuildings),'collisionParts':sum(len(b.get('collisionParts',[b['points']]))for b in d['buildings']),'routeJoinsExact':True,'originalSourceHashesUnchanged':True,'noExistingBuildingOverlap':True,'noNewBuildingOverlap':True,'noOriginalLandOverlap':True,'noOriginalFlatOverlap':True,'allFullRoadWidthsOnLand':True,'palmsPrimaryReportedHeightM':21.34,'courtyards':courtyards},'acceptanceBoundary':'Offline source-data checks only; native route, render fit and performance gates remain required.'}
(Path(__file__).parent/'extension-integrity.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps(audit,indent=2))
