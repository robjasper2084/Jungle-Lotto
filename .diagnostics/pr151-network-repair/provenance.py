import pathlib,json,hashlib,subprocess,os,sys,tarfile
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'pr151-repair';proof=json.loads((out/'source.json').read_text());mode=sys.argv[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==proof['baseHead']
assert subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip()==proof['candidateTree']
for f in proof['files']:assert sha(root/f['path'])==f['sha256'],f['path']
paths=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
# Build tools intentionally regenerate tracked public assets. Preserve that
# separate diff; never confuse it with a changed authoring/runtime source.
if mode=='before':
 tracked={p:sha(root/p) for p in paths if p and (root/p).is_file()}
 (out/'post-build-tracked.json').write_text(json.dumps(tracked))
 (out/'generated-build.diff').write_bytes(subprocess.check_output(['git','diff','--binary'],cwd=root))
else:
 if (out/'post-build-tracked.json').exists():
  for p,h in json.loads((out/'post-build-tracked.json').read_text()).items():assert sha(root/p)==h,p
 with tarfile.open(out/'proposed-source.tar.gz','w:gz') as archive:
  for f in proof['files']:archive.add(root/f['path'],arcname=f['path'])
 proof['validatedSourceHashesAfterExecution']=True
 proof['stage']=mode
 (out/'source.json').write_text(json.dumps(proof,indent=2))
 print(json.dumps(proof))
