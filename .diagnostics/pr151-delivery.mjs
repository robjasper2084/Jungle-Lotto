import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

// Serialized into the browser. Observe the actual loader reader without replacing
// responses, changing bytes, cancelling requests, or injecting gameplay state.
export function installReadOnlyDeliveryObserver(){
 const state=window.__pr151Delivery={responses:[],digests:[]};
 const fetch=window.fetch;
 window.fetch=async function(...args){
  const response=await fetch.apply(this,args);
  if(!response.body||!new URL(response.url).pathname.match(/\.(glb|hdr)$/i))return response;
  const record={url:response.url,status:response.status,declaredBytes:Number(response.headers.get('Content-Length')),bytes:0,chunks:0,eof:false,sha256:null,error:null,startedAt:performance.now()};state.responses.push(record);
  const body=response.body,getReader=body.getReader.bind(body),parts=[];
  body.getReader=function(...options){
   const reader=getReader(...options),read=reader.read.bind(reader);
   reader.read=async function(...readArgs){
    try{
     const value=await read(...readArgs);
     if(value.done&&!record.eof){
      record.eof=true;record.completedAt=performance.now();const bytes=new Uint8Array(record.bytes);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}parts.length=0;
      state.digests.push(crypto.subtle.digest('SHA-256',bytes).then(hash=>{record.sha256=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');},error=>{record.error=String(error);}));
     }else if(!value.done){record.bytes+=value.value.byteLength;record.chunks++;parts.push(value.value.slice());}
     return value;
    }catch(error){record.error=String(error);throw error;}
   };return reader;
  };return response;
 };
}
export async function collectDeliveryEvidence(page,root){
 const records=await page.evaluate(async()=>{const s=window.__pr151Delivery;if(!s)throw Error('Delivery observer missing');await Promise.all(s.digests);return s.responses;});
 const proofs=[];
 for(const record of records){
  const url=new URL(record.url),file=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(url.hostname!=='127.0.0.1'||!file.startsWith(root+sep))throw Error('Unexpected asset source');
  const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');
  const match=record.status===200&&record.eof===true&&record.error===null&&record.bytes>0&&record.bytes===record.declaredBytes&&record.bytes===bytes.length&&record.sha256===sha256;
  proofs.push({...record,sourceBytes:bytes.length,sourceSha256:sha256,match});
 }
 return proofs;
}
export function classifyDeliveryEvidence(proofs,failures,requestCounts){
 const explained=[],unexplained=[];
 if(!proofs?.length)unexplained.push('No complete actual-loader delivery evidence');
 for(const proof of proofs||[])if(!proof.match)unexplained.push('Unverified asset body: '+proof.url);
 for(const failure of failures||[]){
  let local=false;try{const u=new URL(failure.url);local=u.protocol==='http:'&&u.hostname==='127.0.0.1'&&/\.(glb|hdr)$/i.test(u.pathname);}catch{}
  const matching=(proofs||[]).filter(p=>p.url===failure.url);
  const unique=requestCounts?.[failure.url]===1&&(failures||[]).filter(f=>f.url===failure.url).length===1&&matching.length===1;
  if(local&&failure.error==='net::ERR_ABORTED'&&unique&&matching[0].match){explained.push({event:failure,bytes:matching[0].bytes,sha256:matching[0].sha256,classification:'raw abort signal despite unique EOF/size/SHA-256 verified loader body; lifecycle cause not certified'});}
  else unexplained.push(JSON.stringify(failure));
 }
 return {explained,unexplained};
}
