from pathlib import Path
import json,tarfile,hashlib,gzip
base=Path(r'C:/Users/digit/Documents/phone/_goth_swoop_release_20260916/.game-builds/combat-sources');base.mkdir(parents=True,exist_ok=True)
catalog=Path(r'C:/Users/digit/Documents/phone/gothtech-film-mocap-20261005')
mapping=json.loads((catalog/'Huge FBX Mocap Library part 2.json').read_text())
wanted={key:value.splitlines()[0] for key,value in mapping.items() if any('/'+name+'.fbx' in value for name in ['79_96','80_03'])}
package=Path(r'C:/Users/digit/AppData/Roaming/Unity/Asset Store-5.x/cMonkeys/Animation/Huge FBX Mocap Library part 2.unitypackage')
report=[]
with gzip.open(package,'rb') as compressed, tarfile.open(fileobj=compressed,mode='r|') as tar:
 for member in tar:
  parts=member.name.split('/')
  if len(parts)!=2 or parts[1]!='asset' or parts[0] not in wanted:continue
  data=tar.extractfile(member).read();name=Path(wanted[parts[0]]).name;(base/name).write_bytes(data)
  report.append({'pack':str(package),'path':wanted[parts[0]],'local':str(base/name),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'license':str(catalog/'Sources/Huge FBX Mocap Library part 2/READTHIS.txt')})
  if len(report)==len(wanted):break
assert len(report)==2
(base/'source-inventory.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
