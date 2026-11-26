import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const game=process.env.APP_GAME??fileURLToPath(new URL('../../Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/',import.meta.url));
const patched=process.env.DIAGNOSTIC_SOURCE_ROOT??fileURLToPath(new URL('./source/',import.meta.url));
const require=createRequire(resolve(game,'package.json')),{build}=require('esbuild'),ts=require('typescript');
async function bundle(path,contents){
 const options={bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'};
 const {outputFiles}=await build(contents===undefined?{...options,entryPoints:[resolve(game,path)]}:
  {...options,stdin:{contents,sourcefile:path,resolveDir:resolve(game,'src/belle'),loader:'ts'}});
 return import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
}
const source=await readFile(resolve(patched,'src/belle/renderDiagnostics.ts'),'utf8');
const [{createNatureRenderProbe},{RideProfile},{createRideProfileBuildReader}]=await Promise.all([
 bundle('src/belle/renderDiagnostics.ts',source),bundle('src/belle/rideProfile.ts'),bundle('src/belle/rideProfileBuild.ts')]);
const main=ts.createSourceFile('main.ts',await readFile(resolve(patched,'src/belle/main.ts'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const initializers=new Map();
function visit(node){
 if(ts.isVariableDeclaration(node)&&['loopProbe','submissionProbe'].includes(node.name.getText(main)))initializers.set(node.name.getText(main),node.initializer.getText(main));
 ts.forEachChild(node,visit);
}
visit(main);assert.equal(initializers.size,2);

test('only the exact diagnostic opt-in enables named render probes beside the original manual mode',()=>{
 let reads=0;const clock=()=>++reads;
 for(const query of ['', '?profile=1','?renderSubmission=1','?profile=automatic&renderSubmission=1','?profile=1&renderSubmission=0','?profile=1&renderSubmission=true'])
  assert.equal(createNatureRenderProbe(query,clock),undefined,query);
 for(const query of ['?profile=manual','?profile=1&renderSubmission=1','?renderSubmission=1&profile=1']){
  const probe=createNatureRenderProbe(query,clock);assert(probe);probe.beginFrame(false);assert.equal(probe.now(),0);assert.equal(probe.finishFrame(),undefined);
 }
 assert.equal(reads,0,'Dormant diagnostics do no clock work');
});

test('the actual main initializers install named submission hooks without installing the manual loop/pacing observer',()=>{
 const loop=Function('renderProbe','ManualLoopProbe','location','return '+initializers.get('loopProbe'));
 const submission=Function('renderProbe','installRenderSubmissionProbe','renderer','scene','return '+initializers.get('submissionProbe'));
 const renderer={},scene={};let loops=0,submissions=0;
 class ManualLoopProbe{constructor(){loops++;}}
 for(const search of ['?profile=1','?profile=1&renderSubmission=1','?profile=manual']){
  const renderProbe=createNatureRenderProbe(search),beforeLoops=loops,beforeSubmissions=submissions;
  const instance=loop(renderProbe,ManualLoopProbe,{search});
  const hook=submission(renderProbe,(r,s)=>{assert.equal(r,renderer);assert.equal(s,scene);submissions++;return 'installed';},renderer,scene);
  assert.equal(loops-beforeLoops,search==='?profile=manual'?1:0);
  assert.equal(!!instance,search==='?profile=manual');
  assert.equal(submissions-beforeSubmissions,renderProbe?1:0);assert.equal(hook,renderProbe?'installed':undefined);
 }
});

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.hidden=false;this.open=false;this.attributes={};}
 append(child){this.children.push(child);child.parentElement=this;}
 setAttribute(key,value){this.attributes[key]=value;}
}
function profileFixture(search){
 const keys=['document','location','innerWidth','innerHeight','devicePixelRatio'],saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const callbacks=new Map(),settings=new Element('dialog');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,createElement:name=>new Element(name),getElementById:id=>id==='settings'?settings:null,
  addEventListener:(name,callback)=>callbacks.set(name,[...(callbacks.get(name)||[]),callback])}});
 Object.defineProperty(globalThis,'location',{configurable:true,value:{hostname:'127.0.0.1',search}});
 Object.assign(globalThis,{innerWidth:1440,innerHeight:900,devicePixelRatio:1});
 const profile=new RideProfile(()=>({quality:'high'}));
 return {profile,settings,emit:(name,event)=>{for(const callback of callbacks.get(name)||[])callback(event);},restore(){for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}};
}

test('the untouched RideProfile preserves the original trusted W boundary with the extra flag',()=>{
 for(const search of ['?profile=1','?profile=1&renderSubmission=1']){
  const fixture=profileFixture(search);
  try{
   const profile=fixture.profile;profile.start();profile.sample(.1,[1,2,3,4,5],12,120,4,3,0,0,2,'MacArthur Bridge',true);
   fixture.emit('keyup',{code:'KeyW',isTrusted:false});assert.equal(profile.enabled,true);
   fixture.emit('keyup',{code:'KeyS',isTrusted:true});assert.equal(profile.enabled,true);
   fixture.emit('keyup',{code:'KeyW',isTrusted:true});assert.equal(profile.enabled,false);
   const report=JSON.parse(fixture.settings.children[0].children[2].value);
   assert.equal(report.stopReason,'trusted-W-keyup');assert.equal(report.frames,1);assert.equal(report.activeSeconds,.1);
  }finally{fixture.restore();}
 }
});

test('profile=1 plus the observation flag never selects the manual build-marker request',()=>{
 let calls=0;
 const query=new URLSearchParams('?profile=1&renderSubmission=1');
 const read=createRideProfileBuildReader(query.get('profile'),()=>{calls++;throw Error('Unexpected build-marker fetch');});
 assert.equal(read().status,'unavailable');assert.equal(read().reason,'manual comparison not selected');assert.equal(calls,0);
});
