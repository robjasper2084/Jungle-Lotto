import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {buildRelease,promotePackages,readableTree,validatePackage,modelDependencies} from './game-package.mjs';

async function fixture(t){const root=await mkdtemp(resolve(tmpdir(),'riding-package-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function packageAt(path,entry,text){await mkdir(resolve(path,'licenses'),{recursive:true});await writeFile(resolve(path,'licenses/notice.txt'),'license');await writeFile(resolve(path,'SOURCE.md'),'source');await writeFile(resolve(path,'game.js'),text);await writeFile(resolve(path,entry),'<script src="./game.js"></script>');}
test('externalized model textures are included and missing ones fail before packaging',async t=>{
  const root=await fixture(t);await mkdir(resolve(root,'models'));await mkdir(resolve(root,'shared-textures'));
  const json=Buffer.from(JSON.stringify({images:[{uri:'../shared-textures/dog.png'}]})),glb=Buffer.alloc(20+json.length);glb.writeUInt32LE(json.length,12);json.copy(glb,20);await writeFile(resolve(root,'models/dog.glb'),glb);
  await assert.rejects(modelDependencies(root,['models/dog.glb']),{code:'ENOENT'});
  await writeFile(resolve(root,'shared-textures/dog.png'),'texture');assert.deepEqual([...await modelDependencies(root,['models/dog.glb'])],['shared-textures/dog.png']);
});
test('second build failure preserves both previous packages',async t=>{
  const root=await fixture(t),a=resolve(root,'store/public/arcade/swoop-detroit'),b=resolve(root,'store/public/arcade/elmwood-explorer');
  await packageAt(a,'index.html','old Swoop');await packageAt(b,'elmwood.html','old Elmwood');
  await assert.rejects(buildRelease(root,[{name:'swoop-detroit',entry:'index.html',build:out=>packageAt(out,'index.html','new Swoop')},{name:'elmwood-explorer',entry:'elmwood.html',build(){throw Error('Late texture failure');}}]),/Late texture/);
  assert.equal(await readFile(resolve(a,'game.js'),'utf8'),'old Swoop');assert.equal(await readFile(resolve(b,'game.js'),'utf8'),'old Elmwood');
});
test('second promotion failure rolls back the first package and retains staged work',async t=>{
  const root=await fixture(t),plans=['swoop-detroit','elmwood-explorer'].map((name,i)=>({name,entry:i?'elmwood.html':'index.html',staged:resolve(root,'new',name),destination:resolve(root,'live',name)}));
  for(const p of plans){await packageAt(p.staged,p.entry,'new');await packageAt(p.destination,p.entry,'old');}
  await assert.rejects(promotePackages(plans,resolve(root,'backup'),async(a,b)=>{if(a===plans[1].staged)throw Error('Simulated locked directory');await rename(a,b);}),/locked/);
  for(const p of plans){assert.equal(await readFile(resolve(p.destination,'game.js'),'utf8'),'old');assert.equal(await readFile(resolve(p.staged,'game.js'),'utf8'),'new');}
});
test('missing late asset or license fails preflight without changing an existing output',async t=>{
  const root=await fixture(t),out=resolve(root,'live');await packageAt(out,'index.html','old');
  for(const dependency of ['exports/atwater/mack.glb','LICENSE.txt'])await assert.rejects(readableTree(resolve(root,dependency)),{code:'ENOENT'});
  assert.equal(await readFile(resolve(out,'game.js'),'utf8'),'old');
});
test('nested entry validation rejects missing bundles; successful paired build retains both backups',async t=>{
  const root=await fixture(t),out=resolve(root,'bad');await packageAt(out,'elmwood.html','ok');await writeFile(resolve(out,'elmwood.html'),'<script src="./missing.js"></script>');
  await assert.rejects(validatePackage(out,'elmwood.html'),{code:'ENOENT'});
  const plans=['swoop-detroit','elmwood-explorer'].map((name,i)=>({name,source:'fixture',entry:i?'elmwood.html':'index.html',build:out=>packageAt(out,i?'elmwood.html':'index.html','new')}));
  for(const p of plans)await packageAt(resolve(root,'store/public/arcade',p.name),p.entry,'old');
  const receipt=await buildRelease(root,plans);
  for(const p of plans){assert.equal(await readFile(resolve(receipt.backup,p.name,'game.js'),'utf8'),'old');assert.equal(await readFile(resolve(root,'store/public/arcade',p.name,'game.js'),'utf8'),'new');}
});
