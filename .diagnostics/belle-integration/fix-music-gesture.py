import os,pathlib,subprocess,json,hashlib,shutil
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';diag=pathlib.Path(__file__).parent;G=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';out=root/'integration-evidence'
proof=json.loads((out/'source.json').read_text());assert proof['candidateTree']=='828e8045564aa35e4bf070cd3eb8ba2b9d964441'
for f in proof['files']:assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256']
p=G/'src/belle/belleMusicPlayer.ts';b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='aff3ff00afd1882591552dc30f9e69ecdbf17a5f';t=b.decode();old='  this.authorized=true;this.blocked=false;this.start(true);';assert t.count(old)==1
p.write_text(t.replace(old,'  // Global click/key listeners also see settings interactions. Once permission\n  // is primed, leave paused media alone; only a denied/error state needs re-priming.\n  const prime=!this.authorized||this.blocked;\n  this.authorized=true;this.blocked=false;this.start(prime);',1))
test=G/'src/belle/musicGesture.test.mjs';assert not test.exists();shutil.copyfile(diag/'musicGesture.test.mjs',test)
p=G/'run-tests.mjs';old=p.read_text();assert old.count("'--test',")==1;p.write_text(old.replace("'--test',","'--test','src/belle/musicGesture.test.mjs',",1));assert p.read_text().replace("'src/belle/musicGesture.test.mjs',",'',1)==old
subprocess.run(['git','add','--',str(G/'src/belle/belleMusicPlayer.ts'),str(test),str(p)],cwd=root,check=True)
proof['previousCandidateTree']=proof['candidateTree'];proof['candidateTree']=subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip();proof['validationStatus']='NOT YET PASSED';proof['repair']='Idempotent silent priming after authorization; denied/error states still permit trusted-gesture retries. No caching/preload/music asset changes.'
proof['files']=[]
for path in subprocess.check_output(['git','diff','--cached','--name-only',proof['production']],cwd=root,text=True).splitlines():
 p=root/path;b=p.read_bytes();proof['files'].append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'blob':subprocess.check_output(['git','rev-parse',':'+path],cwd=root,text=True).strip()})
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(proof['candidateTree']+'\n');(out/'combined.patch').write_bytes(subprocess.check_output(['git','diff','--cached','--binary',proof['production']],cwd=root))
print(json.dumps({'tree':proof['candidateTree'],'repair':proof['repair']}))
