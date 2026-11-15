import {REPOSITORY,requireTarget,assertDeployment,assertManifest} from './release-health-model.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
$('sha').value=params.get('sha')||'';$('run').value=params.get('run')||'';
const api='https://api.github.com/repos/'+REPOSITORY;
async function json(url){const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Evidence unavailable: HTTP '+response.status);return response.json();}
async function pages(path,key){const all=[];for(let p=1;p<=20;p++){const data=await json(api+path+(path.includes('?')?'&':'?')+'per_page=100&page='+p);if(!Array.isArray(data[key])||!Number.isSafeInteger(data.total_count))throw Error('Invalid GitHub evidence');all.push(...data[key]);if(all.length>=data.total_count)return all;if(!data[key].length)break;}throw Error('Incomplete GitHub evidence pagination');}
$('verify').addEventListener('submit',async event=>{
 event.preventDefault();const sha=$('sha').value.trim(),runId=$('run').value.trim();$('refresh').disabled=true;$('checks').textContent='Loading actual commit checks…';$('result').textContent='Checking exact run, deploy steps and public manifest…';$('run-link').hidden=true;
 try{
  requireTarget(sha,runId);
  const run=await json(api+'/actions/runs/'+runId);
  if(!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)throw Error('Missing actual run attempt');
  const jobs=await pages('/actions/runs/'+runId+'/attempts/'+run.run_attempt+'/jobs','jobs');
  assertDeployment(run,jobs,sha,runId);
  const base=new URL('https://robjasper2084.github.io/Jungle-Lotto/');
  const manifestURL=new URL('pages-artifact-manifest.json',base);manifestURL.searchParams.set('verify',sha);
  assertManifest(await json(manifestURL),sha);
  $('result').textContent='MANIFEST + ACTUAL DEPLOY CONFIRMED\nCommit: '+sha+'\nRun: '+runId+' / attempt '+run.run_attempt+'\nBuild: success · Deploy job: success · Deploy to GitHub Pages step: success\nChecked: '+new Date().toLocaleString()+'\n\nScope: metadata only. Public byte hashes and interactive rendering must also pass the linked public browser verification before a live-release announcement.';
  $('run-link').href='https://github.com/'+REPOSITORY+'/actions/runs/'+runId;$('run-link').hidden=false;
 }catch(error){$('result').textContent='NOT VERIFIED\n'+error.message+'\nNo successful publication is being asserted.';}
 // Check runs remain useful even if publication failed; never treat their rollup as deploy evidence.
 try{
  requireTarget(sha,runId);const checks=await pages('/commits/'+sha+'/check-runs','check_runs');$('checks').replaceChildren();
  if(!checks.length)$('checks').textContent='Unknown: no checks were returned for this exact SHA.';
  else{const table=document.createElement('table');const header=table.createTHead().insertRow();for(const title of ['Check','State','Conclusion']){const th=document.createElement('th');th.scope='col';th.textContent=title;header.append(th);}const body=table.createTBody();for(const check of checks){const row=body.insertRow();for(const value of [check.name,check.status,check.conclusion||'pending / unknown'])row.insertCell().textContent=value;} $('checks').append(table);}
 }catch(error){$('checks').textContent='Check-run evidence unavailable: '+error.message;}
 finally{$('refresh').disabled=false;}
});
