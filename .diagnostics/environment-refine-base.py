import os,sys,json,hashlib,pathlib,subprocess
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work'
diag=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'diagnostic/.diagnostics'
variant=sys.argv[1] if len(sys.argv)>1 else 'candidate'
if variant=='candidate':
 out=root/'environment-validation';proof=json.loads((out/'candidate-source.json').read_text())
 assert (out/'candidate-tree.txt').read_text().strip()=='194243d8d025ce14a507a44ecd2c12f2432d618b'
 for f in proof['files']:assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['afterSha256'],f['path']
 s=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle'
 p=s/'gardenMazeScene.ts';t=p.read_text();assert "'Garden maze living hedge'" in t;t=t.replace("'Garden maze living hedge'","'Garden maze living foliage'",1)
 old='for(const m of materials)m.dispose();'
 new='for(const m of new Set([...materials,...[cores,crowns,floors].flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material])]))m.dispose();'
 assert old in t;t=t.replace(old,new,1);p.write_text(t)
 p=s/'environmentPresentation.test.ts';t=p.read_text();t+="""
import {surfaceKind} from './realisticMaterialRules.ts';
test('all maze hedge meshes retain foliage classification through material dressing',()=>{const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')),view=addGardenMaze(new T.Scene(),new GardenMazeCollision(map.conservatory));for(const name of ['Maze hedge collision-matched cores','Maze hedge rounded foliage']){const mesh=view.root.getObjectByName(name) as T.Mesh;assert.equal(surfaceKind((mesh.material as T.Material).name,mesh.name),'leaf');}view.dispose();});
test('maze cleanup releases decorated materials once without disposing borrowed textures',()=>{const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')),view=addGardenMaze(new T.Scene(),new GardenMazeCollision(map.conservatory)),a=view.root.getObjectByName('Maze hedge collision-matched cores') as T.Mesh,b=view.root.getObjectByName('Maze hedge rounded foliage') as T.Mesh,original=a.material as T.MeshStandardMaterial,decorated=original.clone(),shared=new T.Texture();decorated.map=shared;let originals=0,clones=0,textures=0;original.addEventListener('dispose',()=>originals++);decorated.addEventListener('dispose',()=>clones++);shared.addEventListener('dispose',()=>textures++);a.material=b.material=decorated;view.dispose();view.dispose();assert.equal(originals,1);assert.equal(clones,1);assert.equal(textures,0);shared.dispose();});
""";p.write_text(t)
 for f in proof['files']:f['afterSha256']=hashlib.sha256((root/f['path']).read_bytes()).hexdigest()
 proof.pop('fullRegisteredSuitesPassed',None);proof.pop('renderedEnvironmentAcceptance',None)
 (out/'candidate-source.json').write_text(json.dumps(proof,indent=2))
 subprocess.run(['git','add','--',*[f['path'] for f in proof['files']]],cwd=root,check=True)
 tree=subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip();(out/'candidate-tree.txt').write_text(tree+'\n');(out/'candidate.patch').write_bytes(subprocess.check_output(['git','diff','--cached','--binary'],cwd=root));print('REFINED CANDIDATE TREE',tree)
# Read-only body-consumption evidence for transport aborts seen in both baselines.
# Preserve every failure and retain the original error assertions.
p=diag/'environment-browser.mjs';t=p.read_text()
needle='const hub=new EventTarget();'
observe=r'''const transfers=window.__environmentTransfers=[];const nativeFetch=window.fetch;window.fetch=async function(...args){const response=await nativeFetch.apply(this,args);if(!/\.glb$/i.test(new URL(response.url||String(args[0]),location.href).pathname)||!response.body)return response;const entry={url:response.url,status:response.status,expectedBytes:Number(response.headers.get('Content-Length')),bytes:0,chunks:0,complete:false,sha256:null,readError:null,startedAt:performance.now()};transfers.push(entry);const chunks=[],body=response.body,getReader=body.getReader.bind(body);body.getReader=function(...options){const reader=getReader(...options),read=reader.read.bind(reader);reader.read=async function(...readArgs){try{const value=await read(...readArgs);if(value.done){entry.complete=true;entry.completedAt=performance.now();const all=new Uint8Array(entry.bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}chunks.length=0;crypto.subtle.digest('SHA-256',all).then(hash=>entry.sha256=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join(''),error=>entry.readError=String(error));}else{entry.bytes+=value.value.byteLength;entry.chunks++;chunks.push(value.value.slice());}return value;}catch(error){entry.readError=String(error);throw error;}};return reader;};return response;};const hub=new EventTarget();'''
assert needle in t;t=t.replace(needle,observe,1)
t=t.replace("report.events=await page.evaluate(()=>window.__environmentObservation.events);","report.transfers=await page.evaluate(()=>window.__environmentTransfers);report.events=await page.evaluate(()=>window.__environmentObservation.events);",1)
t=t.replace("try{if(page)report.last=await bounded(snapshot(),5000,'last observation');}","try{if(page){report.last=await bounded(snapshot(),5000,'last observation');report.transfers=await bounded(page.evaluate(()=>window.__environmentTransfers),5000,'stream evidence');}}",1)
t=t.replace("report.finishedAt=new Date().toISOString();", "report.transferIntegrity=[];for(const entry of report.transfers||[]){try{const file=resolve(root,'.'+decodeURIComponent(new URL(entry.url).pathname));assert(file.startsWith(root+sep));const bytes=await readFile(file),crypto=await import('node:crypto'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');report.transferIntegrity.push({url:entry.url,expectedBytes:bytes.length,expectedSha256:sha256,observedBytes:entry.bytes,observedSha256:entry.sha256,complete:entry.complete,match:entry.complete&&entry.bytes===bytes.length&&entry.sha256===sha256&&!entry.readError});}catch(error){report.transferIntegrity.push({url:entry.url,error:String(error),match:false});}}report.finishedAt=new Date().toISOString();",1)
p.write_text(t)
print('Read-only GLB stream observer added; original error assertions unchanged')
