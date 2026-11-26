#!/usr/bin/env python3
"""Offline mesh and entrance-gate checks; not a browser, physics, or accessibility test."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
import trimesh
root=Path(__file__).resolve().parents[1]
report=json.loads((root/'qa'/'model_report.json').read_text())
assert report['productionDeployed'] is False and report['collisionUpdated'] is False
out={'status':'passed','checks':[],'limitations':['No browser/native GPU run','No full collision-sweep validation','Architecture is a modeling approximation','Real-world survey grade not established']}
def chk(cond,label):
 out['checks'].append({'description':label,'passed':bool(cond)});
 if not cond:raise AssertionError(label)
def has_blocker(scene, amin,amax):
 low,high=np.array(amin),np.array(amax)
 hits=[]
 for name,mesh in scene.geometry.items():
  v=mesh.vertices[mesh.faces]
  # conservative per-triangle AABB overlap in a designated standing-height corridor
  tmin=v.min(axis=1);tmax=v.max(axis=1)
  mask=((tmin<=high)&(tmax>=low)).all(axis=1)
  if np.any(mask):hits.append((name,int(mask.sum())))
 return hits
for site in report['models']:
 siteName=site['site'];sizes=[]
 for v in site['lods']:
  path=root/'models'/v['file'];raw=path.read_bytes();sizes.append(v['total_triangles'])
  scene=trimesh.load(path,force='scene')
  chk(hashlib.sha256(raw).hexdigest()==v['sha256'],f"{siteName} LOD{v['lod']} SHA-256")
  chk(len(scene.geometry)==v['total_mesh_groups'],f"{siteName} LOD{v['lod']} mesh group count")
  chk(sum(len(m.faces) for m in scene.geometry.values())==v['total_triangles'],f"{siteName} LOD{v['lod']} triangle count")
  chk(all(np.isfinite(m.vertices).all() and m.is_winding_consistent for m in scene.geometry.values()),f"{siteName} LOD{v['lod']} valid geometry and winding")
  chk(all(m.is_watertight for name,m in scene.geometry.items() if not ('Glass' in name or 'Glaz' in name or 'WaterPlane' in name or 'SlopedRoof' in name or 'PatinatedCopperPanels' in name)),f"{siteName} LOD{v['lod']} closed opaque solids")
  if siteName=='Anna Scripps Whitcomb Conservatory':
   # West vestibule, accessible ground-level volume. All opaque/glass elements should avoid this volume.
   chk(not has_blocker(scene,[-17.22,.64,-1.55],[-16.72,2.82,1.55]),f"Conservatory west door standing clearance LOD{v['lod']}")
   chk(not has_blocker(scene,[10,.35,-1.55],[13,3.1,1.55]),f"Conservatory existing Show House connector standing clearance LOD{v['lod']}")
   end_glazing=scene.geometry['ShowHouse/EndGlazing__greenGlass']
   chk(end_glazing.is_watertight and end_glazing.is_winding_consistent and end_glazing.body_count==2,f"Conservatory continuous connector glazing and retained exterior pane LOD{v['lod']}")
  if siteName=='Belle Isle Aquarium':
   chk(not has_blocker(scene,[-1.45,1.22,37.70],[1.45,2.82,39.28]),f"Aquarium arched passage standing clearance LOD{v['lod']}")
 chk(sizes[0]>=sizes[1]>=sizes[2],f'{siteName} LOD triangle monotonicity')
 if siteName=='Anna Scripps Whitcomb Conservatory':
  chk(abs(site['authoringAssumptions']['domeHeightM']-25.9)<.01,'Conservatory dome published 85ft constraint (approximate)')
 if siteName=='Belle Isle Aquarium':
  chk(site['authoringAssumptions']['stairs']['rise']==.15 and site['authoringAssumptions']['stairs']['count']==4,'Aquarium original map stairs preserved')
 if siteName=='Conservatory Drive roadway detail example':
  chk(site['authoringAssumptions']['actualIntersectionCurbGeometryVerified'] is False,'Road curb study not asserted to be survey-aligned')
chk(report['surveyVerticalAlignmentVerified']==False,'No survey certification claimed')
(root/'qa'/'mesh_test_receipt.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"Passed {len(out['checks'])} model integrity/clearance checks")
