#!/usr/bin/env node
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {validateAcceptance,evidenceFiles,hasExactHeadPeerApproval} from '../src/acceptanceGate.mjs';

const errors=[];
const sha=process.env.GDS_CANDIDATE_SHA||'';
const manifest=process.env.GDS_EVIDENCE_MANIFEST||'';
const repository=process.env.GITHUB_REPOSITORY||'';
const prNumber=process.env.GDS_PR_NUMBER||'';
let report;
if(!manifest)errors.push('No evidence manifest from browser/device verification. A checklist is not proof.');
else try{report=JSON.parse(await readFile(manifest,'utf8'));}catch(e){errors.push('Could not read evidence manifest: '+String(e));}
errors.push(...validateAcceptance(report,sha));

if(report&&manifest){
 try{
  const base=await realpath(dirname(resolve(manifest)));
  for(const file of evidenceFiles(report)){
   if(!file||typeof file.path!=='string'||!file.path||file.path.startsWith('/')||file.path.includes('\\')||
      file.path.split('/').includes('..')||!/^[a-f0-9]{64}$/i.test(file.sha256??'')){
    errors.push('Invalid artifact path/digest');continue;
   }
   try{
    const located=await realpath(resolve(base,file.path));
    if(!located.startsWith(base+sep))throw Error('Artifact escapes evidence directory');
    const actual=createHash('sha256').update(await readFile(located)).digest('hex');
    if(actual.toLowerCase()!==file.sha256.toLowerCase())throw Error('SHA-256 mismatch');
   }catch(e){errors.push(file.path+': '+String(e));}
  }
 }catch(e){errors.push('Invalid evidence folder: '+String(e));}
}

const token=process.env.GITHUB_TOKEN;
if(!token||!repository||!prNumber||!/^\d+$/.test(prNumber))errors.push('Independent exact-head GitHub approval was not verified');
else try{
 const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
 const api='https://api.github.com/repos/'+repository+'/pulls/'+prNumber;
 const get=async u=>{const res=await fetch(u,{headers});if(!res.ok)throw Error('GitHub '+res.status+' '+u);return res.json();};
 const pr=await get(api);
 if(pr.head?.sha!==sha)errors.push('PR head changed since evidence capture');
 const reviews=await get(api+'/reviews?per_page=100');
 if(!hasExactHeadPeerApproval(reviews,sha,pr.user?.login))errors.push('No independent APPROVED peer review for exact current head SHA');
 if(reviews.length>=100)errors.push('Review list may be truncated; review paging required');
}catch(e){errors.push('Peer review could not be verified: '+String(e));}

if(errors.length){
 console.error('Greater Detroit predeployment acceptance: BLOCKED ('+errors.length+' issues)');
 for(const error of [...new Set(errors)])console.error(' - '+error);
 process.exitCode=1;
}else console.log('Greater Detroit predeployment acceptance evidence: validated for '+sha);
