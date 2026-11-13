import hashlib,json,os,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work'
diag=pathlib.Path(__file__).parent
prefix='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
expected='279af528be739ce3f348093b30eff8d1f6dd354b'
if (root/'.git').exists():
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==expected
 assert subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip()=='27a87eb6c70b625e043d3028b461a91dc0bf95e2'
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
p=root/(prefix+'scripts/polish-browser-smoke.mjs');before=p.read_bytes();assert blob(before)=='8288c5b59f5dfe35eb96c9d95f57681867469ce6'
t=before.decode()
def replace(old,new):
 global t
 assert t.count(old)==1,(old[:90],t.count(old));t=t.replace(old,new,1)
replace("import {dispatchAfterReadyCountdown} from './polish-ready-dispatch.mjs';", "import {dispatchAfterReadyCountdown} from './polish-ready-dispatch.mjs';\nimport {recordRequestFailure} from './visual-review-evidence.mjs';")
replace("'Cache-Control': 'no-store'", "'Cache-Control': 'no-cache, max-age=0, must-revalidate'")
replace("let countdownSequence = 0;", "let requestPhase = 'gameplay';\n  let countdownSequence = 0;")
replace("      const message = request.failure()?.errorText + ' ' + request.url(); entry.failedRequests.push(message);\n      if (!message.startsWith('net::ERR_ABORTED')) entry.errors.push(message);", "      log(`${configuration.name}: ${requestPhase} request failed ${recordRequestFailure(entry, request, requestPhase)}`);")
replace("entry.realGameCompletedAt = new Date().toISOString();", "requestPhase = 'fixtures';\n      entry.realGameCompletedAt = new Date().toISOString();")
replace("    clearTimeout(deadline);\n    if (countdownWaiter)", "    requestPhase = 'cleanup';\n    clearTimeout(deadline);\n    if (countdownWaiter)")
replace("entry.functionalPassed = entry.functionalPassed && !entry.failure && !timedOut && !cleanupFailed;", "entry.functionalPassed = entry.functionalPassed && !entry.failure && !timedOut && !cleanupFailed && entry.errors.length === 0;")
p.write_text(t)
files=[{'path':prefix+'scripts/polish-browser-smoke.mjs','beforeBlob':blob(before),'afterBlob':blob(p.read_bytes()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}]
p=root/(prefix+'scripts/polish-network-evidence.test.mjs');assert not p.exists();p.write_bytes((diag/'polish-network-evidence.test.mjs').read_bytes());files.append({'path':str(p.relative_to(root)),'beforeBlob':None,'afterBlob':blob(p.read_bytes()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
p=root/(prefix+'run-tests.mjs');before=p.read_bytes();assert blob(before)=='5c5bf993f8428676b0432db13ba1471d5a2062e2'
t=before.decode();old="'--test',";assert t.count(old)==1;t=t.replace(old,"'--test','scripts/polish-network-evidence.test.mjs',",1);p.write_text(t);files.append({'path':str(p.relative_to(root)),'beforeBlob':blob(before),'afterBlob':blob(p.read_bytes()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
out=root/'pr151-repair';out.mkdir(exist_ok=True)
proof={'baseHead':expected,'baseTree':'27a87eb6c70b625e043d3028b461a91dc0bf95e2','files':files,'scope':'Test fixture streaming server and strict failure evidence only. Game runtime/media, native scenarios, limits and existing release workflows unchanged.'}
if (root/'.git').exists():
 subprocess.run(['git','add','--',*[f['path'] for f in files]],cwd=root,check=True)
 proof['candidateTree']=subprocess.check_output(['git','write-tree'],cwd=root,text=True).strip()
 (out/'candidate.patch').write_bytes(subprocess.check_output(['git','diff','--cached','--binary'],cwd=root))
(out/'source.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof))
