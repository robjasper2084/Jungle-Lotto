#!/usr/bin/env python3
"""Read-only City of Detroit crosswalk against the existing game maps.

Matches are candidates for review, never authorization to replace collisions,
invent building heights, or deploy source-derived assets. The City service is
live; its 187 ID inventory must match the archived November 24 acquisition.
"""
import argparse
import hashlib
import json
import math
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from shapely.geometry import Polygon, shape
from shapely.ops import transform
from shapely.strtree import STRtree

SERVICE='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BaseUnitFeatures/FeatureServer/2/query'
BBOX=(-83.016,42.339,-82.996,42.349)
SOURCE_ID_SHA='8145d967f37e37e18614fc88784486901969dedeec36fb0cd7003ba167eb07ad'
MAP_SHA='eb36e093fc477055c217025668403fc5d2c422bfdc9d9021769192dbb5660d87'
DISTRICT_SHA='4006a1c523b08a5403f7101a45bd9f739c4aa4632d55a1be5c3676148cde0bdf'
REGION=(-1330,-310,530,960)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def query(params):
    url=SERVICE+'?'+urllib.parse.urlencode(params)
    request=urllib.request.Request(url,headers={'User-Agent':'JeffersonGISReadOnlyAudit/1.0','Accept':'application/json'})
    with urllib.request.urlopen(request,timeout=30) as reply:
        if reply.status!=200:raise RuntimeError('ArcGIS HTTP '+str(reply.status))
        raw=reply.read(12*1024*1024+1)
    if len(raw)>12*1024*1024:raise RuntimeError('Oversize ArcGIS response')
    data=json.loads(raw)
    if isinstance(data,dict) and data.get('error'):raise RuntimeError('ArcGIS query failed: '+str(data['error']))
    if data.get('exceededTransferLimit') is True or data.get('properties',{}).get('exceededTransferLimit') is True:
        raise RuntimeError('ArcGIS truncated a response')
    return data

def acquire():
    base={'where':'1=1','geometry':','.join(map(str,BBOX)),'geometryType':'esriGeometryEnvelope',
          'inSR':4326,'spatialRel':'esriSpatialRelIntersects'}
    response=query({**base,'f':'json','returnIdsOnly':'true','returnGeometry':'false'})
    ids=response.get('objectIds')
    if not isinstance(ids,list) or not all(type(i) is int for i in ids):
        raise RuntimeError('Missing independent integer source ID inventory')
    ids=sorted(ids)
    if len(ids)!=187 or len(set(ids))!=187 or hashlib.sha256(json.dumps(ids,separators=(',',':')).encode()).hexdigest()!=SOURCE_ID_SHA:
        raise RuntimeError('City ID set drift; this comparison requires the reviewed source snapshot')
    features=[]
    for start in range(0,len(ids),70):
        cohort=ids[start:start+70]
        page=query({**base,'f':'geojson','outSR':4326,'returnGeometry':'true','returnZ':'false',
            'returnM':'false','outFields':'objectid,building_id,semcog_id,status',
            'objectIds':','.join(map(str,cohort)),'resultRecordCount':len(cohort)})
        if page.get('type')!='FeatureCollection' or not isinstance(page.get('features'),list):
            raise RuntimeError('Unexpected GeoJSON source schema')
        features.extend(page['features'])
    seen=[]
    for feature in features:
        fid=feature.get('id',feature.get('properties',{}).get('objectid'))
        if type(fid) is not int:raise RuntimeError('Missing integer City object ID')
        seen.append(fid)
        geom=feature.get('geometry',{})
        if geom.get('type') not in ('Polygon','MultiPolygon'):raise RuntimeError('Unsupported geometry')
        if geom.get('crs') not in (None,):raise RuntimeError('Unexpected coordinate declaration')
    if sorted(seen)!=ids:raise RuntimeError('Incomplete or duplicate City feature response')
    return features

def project(lon,lat,z=None):
    return ((lon+83.00175)*111320*math.cos(math.radians(42.34680)),(42.34680-lat)*111320)

def match(features,park,districts,min_iou=.80):
    if not (.5<=min_iou<=1):raise ValueError('min_iou out of range')
    old=[]
    for layer,source in [('park',park),('districts',districts)]:
        for b in source['buildings']:
            points=b.get('points')
            if not isinstance(points,list) or len(points)<4:continue
            xs=[p[0] for p in points];zs=[p[1] for p in points]
            if max(xs)<REGION[0] or min(xs)>REGION[2] or max(zs)<REGION[1] or min(zs)>REGION[3]:continue
            poly=Polygon(points)
            if not poly.is_valid or poly.area<=0:continue
            old.append({'id':str(b['id']),'layer':layer,'poly':poly})
    tree=STRtree([o['poly'] for o in old])
    rows=[]
    for feature in features:
        fid=feature.get('id',feature['properties'].get('objectid'))
        geo=shape(feature['geometry'])
        if not geo.is_valid or geo.is_empty:raise RuntimeError('Invalid City polygon '+str(fid))
        current=transform(project,geo);possible=[]
        for index in tree.query(current):
            b=old[int(index)];geometry=b['poly']
            if not current.intersects(geometry):continue
            overlap=current.intersection(geometry).area
            if overlap<=0:continue
            iou=overlap/(current.area+geometry.area-overlap)
            if iou<=.05:continue
            possible.append({'gameId':b['id'],'layer':b['layer'],'IoU':round(iou,6),
                'boundaryHausdorffM':round(current.hausdorff_distance(geometry),3)})
        possible.sort(key=lambda c:-c['IoU'])
        good=bool(possible and possible[0]['IoU']>=min_iou and (len(possible)==1 or possible[1]['IoU']<min_iou-.03))
        rows.append({'cityObjectId':fid,'status':'candidate' if good else 'unresolved','candidates':possible[:3]})
    reuse=defaultdict(list)
    for row in rows:
        if row['status']=='candidate':
            c=row['candidates'][0];reuse[c['layer']+':'+c['gameId']].append(row['cityObjectId'])
    conflicts={k:v for k,v in reuse.items() if len(v)>1}
    for row in rows:
        if row['status']=='candidate':
            c=row['candidates'][0]
            if c['layer']+':'+c['gameId'] in conflicts:row['status']='conflicting-match'
    return {'sourceCityCount':len(rows),'oldGameNearbyCount':len(old),
        'uniqueCandidates':sum(r['status']=='candidate' for r in rows),
        'unresolvedCount':sum(r['status']!='candidate' for r in rows),
        'reuseConflicts':conflicts,'armory':next((r for r in rows if r['cityObjectId']==38712),None),
        'matches':rows,'rendererChanged':False,'collisionChanged':False,'heightCertified':False,
        'releaseApproved':False}

def run(map_path,district_path,out):
    hashes={'map':sha(map_path),'districts':sha(district_path)}
    if hashes!={'map':MAP_SHA,'districts':DISTRICT_SHA}:
        raise RuntimeError('Game inputs moved from reviewed baseline: '+json.dumps(hashes))
    park=json.loads(map_path.read_text());districts=json.loads(district_path.read_text())
    report={'schema':'jefferson-real-game-crosswalk/v1',
        'provenance':{'gameMapHashes':hashes,'sourceService':SERVICE,
        'sourceIdSetHash':SOURCE_ID_SHA,'sourceRetrievedLive':True,'sourceSnapshotAtomic':False},
        **match(acquire(),park,districts)}
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('sourceCityCount','oldGameNearbyCount','uniqueCandidates','unresolvedCount')},indent=2))
    if report['unresolvedCount'] or report['reuseConflicts']:
        print('NOT READY: no runtime replacements authorized',file=sys.stderr)
    return 0

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--map',required=True,type=Path)
    cli.add_argument('--districts',required=True,type=Path)
    cli.add_argument('--out',required=True,type=Path)
    args=cli.parse_args()
    try:return run(args.map,args.districts,args.out)
    except Exception as error:
        print('Crosswalk FAILED CLOSED: '+str(error),file=sys.stderr)
        return 2

if __name__=='__main__':sys.exit(main())
