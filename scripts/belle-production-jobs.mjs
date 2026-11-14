import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {REPOSITORY,requireTarget,assertDeployment} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/release-health-model.mjs';
/** Read actual latest-attempt jobs, never the PR check rollup or workflow badge. */
export async function verifyProductionJobs(sha,runId,{fetcher=fetch,token=process.env.GITHUB_TOKEN}={}) {
  requireTarget(sha,runId);
  const get=async path=>{
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token) headers.Authorization='Bearer '+token;
    const response=await fetcher('https://api.github.com/repos/'+REPOSITORY+path,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw Error('GitHub evidence HTTP '+response.status+' '+path);
    return response.json();
  };
  const run=await get('/actions/runs/'+runId);
  if(!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1) throw Error('Missing actual workflow attempt.');
  const jobs=[];let complete=false;
  for(let page=1;page<=20;page++){
    const part=await get('/actions/runs/'+runId+'/attempts/'+run.run_attempt+'/jobs?per_page=100&page='+page);
    if(!Array.isArray(part.jobs)||!Number.isSafeInteger(part.total_count))throw Error('Malformed workflow job response.');
    jobs.push(...part.jobs);
    if(jobs.length>=part.total_count){complete=true;break;}
    if(part.jobs.length===0) break;
  }
  if(!complete) throw Error('Incomplete workflow job pagination.');
  return {...assertDeployment(run,jobs,sha,runId),passed:true,attempt:run.run_attempt,checkedAt:new Date().toISOString(),url:'https://github.com/'+REPOSITORY+'/actions/runs/'+runId};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [sha,run]=process.argv.slice(2);let report;
  try{report=await verifyProductionJobs(sha,run);}catch(error){report={passed:false,commit:sha,runId:run,error:String(error)};process.exitCode=1;}
  await writeFile('belle-production-jobs.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
