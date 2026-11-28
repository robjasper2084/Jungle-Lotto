export const PREVIEW_BRANCH='staging/dequindre-cut-whole-map-20261127';
export const PREVIEW_WORKFLOW='.github/workflows/dequindre-cut-preview.yml';
const events=`on:
  push:
    branches:
      - ${PREVIEW_BRANCH}
    paths:
      - experiments/dequindre-cut-preview/**
      - ${PREVIEW_WORKFLOW}`;
const allowedArtifacts=[
 'experiments/dequindre-cut-preview/output/browser/',
 'experiments/dequindre-cut-preview/output/ci/',
 'experiments/dequindre-cut-preview/dist/preview-manifest.json',
];

/** This intentionally accepts only the reviewed, simple workflow shape. Any
 * change to event scope, privilege, job count or published files needs review. */
export function assertPreviewWorkflow(source){
 const fail=reason=>{throw Error('Isolated preview workflow boundary changed: '+reason);};
 const block=key=>{
  const matches=[...source.matchAll(new RegExp('^'+key+':(?:[^\\n]*\\n)([\\s\\S]*?)(?=^[^ \\t\\n#]|$(?![\\s\\S]))','gm'))];
  if(matches.length!==1)fail('expected exactly one '+key+' block');
  return matches[0][0].trimEnd();
 };
 if(block('on')!==events)fail('exact branch push and preview paths are required');
 if(block('permissions')!=='permissions:\n  contents: read'||(source.match(/^\s*permissions:/gm)||[]).length!==1)fail('only read-only contents permission is allowed');
 if(/\b(?:workflow_dispatch|pull_request|workflow_run|environment|secrets)\s*:|\b(?:pages|id-token)\s*:|actions\/deploy-|actions\/upload-pages-artifact/.test(source))fail('release or manual trigger capability is forbidden');
 const jobs=block('jobs');
 if((jobs.match(/^  [^\s:]+:/gm)||[]).join('\n')!=='  validate:')fail('only one validation job is allowed');
 if(!jobs.includes("    if: github.event_name == 'push' && github.ref == 'refs/heads/"+PREVIEW_BRANCH+"'\n"))fail('exact job ref guard is required');
 for(const line of ['    runs-on: ubuntu-latest','    timeout-minutes: 30','          ref: ${{ github.sha }}','          persist-credentials: false','          sparse-checkout-cone-mode: false'])if(!source.includes(line+'\n'))fail('missing '+line.trim());
 const upload=source.match(/uses: actions\/upload-artifact@v4\n([\s\S]*?)$/);
 if(!upload||(source.match(/uses: actions\/upload-artifact@/g)||[]).length!==1)fail('one evidence-only artifact is required');
 const paths=upload[1].match(/          path: \|\n([\s\S]*?)          if-no-files-found:/);
 if(!paths||paths[1].split('\n').map(line=>line.trim()).filter(Boolean).join('\n')!==allowedArtifacts.join('\n'))fail('artifact paths may contain only reports, captures, inventory, logs and build receipt');
 if(!source.includes('        run: node scripts/run-browser-suite.mjs\n'))fail('the bounded native browser suite is required');
 return {productionDeployment:false,productionAcceptance:false,branch:PREVIEW_BRANCH,jobCount:1};
}
