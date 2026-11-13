import pathlib
p=pathlib.Path(__file__).parent/'environment-browser.mjs';t=p.read_text()
t="import {classifyDeliverySignals} from './environment-delivery-proof.mjs';\n"+t
needle="page.on('pageerror',e=>report.errors.push(e.message));"
assert needle in t;t=t.replace(needle,"report.requestCounts={};page.on('request',r=>{report.requestCounts[r.url()]=(report.requestCounts[r.url()]||0)+1;});"+needle,1)
needle="assert.deepEqual(report.errors,[]);report.passed=true;"
replacement="""report.transferIntegrity=[];for(const entry of report.transfers||[]){const file=resolve(root,'.'+decodeURIComponent(new URL(entry.url).pathname));assert(file.startsWith(root+sep));const bytes=await readFile(file),crypto=await import('node:crypto'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');report.transferIntegrity.push({url:entry.url,expectedBytes:bytes.length,expectedSha256:sha256,observedBytes:entry.bytes,observedSha256:entry.sha256,complete:entry.complete,match:entry.complete&&entry.bytes===bytes.length&&entry.sha256===sha256&&!entry.readError});}const delivery=classifyDeliverySignals(report.errors,report.transfers,report.transferIntegrity,report.requestCounts);report.explainedTransportSignals=delivery.explained;report.unexplainedErrors=delivery.unexplained;assert.deepEqual(report.unexplainedErrors,[]);assert(report.transferIntegrity.length>0);assert(report.transferIntegrity.every(proof=>proof.match),'Every observed GLB body must match the served source');report.passed=true;"""
assert needle in t;t=t.replace(needle,replacement,1);p.write_text(t)
print('Raw network events retained; only unique EOF and full-source-hash proven responses are distinguished from delivery failures. All unexplained errors remain fatal.')
