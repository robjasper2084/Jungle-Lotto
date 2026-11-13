import pathlib,hashlib,json,subprocess,os
workspace=pathlib.Path(os.environ['GITHUB_WORKSPACE']);root=workspace/'work';diag=workspace/'diagnostic/.diagnostics'
source='279af528be739ce3f348093b30eff8d1f6dd354b';tree='27a87eb6c70b625e043d3028b461a91dc0bf95e2'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==source
assert subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip()==tree
p=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/polish-browser-smoke.mjs';data=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert blob=='8288c5b59f5dfe35eb96c9d95f57681867469ce6'
t=data.decode();changes=[]
def insert(old,new):
 global t
 assert t.count(old)==1,(old,t.count(old));t=t.replace(old,new,1);changes.append(old)
t='import {installReadOnlyDeliveryObserver,collectDeliveryEvidence,classifyDeliveryEvidence} from '+json.dumps((diag/'pr151-delivery.mjs').as_uri())+';\n'+t
insert("await page.exposeBinding('__polishCountdownReady'", "entry.deliveryPhase='gameplay';entry.deliveryFailures=[];entry.deliveryRequestCounts={};page.on('request',request=>{entry.deliveryRequestCounts[request.url()]=(entry.deliveryRequestCounts[request.url()]||0)+1;});page.on('requestfailed',request=>entry.deliveryFailures.push({url:request.url(),error:request.failure()?.errorText,phase:entry.deliveryPhase,at:new Date().toISOString()}));await page.addInitScript(installReadOnlyDeliveryObserver);\n    await page.exposeBinding('__polishCountdownReady'")
insert("entry.realGameCompletedAt = new Date().toISOString();", "entry.deliveryProofs=await bounded(collectDeliveryEvidence(page,root),15000,'Actual loader EOF and source hash evidence');entry.deliveryPhase='fixtures';\n      entry.realGameCompletedAt = new Date().toISOString();")
insert('let cleanupFailure;','entry.deliveryPhase=\'cleanup\';\n    let cleanupFailure;')
insert('entry.cleanupFailed = cleanupFailed;', "entry.deliveryClassification=classifyDeliveryEvidence(entry.deliveryProofs,entry.deliveryFailures,entry.deliveryRequestCounts);if(entry.deliveryClassification.unexplained.length){entry.failure ??= 'Unverified asset delivery';entry.errors.push(...entry.deliveryClassification.unexplained);}\n    entry.cleanupFailed = cleanupFailed;")
copy=p.with_name('pr151-polish-delivery-observed.mjs');assert not copy.exists();copy.write_text(t)
proof={'source':source,'sourceTree':tree,'diagnosticWorkflowHead':os.environ['GITHUB_SHA'],'originalHarnessBlob':blob,'copiedHarnessSha256':hashlib.sha256(t.encode()).hexdigest(),'sourceChanged':False,'productionWorkflowsChanged':False,'timingLimitsChanged':False,'purpose':'Additional read-only actual-loader asset evidence; does not replace any original release gate. Not a performance benchmark.','instrumentationAnchors':changes}
out=root/'pr151-delivery-provenance.json';out.write_text(json.dumps(proof,indent=2));assert p.read_bytes()==data
print(json.dumps(proof))
