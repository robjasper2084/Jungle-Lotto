#!/usr/bin/env python3
"""Independent bounded audit of the fixed Canvas proof's saved raw bytes/PNG regions."""
import argparse, hashlib, json, os, re, struct, sys, time, zlib
from pathlib import Path
MAX_INPUT=2*1024*1024
WIDTH,HEIGHT,RAW=420,290,487200

def insist(condition,message):
    if not condition: raise ValueError(message)
def sha(data): return hashlib.sha256(data).hexdigest()
def read_json(path,limit=MAX_INPUT):
    insist(path.stat().st_size<=limit,'JSON input cap: '+str(path))
    return json.loads(path.read_bytes())
def difference(a,b):
    insist(len(a)==len(b),'Byte comparator size mismatch')
    changed=sum(x!=y for x,y in zip(a,b))
    pixels=sum(a[i:i+4]!=b[i:i+4] for i in range(0,len(a),4))
    return {'changedBytes':changed,'changedPixels':pixels,'maxDifference':max((abs(x-y) for x,y in zip(a,b)),default=0)}

def decode_png(data,expected_size=None):
    insist(len(data)<=4*1024*1024,'PNG byte cap')
    insist(data[:8]==b'\x89PNG\r\n\x1a\n','PNG signature')
    p=8;header=None;payload=bytearray();ended=False;idat=False;after_idat=False;chunks=0
    while p<len(data):
        insist(p+12<=len(data),'Truncated PNG chunk')
        n=struct.unpack('>I',data[p:p+4])[0];typ=data[p+4:p+8];p+=8
        insist(n<=4*1024*1024 and p+n+4<=len(data),'PNG chunk length')
        body=data[p:p+n];crc=struct.unpack('>I',data[p+n:p+n+4])[0];p+=n+4;chunks+=1
        insist(chunks<=128,'PNG chunk count cap')
        insist(zlib.crc32(typ+body)&0xffffffff==crc,'PNG CRC mismatch')
        if typ==b'IHDR':
            insist(header is None and chunks==1 and n==13,'PNG IHDR order')
            w,h,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',body)
            insist(0<w<=1340 and 0<h<=650 and depth==8 and color in (2,6) and compression==filtering==interlace==0,'Unsupported PNG shape')
            if expected_size: insist((w,h)==tuple(expected_size),'PNG viewport mismatch')
            header=(w,h,3 if color==2 else 4)
        elif typ==b'IDAT':
            insist(header and not after_idat and not ended,'PNG IDAT order');idat=True;payload.extend(body)
        elif typ==b'IEND':
            insist(n==0 and header and idat,'PNG IEND');ended=True;break
        else:
            insist(typ[0]&32,'Unknown critical PNG chunk')
            if idat: after_idat=True
    insist(ended and p==len(data),'PNG EOF/trailing data')
    w,h,bpp=header;stride=w*bpp;expected=(stride+1)*h
    decoder=zlib.decompressobj();decoded=decoder.decompress(bytes(payload),expected+1)
    insist(len(decoded)==expected and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail,'PNG zlib size/EOF')
    rows=[];previous=bytearray(stride);q=0
    for _ in range(h):
        kind=decoded[q];q+=1;row=bytearray(decoded[q:q+stride]);q+=stride
        insist(kind<=4,'PNG filter')
        for i in range(stride):
            a=row[i-bpp] if i>=bpp else 0;b=previous[i];c=previous[i-bpp] if i>=bpp else 0
            if kind==1: predictor=a
            elif kind==2: predictor=b
            elif kind==3: predictor=(a+b)//2
            elif kind==4:
                value=a+b-c;da,db,dc=abs(value-a),abs(value-b),abs(value-c)
                predictor=a if da<=db and da<=dc else b if db<=dc else c
            else: predictor=0
            row[i]=(row[i]+predictor)&255
        if bpp==3: rows.append(b''.join(row[i:i+3]+b'\xff' for i in range(0,stride,3)))
        else: rows.append(bytes(row))
        previous=row
    return w,h,rows

def region(decoded,rectangle):
    w,h,rows=decoded;x,y,rw,rh=(rectangle[k] for k in ('x','y','width','height'))
    insist(all(type(v) is int for v in (x,y,rw,rh)),'Noninteger screenshot rectangle')
    insist(rw==WIDTH and rh==HEIGHT and 0<=x<=w-rw and 0<=y<=h-rh,'Screenshot rectangle bounds')
    return b''.join(row[x*4:(x+rw)*4] for row in rows[y:y+rh])

def validate_schedule(schedule):
    rows=schedule['checkpoints']
    insist(schedule['groups']==['P'+str(i) for i in range(1,9)],'Fixed group set')
    insist(len(rows)==26 and len({r['id'] for r in rows})==26,'Fixed checkpoint count')
    composition=[r for r in rows if r['composition']]
    insist([r['id'] for r in composition]==['p1-visible','p2-latest','p4-base-failure','p5-partial'],'Fixed composition set')
    insist(all(r['readbacksPerCanvasBefore']==0 for r in composition),'Composition pair has prior readback')
    insist(len({r['pair'] for r in composition})==4,'Composition pairs are not fresh/distinct')
    insist([r['id'] for r in rows if r['detector']]==['n1-byte-mutant','n2-state-only','n3-current-path'],'Fixed detectors')
    counts={}
    for r in rows:
        insist(counts.get(r['pair'],0)==r['readbacksPerCanvasBefore'],'Per-pair readback schedule')
        if not r['savedRawMutation']: counts[r['pair']]=counts.get(r['pair'],0)+1
    return True

def validate_composition_binding(composition,expected_id,ledger):
    expected=[{'x':10,'y':10,'width':WIDTH,'height':HEIGHT},{'x':450,'y':10,'width':WIDTH,'height':HEIGHT}]
    if expected_id=='p1-visible': expected.append({'x':890,'y':10,'width':WIDTH,'height':HEIGHT})
    insist(composition['id']==expected_id,'Composition checkpoint identity')
    insist(composition['rectangles']==expected,'Exact ordered non-aliased composition rectangles')
    name=expected_id+'.png';entry=ledger.get(name)
    insist(entry is not None and entry.get('name')==name and entry.get('kind')=='png','Expected checkpoint PNG ledger row')
    insist(composition.get('file')==entry,'Composition PNG identity/bytes/SHA ledger binding')
    return True

def validate_browser_binding(runtime,lane,policies):
    policy=policies[lane];version=runtime['version'];revision=version.get('revision','').removeprefix('@')
    insist(version.get('product')==policy['product'],'Exact browser product for lane')
    insist(re.fullmatch('[a-f0-9]{40}',revision) is not None,'Missing/malformed actual CDP revision')
    exact=policy['revisionPolicy']=='exact-retained'
    insist(exact or policy['revisionPolicy']=='observe-first-capture','Unknown revision policy')
    insist(revision==policy['revision'] if exact else policy['revision'] is None,'Incorrect pre-run revision binding')
    expected={'policy':policy['revisionPolicy'],'revision':revision,'previouslyVerified':exact,'sameBrowserForBothSources':True}
    insist(runtime.get('revisionBinding')==expected,'Actual revision receipt/policy mismatch')
    return expected

def evidence_usage(directory,schedule):
    raw={row['id']+'.'+side+'.rgba' for row in schedule['checkpoints'] for side in ('original','candidate')}
    total=ancillary=0
    for p in directory.iterdir():
        if p.name=='audit.json': continue
        insist(p.is_file() and not p.is_symlink(),'Unexpected evidence directory/symlink')
        size=p.stat().st_size;total+=size
        if p.name not in raw: ancillary+=size
    return total,ancillary

def write_audit_report(directory,output,manifest,schedule):
    target=directory/'audit.json';insist(not target.exists(),'Audit output already exists; preserve original attempt')
    total,ancillary=evidence_usage(directory,schedule);bounds=manifest['bounds']
    data=(json.dumps(output,indent=2)+'\n').encode()
    if len(data)>bounds['reservedAuditBytes']:
        output={'auditCompleted':False,'passed':False,'releaseReady':False,'errors':['Audit report exceeded its reserved slot']}
        data=(json.dumps(output)+'\n').encode()
    if len(data)>bounds['reservedAuditBytes'] or total+len(data)>bounds['outputBytes'] or ancillary+len(data)>bounds['ancillaryBytes']:
        output={'auditCompleted':False,'passed':False,'releaseReady':False,'errors':['No report bytes fit the original evidence caps; no fallback file written']}
        return output
    # The sole audit output is charged against both original caps. There is no
    # unaccounted error-file fallback and no replacement of an earlier attempt.
    target.write_bytes(data)
    return output

def audit(directory,manifest_path,binding_path):
    started=time.monotonic();directory=Path(directory)
    m=read_json(manifest_path);binding=read_json(binding_path);status=read_json(directory/'capture-status.json')
    output={'schema':'minimap-saved-byte-audit-v1','auditCompleted':False,'passed':False,'releaseReady':False,'performanceMeasured':False,'errors':[],'checkpoints':[],'compositions':[]}
    errors=output['errors']
    def check(condition,message):
        if not condition: errors.append(message)
    check(m['executionBound'] is True,'Execution was UNBOUND')
    check((directory/'manifest.json').read_bytes()==manifest_path.read_bytes(),'Saved manifest differs')
    check(status['manifestSha256']==sha(manifest_path.read_bytes())==binding['manifestSha256'],'External manifest pin')
    check(status['binding']==binding==read_json(directory/'runtime-binding.json'),'External workflow binding')
    check(binding['attempt']==1,'Not first workflow attempt')
    check(status.get('captureComplete') is True and status.get('partial') is False and not status.get('errors'),'Capture incomplete/errors')
    check(status['elapsedMs']<m['bounds']['absoluteMs'],'Driver deadline')
    check(status['cleanup']['acknowledged'] is True and status['cleanup']['processExited'] is True and status['cleanup']['elapsedMs']<=m['bounds']['cleanupMs'],'Cleanup ownership/deadline')
    revision_binding=validate_browser_binding(status.get('runtime') or {},status.get('lane'),m['runtime']['browserLanes'])
    check(status.get('clock')=='node-performance-monotonic','Monotonic deadline clock')
    error_receipts=status.get('errorReceipts') or {};network=status.get('network') or {}
    check(error_receipts.get('observed')==0 and error_receipts.get('overflow') is False,'Bounded error receipts not clean')
    check(network.get('observed')==0 and network.get('overflow') is False and network.get('rows')==[],'Unexpected network/error receipts')
    check(status.get('runtime',{}).get('playwright')==m['runtime']['playwright'],'Playwright runtime')
    lane=status.get('lane');renderer=status.get('runtime',{}).get('renderer',{}).get('renderer','')
    check(lane in m['runtime']['lanes'] and (('Metal' in renderer and 'SwiftShader' not in renderer) if lane=='metal' else 'SwiftShader' in renderer),'Renderer lane')
    expected_files={r['name']:r for r in status['files']};check(len(expected_files)==len(status['files']),'Duplicate output name')
    actual_files={p.name:p for p in directory.iterdir() if p.is_file() and p.name!='audit.json'}
    check(set(actual_files)==set(expected_files)|{'capture-status.json'},'Unexpected/missing evidence files')
    insist(actual_files['capture-status.json'].stat().st_size<=m['bounds']['reservedStatusBytes'],'Capture status slot cap')
    reserve=m['bounds']['reservedStatusBytes']+m['bounds']['reservedFailureBytes']+m['bounds']['reservedAuditBytes']
    declared=status.get('budget') or {}
    check(declared.get('reservedSlots')=={'capture-status.json':m['bounds']['reservedStatusBytes'],'terminal-error.json':m['bounds']['reservedFailureBytes'],'audit.json':m['bounds']['reservedAuditBytes']},'Reserved output slots')
    check(declared.get('regularEvidenceBytes',m['bounds']['outputBytes'])+reserve<=m['bounds']['outputBytes'] and declared.get('regularAncillaryBytes',m['bounds']['ancillaryBytes'])+reserve<=m['bounds']['ancillaryBytes'],'Regular evidence consumed reserved report capacity')
    total=sum(p.stat().st_size for p in actual_files.values());insist(total<=m['bounds']['outputBytes'],'Total output cap')
    ancillary=actual_files['capture-status.json'].stat().st_size
    for name,row in expected_files.items():
        insist(re.fullmatch('[a-z0-9][a-z0-9_.-]*',name) is not None,'Unsafe output path')
        p=directory/name;check(p.is_file() and p.stat().st_size==row['bytes'],'Missing/size mismatch '+name)
        if not p.is_file(): continue
        check(sha(p.read_bytes())==row['sha256'],'SHA mismatch '+name)
        if row['kind']!='raw': ancillary+=row['bytes']
    check(ancillary+m['bounds']['reservedAuditBytes']<=m['bounds']['ancillaryBytes'],'Ancillary cap including final audit reserve')
    check(total+m['bounds']['reservedAuditBytes']<=m['bounds']['outputBytes'],'Total cap including final audit reserve')
    schedule=read_json(directory/'schedule.json');validate_schedule(schedule)
    check((directory/'schedule.json').read_bytes()==(manifest_path.parent/'schedule.json').read_bytes(),'Fixed schedule pin')
    check((directory/'tapes.json').read_bytes()==(manifest_path.parent/'tapes.json').read_bytes(),'Fixed tape pin')
    check(sha((directory/'source-receipt.json').read_bytes())==m['build']['sourceReceiptSha256'],'Extracted source identity')
    source=read_json(directory/'source-receipt.json');check(source['bundle']['sha256']==m['build']['bundleSha256']==sha((directory/'fixture.js').read_bytes()),'Compiled bundle identity')
    check(source['noFullGameBuild'] and source['noProducerBodyRecreation'] and source['scope']['originalForegroundUnchanged'] and source['scope']['immediateBackground'],'Actual-source scope receipts')
    check([v['id'] for v in status['checkpoints']]==[s['id'] for s in schedule['checkpoints']],'Checkpoint identity/order')
    raws={};metadata={}
    for spec in schedule['checkpoints']:
        id=spec['id'];record=read_json(directory/(id+'.json'));metadata[id]=record
        a=(directory/(id+'.original.rgba')).read_bytes();b=(directory/(id+'.candidate.rgba')).read_bytes()
        insist(len(a)==len(b)==RAW,'Raw dimensions '+id);raws[id]=(a,b)
        diff=difference(a,b);states=[v['state'] for v in record['values']];state_equal=states[0]==states[1]
        check((diff['changedBytes']==0)==spec['expectedRawEqual'],'Unexpected raw equality '+id)
        check(state_equal==spec['expectedStateEqual'],'Unexpected native state equality '+id)
        check(diff==record['rawDiff'] and state_equal==record['stateEqual'],'Declared comparator differs '+id)
        check(record['caseElapsedMs']<m['bounds']['caseMs'],'Case deadline '+id)
        check(record['id']==id and record['pair']==spec['pair'],'Pair identity '+id)
        if not spec['savedRawMutation']:
            check([v['readbacks'] for v in record['values']]==[spec['readbacksPerCanvasBefore']+1]*2,'Readback counts '+id)
        s=record['summaries'];check(s[0]['sourceKind']=='original' and s[1]['sourceKind']=='candidate','Source lane '+id)
        check(s[0]['providerCalls']==s[1]['providerCalls'],'Scheduled provider tape '+id)
        for value in states:
            attrs=value['contextAttributes'];check(value['canvas']=={'width':WIDTH,'height':HEIGHT},'Canvas size '+id)
            check(attrs.get('alpha') is True and attrs.get('willReadFrequently') is False,'Original default context options '+id)
        output['checkpoints'].append({'id':id,'raw':diff,'stateEqual':state_equal,'rawSha256':[sha(a),sha(b)],'expectedDetector':spec['detector']})
    check(metadata['p2-latest']['deferralEvidence']['nativeForegroundPaintsBeforeReveal'][0]>0 and metadata['p2-latest']['deferralEvidence']['nativeForegroundPaintsBeforeReveal'][1]==0 and metadata['p2-latest']['deferralEvidence']['backgroundBlits']==[3,3],'Actual hidden foreground/background boundary')
    for id,name,message in [('p4-base-failure','Error','fixture-after-native-base-fill'),('p4-drawimage-failure','InvalidStateError',None),('p5-partial','Error','fixture-after-native-rotate'),('p7-arc-error','IndexSizeError',None)]:
        for side in metadata[id]['summaries']:
            error=side['tickReceipts'][-1]['error'];check(error and error['name']==name and (message is None or error['message']==message),'Original exception forwarding '+id)
    for side in metadata['p3-guards']['summaries']:
        check(all(t['providerReads']==t['clears']==t['blits']==0 for t in side['tickReceipts']),'Hidden guard sampled/worked')
    for note in metadata['p3-collapse-reveal']['caseNotes']:
        check(note['kind']=='concealment' and all(not v['visible'] and v['viewport']['height']==400 for v in note['values']),'Short viewport/trial concealment')
    check(len(metadata['p3-collapse-reveal']['caseNotes'])==3,'CSS cases missing')
    for side in metadata['p7-canonical']['summaries']:
        c=side['canonical'];check(len(c)==2 and c[0]['values']==c[1]['values'],'Canonical invalid setter handling')
    for side in metadata['p8-loss-listener']['summaries']:
        loss=[e for e in side['events'] if e['kind']=='synthetic-listener-policy'];check(len(loss)==1 and loss[0]['trusted'] is False and loss[0]['realLossProven'] is False,'Loss listener scope')
    check(raws['n1-byte-mutant'][0]==raws['p1-visible'][0],'One-byte detector reference')
    check(raws['n1-byte-mutant'][1]==bytes([raws['p1-visible'][1][0]^1])+raws['p1-visible'][1][1:],'Exact saved candidate-byte mutation')
    check([v['state'] for v in metadata['n1-byte-mutant']['values']]==[v['state'] for v in metadata['p1-visible']['values']],'Saved detector state binding; not a new native capture')
    check(difference(*raws['n1-byte-mutant'])['changedBytes']==1,'One-byte detector did not reject exactly one byte')
    check(raws['p1-visible'][0]!=raws['p2-latest'][0],'Latest-image detector is vacuous')
    check(raws['p4-base-failure'][0]==raws['p1-visible'][0],'Failed base rebuild did not preserve previous target')
    check(raws['p4-before-rebuild'][0]==raws['p1-visible'][0],'Prior image absent before base mutation')
    check(not any(raws['p4-drawimage-failure'][0]) and not any(raws['p4-drawimage-failure'][1]),'Failed blit revived stale foreground')
    check(raws['p8-source-reset'][0]==raws['p1-visible'][0],'Source reset changed target-owned image')
    check(not any(raws['p8-loss-listener'][0]) and not any(raws['p8-loss-listener'][1]),'Listener policy retained stale pixels')
    check([v['id'] for v in status['compositions']]==schedule['compositionIds'],'Composition identity/order')
    for c,expected_id in zip(status['compositions'],schedule['compositionIds']):
        validate_composition_binding(c,expected_id,expected_files)
        check(c['noPriorReadbacks'] is True and c['priorReadbacks']==[0,0],'Composition pre-readback contract '+c['id'])
        check(c['dpr']==1 and c['viewport']==m['runtime']['viewport'] and c['matte']==m['runtime']['matte'],'Composition layout '+c['id'])
        check(len(c['rectangles'])==(3 if c['id']=='p1-visible' else 2),'Composition rectangle count')
        decoded=decode_png((directory/c['file']['name']).read_bytes(),(m['runtime']['viewport']['width'],m['runtime']['viewport']['height']))
        regions=[region(decoded,r) for r in c['rectangles']];diff=difference(regions[0],regions[1]);check(diff['changedBytes']==0,'Visible composition mismatch '+c['id'])
        item={'id':c['id'],'rgbaSha256':[sha(v) for v in regions],'difference':diff,'noPriorReadbacks':True}
        if c['id']=='p1-visible':
            control_summary=c['controlSummary'];check(control_summary['sourceKind']=='candidate' and control_summary['readbacks']==0 and len(control_summary['tickReceipts'])==1,'Actual native screenshot detector provenance');
            control=difference(regions[0],regions[2]);check(control['changedPixels']==1,'Native composition detector failed');item['nativePixelDetector']=control
        output['compositions'].append(item)
    summary=status.get('summary') or {}
    check(summary.get('methodCoverage')==['clearRect','drawImage','beginPath','moveTo','lineTo','closePath','arc','ellipse','fill','stroke','fillRect','fillText','strokeText','save','restore','translate','rotate','setLineDash'],'18 native methods not covered')
    check(summary.get('fieldCoverage')==['fillStyle','strokeStyle','lineWidth','globalAlpha','font','textAlign'],'Six properties not covered')
    check(summary.get('realContextLossProven') is False and summary.get('canvasStorageBackendAttested') is False,'Unsupported context/backend claim')
    output.update(auditCompleted=True,passed=not errors,lane=lane,elapsedSeconds=time.monotonic()-started,outputBytes=total,originalCommit=m['source']['originalCommit'],candidateCommit=m['source']['candidateCommit'],browserRevisionBinding=revision_binding,scope='fixed Canvas2D pixels/state only; no game performance or real context-loss result')
    return output

def main():
    parser=argparse.ArgumentParser();parser.add_argument('directory');parser.add_argument('manifest');parser.add_argument('binding');args=parser.parse_args()
    try: output=audit(Path(args.directory),Path(args.manifest),Path(args.binding))
    except Exception as e: output={'auditCompleted':False,'passed':False,'releaseReady':False,'errors':[str(e)]}
    try:
        m=read_json(Path(args.manifest));schedule=read_json(Path(args.manifest).parent/'schedule.json')
        output=write_audit_report(Path(args.directory),output,m,schedule)
    except Exception as e:
        output={'auditCompleted':False,'passed':False,'releaseReady':False,'errors':['Bounded report persistence failed: '+str(e)]}
    print('MINIMAP_AUDIT_JSON='+json.dumps(output,separators=(',',':')));return 0 if output['passed'] else 1
if __name__=='__main__': sys.exit(main())
