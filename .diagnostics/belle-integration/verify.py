import pathlib,os,json,hashlib,subprocess,sys
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'integration-evidence';proof=json.loads((out/'source.json').read_text())
assert subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip()==proof['candidateTree']
for f in proof['files']:assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
proof['sourceHashesVerifiedAfterExecution']=True;proof['validationStatus']=sys.argv[1];(out/'source.json').write_text(json.dumps(proof,indent=2));print(json.dumps({'tree':proof['candidateTree'],'sourceFiles':len(proof['files']),'stage':sys.argv[1]}))
