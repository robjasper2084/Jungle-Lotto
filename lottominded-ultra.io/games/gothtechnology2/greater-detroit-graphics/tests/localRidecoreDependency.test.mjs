import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const json=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const ride=json('ride-core/package.json');
const requiredPath='file:../ride-core';
for(const district of ['swoop','elmwood']){
 const project=district+'-source';
 test(district+' clean npm ci lock resolves the checked-in RideCore',()=>{
  const p=json(project+'/package.json'),lock=json(project+'/package-lock.json');
  assert.equal(p.dependencies['@digital-static/ridecore'],requiredPath);
  assert.equal(lock.packages[''].dependencies['@digital-static/ridecore'],requiredPath);
  assert.equal(lock.packages['../ride-core'].name,ride.name);
  assert.equal(lock.packages['../ride-core'].version,ride.version);
  assert.deepEqual(lock.packages['../ride-core'].dependencies,ride.dependencies);
  assert.deepEqual(lock.packages['../ride-core'].peerDependencies,ride.peerDependencies);
  assert.deepEqual(lock.packages['node_modules/@digital-static/ridecore'],{resolved:'../ride-core',link:true});
  assert.equal(p.scripts.check,'tsc -p tsconfig.merge-check.json --noEmit');
 });
 test(district+' type check extends original project with compiled RideCore declarations',()=>{
  const config=json(project+'/tsconfig.merge-check.json');
  assert.equal(config.compilerOptions.erasableSyntaxOnly,false);
  assert.equal(typeof config.compilerOptions.paths['@digital-static/ridecore'][0],'string');
  assert.ok(config.compilerOptions.paths['@digital-static/ridecore'][0].includes('ride-core'));
 });
}
test('CI requires reproducible npm ci with no lock regeneration or external directory link',()=>{
 for(const filename of ['gds-source-builds.yml','gds-real-capture.yml']){
  const s=readFileSync(resolve(root,'../../../../.github/workflows',filename),'utf8');
  assert.doesNotMatch(s,/npm install --package-lock-only/);
  assert.doesNotMatch(s,/ln -s/);
  assert.match(s,/npm ci/);
 }
});
