import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {repoRoot,outputRoot,assertPreviewOutput} from './paths.mjs';
import {SOURCE_DIGESTS,assertPinnedInput,PINNED_BASE} from './source-transforms.mjs';
import {assertPreviewWorkflow,PREVIEW_WORKFLOW} from './workflow-isolation.mjs';

export async function verifyIsolation(){
  assertPreviewOutput(outputRoot);
  for(const file of Object.keys(SOURCE_DIGESTS))assertPinnedInput(await readFile(resolve(repoRoot,file),'utf8'),file);
  const tracked=execFileSync('git',['diff','--name-only',PINNED_BASE,'--'],{cwd:repoRoot,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const added=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:repoRoot,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const changed=[...new Set([...tracked,...added])];
  const allowed=file=>file.startsWith('experiments/dequindre-cut-preview/')||file==='.github/workflows/dequindre-cut-preview.yml';
  const outside=changed.filter(file=>!allowed(file));
  if(outside.length)throw Error('Preview candidate changes files outside its isolated scope: '+outside.join(', '));
  const pages=await readFile(resolve(repoRoot,'.github/workflows/pages.yml'),'utf8');
  if(!pages.includes("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'"))throw Error('Pages deployment boundary changed; re-audit before continuing');
  const assembler=await readFile(resolve(repoRoot,'scripts/build-pages-artifact.mjs'),'utf8');
  const block=assembler.match(/const publicRoots = \[([\s\S]*?)\];/);
  if(!block||/experiments/.test(block[1]))throw Error('Preview may enter Pages public roots');
  const workflow=assertPreviewWorkflow(await readFile(resolve(repoRoot,PREVIEW_WORKFLOW),'utf8'));
  return {passed:true,base:PINNED_BASE,changedFiles:changed.length,productionSourceDigests:Object.keys(SOURCE_DIGESTS).length,productionDeployment:false,workflow};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log(JSON.stringify(await verifyIsolation(),null,2));
}
