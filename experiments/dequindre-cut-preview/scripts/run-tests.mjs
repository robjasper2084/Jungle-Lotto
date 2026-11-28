import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {previewRoot} from './paths.mjs';

const tests=[];
for(const directory of ['tests','src']){
  for(const file of await readdir(resolve(previewRoot,directory)).catch(()=>[]))if(/\.test\.(?:mjs|ts)$/.test(file))tests.push(resolve(previewRoot,directory,file));
}
if(!tests.length)throw Error('No preview tests found');
const result=spawnSync(process.execPath,['--experimental-transform-types','--import',resolve(previewRoot,'scripts/register-test-resolver.mjs'),'--test',...tests.sort()],{cwd:previewRoot,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
