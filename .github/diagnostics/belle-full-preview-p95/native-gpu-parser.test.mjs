/** Actual retained report syntax plus malformed controls; no native sampling. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseNativeSampleReport,NATIVE_GPU_SAMPLE_CONFIG as C} from './native-gpu-sample.mjs';

const bytes=await readFile(new URL('./fixtures/pr278-native-sample-report.txt',import.meta.url));
const actual=bytes.toString('utf8');
const header='Analysis of sampling Test (pid 22) every 10 milliseconds\nProcess: Test [22]\nPath: /test/GPU\nParent Process: Browser [11]\nCall graph:\n';
const images='Binary Images:\n0x1000 - 0x1fff Test (1) <12345678-1234-1234-1234-123456789abc> /test/GPU\n';
const minimal=body=>header+body+'\n'+images;
const sample=(body='    1 Thread_123: Test\n    + 1 frame  (in Test) + 8  [0x1008]')=>parseNativeSampleReport(minimal(body));

test('the exact native report parses completely while every line and original count stays recoverable',()=>{
 assert.equal(bytes.length,335445);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'c65f96db61dbcc3f7b0849921093e08c4650230f22fd7006e3328a7aec0ebeeb');
 const parsed=parseNativeSampleReport(actual);
 assert.equal(parsed.parserVersion,3);assert.equal(parsed.structureUsable,true);
 assert.deepEqual(parsed.issues,[]);assert.deepEqual(parsed.unparsedGraphLines,[]);
 assert.equal(parsed.rawLines.length,2183);
 assert.equal(parsed.rawLines.map(row=>row.raw+row.lineEnding).join(''),actual);
 assert.equal(parsed.threadRoots.length,24);assert.equal(parsed.inclusiveFrames.length,1128);assert.equal(parsed.binaryImages.length,969);
 assert.equal(parsed.retainedLocationCount,1137);
 assert.equal(parsed.targetPid,12913);assert.equal(parsed.parentPid,12903);assert.equal(parsed.declaredIntervalMs,10);
 assert.equal(parsed.declaredGlobalSampleCount,null);assert.equal(parsed.mechanismAttributionUsable,null);
 const rawLines=actual.split('\n'),graphStart=rawLines.indexOf('Call graph:')+1;
 const graphEnd=rawLines.findIndex((line,index)=>index>=graphStart&&line.startsWith('Total number in stack'));
 assert(graphEnd>graphStart);
 const observed=[...parsed.threadRoots,...parsed.inclusiveFrames];
 assert.equal(new Set(observed.map(row=>row.lineNumber)).size,observed.length,'No graph row may be counted twice');
 const expectedLines=[];
 for(let i=graphStart;i<graphEnd;i++)if(rawLines[i].trim())expectedLines.push(i+1);
 assert.deepEqual(observed.map(row=>row.lineNumber).sort((a,b)=>a-b),expectedLines);
 for(const row of observed){
  assert.equal(row.raw,rawLines[row.lineNumber-1]);
  const match=row.raw.match(/^([ \t+!:|]*)(\d+)[ \t]+/);
  assert.equal(row.prefix,match[1]);assert.equal(row.count,Number(match[2]));
 }
});

test('unknown load-address rows retain unresolved symbols, bases, relative offsets and exact addresses',()=>{
 const parsed=parseNativeSampleReport(actual),unknown=parsed.inclusiveFrames.filter(row=>row.symbol==='???');
 assert.equal(unknown.length,68);assert.equal(parsed.unknownSymbolFrameRows,68);
 for(const row of unknown){
  assert.equal(row.named,false);assert.equal(row.symbolized,false);assert.equal(row.locationKind,'load-address-relative');
  assert.equal(row.locations.length,1);assert.equal(row.collapsed,false);assert.equal(row.locationsComplete,true);
  assert.equal(BigInt(row.loadAddress)+BigInt(row.locations[0].offsetText),BigInt(row.address));
  assert.equal(row.offsetBytes,Number(row.locations[0].offsetText));
 }
 const first=unknown[0];assert.equal(first.lineNumber,85);assert.equal(first.loadAddress,'0x109440000');
 assert.equal(first.address,'0x10945c39c');assert.equal(first.offsetBytes,0x1c39c);
});

test('collapsed rows retain location arrays and an ellipsis is explicit incompleteness, never invented locations',()=>{
 const parsed=parseNativeSampleReport(actual),collapsed=parsed.inclusiveFrames.filter(row=>row.collapsed);
 assert.equal(collapsed.length,9);assert.equal(parsed.collapsedFrameRows,9);
 const ellipsis=collapsed.filter(row=>!row.locationsComplete);assert.equal(ellipsis.length,1);assert.equal(parsed.incompleteLocationFrameRows,1);
 assert.equal(ellipsis[0].lineNumber,472);assert.equal(ellipsis[0].count,5);
 assert.deepEqual(ellipsis[0].locations,[
  {address:'0x1279a4fcc',offsetText:'55329832',offsetBytes:55329832},
  {address:'0x128a57f68',offsetText:'72840132',offsetBytes:72840132}
 ]);
 for(const row of collapsed){
  assert.equal(row.offsetBytes,null);assert.equal(row.address,null);assert.equal(row.locations.length,2);
  assert.equal(row.locationKind,'symbol-relative');assert.equal(row.symbol,'ChromeMain');
  assert.equal(row.named,true);assert.equal(row.symbolized,false);assert.equal(row.unresolvedNamed,true);
 }
 assert.equal(collapsed.reduce((n,row)=>n+row.count,0),21,'The original inclusive row counts are preserved once');
});

test('root records are observation groups and repeated IDs do not become a distinct-thread census',()=>{
 const parsed=parseNativeSampleReport(actual),multiple=parsed.threadRoots.filter(row=>row.kind==='multiple-thread-group');
 assert.equal(multiple.length,3);
 assert.deepEqual(multiple.map(row=>row.lineNumber),[1072,1093,1134]);
 assert(multiple.every(row=>row.threadId===null&&row.distinctThreadCount===null));
 const repeated=parsed.threadRoots.filter(row=>row.threadId==='41719');assert.equal(repeated.length,2);
 assert.notEqual(repeated[0].lineNumber,repeated[1].lineNumber);
 assert(parsed.threadRoots.every(row=>row.distinctThreadCount===null));
 const threadStart=sample('    1 Thread_123\n    + 1 thread_start  (in libsystem_pthread.dylib) + 8  [0x1008]');
 assert.equal(threadStart.threadRoots.length,1);assert.equal(threadStart.inclusiveFrames[0].symbol,'thread_start');
});

test('large named export offsets stay unresolved and cannot supply useful Chrome function symbolization',()=>{
 const parsed=parseNativeSampleReport(actual),chrome=parsed.inclusiveFrames.filter(row=>row.symbol==='ChromeMain');
 assert.equal(chrome.length,662);assert.equal(parsed.namedFrameRows,1060);
 assert.equal(parsed.largeOffsetNamedFrameRows,666);assert.equal(parsed.unresolvedNamedFrameRows,666);
 assert.equal(parsed.symbolizedFrameRows,394);assert.equal(parsed.symbolCoverage,'partial');
 assert(chrome.filter(row=>row.largeOffset).every(row=>row.named&&!row.symbolized&&row.unresolvedNamed));
 assert.equal(parsed.mechanismAttributionUsable,null);
 const unresolvedOnly=sample('    1 Thread_123\n    + 1 ChromeMain  (in Chrome) + 999999  [0x123456]');
 assert.equal(unresolvedOnly.structureUsable,true);assert.equal(unresolvedOnly.someSymbolsPresent,false);
 assert.equal(unresolvedOnly.symbolCoverage,'unavailable');assert.equal(unresolvedOnly.namedFrameRows,1);
 assert.equal(unresolvedOnly.unknownSymbolFrameRows,0);assert.equal(unresolvedOnly.unresolvedNamedFrameRows,1);
});

test('horizontal spacing, parenthesized images, inline offsets and line endings retain their exact source',()=>{
 const text=minimal('    1 Thread_<multiple>   DispatchQueue_1: queue (serial)\n    +\t1 label + 8\t(in Test (GPU))\t[0x1008]').replaceAll('\n','\r\n');
 const parsed=parseNativeSampleReport(text);assert.equal(parsed.structureUsable,true);
 assert.equal(parsed.inclusiveFrames[0].image,'Test (GPU)');assert.equal(parsed.inclusiveFrames[0].offsetBytes,8);
 assert.equal(parsed.inclusiveFrames[0].symbol,'label');assert.equal(parsed.rawLines.map(row=>row.raw+row.lineEnding).join(''),text);
 const noFinal=text.slice(0,-2),without=parseNativeSampleReport(noFinal);
 assert.equal(without.structureUsable,true);assert.equal(without.rawLines.at(-1).lineEnding,'');
 assert.equal(without.rawLines.map(row=>row.raw+row.lineEnding).join(''),noFinal);
});

test('malformed locations, unsafe offsets, fake root tokens and unrecognized lines remain failures with raw evidence',()=>{
 const invalid=[
  'label (in Test) + 1,2 [0x1001]',
  'label (in Test) + 1 [0x1001,0x1002]',
  'label (in Test) + 1,2,... [0x1001,0x1002]',
  'label (in Test) + 1,2 [0x1001,0x1002,...]',
  'label (in Test) + 1,...,2 [0x1001,...,0x1002]',
  'label (in Test) + 1, [0x1001,]',
  'label (in Test) + 9007199254740992 [0x1001]',
  'label + 8 (in Test) + 9 [0x1001]',
  '??? (in Test) load address 0x1000 + 0x11 [0x1010]',
  'label (in Test) load address 0x1000 + 0x10 [0x1010]',
  '??? (in Test) load address 0x1000 + 0x20000000000000 [0x20000000001000]',
  '??? (in Test) load address 0x10000000000000000 + 0x1 [0x10000000000000001]',
  'label (in Test) + 1 [0x10000000000000001]',
  'label (in Test) + -1 [0x1001]',
  'label (in Test) + 1 [not-an-address]',
  'label (in Test) + 1 [0x1001] unexpected suffix',
  'label (in  ) + 8 [0x1008]',
  'label (in Test) + -1 (junk) [0x1008]',
  'label (in Test (GPU) + 8 [0x1008]',
  'Thread_<multiple>bad',
  'Thread_123xyz'
 ];
 for(const body of invalid){
  const text=minimal('    1 Thread_123\n    + 1 '+body),parsed=parseNativeSampleReport(text);
  assert.equal(parsed.structureUsable,false,body);assert(parsed.issues.length>0,body);
  assert.equal(parsed.rawLines.map(row=>row.raw+row.lineEnding).join(''),text);
 }
 for(const body of ['    + 1 label (in Test) + 8 [0x1008]','    1 Thread_123\nnot a stack row','    1 Thread_123\n    + 0 label (in Test) + 8 [0x1008]']){
  assert.equal(sample(body).structureUsable,false);
 }
});

test('existing byte, line, root, frame, image, unparsed-line and issue bounds remain enforced',()=>{
 assert.throws(()=>parseNativeSampleReport('x'.repeat(C.maxReportBytes+1)),/byte bound/);
 assert.throws(()=>parseNativeSampleReport('\n'.repeat(250000)),/line bound/);
 assert.throws(()=>sample(Array.from({length:1025},(_,i)=>'    1 Thread_'+i).join('\n')),/Thread-root bound/);
 assert.throws(()=>sample('    1 Thread_1\n'+('    + 1 frame (in Test) + 1 [0x1001]\n').repeat(100001)),/Frame-row bound/);
 const image='0x1000 - 0x1fff Test <12345678-1234-1234-1234-123456789abc> /test/GPU\n';
 assert.throws(()=>parseNativeSampleReport(header+'    1 Thread_1\n    + 1 frame (in Test) + 1 [0x1001]\nBinary Images:\n'+image.repeat(10001)),/Binary-image bound/);
 assert.throws(()=>sample('    1 Thread_1\n'+('bad stack row\n').repeat(10001)),/Unparsed graph bound/);
 assert.throws(()=>sample('    1 Thread_1\n'+('    + 1 malformed\n').repeat(1001)),/Sample issue bound/);
 const tooManyOffsets=Array.from({length:1025},(_,i)=>String(i)).join(','),tooManyAddresses=Array.from({length:1025},(_,i)=>'0x'+i.toString(16)).join(',');
 assert.equal(sample('    1 Thread_1\n    + 1025 label (in Test) + '+tooManyOffsets+' ['+tooManyAddresses+']').structureUsable,false);
 const offsets=Array(1024).fill('1').join(','),addresses=Array(1024).fill('0x1001').join(',');
 const collapsed='    + 1024 label (in Test) + '+offsets+' ['+addresses+']\n';
 assert.throws(()=>sample('    1 Thread_1\n'+collapsed.repeat(98)),/Total retained-location bound/);
});
