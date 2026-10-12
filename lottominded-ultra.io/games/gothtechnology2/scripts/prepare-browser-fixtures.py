"""Lossless binary transport of canonical physics; no collider simplification."""
from pathlib import Path
import gzip,json,base64,hashlib
p=Path(__file__).resolve().parents[1]
rows=[]
for product,source in [('swoop-detroit','swoop-source'),('elmwood-explorer','elmwood-source')]:
 folder=p/source/'public/love-tag';canonical=folder/(product+'.json.gz')
 raw=gzip.decompress(canonical.read_bytes());fixture=json.loads(raw);physics=base64.b64decode(fixture.pop('physics'));fixture['physics']=''
 # Immutable names prevent an old manifest/new physics mixture in caches.
 digest=hashlib.sha256(physics).hexdigest();name=product+'.physics-'+digest[:16]+'.bin.gz';compressed=gzip.compress(physics,compresslevel=9,mtime=0)
 (folder/name).write_bytes(compressed)
 manifest={'version':1,'physics':name,'physicsHash':digest,'physicsBytes':len(physics),'fixture':fixture}
 metadata=gzip.compress(json.dumps(manifest,separators=(',',':')).encode(),compresslevel=9,mtime=0)
 (folder/(product+'.browser.json.gz')).write_bytes(metadata)
 rows.append({'product':product,'canonicalDownload':canonical.stat().st_size,'canonicalJson':len(raw),'download':len(compressed)+len(metadata),'physicsBytes':len(physics),'metadataJson':len(json.dumps(manifest,separators=(',',':'))),'physicsHash':digest,'mapHash':fixture['hash'],'physicsFile':name})
 print(rows[-1],flush=True)
out=p/'docs/combat/evidence/browser-fixtures-20261011.json';out.write_text(json.dumps(rows,indent=2))
