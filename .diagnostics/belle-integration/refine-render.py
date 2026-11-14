import pathlib,os,subprocess,json,hashlib,tarfile
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'integration-evidence';diag=pathlib.Path(__file__).parent;G='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def digest(b):return hashlib.sha256(b).hexdigest()
proof=json.loads((out/'source.json').read_text());assert proof['candidateTree']=='dbf31d8c803de5a91195c4ce594f64b07b5a5c4d';assert git('write-tree').decode().strip()==proof['candidateTree']
for f in proof['files']:assert digest((root/f['path']).read_bytes())==f['sha256'],f['path']
for name,h in [('cinematic-render-proof.mjs','16e32a4632a11459f0c6a66c990a5257e2a536afdb268267f665e218b066d535'),('cinematic-render-proof.test.mjs','19fd1672c78e76c7fc47250f5d90778be5b6d45c1f392119a333f21507685c1d')]:
 p=root/(G+'scripts/'+name);assert not p.exists();data=(diag/name).read_bytes();assert digest(data)==h;p.write_bytes(data)
p=root/'scripts/belle-cinematic-browser-smoke.mjs';assert digest(p.read_bytes())=='574331ae75182a28926c57e8a747fad8a9e8739915f8827bc362fa47ee85c45b';t=p.read_text();old="import {recordRequestFailure} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/visual-review-evidence.mjs';";assert t.count(old)==1;t=t.replace(old,old+"\nimport {observeCurrentRendering} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/cinematic-render-proof.mjs';",1);old="await expect.poll(()=>page.evaluate(()=>window.__belleStartupProfile?.().windows.reduce((n,w)=>n+w.frames,0)||0),{timeout:90000}).toBeGreaterThan(2);";assert t.count(old)==1;t=t.replace(old,"evidence.currentFrames=await observeCurrentRendering(page);",1);assert digest(t.encode())=='866374e2473744fff06b555d4079bd7c6caeb7e3aec9e8466c7891e8752013ff';p.write_text(t)
p=root/(G+'run-tests.mjs');assert digest(p.read_bytes())=='4de4c27ebc8bb56235b3358b88b82060db7d1e83ad00a81a8b7d888d52cc1390';t=p.read_text().replace("'--test',","'--test','scripts/cinematic-render-proof.test.mjs',",1);assert digest(t.encode())=='b403e3fbb5df97967d0dd55b5011308c67f93d3d16b16647bb1b2078d062fc16';p.write_text(t)
p=root/(G+'src/belle/cinematicPolicy.test.ts');assert digest(p.read_bytes())=='abd0a7d274d01fd4934fdda4286c11c19739f05d961e0dad43ec031420ef1c81';t=p.read_text()+"\n\ntest('cinematic smoke proves new live frames rather than expired startup-window totals',()=>{\n const source=readFileSync(new URL('../../../../../../../scripts/belle-cinematic-browser-smoke.mjs',import.meta.url),'utf8');\n assert.match(source,/observeCurrentRendering\\(page\\)/);assert.doesNotMatch(source,/windows\\.reduce/);\n});\n";assert digest(t.encode())=='2fdc408a61746a2391219815990ae87c71782d33ee3b374b30116670fb90f964';p.write_text(t)
names=[G+'scripts/cinematic-render-proof.mjs',G+'scripts/cinematic-render-proof.test.mjs','scripts/belle-cinematic-browser-smoke.mjs',G+'run-tests.mjs',G+'src/belle/cinematicPolicy.test.ts'];git('add','--',*names)
proof['previousCandidateTree']=proof['candidateTree'];proof['candidateTree']=git('write-tree').decode().strip();proof['files']=[]
# Protect every existing review workflow using actual production paths.
for name in git('ls-tree','-r','--name-only',proof['production'],'.github/workflows').decode().splitlines():
 if name=='.github/workflows/belle-public-verification.yml':continue
 assert (root/name).read_bytes()==git('show',proof['production']+':'+name),name
for name in git('diff','--cached','--name-only',proof['production']).decode().splitlines():
 p=root/name;assert p.is_file();proof['files'].append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p.read_bytes()),'blob':git('rev-parse',':'+name).decode().strip()})
proof['validationStatus']='NOT YET PASSED';proof['renderObserverRepair']='Trace confirms activeFrames progress while first-30-second startup bands remain fixed. Require three NEW current frames plus GPU fence and two paint opportunities; 90s/45s deadlines unchanged.'
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(proof['candidateTree']+'\n');(out/'combined.patch').write_bytes(git('diff','--cached','--binary',proof['production']))
with tarfile.open(out/'combined-source.tar.gz','w:gz') as tar:
 for f in proof['files']:tar.add(root/f['path'],arcname=f['path'],recursive=False)
print(json.dumps(proof,indent=2))
