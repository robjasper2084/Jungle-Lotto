import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {traceSummary,MARKER_PREFIX,createTraceSummaryAccumulator} from './contract.mjs';
import {scanTraceStream,scanTraceFile,summarizeTraceSource as readerSource,summarizeTraceFile as readerFile} from './sustained-trace-json.mjs';
const summarizeTraceSource=(open,cpu,page,options={})=>readerSource(open,cpu,page,{createAccumulator:createTraceSummaryAccumulator,...options});
const summarizeTraceFile=(file,cpu,page,options={})=>readerFile(file,cpu,page,{createAccumulator:createTraceSummaryAccumulator,...options});

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function* chunks(bytes,size=17){for(let i=0;i<bytes.length;i+=size)yield bytes.subarray(i,i+size);}
const parse=async(bytes,size=17,options={})=>{
 const events=[],receipt=await scanTraceStream(chunks(bytes,size),event=>events.push(event),options);
 assert.equal(receipt.bytes,bytes.length);assert.equal(receipt.sha256,digest(bytes));
 assert.equal(receipt.events,events.length);assert.equal(receipt.completeFile,true);assert.equal(receipt.completeDocument,true);
 return {events,receipt};
};
function fixture(){
 const markers=[{label:'profile-start-click',atMs:1000},{label:'first-w-keydown',atMs:1100},{label:'w-keyup',atMs:91108}];
 const page={url:'http://127.0.0.1:1234/?profile=1&perfProbe=1',markers,errors:[],droppedMarkers:0};
 const events=[
  ...['Browser','Renderer','GPU Process'].map((name,i)=>({ph:'M',name:'process_name',pid:i+1,args:{name}})),
  {ph:'M',name:'thread_name',pid:2,tid:9,args:{name:'CrRendererMain'}},
  ...markers.map(m=>({name:MARKER_PREFIX+m.label,cat:'blink.user_timing',pid:2,tid:9,ts:1_000_000+m.atMs*1000,ph:'R'})),
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:2_099_950,dur:100},
  {ph:'X',cat:'devtools.timeline',name:'FunctionCall',pid:2,tid:9,ts:90_000_000,dur:466700},
  {ph:'X',cat:'devtools.timeline',name:'EventDispatch',pid:2,tid:9,ts:92_107_950,dur:100}];
 const cpu={nodes:[{id:1,callFrame:{functionName:'work'}}],samples:[1,1,1,1],timeDeltas:[100_000,600_000,89_900_000,200_000],startTime:1_500_000,endTime:92_500_000};
 return {events,page,cpu};
}

test('stream reader handles both roots, arbitrary whitespace/property order and final glued metadata',async()=>{
 const events=[{name:'雪😀',args:{text:'quotes " \\ slash / \n\t braces }][{',nested:[null,true,false,{},[-0,1.25e-20,2e30]]}},{name:'last',ts:42}];
 const variants=[JSON.stringify(events),JSON.stringify(events,null,2),JSON.stringify({metadata:{before:events},traceEvents:events,other:[1,2,3]}),
  '{"traceEvents":[\n'+events.map(e=>JSON.stringify(e)).join(',\n')+'],"metadata":{"after":true}}',
  '{"metadata":false,"tr\\u0061ceEvents":'+JSON.stringify(events)+',"metadata":null}',
  '{"traceEvents":[]}', '[]', ' { "traceEvents" : [ ] , "other" : -0.123e+45 } \r\n'];
 for(const text of variants)for(const size of [1,2,3,5,17,1024]){
  const bytes=Buffer.from(text),result=await parse(bytes,size),decoded=JSON.parse(text);
  assert.deepEqual(result.events,Array.isArray(decoded)?decoded:decoded.traceEvents);
 }
});

test('every byte split preserves multibyte UTF-8, escaped strings, Unicode escapes and nested records',async()=>{
 const text=JSON.stringify({metadata:{text:'雪😀 \\u0041 \\"'},traceEvents:[{name:'é雪😀',x:'\n\t\\"',escaped:'escape-code',nest:{a:[1e-4,-0,true,false,null,{},[]]}}],tail:[42]})
  .replace('"escape-code"','"\\uD83D\\uDE00\\u0041"');
 const bytes=Buffer.from(text),expected=JSON.parse(text).traceEvents;
 for(let split=0;split<=bytes.length;split++){
  const actual=[];
  async function* source(){yield bytes.subarray(0,split);yield bytes.subarray(split);}
  const receipt=await scanTraceStream(source(),e=>actual.push(e));
  assert.deepEqual(actual,expected,'split '+split);assert.equal(receipt.sha256,digest(bytes));
 }
});

test('metadata strings/arrays are validated without retaining them as one record',async()=>{
 const text='{"metadata":{"text":"'+'z'.repeat(2*1024*1024)+'","nested":'+ '['.repeat(200)+'null'+']'.repeat(200)+'},"traceEvents":[{"name":"small"}]}';
 const result=await parse(Buffer.from(text),997,{maxRecordChars:64,maxDepth:256});
 assert.equal(result.events[0].name,'small');
});

test('all truncated prefixes fail closed and still hash every original byte',async()=>{
 const complete=Buffer.from('{"traceEvents":[{"name":"雪😀","args":{"nested":[true,false,null,12e-3,"\\u0041\\\\\\\""]}}],"metadata":{"last":"end"}}');
 for(let end=0;end<complete.length;end++){
  const bytes=complete.subarray(0,end);
  await assert.rejects(parse(bytes,3),error=>error.traceReceipt?.completeFile===true&&error.traceReceipt.completeDocument===false&&error.traceReceipt.sha256===digest(bytes));
 }
});

test('invalid grammar, UTF-8, unsupported roots, duplicate arrays and explicit bounds cannot return a summary',async()=>{
 const invalid=['','null','{}','{"traceEvents":{}}','[null]','[1]','[[]]',
  '[{},]','[,{}]','[{}{}]','{"traceEvents":[{,}]}','{"traceEvents":[{"a":1,}]}','{"traceEvents":[{"a" 1}]}',
  '{"traceEvents":[],}','{"traceEvents":[] "a":1}','{"traceEvents":[],"traceEvents":[]}',
  '{"traceEvents":[],"a":01}','{"traceEvents":[],"a":-.1}','{"traceEvents":[],"a":1.}',
  '{"traceEvents":[],"a":1e}','{"traceEvents":[],"a":1e+}','{"traceEvents":[],"a":tru}',
  '{"traceEvents":[],"a":"\\x20"}','{"traceEvents":[],"a":"\\u00xz"}',
  '{"traceEvents":[],"a":"line\nfeed"}','{"traceEvents":[]} trailing','{"traceEvents":[]}{}',
  '{"traceEvents":[{}]]}','\uFEFF{"traceEvents":[]}','{"traceEvents":[],"a":NaN}'];
 for(const text of invalid){const bytes=Buffer.from(text);await assert.rejects(parse(bytes,1),error=>error.traceReceipt?.sha256===digest(bytes)&&!error.traceReceipt.completeDocument,text);}
 for(const suffix of [[0xff],[0xc0,0x80],[0xf0,0x9f],[0xed,0xa0,0x80]]){
  const bytes=Buffer.concat([Buffer.from('{"traceEvents":[],"a":"'),Buffer.from(suffix),Buffer.from('"}')]);
  await assert.rejects(parse(bytes,1),error=>error.traceReceipt?.sha256===digest(bytes));
 }
 for(const [text,options] of [['[{"long":"'+'x'.repeat(100)+'"}]',{maxRecordChars:32}],['{"traceEvents":[],"meta":[[[[0]]]]}',{maxDepth:3}]]){
  const bytes=Buffer.from(text);await assert.rejects(parse(bytes,7,options),error=>error.traceReceipt?.sha256===digest(bytes));
 }
});

test('visitor and source failures retain complete or explicitly partial byte receipts',async()=>{
 const bytes=Buffer.from('[{},{}]');
 await assert.rejects(scanTraceStream(chunks(bytes,2),()=>{throw Error('visitor failure');}),error=>error.traceReceipt.sha256===digest(bytes)&&error.traceReceipt.completeFile&&!error.traceReceipt.completeDocument);
 async function* broken(){yield bytes.subarray(0,3);throw Error('read failure');}
 await assert.rejects(scanTraceStream(broken(),()=>{}),error=>!error.traceReceipt.completeFile&&error.traceReceipt.sha256===null&&error.traceReceipt.partialSha256===digest(bytes.subarray(0,3)));
});

test('incremental summary exactly matches the stronger bf2 phone contract including failures and signed deltas',async()=>{
 const mutations=[()=>{},f=>f.events.reverse(),f=>f.events.push({...f.events[4]}),
  f=>f.events.push({...f.events[4],tid:10}),f=>f.events.pop(),f=>f.events.splice(0,3),
  f=>f.page.markers.push({...f.page.markers[0]}),f=>f.page.markers[1].atMs+=20,
  f=>f.page.url='https://example.com',f=>f.page.errors.push('observer failure'),f=>f.page.droppedMarkers=1,
  f=>f.events[4].cat='blink.user_timing, blink.user_timing',f=>f.events[5].cat=' blink.user_timing',
  f=>{f.events[7].dur=0;f.events[7].ts=2_100_000;},f=>f.events[7].dur=-1,
  f=>{f.cpu.samples=[1,1,1,1,1];f.cpu.timeDeltas=[100_000,600_000,-64_323,89_964_323,200_000];},
  f=>f.cpu.samples[1]=999,f=>f.cpu.nodes.push({id:1}),f=>f.cpu.timeDeltas[0]=null,
  f=>f.cpu.timeDeltas[1]=200_000_000,f=>f.cpu.samples=[],f=>f.cpu.timeDeltas='123',
  f=>{f.cpu.samples=[1];f.cpu.timeDeltas=[100_000];},f=>f.cpu.startTime=3_000_000,
  f=>f.cpu.endTime=90_000_000,f=>f.page.markers[0].atMs=-1];
 for(const mutate of mutations){
  const f=fixture();mutate(f);const bytes=Buffer.from(JSON.stringify({metadata:{version:1},traceEvents:f.events}));
  const result=await summarizeTraceSource(()=>chunks(bytes,13),f.cpu,f.page);
  assert.deepEqual(result.summary,traceSummary(JSON.parse(bytes),f.cpu,f.page));
  assert.equal(result.receipt.passes,2);assert.equal(result.receipt.unchangedBetweenPasses,true);
 }
});

test('all categories and stable top-100 ordering survive incremental reduction',async()=>{
 const f=fixture();
 for(let i=0;i<250;i++)f.events.push({ph:'X',name:'long-'+i,pid:9,tid:4,ts:i,dur:50000+(i%7),cat:i%2?'a,b, c':'a,,b'});
 const bytes=Buffer.from(JSON.stringify(f.events)),actual=await summarizeTraceSource(()=>chunks(bytes,257),f.cpu,f.page);
 assert.deepEqual(actual.summary,traceSummary(f.events,f.cpu,f.page));assert.equal(actual.summary.longEvents.length,100);
});

test('summary supports a different marker prefix and target URL without changing event semantics',async()=>{
 const f=fixture(),expected=traceSummary(f.events,f.cpu,f.page),prefix='another-native-capture:';
 for(const event of f.events)if(event.name.startsWith(MARKER_PREFIX))event.name=prefix+event.name.slice(MARKER_PREFIX.length);
 f.page.url='http://127.0.0.1:1234/?profile=custom';const bytes=Buffer.from(JSON.stringify(f.events));
 const result=await summarizeTraceSource(()=>chunks(bytes),f.cpu,f.page,{markerPrefix:prefix,isGameUrl:url=>url===f.page.url});
 assert.deepEqual(result.summary,expected);
});

test('caller accumulator is retained and raw changes between passes fail closed',async()=>{
 const bytes=Buffer.from('[{}]');let calls=0;
 const factory=()=>({index:()=>calls++,beginCoverage:()=>calls++,observe:()=>calls++,finish:()=>({callerChecks:'retained',calls})});
 const result=await summarizeTraceSource(()=>chunks(bytes),null,null,{createAccumulator:factory});
 assert.deepEqual(result.summary,{callerChecks:'retained',calls:3});
 let passes=0;await assert.rejects(summarizeTraceSource(()=>chunks(Buffer.from(++passes===1?'[{}]':'[{}] ')),null,null),error=>error.traceReceipt?.unchangedBetweenPasses===false);
});

test('file API reads bounded chunks and retains the complete file identity',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(),'trace-json-test-'));
 try{
  const f=fixture(),bytes=Buffer.from(JSON.stringify({traceEvents:f.events})),path=resolve(dir,'trace.json');await writeFile(path,bytes);
  const scanned=await scanTraceFile(path,()=>{},{highWaterMark:1});assert.equal(scanned.sha256,digest(bytes));
  const result=await summarizeTraceFile(path,f.cpu,f.page,{highWaterMark:19});
  assert.deepEqual(result.summary,traceSummary(f.events,f.cpu,f.page));assert.equal(result.sha256,digest(bytes));assert.equal(result.bytes,bytes.length);
 }finally{await rm(dir,{recursive:true,force:true});}
});
