import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,mkdir,writeFile,readFile,rm,stat}from'node:fs/promises';import{tmpdir}from'node:os';import{resolve}from'node:path';import{createHash}from'node:crypto';import{shareCityData}from'./share-city-data.mjs';
test('map identity is checked before edits; exact shared bytes replace only the artifact copy',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'city-data-'));try{const game=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit');await mkdir(game,{recursive:true});const bytes=Buffer.alloc(4096,8),file=resolve(game,'city.gz'),js=resolve(game,'main.js');await writeFile(file,bytes);await writeFile(js,'loadFixture("./city")');const spec={file:'city.gz',from:'./city',to:'https://example.test/pinned/city',sha:'bad'};await assert.rejects(shareCityData(root,[spec]),/changed/);assert.equal(await readFile(js,'utf8'),'loadFixture("./city")');assert.deepEqual(await readFile(file),bytes);spec.sha=createHash('sha256').update(bytes).digest('hex');assert((await shareCityData(root,[spec])).saved>0);assert((await readFile(js,'utf8')).includes(spec.to));await assert.rejects(stat(file),{code:'ENOENT'});}finally{await rm(root,{recursive:true,force:true});}
});
test('binary map companions require a rewritten parent and verified bytes before removal',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'binary-city-'));try{
  const game=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit');await mkdir(game,{recursive:true});
  const bytes=Buffer.alloc(4096,9),sha=createHash('sha256').update(bytes).digest('hex'),main=resolve(game,'main.js');
  for(const file of ['map.gz','map.browser.gz','map.physics.gz'])await writeFile(resolve(game,file),bytes);
  await writeFile(main,'loadFixture("./map.json")');
  const companions=[{file:'map.browser.gz',derivedFrom:'./map.json',sha},{file:'map.physics.gz',derivedFrom:'./map.json',sha}];
  await assert.rejects(shareCityData(root,companions),/parent missing/);assert.equal(await readFile(main,'utf8'),'loadFixture("./map.json")');
  const specs=[{file:'map.gz',from:'./map.json',to:'https://example.test/immutable/map.json',sha},...companions];
  const result=await shareCityData(root,specs);assert.equal(result.files,3);assert(result.saved>12000);assert((await readFile(main,'utf8')).includes(specs[0].to));
  for(const spec of specs)await assert.rejects(stat(resolve(game,spec.file)),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
