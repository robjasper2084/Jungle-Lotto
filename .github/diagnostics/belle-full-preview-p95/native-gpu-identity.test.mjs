/** Regressions derived from the retained first native failure, not a new capture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compareBrowserCommandLines,nativeRendererIdentity,parseMacCommandLine} from './native-gpu-sample.mjs';

const fixtureUrl=new URL('./fixtures/pr278-failed-native-gpu-sample.json',import.meta.url);
const fixtureBytes=await readFile(fixtureUrl),failed=JSON.parse(fixtureBytes);
const version=failed.browserVersion,executable=failed.initialSnapshot.os.browser.executable;
const os=parseMacCommandLine(failed.initialSnapshot.os.browser.args,executable);
const cdp=parseMacCommandLine(failed.initialSnapshot.browserCommandLine,executable);
const tail=['--flag-switches-begin','--flag-switches-end','--enable-unsafe-swiftshader'];
const suffixFor=prefix=>[...prefix,...tail];
const name=token=>token.split('=')[0];
const unsafe='--enable-unsafe-swiftshader';
const rejectPair=(launch,reported,label,browser=version)=>{
 assert.throws(()=>compareBrowserCommandLines(launch,reported,browser),undefined,label);
};

test('the exact failed native receipt permits only a qualified command relation and stays a failed capture',()=>{
 assert.equal(fixtureBytes.length,30256);
 assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),'7df7be82439b44a92f339ae0173ec1b104bea1191ca317cd4bdc46aa5b335167');
 assert.equal(os.length,43);assert.equal(cdp.length,46);
 const original=structuredClone(failed),launch=Object.freeze([...os]),reported=Object.freeze([...cdp]);
 const relation=compareBrowserCommandLines(launch,reported,version);
 assert.equal(relation.version,1);assert.equal(relation.mode,'pinned-chromium-in-memory-append');
 assert.equal(relation.sourceRevision,version.revision);
 assert.deepEqual(relation.osSwitches,os);assert.deepEqual(relation.systemSwitches,cdp);
 assert.deepEqual(relation.appendedSwitches,tail);assert.equal(relation.existingSwitchValuesPreserved,true);assert.equal(relation.fallbackPermissionIntroduced,false);
 assert.equal(relation.osSwitches.filter(value=>value===unsafe).length,1);
 assert.equal(relation.systemSwitches.filter(value=>value===unsafe).length,2);
 assert.deepEqual(failed,original,'Reinterpreting a representation difference must not rewrite historical evidence');
 assert.equal(failed.collectionComplete,false);assert.equal(failed.validationPassed,false);assert.equal(failed.releaseAcceptance,false);
 for(const field of ['sample','beforeSnapshot','afterSnapshot','analysis'])assert.equal(failed[field],null);
});

test('identical command vectors keep their distinct relation and preserve existing duplicates',()=>{
 const relation=compareBrowserCommandLines(Object.freeze([...os]),Object.freeze([...os]),version);
 assert.equal(relation.mode,'identical');assert.deepEqual(relation.appendedSwitches,[]);
 assert.deepEqual(relation.osSwitches,os);assert.deepEqual(relation.systemSwitches,os);
 assert.equal(relation.osSwitches.filter(value=>value==='--disable-search-engine-choice-screen').length,2);
 assert.equal(relation.existingSwitchValuesPreserved,true);assert.equal(relation.fallbackPermissionIntroduced,false);
});

test('the three observed additions are exact and ordered, with no broader suffix allowance',()=>{
 const variants=[
  ['missing closing marker',[tail[0],tail[2]]],
  ['missing duplicated switch',tail.slice(0,2)],
  ['reordered markers',[tail[1],tail[0],tail[2]]],
  ['repeated suffix',[...tail,...tail]],
  ['nonempty flag block',[tail[0],'--new-feature',tail[1],tail[2]]],
  ['switch before markers',['--new-feature',...tail]],
  ['switch after suffix',[...tail,'--new-feature']],
  ['valued begin marker',[tail[0]+'=1',tail[1],tail[2]]],
  ['valued end marker',[tail[0],tail[1]+'=',tail[2]]],
  ['valued duplicated switch',[tail[0],tail[1],tail[2]+'=false']],
  ['renamed duplicated switch',[tail[0],tail[1],'--enable-swiftshader']]
 ];
 for(const [label,addition] of variants)rejectPair([...os],[...os,...addition],label);
});

test('the addition cannot introduce fallback permission or hide preexisting marker or value ambiguity',()=>{
 const withoutUnsafe=os.filter(value=>name(value)!==unsafe);
 const variants=[
  ['absent launch permission',withoutUnsafe],
  ['multiple launch occurrences',[...os,unsafe]],
  ['valued launch occurrence',os.map(value=>value===unsafe?unsafe+'=false':value)],
  ['empty-valued launch occurrence',os.map(value=>value===unsafe?unsafe+'=':value)],
  ['conflicting launch values',[...os,unsafe+'=1']],
  ['launch begin marker',[...os,tail[0]]],
  ['launch end marker',[...os,tail[1]]],
  ['valued launch begin marker',[...os,tail[0]+'=1']],
  ['valued launch end marker',[...os,tail[1]+'=']]
 ];
 for(const [label,launch] of variants)rejectPair(launch,suffixFor(launch),label);
});

test('prefix order, multiplicity and exact values cannot be normalized away',()=>{
 const reordered=[...os];[reordered[0],reordered[1]]=[reordered[1],reordered[0]];
 const duplicateIndex=os.indexOf('--disable-search-engine-choice-screen');
 const deduplicated=os.filter((_,index)=>index!==duplicateIndex);
 const altered=os.map(value=>value==='--force-color-profile=srgb'?'--force-color-profile=display-p3':value);
 for(const [label,reportedPrefix] of [['reordered prefix',reordered],['removed repeated prefix argument',deduplicated],['changed prefix value',altered]]){
  rejectPair([...os],suffixFor(reportedPrefix),label);
 }
 rejectPair([...os,'--new-launch-argument'],[...cdp],'omitted OS argument');
});

test('both complete vectors retain native backend requirements and reject added instrumentation',()=>{
 const replacements=[
  ['software backend',os.map(value=>value==='--use-angle=metal'?'--use-angle=swiftshader':value)],
  ['conflicting backend occurrence',[...os,'--use-angle=swiftshader']],
  ['duplicated native backend occurrence',[...os,'--use-angle=metal']],
  ['missing native enable switch',os.filter(value=>value!=='--enable-gpu')],
  ['disabled native GPU',[...os,'--disable-gpu']],
  ['disabled GPU compositing',[...os,'--disable-gpu-compositing']],
  ['GPU service trace',[...os,'--enable-gpu-service-tracing']],
  ['GPU command log',[...os,'--enable-gpu-command-logging']],
  ['startup tracing',[...os,'--trace-startup=category']],
  ['trace config override',[...os,'--trace-config-file=/tmp/trace-config.json']]
 ];
 for(const [label,launch] of replacements){
  rejectPair(launch,suffixFor(launch),label+' with approved tail');
  rejectPair(launch,[...launch],label+' with equal vectors');
 }
 for(const flag of ['--disable-gpu','--enable-gpu-debugging','--trace-startup-duration=8']){
  rejectPair([...os],[...cdp,flag],'CDP-only conflict '+flag);
 }
});

test('the qualified relation is limited to the verified browser product and source revision',()=>{
 for(const browser of [
  {...version,product:'Chrome/159.0.0.0'},
  {...version,product:'Chromium/158.0.8127.89'},
  {...version,revision:'@0000000000000000000000000000000000000000'},
  {...version,revision:version.revision.slice(1)},
  {...version,revision:undefined},null
 ])rejectPair([...os],[...cdp],'unverified browser source',browser);
});

test('ambiguous flattened commands cannot enter the qualified comparison',()=>{
 const command=failed.initialSnapshot.os.browser.args;
 for(const suffix of [' --profile="a b"'," --profile='a b'",' --profile=a\\ b',' --profile=a b',' --profile=a\tb',' --profile=a\nb',' --profile=a\u0000b',' positional']){
  assert.throws(()=>parseMacCommandLine(command+suffix,executable),undefined,JSON.stringify(suffix));
 }
 assert.throws(()=>parseMacCommandLine(command.replace(executable,'/Applications/Other.app/Contents/MacOS/Other'),executable));
 assert.throws(()=>parseMacCommandLine(command+' ',executable));
});

test('actual native renderer evidence is independent of the accepted command representation',()=>{
 assert.doesNotThrow(()=>nativeRendererIdentity(failed.systemInfo));
 const changes=[
  info=>info.gpu.auxAttributes.displayType='ANGLE_SWIFTSHADER',
  info=>info.gpu.auxAttributes.glImplementationParts='(gl=egl-angle,angle=swiftshader)',
  info=>info.gpu.auxAttributes.glRenderer='ANGLE (Google, Vulkan SwiftShader Device)',
  info=>info.gpu.auxAttributes.glRenderer='ANGLE Metal Renderer: llvmpipe software',
  info=>info.gpu.auxAttributes.glRenderer='ANGLE Metal Renderer: SwiftShader',
  info=>info.gpu.auxAttributes.inProcessGpu=true,
  info=>info.gpu.auxAttributes.glVendor='',
  info=>info.gpu.auxAttributes.glVersion='',
  info=>info.gpu.devices=[],
  info=>info.gpu.devices=Array.from({length:17},()=>({vendorId:0,deviceId:0})),
  info=>info.gpu.devices=null,
  info=>delete info.gpu.auxAttributes.glRenderer,
  info=>delete info.gpu
 ];
 for(const mutate of changes){
  const info=structuredClone(failed.systemInfo);mutate(info);
  assert.throws(()=>nativeRendererIdentity(info));
  assert.equal(compareBrowserCommandLines(os,cdp,version).mode,'pinned-chromium-in-memory-append','A switch relation alone must not certify the backend');
 }
});
