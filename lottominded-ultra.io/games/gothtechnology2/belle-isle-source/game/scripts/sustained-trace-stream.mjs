/** Read Chrome's observed JSON export without constructing one giant string.
 * Format: traceEvents first, one complete event per line, optional metadata last.
 * The final event may share its line with ],"metadata":. Unsupported framing
 * fails closed. All bytes are hashed even after a parse error; raw files remain
 * untouched. Metadata and every event are fully JSON-validated, never truncated.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {createTraceSummaryAccumulator} from './sustained-trace-contract.mjs';

function objectEnd(text){
 assert.equal(text[0],'{','Expected a JSON object');
 let depth=0,string=false,escaped=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(string){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')string=false;continue;}
  if(c==='"'){string=true;continue;}
  if(c==='{'||c==='[')depth++;
  else if(c==='}'||c===']'){depth--;if(depth===0)return i+1;}
 }
 throw Error('Incomplete JSON object');
}

export async function scanTraceFile(file,onEvent,{highWaterMark=1024*1024,maxRecordChars=32*1024*1024}={}){
 const digest=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,count=0,carry='',trailer='',state='header',previousComma=null,parseError,readError,completeFile=false,topLevelKeys=[];
 const limit=text=>assert.ok(text.length<=maxRecordChars,'Trace record/trailer exceeds bounded parser limit; raw file retained');
 const beginTrailer=text=>{state='trailer';trailer=text+'\n';limit(trailer);};
 const line=raw=>{
  limit(raw);const text=raw.trim();
  if(state==='trailer'){trailer+=raw+'\n';limit(trailer);return;}
  if(!text)return;
  if(state==='header'){
   assert.match(text,/^\{\s*"traceEvents"\s*:\s*\[$/,'Unsupported traceEvents header/framing');state='events';return;
  }
  if(text.startsWith(']')){
   assert.notEqual(previousComma,true,'Trailing comma in traceEvents array');beginTrailer(text.slice(1));return;
  }
  assert.notEqual(previousComma,false,'Missing event array separator');
  let body,suffix;
  if(text.endsWith(',')){body=text.slice(0,-1);suffix=',';}
  else{const end=objectEnd(text);body=text.slice(0,end);suffix=text.slice(end).trim();}
  const event=JSON.parse(body);assert.ok(event&&typeof event==='object'&&!Array.isArray(event),'Trace event is not an object');
  assert.ok(suffix===''||suffix===','||suffix.startsWith(']'),'Unexpected data after trace event');
  count++;onEvent(event);
  previousComma=suffix===',';
  if(suffix.startsWith(']'))beginTrailer(suffix.slice(1));
 };
 const decode=chunk=>{
  carry+=decoder.decode(chunk,{stream:true});
  let begin=0,end;
  while((end=carry.indexOf('\n',begin))!==-1){line(carry.slice(begin,end));begin=end+1;}
  carry=carry.slice(begin);limit(carry);
 };
 try{
  for await(const chunk of createReadStream(file,{highWaterMark})){
   digest.update(chunk);bytes+=chunk.length;
   if(!parseError)try{decode(chunk);}catch(error){parseError=error;carry='';trailer='';}
  }
  completeFile=true;
 }catch(error){readError=error;}
 if(!parseError&&!readError)try{
  carry+=decoder.decode();if(carry)line(carry);
  assert.equal(state,'trailer','Trace ended before its array/document closed');
  const tail=trailer.trim();topLevelKeys=['traceEvents'];
  if(tail!=='}'){
   const match=/^,\s*"metadata"\s*:\s*/.exec(tail);
   assert.ok(match,'Unsupported top-level trace trailer');
   const text=tail.slice(match[0].length),end=objectEnd(text);
   const metadata=JSON.parse(text.slice(0,end));assert.ok(metadata&&typeof metadata==='object'&&!Array.isArray(metadata),'Invalid trace metadata');
   assert.equal(text.slice(end).trim(),'}','Extra or incomplete top-level trace data');topLevelKeys.push('metadata');
  }
 }catch(error){parseError=error;}
 const receipt={format:'chrome-trace-json-lines-v1',bytes,events:count,sha256:completeFile?digest.digest('hex'):null,
  completeFile,completeDocument:!parseError&&!readError,topLevelKeys};
 if(parseError||readError){
  const error=Error('Trace stream validation failed: '+(parseError||readError).message,{cause:parseError||readError});
  error.traceReceipt=receipt;throw error;
 }
 return receipt;
}

export async function summarizeTraceFile(file,cpu,pageEvidence){
 const accumulator=createTraceSummaryAccumulator(cpu,pageEvidence);
 const first=await scanTraceFile(file,accumulator.index);
 accumulator.beginCoverage();
 const second=await scanTraceFile(file,accumulator.observe);
 if(first.sha256!==second.sha256||first.bytes!==second.bytes||first.events!==second.events){
  const error=Error('Raw trace changed between validation passes');
  error.traceReceipt={...second,unchangedBetweenPasses:false,firstPass:first};throw error;
 }
 return {summary:accumulator.finish(),receipt:{...first,passes:2,unchangedBetweenPasses:true}};
}
