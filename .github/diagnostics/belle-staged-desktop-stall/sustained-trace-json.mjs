/** Bounded Chrome trace JSON reader. No assumption about lines, property order,
 * UTF-8/chunk boundaries, or nested metadata. Only the current event and root
 * key are materialized. All other values are syntax-checked incrementally.
 *
 * Accepted roots: an event array, or an object with one traceEvents array.
 * Duplicate traceEvents members are ambiguous for a streaming visitor and fail
 * closed. Each event must be an object. Oversized records/depth fail explicitly;
 * no records, strings, categories or raw bytes are silently truncated.
 * Visitors are synchronous. A failed parse/visitor still drains and hashes the
 * input; no summary is returned unless the entire document validates.
 */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';

const whitespace=c=>c===' '||c==='\t'||c==='\r'||c==='\n';
const digit=c=>c>='0'&&c<='9';
const hex=c=>digit(c)||(c>='a'&&c<='f')||(c>='A'&&c<='F');

class TraceJsonParser {
 constructor(onEvent,{maxRecordChars=32*1024*1024,maxDepth=4096}={}){
  assert.equal(typeof onEvent,'function','A synchronous event visitor is required');
  assert.ok(Number.isSafeInteger(maxRecordChars)&&maxRecordChars>0,'Invalid record limit');
  assert.ok(Number.isSafeInteger(maxDepth)&&maxDepth>0,'Invalid nesting limit');
  this.onEvent=onEvent;this.maxRecordChars=maxRecordChars;this.maxDepth=maxDepth;
  this.stack=[];this.events=0;this.topLevelKeys=[];this.started=false;this.done=false;
  this.sawEvents=false;this.lex=null;this.capture=null;this.keyParts=null;
 }
 error(message){throw new SyntaxError(message);}
 append(parts,text){
  parts.chars+=text.length;
  if(parts.chars>this.maxRecordChars)this.error('Trace record/root key exceeds bounded parser limit; raw bytes retained');
  parts.values.push(text);
 }
 takeValue(kind){
  const parent=this.stack.at(-1);let events=false,event=false;
  if(!parent){
   if(this.started)this.error('Unexpected data after trace document');
   if(kind!=='object'&&kind!=='array')this.error('Trace root must be an object or event array');
   this.started=true;this.rootShape=kind;
   if(kind==='array'){events=true;this.sawEvents=true;}
  }else{
   if(parent.type==='object'){
    if(parent.state!=='value')this.error('Expected an object key, colon, comma or closing brace');
    if(parent.root&&parent.key==='traceEvents'){
     if(this.sawEvents)this.error('Duplicate traceEvents member');
     if(kind!=='array')this.error('traceEvents must be an array');
     this.sawEvents=true;events=true;
    }
   }else{
    if(parent.state!=='valueOrEnd'&&parent.state!=='value')this.error('Missing array separator');
    if(parent.events){
     if(kind!=='object')this.error('Trace event must be an object');
     event=true;this.capture={values:[],chars:0};this.captureStart=this.at;
    }
   }
   parent.state='commaOrEnd';
  }
  return {events,event};
 }
 open(type){
  const root=this.stack.length===0,flags=this.takeValue(type);
  if(this.stack.length>=this.maxDepth)this.error('JSON nesting exceeds bounded parser limit');
  this.stack.push({type,root,...flags,state:type==='object'?'keyOrEnd':'valueOrEnd',key:null});
 }
 close(type){
  const frame=this.stack.at(-1),empty=type==='object'?'keyOrEnd':'valueOrEnd';
  if(!frame||frame.type!==type)this.error('Mismatched JSON closing delimiter');
  if(frame.state!=='commaOrEnd'&&frame.state!==empty)this.error('Incomplete value or trailing comma');
  this.stack.pop();
  if(frame.event){
   this.append(this.capture,this.text.slice(this.captureStart,this.at+1));
   const event=JSON.parse(this.capture.values.join(''));
   this.capture=null;this.events++;
   const result=this.onEvent(event);
   if(result&&typeof result.then==='function')this.error('Trace event visitor must be synchronous');
  }
  if(!this.stack.length)this.done=true;
 }
 punctuation(c){
  if(c==='{')return this.open('object');
  if(c==='[')return this.open('array');
  if(c==='}')return this.close('object');
  if(c===']')return this.close('array');
  const frame=this.stack.at(-1);
  if(c===':'){
   if(!frame||frame.type!=='object'||frame.state!=='colon')this.error('Unexpected JSON colon');
   frame.state='value';return;
  }
  if(!frame||frame.state!=='commaOrEnd')this.error('Unexpected JSON comma');
  frame.state=frame.type==='object'?'key':'value';
 }
 stringEnd(){
  const frame=this.stack.at(-1);
  if(this.stringIsKey){
   if(frame.root){
    this.append(this.keyParts,this.text.slice(this.keyStart,this.at+1));
    frame.key=JSON.parse(this.keyParts.values.join(''));this.keyParts=null;
    this.topLevelKeys.push(frame.key);
   }
   frame.state='colon';
  }else this.takeValue('scalar');
  this.lex=null;
 }
 numberChar(c){
  switch(this.numberState){
   case 'sign':if(c==='0')this.numberState='zero';else if(c>='1'&&c<='9')this.numberState='integer';else this.error('Invalid JSON number');return true;
   case 'zero':if(digit(c))this.error('Leading zero in JSON number');break;
   case 'integer':if(digit(c))return true;break;
   case 'dot':if(!digit(c))this.error('Missing fraction digits');this.numberState='fraction';return true;
   case 'fraction':if(digit(c))return true;break;
   case 'exponent':if(c==='+'||c==='-'){this.numberState='exponentSign';return true;}if(!digit(c))this.error('Missing exponent digits');this.numberState='exponentDigits';return true;
   case 'exponentSign':if(!digit(c))this.error('Missing exponent digits');this.numberState='exponentDigits';return true;
   case 'exponentDigits':if(digit(c))return true;break;
  }
  if(c==='.'&&(this.numberState==='zero'||this.numberState==='integer')){this.numberState='dot';return true;}
  if((c==='e'||c==='E')&&['zero','integer','fraction'].includes(this.numberState)){this.numberState='exponent';return true;}
  this.takeValue('scalar');this.lex=null;return false;
 }
 push(text){
  this.text=text;if(this.capture)this.captureStart=0;if(this.keyParts)this.keyStart=0;
  for(let i=0;i<text.length;i++){
   this.at=i;const c=text[i];
   if(this.lex==='string'){
    if(c==='"')this.stringEnd();else if(c==='\\')this.lex='escape';else if(c.charCodeAt(0)<32)this.error('Unescaped control character in JSON string');
    continue;
   }
   if(this.lex==='escape'){
    if(c==='u'){this.lex='unicode';this.unicodeLeft=4;}
    else if('"\\/bfnrt'.includes(c))this.lex='string';else this.error('Invalid JSON string escape');
    continue;
   }
   if(this.lex==='unicode'){
    if(!hex(c))this.error('Invalid JSON Unicode escape');
    if(--this.unicodeLeft===0)this.lex='string';continue;
   }
   if(this.lex==='literal'){
    if(c!==this.literal[this.literalAt++])this.error('Invalid JSON literal');
    if(this.literalAt===this.literal.length){this.lex=null;this.takeValue('scalar');}continue;
   }
   if(this.lex==='number'){if(this.numberChar(c))continue;i--;continue;}
   if(whitespace(c))continue;
   if('{}[]:,'.includes(c)){this.punctuation(c);continue;}
   if(c==='"'){
    const frame=this.stack.at(-1);
    this.stringIsKey=frame?.type==='object'&&(frame.state==='key'||frame.state==='keyOrEnd');
    if(this.stringIsKey&&frame.root){this.keyParts={values:[],chars:0};this.keyStart=i;}
    this.lex='string';continue;
   }
   if(c==='-'||digit(c)){this.lex='number';this.numberState=c==='-'?'sign':c==='0'?'zero':'integer';continue;}
   if(c==='t'||c==='f'||c==='n'){this.lex='literal';this.literal=c==='t'?'true':c==='f'?'false':'null';this.literalAt=1;continue;}
   this.error('Unexpected character in JSON document');
  }
  if(this.capture)this.append(this.capture,text.slice(this.captureStart));
  if(this.keyParts)this.append(this.keyParts,text.slice(this.keyStart));
  this.text='';
 }
 finish(){
  if(this.lex==='number'&&['zero','integer','fraction','exponentDigits'].includes(this.numberState)){this.lex=null;this.takeValue('scalar');}
  if(this.lex||this.stack.length||!this.done)this.error('Truncated JSON trace document');
  if(!this.sawEvents)this.error('Trace object has no traceEvents array');
 }
}

export async function scanTraceStream(source,onEvent,options={}){
 const hash=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 let parser=new TraceJsonParser(onEvent,options),bytes=0,parseError,readError,completeFile=false;
 const state=()=>({events:parser.events,topLevelKeys:[...parser.topLevelKeys],rootShape:parser.rootShape??null});
 let observed=state();
 try{
  for await(const chunk of source){
   assert.ok(chunk instanceof Uint8Array,'Trace source must yield raw UTF-8 bytes');
   hash.update(chunk);bytes+=chunk.byteLength;
   if(!parseError)try{parser.push(decoder.decode(chunk,{stream:true}));}catch(error){parseError=error;observed=state();parser=null;}
  }
  completeFile=true;
 }catch(error){readError=error;}
 if(!parseError&&!readError)try{parser.push(decoder.decode());parser.finish();}catch(error){parseError=error;}
 if(parser)observed=state();
 const digest=hash.digest('hex'),receipt={format:'chrome-trace-json-stream-v1',bytes,sha256:completeFile?digest:null,
  ...observed,completeFile,completeDocument:completeFile&&!parseError&&!readError};
 if(parseError||readError){
  const cause=parseError||readError,error=Error('Trace stream validation failed: '+cause.message,{cause});
  error.traceReceipt={...receipt,...(!completeFile?{partialSha256:digest}:{})};throw error;
 }
 return receipt;
}

export function scanTraceFile(file,onEvent,options={}){
 return scanTraceStream(createReadStream(file,{highWaterMark:options.highWaterMark??1024*1024}),onEvent,options);
}

/** The source factory must return a fresh byte stream each time. Useful for ZIP
 * replay without extracting/duplicating the raw trace. The two passes reconcile
 * the entire raw hash, byte count and event count before publishing a summary. */
export async function summarizeTraceSource(openStream,cpu,pageEvidence,options={}){
 const accumulator=(options.createAccumulator??createTraceSummaryAccumulator)(cpu,pageEvidence,options);
 const first=await scanTraceStream(await openStream(),accumulator.index,options);
 accumulator.beginCoverage();
 const second=await scanTraceStream(await openStream(),accumulator.observe,options);
 if(first.sha256!==second.sha256||first.bytes!==second.bytes||first.events!==second.events){
  const error=Error('Raw trace changed between validation passes');
  error.traceReceipt={...second,unchangedBetweenPasses:false,firstPass:first};throw error;
 }
 const receipt={...first,passes:2,unchangedBetweenPasses:true};
 return {summary:accumulator.finish(),receipt,bytes:first.bytes,sha256:first.sha256,events:first.events};
}

export function summarizeTraceFile(file,cpu,pageEvidence,options={}){
 return summarizeTraceSource(()=>createReadStream(file,{highWaterMark:options.highWaterMark??1024*1024}),cpu,pageEvidence,options);
}

const defaultIsGameUrl=value=>{try{const u=new URL(value);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.pathname==='/'&&u.searchParams.get('profile')==='1'&&u.searchParams.get('locationPerf')==='1';}catch{return false;}};

/** Exact incremental equivalent of the 5949 traceSummary contract. In particular,
 * categories are not trimmed, zero-duration timeline records and inclusive
 * overlap keep their original meaning, and CPU deltas retain original signed
 * values and order. A caller may inject a newer accumulator without changing the
 * parser or silently weakening the caller's additional coverage checks. */
export function createTraceSummaryAccumulator(cpu,pageEvidence,{markerPrefix='belle-native-trace:',isGameUrl=defaultIsGameUrl}={}){
 const categories=event=>typeof event.cat==='string'?event.cat.split(','):[];
 const processes=[],threads=[],observedCategories={},longEvents=[],markerMatches=new Map();
 const labels=['profile-start-click','first-w-keydown','w-keyup'];
 for(const label of labels)markerMatches.set(markerPrefix+label,new Map());
 let count=0,phase='index',errors,mapped,spreadUs,offsets,start,down,end,nativeRide,rendererPid,rendererTid;
 let timelineEvents=0,firstUs=Infinity,lastUs=-Infinity,duringRide=0;
 const index=event=>{
  assert.equal(phase,'index','Trace indexing already finished');count++;
  if(event.ph==='M'&&event.name==='process_name')processes.push({pid:event.pid,name:event.args?.name});
  if(event.ph==='M'&&event.name==='thread_name')threads.push({pid:event.pid,tid:event.tid,name:event.args?.name});
  for(const category of categories(event))observedCategories[category]=(observedCategories[category]??0)+1;
  const matches=markerMatches.get(event.name);
  if(matches&&categories(event).includes('blink.user_timing')&&Number.isFinite(event.ts)&&Number.isFinite(event.pid)&&Number.isFinite(event.tid))matches.set([event.pid,event.tid,event.ts].join(':'),event);
  if(event.ph==='X'&&event.dur>=50000){
   longEvents.push({name:event.name,cat:event.cat,pid:event.pid,tid:event.tid,ts:event.ts,dur:event.dur});
   longEvents.sort((a,b)=>b.dur-a.dur);if(longEvents.length>100)longEvents.pop();
  }
 };
 const beginCoverage=()=>{
  assert.equal(phase,'index','Trace coverage already started');phase='coverage';errors=[];mapped=[];
  for(const label of labels){
   const markers=(Array.isArray(pageEvidence?.markers)?pageEvidence.markers:[]).filter(row=>row.label===label);
   const unique=[...markerMatches.get(markerPrefix+label).values()];
   if(markers.length!==1||!Number.isFinite(markers[0].atMs)||markers[0].atMs<0||unique.length!==1){errors.push('Missing or ambiguous clock marker: '+label);continue;}
   mapped.push({label,pageMs:markers[0].atMs,traceUs:unique[0].ts,pid:unique[0].pid,tid:unique[0].tid,offsetUs:unique[0].ts-markers[0].atMs*1000});
  }
  offsets=mapped.map(x=>x.offsetUs);spreadUs=offsets.length?Math.max(...offsets)-Math.min(...offsets):null;
  if(mapped.length!==3||new Set(mapped.map(x=>[x.pid,x.tid].join(':'))).size!==1||spreadUs>1000)errors.push('Page/trace timestamp mapping incomplete or inconsistent');
  start=mapped.find(x=>x.label==='profile-start-click');down=mapped.find(x=>x.label==='first-w-keydown');end=mapped.find(x=>x.label==='w-keyup');
  if(!start||!down||!end||!(start.pageMs<=down.pageMs&&down.pageMs<end.pageMs&&start.traceUs<=down.traceUs&&down.traceUs<end.traceUs))errors.push('Native ride boundary order is invalid');
  nativeRide=down&&end?{startPageMs:down.pageMs,endPageMs:end.pageMs,durationMs:end.pageMs-down.pageMs,
   startTraceUs:down.traceUs,endTraceUs:end.traceUs,traceDurationMs:(end.traceUs-down.traceUs)/1000,
   basis:'Trusted first W-keydown to W-keyup; eligible active frame time is a separate measurement.'}:null;
  rendererPid=mapped[0]?.pid;rendererTid=mapped[0]?.tid;
  if(!processes.some(p=>p.pid===rendererPid&&/renderer/i.test(p.name||'')))errors.push('Actual game renderer process absent from trace metadata');
 };
 const observe=event=>{
  assert.equal(phase,'coverage','Begin trace coverage before observing events');
  if(event.pid===rendererPid&&event.tid===rendererTid&&event.ph==='X'&&Number.isFinite(event.ts)&&Number.isFinite(event.dur)&&event.dur>=0&&
   categories(event).some(c=>c==='devtools.timeline'||c==='disabled-by-default-devtools.timeline')){
   timelineEvents++;firstUs=Math.min(firstUs,event.ts);lastUs=Math.max(lastUs,event.ts+event.dur);
   if(down&&end&&event.ts<=end.traceUs&&event.ts+event.dur>=down.traceUs)duringRide++;
  }
 };
 const finish=()=>{
  assert.equal(phase,'coverage','Trace coverage must finish once');phase='finished';
  const rendererTimeline={events:timelineEvents,duringRide,firstUs:Number.isFinite(firstUs)?firstUs:null,lastUs:Number.isFinite(lastUs)?lastUs:null};
  if(!down||!end||!duringRide||firstUs>down.traceUs||lastUs<end.traceUs)errors.push('Renderer timeline work does not cover native ride boundaries');
  let cpuCoverage=null;
  if(!Array.isArray(cpu?.nodes)||!cpu.nodes.length||!Array.isArray(cpu?.samples)||!cpu.samples.length||!Array.isArray(cpu.timeDeltas)||cpu.samples.length!==cpu.timeDeltas.length||
   !Number.isFinite(cpu.startTime)||!Number.isFinite(cpu.endTime)||cpu.endTime<cpu.startTime)errors.push('Missing or malformed CPU call-stack samples');
  else{
   const ids=new Set(cpu.nodes.map(node=>node.id));
   if(ids.size!==cpu.nodes.length||!cpu.samples.every(id=>Number.isInteger(id)&&ids.has(id))||!cpu.timeDeltas.every(Number.isFinite))errors.push('CPU samples have invalid node IDs or time deltas');
   else{
    let at=cpu.startTime,first=null,last=null,rideSamples=0,outside=0,negativeDeltas=0;
    for(let i=0;i<cpu.samples.length;i++){
     const delta=cpu.timeDeltas[i];at+=delta;if(delta<0)negativeDeltas++;if(first===null)first=at;last=at;
     if(at<cpu.startTime||at>cpu.endTime)outside++;if(down&&end&&at>=down.traceUs&&at<=end.traceUs)rideSamples++;
    }
    cpuCoverage={samples:cpu.samples.length,firstSampleUs:first,lastSampleUs:last,rideSamples,negativeDeltas};
    if(outside||!down||!end||!rideSamples||first>down.traceUs||last<end.traceUs)errors.push('Actual CPU samples do not cover native ride boundaries');
   }
  }
  if(!start||!end||!(cpu?.startTime<=start.traceUs&&cpu?.endTime>=end.traceUs))errors.push('CPU profile does not cover mapped ride boundaries');
  if(!isGameUrl(pageEvidence?.url)||pageEvidence?.droppedMarkers||pageEvidence?.errors?.length)errors.push('Invalid game target or page observer evidence');
  return {errors,events:count,processes,threads,gameRendererPid:rendererPid??null,gameRendererTid:rendererTid??null,
   observedCategories,rendererTimeline,cpuCoverage,nativeRide,
   browserProcesses:processes.filter(p=>/browser/i.test(p.name||'')),gpuProcesses:processes.filter(p=>/gpu/i.test(p.name||'')),
   clockMapping:{markers:mapped,spreadUs,pageToTraceOffsetUs:offsets.length?offsets.reduce((a,b)=>a+b,0)/offsets.length:null,
    note:'PerformanceMark startTime is paired with its native trace timestamp. CPU header bounds cover the capture markers; actual samples span the native W interval. Native process tasks remain observations, not GPU-execution certification.'},longEvents};
 };
 return {index,beginCoverage,observe,finish};
}
