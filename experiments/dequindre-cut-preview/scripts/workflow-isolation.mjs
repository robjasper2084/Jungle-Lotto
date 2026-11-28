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
 {name:'dequindre-cut-preview-pictures-${{ github.sha }}',paths:[
  'experiments/dequindre-cut-preview/output/browser/phone-pictures/',
  'experiments/dequindre-cut-preview/output/ci/picture-capture.json',
  'experiments/dequindre-cut-preview/output/ci/preview-pictures-server.log',
 ]},
 {name:'dequindre-cut-preview-evidence-${{ github.sha }}',paths:[
  'experiments/dequindre-cut-preview/output/browser/',
  'experiments/dequindre-cut-preview/output/ci/',
  'experiments/dequindre-cut-preview/dist/preview-manifest.json',
 ]},
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
 for(const line of ['    runs-on: ubuntu-24.04','    timeout-minutes: 30','          ref: ${{ github.sha }}','          persist-credentials: false','          sparse-checkout-cone-mode: false'])if(!source.includes(line+'\n'))fail('missing '+line.trim());
 const steps=jobs.split(/(?=^      - )/m).slice(1);
 const uploads=steps.map((step,index)=>({step,index})).filter(({step})=>step.includes('uses: actions/upload-artifact@v4\n'));
 if(uploads.length!==2||(source.match(/uses: actions\/upload-artifact@/g)||[]).length!==2)fail('exactly two evidence-only artifacts are required');
 for(let i=0;i<uploads.length;i++){
  const {step}=uploads[i],expected=allowedArtifacts[i];
  if(!step.includes('        if: always()\n')||!step.includes('          name: '+expected.name+'\n'))fail('each evidence artifact must retain its exact name and failure capture');
  const paths=step.match(/          path: \|\n([\s\S]*?)          if-no-files-found:/);
  if(!paths||paths[1].split('\n').map(line=>line.trim()).filter(Boolean).join('\n')!==expected.paths.join('\n'))fail('artifact paths may contain only their reviewed captures, reports, logs and build receipt');
  if(!step.includes('          if-no-files-found: warn\n')||!step.trimEnd().endsWith('          retention-days: 14'))fail('artifact retention policy changed');
 }
 const capture=steps.findIndex(step=>step.includes('        run: node scripts/run-browser-suite.mjs --capture-only\n'));
 const full=steps.findIndex(step=>step.includes('        run: node scripts/run-browser-suite.mjs\n'));
 if(capture<0||full<0||capture>=uploads[0].index||uploads[0].index>=full||full>=uploads[1].index)fail('requested pictures must be retained before the unchanged full native suite');
 if(steps[capture].trimEnd()!==`      - name: Capture requested mobile preview pictures
        timeout-minutes: 6
        continue-on-error: true
        run: node scripts/run-browser-suite.mjs --capture-only`)fail('only the bounded requested-picture step may continue after an error');
 if(steps[full].trimEnd()!==`      - name: Capture native input and continuous draft observations
        timeout-minutes: 22
        run: node scripts/run-browser-suite.mjs`)fail('the unchanged bounded full native suite is required');
 if((source.match(/^\s*continue-on-error:/gm)||[]).length!==1||(source.match(/        run: node scripts\/run-browser-suite\.mjs(?: --capture-only)?\n/g)||[]).length!==2)fail('picture capture cannot replace, repeat, or weaken the full native suite');
 return {productionDeployment:false,productionAcceptance:false,branch:PREVIEW_BRANCH,jobCount:1};
}
