import os,pathlib,subprocess,json,hashlib,shutil,tarfile
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';diag=pathlib.Path(__file__).parent;G=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';out=root/'integration-evidence'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
proof=json.loads((out/'source.json').read_text());assert proof['previousCandidateTree']=='828e8045564aa35e4bf070cd3eb8ba2b9d964441';assert git('write-tree').decode().strip()==proof['candidateTree']
for f in proof['files']:assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256']
p=G/'scripts/preview-media-server.mjs';assert blob(p.read_bytes())=='a1d4efccfdc0b56c5f17d03e7edb147f340b5109';shutil.copyfile(diag/'cached-preview-media-server.mjs',p)
test=G/'scripts/preview-media-cache.test.mjs';assert not test.exists();shutil.copyfile(diag/'preview-media-cache.test.mjs',test)
runner=G/'run-tests.mjs';old=runner.read_text();assert old.count("'--test',")==1;runner.write_text(old.replace("'--test',","'--test','scripts/preview-media-cache.test.mjs',",1));assert runner.read_text().replace("'scripts/preview-media-cache.test.mjs',",'',1)==old
# The full cinematic test is byte-identical to the known failing source.
assert blob((root/'scripts/belle-cinematic-browser-smoke.mjs').read_bytes())=='a7f53cd7fc0ce3ceea8552e6407ef39f71e02eff'
git('add','--',str(p),str(test),str(runner));proof['previousCandidateTree']=proof['candidateTree'];proof['candidateTree']=git('write-tree').decode().strip();proof['validationStatus']='NOT YET PASSED';proof['repair']+=' Preview-only bounded private caching of actual completed media bytes prevents re-fetch/suspend cancellation; default middleware remains revalidating.'
proof['files']=[]
for name in git('diff','--cached','--name-only',proof['production']).decode().splitlines():
 p=root/name;b=p.read_bytes();proof['files'].append({'path':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':git('rev-parse',':'+name).decode().strip()})
proof.pop('sourceHashesVerifiedAfterExecution',None)
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(proof['candidateTree']+'\n');(out/'combined.patch').write_bytes(git('diff','--cached','--binary',proof['production']))
with tarfile.open(out/'combined-source.tar.gz','w:gz') as tar:
 for f in proof['files']:tar.add(root/f['path'],arcname=f['path'],recursive=False)
print(json.dumps({'tree':proof['candidateTree'],'files':len(proof['files']),'repair':proof['repair']},indent=2))
