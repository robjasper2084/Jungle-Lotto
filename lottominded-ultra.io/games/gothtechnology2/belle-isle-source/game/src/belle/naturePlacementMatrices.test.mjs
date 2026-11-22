import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import ts from 'typescript';

// Exercise the actual production helper closure and original composition body.
// The independent optimization oracle separately pins the untouched baseline.
const filename=fileURLToPath(new URL('./nature.ts',import.meta.url));
const source=fs.readFileSync(filename,'utf8');
const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const factory=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='addNature');
const declaration=name=>factory.body.statements.flatMap(node=>ts.isVariableStatement(node)?[...node.declarationList.declarations]:[]).find(node=>node.name.getText(ast)===name);
const begin=factory.body.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(row=>row.name.getText(ast)==='riparianFocus'));
const end=factory.body.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='matrix');
assert(begin&&end);
const imports=ast.statements.filter(node=>ts.isImportDeclaration(node)&&['./habitatPolicy.ts','./sunsetCanopy.ts','./naturePlacementMatrices.ts'].includes(node.moduleSpecifier.text)).map(node=>node.getText(ast)).join('\n');
assert.equal(imports.split('\n').length,3);
const statsGetter=declaration('stats').initializer.properties.find(node=>node.name?.getText(ast)==='placementMatrices');
assert(ts.isGetAccessorDeclaration(statsGetter));
const code=`import * as T from 'three';\n${imports}\nexport function fixture(terrain,plan){\nconst ${declaration('dummy').getText(ast)},${declaration('tint').getText(ast)};\n${source.slice(begin.getStart(ast),end.end)}\nconst stats={${statsGetter.getText(ast)}};\nreturn {T,matrix,composePlacementMatrix,dummy,growth,crownOverlap,canopyCache,canalCrowns,placementMatrices,stats};\n}`;
const {outputFiles}=await build({stdin:{contents:code,loader:'ts',sourcefile:'nature-placement-functional-fixture.ts',resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'});
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const plan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
const terrain={map:{pois:[{name:'Nashua Canal',x:120,z:-80},{name:'Sylvan Canal',x:-60,z:100},{name:'Loop Canal',x:70,z:40}]}};
const seed=id=>structuredClone((id.startsWith('rock')?plan.ground:plan.trees).find(row=>row.id===id)??plan.ground[0]);
const hex64=matrix=>Buffer.from(new Float64Array(matrix.elements.slice(0,16)).buffer).toString('hex');
function side(plants){
 const records=structuredClone(plants),f=fixture(terrain,{trees:records,ground:[]});
 const instance=new f.T.InstancedMesh(new f.T.BufferGeometry(),new f.T.MeshBasicMaterial(),1);
 let calls=0;const update=f.dummy.updateMatrix;
 f.dummy.updateMatrix=function(...args){calls++;return Reflect.apply(update,this,args);};
 const sample=(input,hidden,crown,cached)=>{const matrix=(cached?f.matrix:f.composePlacementMatrix)(input,hidden,crown);assert.equal(matrix,f.dummy.matrix);instance.setMatrixAt(0,matrix);return {float64:hex64(matrix),float32:Buffer.from(instance.instanceMatrix.array.buffer).toString('hex')};};
 return {f,records,sample,calls:()=>calls};
}
function pair(plants=[seed('willow')]){
 const baseline=side(plants),candidate=side(plants);
 const compare=(index=0,hidden=false,crown=false)=>assert.deepEqual(candidate.sample(candidate.records[index],hidden,crown,true),baseline.sample(baseline.records[index],hidden,crown,false));
 const both=fn=>{fn(baseline);fn(candidate);};
 return {baseline,candidate,compare,both};
}

test('real placement closure preserves shared matrix identity and protects cached words from caller mutation',()=>{
 const p=pair();p.compare();
 const identity=p.candidate.f.dummy.matrix;
 p.candidate.f.dummy.matrix.elements.fill(713);
 p.compare();
 assert.equal(p.candidate.f.dummy.matrix,identity);
 assert.equal(p.candidate.calls(),1);
 assert.equal(p.candidate.f.placementMatrices.diagnostics.reuses,1);
});

test('four hidden/crown variants retain exact Float64 and actual instance-buffer words',()=>{
 const p=pair([seed('willow'),seed('pine'),seed('rock_1')]);
 assert.equal(p.candidate.calls(),0,'factory construction does not compose');
 for(let repeat=0;repeat<3;repeat++)for(let index=0;index<3;index++)for(const hidden of [false,true])for(const crown of [false,true])p.compare(index,hidden,crown);
 const d=p.candidate.f.placementMatrices.diagnostics;
 assert.equal(d.attempts,d.compositionCalls+d.reuses);assert.equal(d.compositionCalls,p.candidate.calls());
 assert(d.storedEntries<=4*d.registeredSources);
});

test('raw input mutation and returning to old inputs replace bounded variant entries',()=>{
 const p=pair();p.compare();
 const changes={id:['birch','pine','willow'],x:[0,-0,33.25],y:[-0,0,44.5],z:[-18,0,81],yaw:[0,-0,Math.PI],scale:[-2,0,1.25],heightScale:[undefined,null,-1,0,1.75]};
 for(const [name,values] of Object.entries(changes))for(const value of values){p.both(s=>{s.records[0][name]=value;});p.compare();p.compare();}
 assert.equal(p.candidate.f.placementMatrices.diagnostics.storedEntries,1);
});

test('cached effective growth and canal values are observed without recomputing their original lazy caches',()=>{
 const p=pair();p.compare(0,false,true);p.compare(0,false,true);
 for(const [field,value] of [['width',1.37],['height',2.11],['width',-0],['height',0]]){
  p.both(s=>{s.f.canopyCache.get(s.records[0])[field]=value;});p.compare(0,false,true);p.compare(0,false,true);
 }
 p.both(s=>{s.f.canalCrowns.set(s.records[0],1.125);});p.compare(0,false,true);p.compare(0,false,true);
 p.both(s=>{s.records[0].age=999;s.records[0].canopyWidth=99;});p.compare(0,false,true);
});

test('optional heightScale removal and null/default values preserve original fallback semantics',()=>{
 const p=pair();
 for(const value of [1.25,undefined,null]){p.both(s=>{s.records[0].heightScale=value;});p.compare();p.compare();}
 p.both(s=>{delete s.records[0].heightScale;});p.compare();p.compare();
});

test('nonfinite, signed-zero and negative-scale placements preserve exact output for hidden and crown states',()=>{
 const p=pair([seed('birch')]);
 for(const name of ['x','y','z','yaw','scale','heightScale']){
  const original=p.baseline.records[0][name];
  for(const value of [NaN,Infinity,-Infinity,-0,0,-1]){
   p.both(s=>{s.records[0][name]=value;});
   for(const hidden of [false,true])for(const crown of [false,true])p.compare(0,hidden,crown);
  }
  p.both(s=>{s.records[0][name]=original;});
 }
});

test('new objects and unregistered proxies follow the original property-read trace',()=>{
 const p=pair();p.compare();
 const logs={baseline:[],candidate:[]};
 for(const key of ['baseline','candidate']){
  const s=p[key],record={...s.records[0]};
  s.unregistered=new Proxy(record,{
   get(target,name,receiver){logs[key].push(['get',String(name)]);return Reflect.get(target,name,receiver);},
   getOwnPropertyDescriptor(target,name){logs[key].push(['descriptor',String(name)]);return Reflect.getOwnPropertyDescriptor(target,name);},
   getPrototypeOf(target){logs[key].push(['prototype']);return Reflect.getPrototypeOf(target);},
  });
 }
 assert.deepEqual(p.candidate.sample(p.candidate.unregistered,false,true,true),p.baseline.sample(p.baseline.unregistered,false,true,false));
 assert.deepEqual(logs.candidate,logs.baseline);assert(logs.candidate.every(row=>row[0]==='get'));
 const copies={baseline:{...p.baseline.records[0]},candidate:{...p.candidate.records[0]}};
 assert.deepEqual(p.candidate.sample(copies.candidate,false,false,true),p.baseline.sample(copies.baseline,false,false,false));
});

test('owned raw accessors fall back without extra getter calls, including hidden short-circuit reads',()=>{
 const p=pair();let baselineReads=0,candidateReads=0;
 Object.defineProperty(p.baseline.records[0],'scale',{configurable:true,get(){baselineReads++;return 1.25;}});
 Object.defineProperty(p.candidate.records[0],'scale',{configurable:true,get(){candidateReads++;return 1.25;}});
 p.compare();assert.equal(candidateReads,baselineReads);
 baselineReads=candidateReads=0;p.compare(0,true,true);assert.equal(candidateReads,0);assert.equal(baselineReads,0);
 p.both(s=>{Object.defineProperty(s.records[0],'scale',{value:1.25,writable:true,configurable:true});});p.compare();p.compare();
});

test('derived accessors and nonfinite factors preserve the original number and order of getter calls',()=>{
 const p=pair();p.compare(0,false,true);let baselineReads=0,candidateReads=0;
 Object.defineProperty(p.baseline.f.canopyCache.get(p.baseline.records[0]),'width',{configurable:true,get(){baselineReads++;return 1.7;}});
 Object.defineProperty(p.candidate.f.canopyCache.get(p.candidate.records[0]),'width',{configurable:true,get(){candidateReads++;return 1.7;}});
 p.compare(0,false,true);assert.equal(candidateReads,baselineReads);
 p.both(s=>{Object.defineProperty(s.f.canopyCache.get(s.records[0]),'width',{value:Infinity,writable:true,configurable:true});});p.compare(0,false,true);
 p.both(s=>{s.f.canalCrowns.set(s.records[0],NaN);});p.compare(0,false,true);
});

test('early raw-input failure does not eagerly populate derived caches or overcount compositions',()=>{
 const p=pair();
 p.both(s=>{Object.defineProperty(s.records[0],'x',{configurable:true,get(){throw new Error('raw input failed');}});});
 assert.throws(()=>p.baseline.sample(p.baseline.records[0],false,true,false),/raw input failed/);
 assert.throws(()=>p.candidate.sample(p.candidate.records[0],false,true,true),/raw input failed/);
 assert.equal(p.candidate.calls(),0);assert.equal(p.candidate.f.placementMatrices.diagnostics.compositionCalls,0);
 assert.equal(p.candidate.f.placementMatrices.diagnostics.failures,1);
 p.both(s=>{assert(!s.f.canopyCache.has(s.records[0]));assert(!s.f.canalCrowns.has(s.records[0]));Object.defineProperty(s.records[0],'x',{value:12,writable:true,configurable:true});});
 p.compare(0,false,true);p.compare(0,false,true);
});

test('composition failure invalidates only its variant and recovery recomputes before reuse',()=>{
 const p=pair();p.compare();p.compare(0,true,false);
 p.both(s=>{const update=s.f.dummy.updateMatrix;s.restore=()=>{s.f.dummy.updateMatrix=update;};s.f.dummy.updateMatrix=function(){throw new Error('composition failed');};s.records[0].x+=10;});
 assert.throws(()=>p.baseline.sample(p.baseline.records[0],false,false,false),/composition failed/);
 assert.throws(()=>p.candidate.sample(p.candidate.records[0],false,false,true),/composition failed/);
 p.both(s=>{s.restore();s.records[0].x-=10;});
 const before=p.candidate.f.placementMatrices.diagnostics.compositionCalls;
 p.compare();assert.equal(p.candidate.f.placementMatrices.diagnostics.compositionCalls,before+1);p.compare();
 assert.equal(p.candidate.f.placementMatrices.diagnostics.failures,1);
});

test('raw or derived mutation during the original composition does not publish a stale matrix',()=>{
 for(const derived of [false,true]){
  const p=pair();p.compare(0,false,true);p.compare(0,false,true);
  p.both(s=>{s.records[0].yaw+=.1;const original=s.f.dummy.updateMatrix;let first=true;s.f.dummy.updateMatrix=function(...args){const result=Reflect.apply(original,this,args);if(first){first=false;if(derived)s.f.canopyCache.get(s.records[0]).width+=.1;else s.records[0].x+=1;}return result;};});
  p.compare(0,false,true);p.compare(0,false,true);p.compare(0,false,true);
 }
});

test('reentrant original computation cannot commit a key for a changed shared dummy',()=>{
 const p=pair([seed('willow'),seed('pine')]);p.compare();
 p.both(s=>{s.records[0].yaw+=.2;const original=s.f.dummy.updateMatrix;let first=true;s.f.dummy.updateMatrix=function(...args){if(first){first=false;(s===p.candidate?s.f.matrix:s.f.composePlacementMatrix)(s.records[1],false,false);}return Reflect.apply(original,this,args);};});
 p.compare();p.compare();p.compare();
 const d=p.candidate.f.placementMatrices.diagnostics;assert.equal(d.compositionCalls,p.candidate.calls());assert(d.fallbacks>0);
});

test('actual nature.stats getter exposes fresh frozen lifetime counters and bounded storage',()=>{
 const p=pair([seed('willow'),seed('willow')]);
 for(let round=0;round<3;round++)for(let index=0;index<2;index++)for(const hidden of [false,true])for(const crown of [false,true])p.compare(index,hidden,crown);
 const a=p.candidate.f.stats.placementMatrices,b=p.candidate.f.stats.placementMatrices;
 assert(Object.isFrozen(a));assert.notEqual(a,b);assert.deepEqual(a,b);
 assert.equal(a.source,'nature-placement-matrices');assert.equal(a.registeredSources,2);assert(a.storedEntries<=8);
 assert.equal(a.attempts,a.compositionCalls+a.reuses);assert.equal(a.compositionCalls,p.candidate.calls());
 assert.throws(()=>{p.candidate.f.stats.placementMatrices={};},TypeError);
});

test('malformed unregistered input preserves the original exception and recovers on a valid call',()=>{
 const p=pair();
 for(const input of [null,undefined]){
  let expected,actual;
  try{p.baseline.f.composePlacementMatrix(input);}catch(error){expected={name:error.name,message:error.message};}
  try{p.candidate.f.matrix(input);}catch(error){actual={name:error.name,message:error.message};}
  assert.deepEqual(actual,expected);
 }
 p.compare();p.compare();
});
