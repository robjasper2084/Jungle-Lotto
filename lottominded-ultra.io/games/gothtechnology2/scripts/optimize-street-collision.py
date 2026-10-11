import bpy,bmesh,json,gzip,array,math
from pathlib import Path
root=Path(__file__).resolve().parent.parent
assets=root/'swoop-source/public/exports/street-life'
out=root/'docs/combat/evidence/street-surfaces-20261011'
meta=json.loads((assets/'street-surfaces.json').read_text())
values=array.array('f',gzip.decompress((assets/'street-surfaces.bin.gz').read_bytes()))
bpy.ops.wm.read_factory_settings(use_empty=True)
positions=array.array('f');tiles=[];before=0;after=0
for i,tile in enumerate(meta['tiles']):
 if tile['material'] in ['yellow','white','seam']:continue
 data=values[tile['offset']:tile['offset']+tile['count']]
 vertices=[tuple(data[j:j+3]) for j in range(0,len(data),3)]
 mesh=bpy.data.meshes.new('street');mesh.from_pydata(vertices,[],[(j,j+1,j+2) for j in range(0,len(vertices),3)])
 bm=bmesh.new();bm.from_mesh(mesh)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
 bmesh.ops.dissolve_limit(bm,angle_limit=.015,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False)
 bmesh.ops.triangulate(bm,faces=list(bm.faces))
 offset=len(positions)
 for face in bm.faces:
  for vert in face.verts:positions.extend(vert.co)
 before+=len(data)//9;after+=len(bm.faces)
 tiles.append(dict(tile,offset=offset,count=len(positions)-offset))
 bm.free();bpy.data.meshes.remove(mesh)
 if i%100==0:print('STREET',i,before,after,flush=True)
out.mkdir(parents=True,exist_ok=True)
(out/'collision.bin').write_bytes(positions.tobytes())
(out/'collision.json').write_text(json.dumps(dict(meta,tiles=tiles,values=len(positions),before=before,after=after)))
print('STREET_OPTIMIZED',before,after,flush=True)
