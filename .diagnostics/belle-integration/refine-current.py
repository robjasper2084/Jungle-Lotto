import pathlib,os,subprocess,json,hashlib,tarfile,tempfile,re
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'integration-evidence';diag=pathlib.Path(__file__).parent
G='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
old='e0d069cdaac4bce7deb0f410fc153a1bf0a5ba14';latest='09bd1dea2529f1ed839442b1c9b8d9169c202382'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def show(ref,name):return git('show',ref+':'+name)
def digest(b):return hashlib.sha256(b).hexdigest()
proof=json.loads((out/'source.json').read_text());assert proof['candidateTree']=='5b321f2fc32a2d28f0ced4e85a0d25214678279f';assert git('write-tree').decode().strip()==proof['candidateTree']
for f in proof['files']:assert digest((root/f['path']).read_bytes())==f['sha256'],f['path']
git('fetch','--no-tags','--filter=blob:none','origin',latest)
assert git('rev-list','--parents','-n','1',latest).decode().split()==[latest,old]
paths=git('diff','--name-only',old,latest).decode().splitlines()
expected=['run-tests.mjs','scripts/hud-layout-browser-smoke.mjs','src/belle/hudLayoutEditor.css','src/belle/hudLayoutRuntime.ts','src/belle/mobileHud.ts','src/belle/rideRadio.ts','src/belle/rideRadioDock.ts','src/belle/rideRadioDock.test.ts']
assert set(paths)=={G+p for p in expected},paths
before_runner=(root/(G+'run-tests.mjs')).read_text()
for name in paths:
 p=root/name;incoming=show(latest,name)
 if name.endswith('run-tests.mjs'):
  t=p.read_text();needle="'--test',";assert t.count(needle)==1 and "'src/belle/rideRadioDock.test.ts'" not in t
  p.write_text(t.replace(needle,needle+"'src/belle/rideRadioDock.test.ts',",1));continue
 if name.endswith('hudLayoutEditor.css'):
  base=show(old,name);assert incoming.startswith(base);current=p.read_bytes();assert current.startswith(base)
  p.write_bytes(current+incoming[len(base):]);continue
 if name.endswith('hud-layout-browser-smoke.mjs'):
  t=p.read_text();new=incoming.decode();start=new.index('/** Native race/menu regression:');end=new.index('async function run(){',start)
  function=new[start:end];assert 'verifyPortraitRaceRadio' not in t
  assert t.count('async function run(){')==1 and t.count(" phase('finished');")==1
  t=t.replace('async function run(){',function+'async function run(){',1).replace(" phase('finished');"," await verifyPortraitRaceRadio();\n phase('finished');",1)
  p.write_text(t);continue
 if not p.exists():
  assert name in {G+'src/belle/rideRadioDock.ts',G+'src/belle/rideRadioDock.test.ts'}
  p.write_bytes(incoming);continue
 base=show(old,name);current=p.read_bytes()
 if current==base:p.write_bytes(incoming);continue
 with tempfile.TemporaryDirectory() as folder:
  a,b,c=[pathlib.Path(folder)/n for n in ['current','base','incoming']]
  a.write_bytes(current);b.write_bytes(base);c.write_bytes(incoming)
  result=subprocess.run(['git','merge-file','-p',str(a),str(b),str(c)],capture_output=True)
  assert result.returncode==0,(name,result.stdout.decode(),result.stderr.decode());p.write_bytes(result.stdout)
proof['hudCheckout']=old;proof['hudHead']=latest;proof['includedHudSuccessor']='Exact latest eight-file radio docking repair, preserved existing combined source and native assertions.'
for name in ['preview-media-server.mjs','preview-media-server.test.mjs']:
 p=root/(G+'scripts/'+name);assert not p.exists();p.write_bytes((diag/name).read_bytes())
p=root/(G+'vite.config.ts');t=p.read_text();assert "plugins:[" in t and 'previewMediaPlugin' not in t
p.write_text("import {previewMediaPlugin} from './scripts/preview-media-server.mjs';\n"+t.replace('plugins:[','plugins:[previewMediaPlugin(),',1))
p=root/(G+'run-tests.mjs');t=p.read_text();p.write_text(t.replace("'--test',","'--test','scripts/preview-media-server.test.mjs',",1))
runner=p.read_text();assert runner.replace("'scripts/preview-media-server.test.mjs',",'',1).replace("'src/belle/rideRadioDock.test.ts',",'',1)==before_runner
inputs=re.findall(r"'([^']+\.(?:test\.(?:ts|mjs)|test.mjs))'",runner)
assert len(inputs)==len(set(inputs)),inputs
for name in ['.github/workflows/pages.yml','.github/workflows/belle-trials.yml','.github/workflows/belle-release-evidence.yml','.github/workflows/belle-startup.yml','.github/workflows/belle-coop.yml','.github/workflows/belle-polish.yml','.github/workflows/belle-canal-bridges.yml',G+'scripts/polish-browser-smoke.mjs',G+'scripts/polish-network-evidence.test.mjs',G+'src/belle/belleMusicPlayer.ts',G+'src/belle/belleAudio.ts']:
 assert (root/name).read_bytes()==show(proof['production'],name),name
changed=[*paths,G+'scripts/preview-media-server.mjs',G+'scripts/preview-media-server.test.mjs',G+'vite.config.ts']
git('add','--',*changed);proof['previousCandidateTree']=proof['candidateTree'];proof['candidateTree']=git('write-tree').decode().strip();proof['files']=[]
for name in git('diff','--cached','--name-only',proof['production']).decode().splitlines():
 p=root/name;assert p.is_file();proof['files'].append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p.read_bytes()),'blob':git('rev-parse',':'+name).decode().strip()})
proof.pop('sourceHashesVerifiedAfterExecution',None);proof['validationStatus']='NOT YET PASSED';proof['mediaRepair']='Preview-only real-byte range revalidation, without error exemptions. Actual pinned-server comparison and native browser acceptance required.'
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(proof['candidateTree']+'\n');(out/'combined.patch').write_bytes(git('diff','--cached','--binary',proof['production']))
with tarfile.open(out/'combined-source.tar.gz','w:gz') as tar:
 for f in proof['files']:tar.add(root/f['path'],arcname=f['path'],recursive=False)
print(json.dumps(proof,indent=2))
