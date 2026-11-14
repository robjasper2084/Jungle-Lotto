import pathlib,os,subprocess,json,hashlib,re,tarfile
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'integration-evidence';out.mkdir(exist_ok=True)
main='be392dcf43d564eeb9fb33e8d9dc85856fd07143';hud='e0d069cdaac4bce7deb0f410fc153a1bf0a5ba14';cine='04fe6bed163d0273c1c043ca64021d6bb6aeac17'
def git(*args,check=True):return subprocess.run(['git',*args],cwd=root,check=check,capture_output=True)
def text(*args):return git(*args).stdout.decode().strip()
assert text('rev-parse','HEAD')==hud
assert text('rev-parse','HEAD^{tree}')=='9059f4a3c06bdda6846fcfacdf5e1e0d722d176b'
for sha in [main,cine]:git('fetch','--no-tags','--filter=blob:none','origin',sha)
assert git('merge-base','--is-ancestor',main,hud,check=False).returncode==0
assert text('merge-base',hud,cine)=='d546de77fb304ebb3e113c676ff9d322c0535105'
git('config','user.name','Belle integration validation');git('config','user.email','validation@localhost')
result=git('merge','--no-commit','--no-ff',cine,check=False);assert result.returncode==1,result.stdout.decode()+result.stderr.decode()
prefix='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
conflicts=text('diff','--name-only','--diff-filter=U').splitlines()
assert set(conflicts)=={prefix+'run-tests.mjs',prefix+'src/belle/cockpitLcd.ts',prefix+'vite.config.ts'},conflicts
repairs=json.loads((pathlib.Path(__file__).parent/'repairs.json').read_text());assert len(repairs)==9
for item in repairs:
 name=item['path'];assert name.startswith(prefix) or name=='scripts/belle-cinematic-browser-smoke.mjs'
 p=root/name;raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==item['beforeSha256'],('before',name,hashlib.sha256(raw).hexdigest())
 source=raw.decode();last=len(source)
 for splice in reversed(item['splices']):
  a,b=splice['start'],splice['end'];assert 0<=a<=b<=last,(name,a,b,last);source=source[:a]+splice['text']+source[b:];last=a
 data=source.encode();assert hashlib.sha256(data).hexdigest()==item['afterSha256'],('after',name,hashlib.sha256(data).hexdigest())
 assert not re.search(r'^(<<<<<<< |=======\n|>>>>>>> )',source,re.M),name
 p.write_bytes(data)
git('add','--',*[r['path'] for r in repairs]);assert not text('diff','--name-only','--diff-filter=U')
# Both source branches are combined, but all existing production review gates
# and the strict released polish harness remain byte-for-byte unchanged.
for name in ['.github/workflows/pages.yml','.github/workflows/belle-time-trial.yml','.github/workflows/belle-release-evidence.yml','.github/workflows/belle-hover-startup.yml','.github/workflows/belle-coop-review.yml','.github/workflows/belle-polish-review.yml','.github/workflows/belle-canal-review.yml']:
 old=git('show',main+':'+name,check=False)
 if old.returncode==0:assert (root/name).read_bytes()==old.stdout,name
for name in [prefix+'scripts/polish-browser-smoke.mjs',prefix+'scripts/polish-network-evidence.test.mjs']:
 assert (root/name).read_bytes()==git('show',main+':'+name).stdout,name
runner=(root/(prefix+'run-tests.mjs')).read_text();original=git('show',hud+':'+prefix+'run-tests.mjs').stdout.decode()
assert runner==original.replace("'--test',","'--test','src/belle/cinematicPolicy.test.ts',",1)
tree=text('write-tree');changed=text('diff','--cached','--name-only',main).splitlines();files=[]
for name in changed:
 p=root/name;assert p.is_file(),name
 files.append({'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'blob':text('rev-parse',':'+name)})
proof={'production':main,'hudHead':hud,'cinematicHead':cine,'candidateTree':tree,'conflictsResolved':conflicts,'files':files,'validationStatus':'NOT YET PASSED','diagnosticOnly':True,'run':os.environ.get('GITHUB_RUN_ID')}
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(tree+'\n');(out/'combined.patch').write_bytes(git('diff','--cached','--binary',main).stdout)
with tarfile.open(out/'combined-source.tar.gz','w:gz') as tar:
 for f in files:tar.add(root/f['path'],arcname=f['path'],recursive=False)
print(json.dumps(proof,indent=2))
