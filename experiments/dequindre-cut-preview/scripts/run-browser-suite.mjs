import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {previewRoot,repoRoot} from './paths.mjs';

const captureOnly=process.argv.includes('--capture-only');
const output=resolve(previewRoot,'output/ci');await mkdir(output,{recursive:true});
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim();
const url='http://127.0.0.1:8317/';
const summary={sourceHead,mode:captureOnly?'requested-mobile-pictures':'full-native-suite',productionDeployment:false,productionAcceptance:false,startedAt:new Date().toISOString(),checks:[],passed:false};
const log=createWriteStream(resolve(output,captureOnly?'preview-pictures-server.log':'preview-server.log'));
const server=spawn(process.execPath,[resolve(previewRoot,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','8317','--strictPort'],{cwd:previewRoot,stdio:['ignore','pipe','pipe']});
server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
let serverError,serverExited=false,running;
server.once('error',error=>{serverError=error;});
const closed=new Promise(resolve=>server.once('close',()=>{serverExited=true;log.end();resolve();}));
const stop=()=>{running?.kill('SIGTERM');server.kill('SIGTERM');};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 let ready=false,lastError;
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  if(serverError||serverExited)throw serverError??Error('The isolated preview server exited before it was ready');
  try{
   const response=await fetch(url+'preview-manifest.json',{signal:AbortSignal.timeout(2000)});
   if(!response.ok)throw Error('Preview receipt HTTP '+response.status);
   const manifest=await response.json();
   if(manifest.status!=='UNPUBLISHED_DRAFT'||manifest.productionDeployment!==false||manifest.productionRooms!==false||manifest.sourceHead!==sourceHead)throw Error('Preview server receipt does not match this offline draft revision');
   ready=true;break;
  }catch(error){lastError=error;await delay(500);}
 }
 if(!ready)throw Error('Preview server did not become ready: '+lastError);
 const modes=captureOnly?[['--phone','--capture-only']]:[['--profile'],['--phone','--profile'],['--compact','--reduced-motion']];
 for(const args of modes){
  try{
   await new Promise((resolve,reject)=>{
    running=spawn(process.execPath,[resolvePath('scripts/browser-smoke.mjs'),...args],{cwd:previewRoot,stdio:'inherit',env:{...process.env,DEQUINDRE_PREVIEW_URL:url}});
    running.once('error',reject);
    running.once('exit',(code,signal)=>{running=undefined;code===0?resolve():reject(Error('Native preview check '+args.join(' ')+' failed: '+(signal??code)));});
   });
   summary.checks.push({args,passed:true});
  }catch(error){summary.checks.push({args,passed:false,error:String(error)});}
 }
 summary.passed=summary.checks.every(check=>check.passed);
 if(!summary.passed)throw Error('One or more native preview checks failed; all attempted runs are retained');
}catch(error){summary.error=String(error);throw error;
}finally{
 summary.finishedAt=new Date().toISOString();await writeFile(resolve(output,captureOnly?'picture-capture.json':'browser-suite.json'),JSON.stringify(summary,null,2)+'\n');
 stop();await Promise.race([closed,delay(5000)]);if(!serverExited)server.kill('SIGKILL');
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
}
function resolvePath(file){return resolve(previewRoot,file);}
