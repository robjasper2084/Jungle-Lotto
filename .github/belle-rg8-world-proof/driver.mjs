#!/usr/bin/env node
/** Source-bound full-world storage comparison. This diagnostic never grants release approval. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,extname,sep,posix} from 'node:path';
import {gunzipSync,inflateSync,deflateSync} from 'node:zlib';

const BASELINE='75906273c0cd414c0d004320fc6f654b4783e5b1';
const BASELINE_TREE='9f0351be133dd370a676090d27559a0adaf00605';
const CANDIDATE='ef341f2f91a43aec26261f2778404ca7346de9a9';
const CANDIDATE_TREE='24188d608d8f54cf6aafd9d669e6a529252cbdc8';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/';
const GAME_PATH=SOURCE_ROOT+'belle-isle-source/game';
const PROOF_PATH='.github/belle-rg8-world-proof';
const STYLES=['authentic','golden','noir','detroit2084'];
const CASES=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night','ramp-grazing-day','under-ramp-day'];
const PARTITIONS={all:CASES,'linux-a':CASES.slice(0,4),'linux-b':CASES.slice(4)};
const LANES=['original','rg8','restored'];
const CONTROL_LANES=['lost-g','lost-g-restored','shadow-off','shadow-restored'];
const WIDTH=960,HEIGHT=600;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const blobHash=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
const safeName=name=>assert(typeof name==='string'&&/^[a-z0-9][a-z0-9._-]{0,220}$/.test(name),'Unsafe evidence name');
const bottomUp=(bytes,width,height)=>{const out=Buffer.alloc(bytes.length),stride=width*4;for(let y=0;y<height;y++)bytes.copy(out,(height-1-y)*stride,y*stride,(y+1)*stride);return out;};
const pixelDiff=(left,right)=>{assert.equal(left.length,right.length);let changedPixels=0,maxChannelDelta=0;for(let i=0;i<left.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(left[i+c]-right[i+c]);changed ||= delta!==0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};};

const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(bytes,expectedWidth,expectedHeight){
 assert(Buffer.isBuffer(bytes)&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'PNG signature');
 let offset=8,width,height,channels,seenHeader=false,seenData=false,endedData=false,seenEnd=false;const parts=[];
 while(offset<bytes.length){
  assert(offset+12<=bytes.length,'Truncated PNG chunk');const length=bytes.readUInt32BE(offset),end=offset+12+length;assert(end<=bytes.length,'Truncated PNG payload');
  const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);assert.match(type,/^[A-Za-z]{4}$/,'PNG chunk type');
  assert.equal(crc32(bytes.subarray(offset+4,offset+8+length)),bytes.readUInt32BE(offset+8+length),'PNG CRC: '+type);
  assert(!seenEnd,'PNG data after IEND');
  if(type==='IHDR'){
   assert(!seenHeader&&offset===8&&length===13,'PNG requires exactly one leading IHDR');seenHeader=true;
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(width,expectedWidth,'PNG width');assert.equal(height,expectedHeight,'PNG height');
   assert.equal(data[8],8,'PNG must use eight-bit channels');assert([2,6].includes(data[9]),'PNG must be RGB or RGBA');channels=data[9]===6?4:3;
   assert.equal(data[10],0,'PNG compression');assert.equal(data[11],0,'PNG filter method');assert.equal(data[12],0,'PNG interlace');
  }else{
   assert(seenHeader,'PNG header missing');
   if(type==='IDAT'){assert(!endedData,'Non-contiguous PNG IDAT');seenData=true;parts.push(data);}
   else{
    if(seenData)endedData=true;
    if(type==='IEND'){assert(length===0&&seenData,'PNG IEND without image data');seenEnd=true;}
    else{assert(!/^[A-Z]/.test(type)||type==='PLTE','Unsupported critical PNG chunk '+type);assert(type!=='tRNS','Unexpected separate PNG transparency');}
   }
  }
  offset=end;
 }
 assert(seenEnd&&offset===bytes.length,'Missing PNG end');const stride=width*channels,expected=(stride+1)*height;
 const raw=inflateSync(Buffer.concat(parts),{maxOutputLength:expected});assert.equal(raw.length,expected,'PNG decompressed size');const decoded=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];assert(filter<=4,'Unsupported PNG row filter');
  for(let x=0;x<stride;x++){
   const left=x>=channels?decoded[y*stride+x-channels]:0,up=y?decoded[(y-1)*stride+x]:0,upperLeft=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;
   const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);
   decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 const rgba=channels===4?decoded:Buffer.alloc(width*height*4);
 if(channels===3)for(let pixel=0;pixel<width*height;pixel++){decoded.copy(rgba,pixel*4,pixel*3,pixel*3+3);rgba[pixel*4+3]=255;}
 return {width,height,rgba,rgbaSha256:sha256(rgba),readPixelsSha256:sha256(bottomUp(rgba,width,height))};
}


const jsonFile=async(path,value)=>{await writeFile(path,JSON.stringify(value,null,2)+'\n');};

const DETAIL_NAMES=['asphalt','bark','brick','bronze','ceramic','cloth','concrete','copper','cork','feather','fur','granite','graphite','grass','gravel','leaf','leather','limestone','marble','metal','paint','roof','rope','rubber','sand','scales','skin','wood'].map(name=>name+'-detail.webp');
const GL={TEXTURE_2D:0x0de1,RGBA8:0x8058,RG8:0x822b,R8:0x8229,RGBA:0x1908,RG:0x8227,RED:0x1903,UNSIGNED_BYTE:0x1401};
const textureIdentity=value=>{const {name,format,internalFormat,nativeTextureId,...identity}=value;return identity;};
function verifyUpload(row,mode,initial,three){
  const format=mode==='original'?three.RGBAFormat:mode==='rg8'?three.RGFormat:three.RedFormat;
  const internal=mode==='original'?null:mode==='rg8'?'RG8':'R8';
  const glFormat=mode==='original'?GL.RGBA:mode==='rg8'?GL.RG:GL.RED;
  const glInternal=mode==='original'?GL.RGBA8:mode==='rg8'?GL.RG8:GL.R8;
  assert.equal(row.state.format,format);assert.equal(row.state.internalFormat,internal);
  assert.deepEqual(row.storage,[{target:GL.TEXTURE_2D,levels:10,internalFormat:glInternal,width:512,height:512}],'Actual native storage differs');
  assert.deepEqual(row.subImages,[{argumentCount:7,target:GL.TEXTURE_2D,level:0,x:0,y:0,format:glFormat,type:GL.UNSIGNED_BYTE,sameDecodedImage:true}],'Actual DOM image upload differs');
  assert.equal(row.mipmapCalls,1);assert(Number.isSafeInteger(row.nativeTextureId)&&row.nativeTextureId>0);
  if(row.reason==='initial-original')assert.equal(row.priorNativeTextureId,null);
  else{assert(Number.isSafeInteger(row.priorNativeTextureId)&&row.priorNativeTextureId>0);assert.notEqual(row.nativeTextureId,row.priorNativeTextureId,'Storage switch reused old native allocation');}
  for(const key of ['textureUuid','sourceUuid','imageId'])assert.equal(row[key],row.state[key]);
  assert.deepEqual(textureIdentity(row.state),textureIdentity(initial),'Original decoded image or sampler changed');
}
function verifyTextureFrame(frame,initial,three){
  assert.deepEqual(frame.textures.map(x=>x.name).sort(),DETAIL_NAMES,'All28 detail identities required');
  for(const key of ['textureUuid','sourceUuid','imageId','nativeTextureId'])assert.equal(new Set(frame.textures.map(x=>x[key])).size,28,'Aliased detail '+key);
  const mode=frame.lane==='rg8'?'rg8':frame.lane==='lost-g'?'lost-g':'original';
  const format=mode==='original'?three.RGBAFormat:mode==='rg8'?three.RGFormat:three.RedFormat,internal=mode==='original'?null:mode==='rg8'?'RG8':'R8';
  for(const state of frame.textures){
    const first=initial.get(state.name);assert(first,'Missing first original upload');
    assert.deepEqual(textureIdentity(state),textureIdentity(first.state),'Image or sampler identity changed');
    assert.equal(state.format,format);assert.equal(state.internalFormat,internal);
    assert(Number.isSafeInteger(state.nativeTextureId)&&state.nativeTextureId>0);
  }
  const needsUpload=['rg8','restored','lost-g','lost-g-restored'].includes(frame.lane);
  assert.equal(frame.uploads.length,needsUpload?28:0,'Missing/extra explicit storage transitions');
  if(needsUpload){
    assert.deepEqual(frame.uploads.map(x=>x.name).sort(),DETAIL_NAMES);
    for(const row of frame.uploads){verifyUpload(row,mode,initial.get(row.name).state,three);assert.equal(frame.textures.find(x=>x.name===row.name).nativeTextureId,row.nativeTextureId);}
  }
}

const errorText=error=>String(error?.stack||error);
function exactFrame(left,right,readRaw){
  assert.equal(left.calls,right.calls,'Draw count changed');
  assert.equal(left.triangles,right.triangles,'Triangle count changed');
  assert(left.calls>0&&left.triangles>0,'Empty world render');
  assert.deepEqual(right.draws,left.draws,'Submitted draw/program/matrix order changed');
  assert.deepEqual(right.poolDelta,left.poolDelta,'Original pooled-buffer accounting changed');
  for(const key of ['matrixObjects','geometrySha256','materialSha256','collisionSha256'])assert.deepEqual(right[key],left[key],'Frame identity changed: '+key);
  const color=pixelDiff(readRaw(left.colorEvidenceName),readRaw(right.colorEvidenceName));
  assert.equal(color.changedPixels,0,'Whole-frame RGBA pixels differ');
  assert.equal(color.maxChannelDelta,0,'Whole-frame RGBA channel differs');
  assert(readRaw(left.matrixEvidenceName).equals(readRaw(right.matrixEvidenceName)),'Actual matrix bytes changed');
  assert.equal(right.shadowTargets.length,left.shadowTargets.length,'Shadow target population changed');
  for(let i=0;i<left.shadowTargets.length;i++){
    const a=left.shadowTargets[i],b=right.shadowTargets[i];
    for(const key of ['lightId','textureUuid','width','height'])assert.equal(b[key],a[key],'Shadow target identity');
    assert(readRaw(a.evidenceName).equals(readRaw(b.evidenceName)),'Shadow target bytes changed');
  }
  return color;
}
async function verifyUnionMetadata(root){
  const paths=[];
  async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())await walk(path);else if(item.name==='report.json')paths.push(path);}}
  await walk(root);
  const reports=await Promise.all(paths.map(async path=>({path,data:JSON.parse(await readFile(path,'utf8'))})));
  const relevant=reports.filter(({data})=>data.schema==='belle-rg8-world-proof-v1');
  assert.equal(relevant.length,12,'All four native and eight software jobs are required');
  const expected=STYLES.flatMap(style=>[{backend:'metal',style,partition:'all'},{backend:'swiftshader',style,partition:'linux-a'},{backend:'swiftshader',style,partition:'linux-b'}]);
  const seen=new Set(),heads=new Set();
  for(const {path,data} of relevant){
    const id=data.backend+'/'+data.style+'/'+data.partition;
    assert(!seen.has(id),'Duplicate job '+id);seen.add(id);heads.add(data.proofHead);
    assert(expected.some(x=>x.backend+'/'+x.style+'/'+x.partition===id),'Unexpected job '+id);
    assert.equal(data.passed,true,'Failed or incomplete job '+path);
    assert.equal(data.baseline,BASELINE);assert.equal(data.baselineTree,BASELINE_TREE);
    assert.equal(data.candidate,CANDIDATE);assert.equal(data.candidateTree,CANDIDATE_TREE);
    assert.deepEqual(data.independentCases.map(x=>x.name),PARTITIONS[data.partition]);
    assert.equal(data.independentCases.length,data.result.completed.length);
  }
  assert.equal(heads.size,1,'Mixed diagnostic source revisions');
  return {passed:true,jobs:12,uniqueCasesPerBackend:32,proofHead:[...heads][0],baseline:BASELINE,candidate:CANDIDATE,scope:'Complete fixed full-world proof union only. Original ride/control/release gates remain independent.'};
}

async function verifyUnion(root){
  const proof=resolve(import.meta.dirname,'../..');
  const git=(...args)=>execFileSync('git',['-C',proof,...args],{encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024}).trim();
  const expectedProofHead=git('rev-parse','HEAD'),expectedProofTree=git('rev-parse','HEAD^{tree}');
  assert.match(expectedProofHead,/^[a-f0-9]{40}$/);assert.match(expectedProofTree,/^[a-f0-9]{40}$/);
  const paths=[PROOF_PATH+'/browser.ts',PROOF_PATH+'/driver.mjs',PROOF_PATH+'/artifact-audit.mjs',PROOF_PATH+'/source-manifest.json','.github/workflows/belle-rg8-world-proof.yml'];
  const expectedProofFiles=[];
  for(const path of paths){const bytes=await readFile(resolve(proof,path));assert.equal(blobHash(bytes),git('rev-parse','HEAD:'+path),'Union validator differs from exact checkout');expectedProofFiles.push({path,sha256:sha256(bytes),blob:blobHash(bytes)});}
  const metadata=await verifyUnionMetadata(root);assert.equal(metadata.proofHead,expectedProofHead,'Downloaded reports are from a stale/different diagnostic head');
  const {auditWorldArtifacts}=await import('./artifact-audit.mjs');
  const audit=[];
  async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())await walk(path);else if(item.name==='report.json'){const report=JSON.parse(await readFile(path,'utf8'));if(report.schema==='belle-rg8-world-proof-v1')audit.push(await auditWorldArtifacts({directory:dir,report,expectedProofHead,expectedProofTree,expectedProofFiles,validators:{decodePng,exactFrame,verifyUpload,verifyTextureFrame}}));}}}
  await walk(root);assert.equal(audit.length,12);
  return {...metadata,proofTree:expectedProofTree,retainedArtifactsRevalidated:true,audit};
}

async function main(){
  const original=resolve(process.env.RG8_WORLD_ORIGINAL||process.argv[2]||'.');
  const candidate=resolve(process.env.RG8_WORLD_CANDIDATE||process.argv[3]||'.');
  const proof=resolve(import.meta.dirname,'../..'),game=resolve(original,GAME_PATH);
  const output=resolve(process.env.RG8_WORLD_OUTPUT||process.argv[4]||'rg8-world-output');
  const backend=process.env.RG8_WORLD_BACKEND,style=process.env.RG8_WORLD_STYLE,partition=process.env.RG8_WORLD_PARTITION;
  const compileOnly=process.env.RG8_WORLD_COMPILE_ONLY==='1';
  assert(['metal','swiftshader'].includes(backend));assert(STYLES.includes(style));assert(Object.hasOwn(PARTITIONS,partition));
  assert(backend==='metal'?partition==='all':partition!=='all','Fixed backend partition changed');
  await mkdir(output,{recursive:true});
  const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{maxBuffer:256*1024*1024,timeout:60000});
  const gitText=(dir,...args)=>git(dir,...args).toString('utf8').trim();
  const report={schema:'belle-rg8-world-proof-v1',passed:false,compileOnly,backend,style,partition,baseline:BASELINE,baselineTree:BASELINE_TREE,candidate:CANDIDATE,candidateTree:CANDIDATE_TREE,
    startedAt:new Date().toISOString(),proofHead:null,proofTree:null,sourceReceipts:[],sources:[],assets:[],bundleInputs:[],evidence:[],events:[],errors:[],failedRequests:[],independentCases:[],result:null,
    scope:'Full original world storage/pixel proof with frozen explicit views. No physical-device, controls, ride performance, or production release approval.'};
  const recordEvent=async(type,detail={})=>{const item={type,at:new Date().toISOString(),...detail};report.events.push(item);await writeFile(resolve(output,'events.ndjson'),JSON.stringify(item)+'\n',{flag:'a'});};
  const sourceFiles=new Map(),sourceReceipts=new Map(),sourceBytes=new Map(),assets=new Map(),literalAssets=new Map();
  const evidence=new Map(),jsonEvidence=new Map(),rawEvidence=new Map();
  let browser,server,timer,assetBarrier=false,closing=false,origin='',previousCompilation;
  function safePath(path){assert(path.startsWith(SOURCE_ROOT)&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..')&&!posix.isAbsolute(path),'Unsafe pinned source path');return path;}
  function originalBytes(path){
    safePath(path);let bytes=sourceBytes.get(path);if(bytes)return bytes;
    const entry=sourceFiles.get(path);assert(entry?.type==='blob'&&['100644','100755'].includes(entry.mode),'Pinned regular file missing: '+path);
    bytes=git(original,'cat-file','blob',entry.blob);assert.equal(blobHash(bytes),entry.blob,'Original Git bytes changed: '+path);sourceBytes.set(path,bytes);return bytes;
  }
  function sourcePath(path){
    safePath(path);const choices=extname(path)?[path]:[path,path+'.ts',path+'.js',path+'.json',path+'/index.ts',path+'/index.js'];
    const found=choices.find(x=>sourceFiles.get(x)?.type==='blob');assert(found,'Unresolved immutable source '+path);return found;
  }
  function asset(path,url){
    const bytes=originalBytes(path);let receipt=assets.get(path);
    if(!receipt){receipt={path,blob:sourceFiles.get(path).blob,bytes:bytes.length,sha256:sha256(bytes),urls:[],requests:0};assets.set(path,receipt);}
    if(url&&!receipt.urls.includes(url))receipt.urls.push(url);return bytes;
  }
  function assetUrl(path){safePath(path);assert(sourceFiles.has(path),'Missing immutable URL asset');const url='/__pinned_asset/'+path;literalAssets.set(url,path);asset(path,url);return url;}
  function pinned(path){
    const bytes=originalBytes(path),transformations=[];
    const text=bytes.toString('utf8').replace(/new\s+URL\(\s*(['"])([^'"\r\n]+)\1\s*,\s*import\.meta\.url\s*\)(\.href)?/g,(match,_quote,relative,href)=>{
      assert(relative.startsWith('.'),'Only relative immutable URL assets allowed');const referenced=posix.normalize(posix.join(posix.dirname(path),relative)),url=assetUrl(referenced);
      const replacement=href?JSON.stringify(url):'new URL('+JSON.stringify(url)+',location.origin)';
      transformations.push({original:match,replacement,path:referenced,url});return replacement;
    });
    const receipt={path,blob:sourceFiles.get(path).blob,sha256:sha256(bytes),transformedSha256:sha256(text),transformations};
    if(sourceReceipts.has(path))assert.deepEqual(sourceReceipts.get(path),receipt);else sourceReceipts.set(path,receipt);
    return text;
  }
  async function persist(name,payload){
    safeName(name);assert(!evidence.has(name),'Duplicate immutable evidence '+name);assert(payload&&['pixels','binary','json'].includes(payload.kind),'Unknown evidence kind');
    let receipt={name,kind:payload.kind};
    if(payload.kind==='json'){
      const bytes=Buffer.from(JSON.stringify(payload.value,null,2)+'\n');assert(bytes.length<=64*1024*1024,'JSON evidence too large');
      await writeFile(resolve(output,name+'.json'),bytes,{flag:'wx'});receipt={...receipt,file:name+'.json',bytes:bytes.length,sha256:sha256(bytes)};jsonEvidence.set(name,payload.value);
    }else{
      assert(Number.isSafeInteger(payload.bytes)&&payload.bytes>0&&payload.bytes<=64*1024*1024,'Invalid raw evidence size');
      assert.match(payload.sha256,hashPattern);assert(typeof payload.gzipBase64==='string'&&payload.gzipBase64.length<=96*1024*1024,'Compressed evidence too large');
      const compressed=Buffer.from(payload.gzipBase64,'base64'),raw=gunzipSync(compressed,{maxOutputLength:payload.bytes});
      assert.equal(raw.length,payload.bytes,'Raw evidence length');assert.equal(sha256(raw),payload.sha256,'Raw evidence hash');
      if(payload.kind==='pixels'){
        assert(Number.isSafeInteger(payload.width)&&Number.isSafeInteger(payload.height)&&payload.width>0&&payload.height>0);
        assert.equal(payload.format,'RGBA8-bottom-up');assert.equal(raw.length,payload.width*payload.height*4);
      }else assert.equal(payload.format,'Float64-matrix-bytes');
      const file=name+(payload.kind==='pixels'?'.rgba.gz':'.matrix.gz');
      await writeFile(resolve(output,file),compressed,{flag:'wx'});
      receipt={...receipt,file,format:payload.format,width:payload.width,height:payload.height,bytes:raw.length,sha256:sha256(raw),compressedBytes:compressed.length,compressedSha256:sha256(compressed)};
      if(payload.pngDataUrl){
        assert(payload.kind==='pixels');assert(payload.pngDataUrl.startsWith('data:image/png;base64,'));
        const png=Buffer.from(payload.pngDataUrl.slice('data:image/png;base64,'.length),'base64');
        const decoded=decodePng(png,payload.width,payload.height);
        assert.equal(decoded.readPixelsSha256,payload.sha256,'Independent PNG/raw reconstruction');
        await writeFile(resolve(output,name+'.png'),png,{flag:'wx'});receipt.png={file:name+'.png',bytes:png.length,sha256:sha256(png)};
      }
      rawEvidence.set(name,raw);
    }
    evidence.set(name,receipt);report.evidence.push(receipt);
    await writeFile(resolve(output,'evidence.ndjson'),JSON.stringify(receipt)+'\n',{flag:'a'});
    return {persisted:true,name};
  }
  try{
    if(!compileOnly){
      previousCompilation=JSON.parse(await readFile(resolve(output,'report.json'),'utf8'));
      assert.equal(previousCompilation.compileOnly,true,'Missing source-only compile stage');
      assert.equal(previousCompilation.compiled,true,'Source-only compilation did not finish');
      assert.equal(previousCompilation.passed,false,'Source-only compilation cannot be visual acceptance');
      assert.deepEqual(previousCompilation.errors,[],'Source-only compile stage failed');
      assert.equal(previousCompilation.cleanup?.complete,true,'Source-only cleanup incomplete');
      assert.deepEqual(previousCompilation.cleanup.errors,[]);
      const priorEvents=(await readFile(resolve(output,'events.ndjson'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
      assert.equal(priorEvents.length,1,'Unexpected or reused source-only event history');
      assert.equal(priorEvents[0].type,'compiled');
      assert.deepEqual(previousCompilation.events,priorEvents,'Source-only event history changed');
      report.events.push(...priorEvents);
      for(const field of ['backend','style','partition','baseline','baselineTree','candidate','candidateTree'])assert.deepEqual(previousCompilation[field],report[field],'Source-only plan changed: '+field);
    }else{
      try{await readFile(resolve(output,'events.ndjson'));assert.fail('Source-only compilation requires a fresh output directory');}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    assert.equal(gitText(original,'rev-parse','HEAD'),BASELINE);assert.equal(gitText(original,'rev-parse','HEAD^{tree}'),BASELINE_TREE);
    assert.equal(gitText(candidate,'rev-parse','HEAD'),CANDIDATE);assert.equal(gitText(candidate,'rev-parse','HEAD^{tree}'),CANDIDATE_TREE);
    const candidateParents=gitText(candidate,'rev-list','--parents','-n','1','HEAD').split(' ');assert.deepEqual(candidateParents,[CANDIDATE,BASELINE]);
    const materialPath=GAME_PATH+'/src/belle/realisticMaterials.ts',testPath=GAME_PATH+'/src/belle/realisticMaterials.test.ts';
    assert.deepEqual(gitText(candidate,'diff','--name-only','--no-renames',BASELINE,CANDIDATE).split('\n').sort(),[materialPath,testPath].sort());
    const proofParents=gitText(proof,'rev-list','--parents','-n','1','HEAD').split(' ');
    report.proofHead=proofParents[0];report.proofTree=gitText(proof,'rev-parse','HEAD^{tree}');
    const proofFiles=[PROOF_PATH+'/browser.ts',PROOF_PATH+'/driver.mjs',PROOF_PATH+'/artifact-audit.mjs',PROOF_PATH+'/source-manifest.json','.github/workflows/belle-rg8-world-proof.yml'].sort();
    if(!compileOnly){assert.deepEqual(proofParents.slice(1),[BASELINE]);assert.deepEqual(gitText(proof,'diff','--name-only','--no-renames',BASELINE,'HEAD').split('\n').sort(),proofFiles);}
    const tree=git(original,'ls-tree','-rz',BASELINE,'--',SOURCE_ROOT).toString('utf8');
    for(const line of tree.split('\0').filter(Boolean)){const match=line.match(/^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/);assert(match);sourceFiles.set(match[4],{mode:match[1],type:match[2],blob:match[3]});}
    assert(sourceFiles.size>100,'Pinned tree missing');
    const candidateSource=await readFile(resolve(candidate,materialPath));
    assert.equal(blobHash(candidateSource),'2d5ab8f194c5552680008dcd4775ef19ed0523b9');
    assert.equal(blobHash(await readFile(resolve(candidate,testPath))),'4018bb3758f6d51c5540655e4408966112e546a3');
    const addition="     // Detail shaders consume authored roughness R and height G from the same decoded image.\n     detail.format=T.RGFormat;detail.internalFormat='RG8';\n";
    const candidateText=candidateSource.toString('utf8');assert.equal(candidateText.split(addition).length,2,'Exact two-assignment patch changed');
    assert.equal(candidateText.replace(addition,''),originalBytes(materialPath).toString('utf8'),'Runtime changes extend beyond reviewed storage selection');
    for(const path of [SOURCE_ROOT+'package.json',SOURCE_ROOT+'package-lock.json',GAME_PATH+'/package.json',GAME_PATH+'/package-lock.json']){
      const current=await readFile(resolve(original,path));assert(current.equals(originalBytes(path)),'Runtime manifest/lock differs from original');report.sourceReceipts.push({path,sha256:sha256(current),blob:sourceFiles.get(path).blob});
    }
    for(const path of proofFiles){
      const bytes=await readFile(resolve(proof,path));const record={path,sha256:sha256(bytes),blob:blobHash(bytes)};
      if(!compileOnly){const committed=git(proof,'show','HEAD:'+path);assert(bytes.equals(committed),'Proof file differs from exact head');}
      report.sourceReceipts.push(record);
    }
    const sourceManifest=JSON.parse(await readFile(resolve(proof,PROOF_PATH,'source-manifest.json'),'utf8'));
    assert.equal(sourceManifest.baseline,BASELINE);assert.equal(sourceManifest.baselineTree,BASELINE_TREE);assert.equal(sourceManifest.candidate,CANDIDATE);assert.equal(sourceManifest.candidateTree,CANDIDATE_TREE);
    assert.deepEqual(sourceManifest.styles,STYLES);assert.deepEqual(sourceManifest.cases,CASES);assert.deepEqual(sourceManifest.partitions,PARTITIONS);
    const require=createRequire(resolve(game,'package.json')),{build}=require('esbuild'),three=require('three');
    assert.equal(three.REVISION,'185','Original Three revision changed');
    const definitions={'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'};
    const plugin={name:'immutable-original-world',setup(builder){
      builder.onResolve({filter:/^baseline:/},args=>{const name=args.path.slice(9),path=sourcePath(GAME_PATH+'/'+(name.startsWith('src/')||name.startsWith('runtime/')?name:'src/belle/'+name));return {path,namespace:'pinned-source'};});
      builder.onResolve({filter:/^three(?:\/|$)/},args=>args.pluginData?.bound?undefined:builder.resolve(args.path,{resolveDir:game,kind:args.kind,pluginData:{bound:true}}));
      builder.onResolve({filter:/.*/,namespace:'pinned-source'},args=>{
        if(args.path.startsWith('.'))return {path:sourcePath(posix.normalize(posix.join(posix.dirname(args.importer),args.path.replace(/\?url$/,'')))),namespace:'pinned-source'};
        if(args.path==='@digital-static/ridecore')return {path:sourcePath(GAME_PATH+'/runtime/ride-core/src/index.ts'),namespace:'pinned-source'};
        return builder.resolve(args.path,{resolveDir:game,kind:args.kind,pluginData:{bound:true}});
      });
      builder.onLoad({filter:/.*/,namespace:'pinned-source'},args=>{
        const extension=extname(args.path);
        if(!['.ts','.tsx','.js','.mjs','.json'].includes(extension))return {contents:'export default '+JSON.stringify(assetUrl(args.path))+';',loader:'js',resolveDir:game};
        return {contents:pinned(args.path),loader:extension==='.json'?'json':extension==='.tsx'?'tsx':extension==='.ts'?'ts':'js',resolveDir:dirname(resolve(original,args.path))};
      });
    }};
    const built=await build({absWorkingDir:game,entryPoints:[resolve(proof,PROOF_PATH,'browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',metafile:true,plugins:[plugin],define:definitions});
    const javascript=built.outputFiles[0].contents;
    for(const input of Object.keys(built.metafile.inputs).sort()){
      if(input.startsWith('pinned-source:')){report.bundleInputs.push({path:input,pinned:true});continue;}
      if(input==='<define:import.meta.env>'){report.bundleInputs.push({path:input,generated:true,value:definitions['import.meta.env']});continue;}
      const filename=resolve(game,input),isDependency=filename.includes(sep+'node_modules'+sep);
      assert(isDependency||filename===resolve(proof,PROOF_PATH,'browser.ts'),'Nonoriginal application source leaked into proof: '+filename);
      report.bundleInputs.push({path:filename,dependency:isDependency,sha256:sha256(await readFile(filename))});
    }
    for(const name of ['world.ts','realisticMaterials.ts','sharedGeometryBuffers.ts','terrain.ts','detroitAssets.ts','detroitScene.ts','districtModelUrls.ts'])assert(sourceReceipts.has(GAME_PATH+'/src/belle/'+name),'Original module missing: '+name);
    report.fixtureSha256=sha256(javascript);report.definitions=definitions;
    if(previousCompilation){
      for(const field of ['proofHead','proofTree','sourceReceipts','fixtureSha256','definitions'])assert.deepEqual(previousCompilation[field],report[field],'Compiled source binding changed: '+field);
      const byPath=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;
      assert.deepEqual([...previousCompilation.sources].sort(byPath),[...sourceReceipts.values()].sort(byPath),'Immutable module inventory changed between compile and execution');
    }
    await writeFile(resolve(output,'fixture.js'),javascript);await jsonFile(resolve(output,'bundle-metafile.json'),built.metafile);
    await recordEvent('compiled',{fixtureSha256:report.fixtureSha256,pinnedModules:sourceReceipts.size});
    report.compiled=true;if(compileOnly)return;
    const {chromium}=createRequire(resolve(original,SOURCE_ROOT,'package.json'))('@playwright/test');
    const types={'.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.hdr':'application/octet-stream','.wasm':'application/wasm','.js':'text/javascript','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
    server=createServer((request,response)=>{
      try{
        assert(['GET','HEAD'].includes(request.method),'Proof asset server is read-only');
        const pathname=new URL(request.url,'http://127.0.0.1').pathname;response.setHeader('Cache-Control','no-store');
        if(pathname==='/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:960px;height:600px;overflow:hidden}canvas{display:block}</style><canvas></canvas><script type="module" src="/proof.js"></script>');return;}
        if(pathname==='/proof.js'){response.setHeader('Content-Type','text/javascript');response.end(javascript);return;}
        if(pathname==='/__asset_barrier'){assert(!assetBarrier,'Asset publication barrier repeated');assetBarrier=true;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({frozen:true,baseline:BASELINE,candidate:CANDIDATE,proofHead:report.proofHead,requests:[...assets.values()].reduce((n,x)=>n+x.requests,0)}));return;}
        const decoded=decodeURIComponent(pathname);assert(!decoded.includes('\\')&&!decoded.includes('\0')&&!decoded.split('/').includes('..'));
        const path=decoded.startsWith('/__pinned_asset/')?literalAssets.get(decoded):GAME_PATH+'/public'+decoded;assert(path,'Unregistered pinned URL');
        assert(!assetBarrier,'Unexpected late scene asset request after publication: '+path);
        const bytes=asset(path,decoded);assets.get(path).requests++;
        response.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');response.setHeader('Content-Length',bytes.length);response.end(request.method==='HEAD'?undefined:bytes);
      }catch(error){report.errors.push(errorText(error));response.writeHead(500);response.end('Immutable source binding failed');}
    });
    await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok);});origin='http://127.0.0.1:'+server.address().port;
    assert(backend==='metal'?process.platform==='darwin':process.platform==='linux','Backend/host mismatch');
    browser=await chromium.launch({channel:'chrome',headless:false,args:backend==='metal'?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
    report.browserVersion=browser.version();
    const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();report.errors.push('Unexpected external request '+url);return route.abort();});
    const page=await context.newPage();
    await page.exposeFunction('persistWorldEvidence',persist);
    page.on('pageerror',error=>report.errors.push(errorText(error)));
    page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),failure:request.failure()}));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());else if(message.text().startsWith('rg8 world proof '))console.log(message.text());});
    page.on('crash',()=>{if(!closing)report.errors.push('Browser page crashed');});
    browser.on('disconnected',()=>{if(!closing)report.errors.push('Browser disconnected unexpectedly');});
    await page.goto(origin+'/',{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>typeof window.__rg8WorldProof==='function',null,{timeout:120000});
    report.result=await Promise.race([page.evaluate(plan=>window.__rg8WorldProof(plan),{style,partition}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Full-world diagnostic exceeded fixed35-minute limit')),35*60*1000);})]);clearTimeout(timer);
    await jsonFile(resolve(output,'final-result.json'),report.result);
    assert.equal(report.result.passed,true,'Browser proof failed; retained per-case evidence');
    assert.equal(report.result.style,style);assert.equal(report.result.partition,partition);
    assert.deepEqual(report.result.completed.map(x=>typeof x==='string'?x:x.name),PARTITIONS[partition],'Incomplete fixed case coverage');
    const readRaw=name=>{assert(rawEvidence.has(name),'Missing saved raw evidence '+name);return rawEvidence.get(name);};
    const firstUploads=jsonEvidence.get(style+'-initial-textures')?.initialUploads;
    assert(Array.isArray(firstUploads));assert.deepEqual(firstUploads.map(x=>x.name).sort(),DETAIL_NAMES);
    const initial=new Map(firstUploads.map(row=>[row.name,row]));
    for(const row of firstUploads){
      const state=row.state;assert.equal(row.reason,'initial-original');assert.equal(state.width,512);assert.equal(state.height,512);
      assert.equal(new URL(state.url).pathname,'/belle/skins/'+row.name);assert.equal(new URL(state.url).origin,origin);
      assert.equal(state.type,three.UnsignedByteType);assert.equal(state.colorSpace,three.NoColorSpace);
      assert.equal(state.wrapS,three.RepeatWrapping);assert.equal(state.wrapT,three.RepeatWrapping);
      assert.equal(state.minFilter,three.LinearMipmapLinearFilter);assert.equal(state.magFilter,three.LinearFilter);
      assert.equal(state.flipY,true);assert.equal(state.premultiplyAlpha,false);assert.equal(state.unpackAlignment,4);assert.equal(state.generateMipmaps,true);
      assert(Number.isFinite(state.anisotropy)&&state.anisotropy>=1&&state.anisotropy<=8);
      verifyUpload(row,'original',state,three);
    }
    const contextProof=jsonEvidence.get(style+'-context');assert(contextProof,'Missing actual context receipt');
    assert.equal(contextProof.threeRevision,'185');assert.equal(contextProof.width,WIDTH);assert.equal(contextProof.height,HEIGHT);assert.equal(contextProof.dpr,1);assert.equal(contextProof.samples,4);
    assert.equal(contextProof.software,backend==='swiftshader');assert.match(contextProof.gpu,backend==='swiftshader'?/SwiftShader/:/ANGLE Metal Renderer:.*Apple/);
    assert.equal(contextProof.near,.08);assert.equal(contextProof.far,22000);assert.equal(contextProof.style,style);assert.equal(contextProof.partition,partition);
    assert.deepEqual(contextProof.selectedCases,PARTITIONS[partition]);assert.deepEqual(contextProof.casePlan.map(x=>x.name),CASES);
    assert.deepEqual(contextProof.plan.styles,STYLES);assert.deepEqual(contextProof.plan.cases,CASES);assert.deepEqual(contextProof.plan.partitions,PARTITIONS);
    assert.equal(contextProof.plan.warmupRenders,3);assert.equal(contextProof.plan.minimumControlPixels,16);assert.equal(contextProof.plan.deadlineMinutes,35);
    const programs=[...jsonEvidence.entries()].filter(([name])=>name.startsWith(style+'-program-')).map(([,value])=>value);
    assert(programs.length>0);for(const program of programs){assert.equal(program.linked,true);assert.equal(sha256(program.vertex),program.vertexSha256);assert.equal(sha256(program.fragment),program.fragmentSha256);}
    const programIds=new Set(programs.map(x=>x.id));
    for(const [index,caseName] of PARTITIONS[partition].entries()){
      const prefix=style+'-'+caseName,lanes=index===0?[...LANES,...CONTROL_LANES]:LANES;
      const frames=new Map();
      for(const lane of lanes){
        const name=prefix+'-'+lane+'-frame',frame=jsonEvidence.get(name);assert(frame,'Missing exact frame '+name);
        assert.equal(frame.caseName,caseName);assert.equal(frame.lane,lane);assert.equal(frame.style,style);
        verifyTextureFrame(frame,initial,three);
        assert(frame.draws.every(draw=>programIds.has(draw.program)),'Missing actual linked shader source');
        assert.equal(sha256(readRaw(frame.colorEvidenceName)),frame.rgbaSha256);assert.equal(sha256(readRaw(frame.matrixEvidenceName)),frame.matrixSha256);
        assert.equal(readRaw(frame.colorEvidenceName).length,WIDTH*HEIGHT*4);
        for(const target of frame.shadowTargets)assert.equal(sha256(readRaw(target.evidenceName)),target.sha256);
        frames.set(lane,frame);
      }
      const originalFrame=frames.get('original');
      for(const lane of ['rg8','restored'])exactFrame(originalFrame,frames.get(lane),readRaw);
      const audit={name:caseName,style,frames:lanes.length,exactLanes:['rg8','restored']};
      if(index===0){
        const lost=pixelDiff(readRaw(originalFrame.colorEvidenceName),readRaw(frames.get('lost-g').colorEvidenceName));
        const shadow=pixelDiff(readRaw(originalFrame.colorEvidenceName),readRaw(frames.get('shadow-off').colorEvidenceName));
        assert(lost.changedPixels>=16,'Lost-G control is ineffective');assert(shadow.changedPixels>=16,'Shadow-off control is ineffective');
        for(const lane of ['lost-g-restored','shadow-restored'])exactFrame(originalFrame,frames.get(lane),readRaw);
        audit.controls={lostG:lost,shadowOff:shadow,exactRestorations:2};
      }
      const item=jsonEvidence.get(prefix+'-case');assert(item?.passed===true,'Case assertion failed or absent');
      report.independentCases.push(audit);
    }
    assert(assetBarrier,'Original asset publication did not complete');
    for(const name of ['street-at-sunset','detroit-scenery'])assert(assets.get(GAME_PATH+'/src/belle/districtModels/'+name+'.glb')?.requests>0,'Actual Detroit pack not consumed');
    const detailAssets=[...assets.values()].filter(x=>x.path.startsWith(GAME_PATH+'/public/belle/skins/')&&x.path.endsWith('-detail.webp')&&x.requests>0);
    assert.equal(detailAssets.length,28,'All28 original detail maps must be consumed');
    assert.equal(report.errors.length,0,'Page/shader/source errors');assert.equal(report.failedRequests.length,0,'Failed requests');
    report.passed=true;
  }catch(error){report.errors.push(errorText(error));process.exitCode=1;}
  finally{
    clearTimeout(timer);closing=true;
    const validationPassed=report.passed;report.passed=false;
    report.sources=[...sourceReceipts.values()];report.assets=[...assets.values()];report.finishedAt=new Date().toISOString();
    report.cleanup={complete:false,startedAt:new Date().toISOString(),timedOut:false,errors:[]};
    // A killed or hung browser must not leave the earlier compile-only report
    // as the terminal record. Pending cleanup is explicitly not acceptance.
    await jsonFile(resolve(output,'report.json'),report);
    const boundedCleanup=async(label,operation)=>{
      let timeout;try{await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timeout=setTimeout(()=>{report.cleanup.timedOut=true;reject(Error(label+' exceeded its10-second cleanup limit'));},10000);})]);}
      catch(error){const message=label+': '+errorText(error);report.cleanup.errors.push(message);report.errors.push(message);process.exitCode=1;}
      finally{clearTimeout(timeout);}
    };
    if(browser)await boundedCleanup('Closing browser',()=>browser.close());
    if(server)await boundedCleanup('Closing asset server',()=>new Promise(ok=>{server.close(ok);server.closeAllConnections?.();}));
    report.cleanup.complete=true;report.cleanup.finishedAt=new Date().toISOString();
    report.passed=validationPassed&&report.cleanup.errors.length===0;
    await jsonFile(resolve(output,'report.json'),report);
    console.log(JSON.stringify({passed:report.passed,compileOnly,backend,style,partition,cases:report.independentCases.length,files:report.evidence.length,errors:report.errors,report:resolve(output,'report.json')}));
    if(report.cleanup.timedOut)process.exit(1);
  }
}
async function selfTest(){
  const makeRaw=()=>new Map([['a-color',Buffer.from([3,17,99,255])],['b-color',Buffer.from([3,17,99,255])],['a-matrix',Buffer.alloc(16)],['b-matrix',Buffer.alloc(16)],['a-shadow',Buffer.from([1,2,3,255])],['b-shadow',Buffer.from([1,2,3,255])]]);
  const frame=prefix=>({calls:1,triangles:3,draws:[{object:4,program:7}],matrixObjects:[{id:4}],geometrySha256:'geometry',materialSha256:'material',collisionSha256:'collision',colorEvidenceName:prefix+'-color',matrixEvidenceName:prefix+'-matrix',shadowTargets:[{lightId:2,width:1,height:1,evidenceName:prefix+'-shadow'}]});
  const a=frame('a'),b=frame('b');
  let raw=makeRaw();assert.deepEqual(exactFrame(a,b,name=>raw.get(name)),{changedPixels:0,maxChannelDelta:0});
  raw=makeRaw();raw.get('b-color')[1]++;assert.throws(()=>exactFrame(a,b,name=>raw.get(name)),/RGBA pixels differ/);
  raw=makeRaw();raw.get('b-matrix')[0]=1;assert.throws(()=>exactFrame(a,b,name=>raw.get(name)),/matrix bytes changed/);
  raw=makeRaw();raw.get('b-shadow')[0]=0;assert.throws(()=>exactFrame(a,b,name=>raw.get(name)),/Shadow target bytes changed/);
  raw=makeRaw();const wrongDraw=structuredClone(b);wrongDraw.draws[0].program=8;assert.throws(()=>exactFrame(a,wrongDraw,name=>raw.get(name)),/draw\/program\/matrix order changed/);
  const wrongMaterial={...b,materialSha256:'other'};assert.throws(()=>exactFrame(a,wrongMaterial,name=>raw.get(name)),/Frame identity changed/);
  const chunk=(name,data)=>{const kind=Buffer.from(name),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length,0);kind.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([kind,data])),data.length+8);return result;};
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,3,17,99,255]))),chunk('IEND',Buffer.alloc(0))]);
  assert(decodePng(png,1,1).rgba.equals(Buffer.from([3,17,99,255])));const corrupt=Buffer.from(png);corrupt[corrupt.length-1]^=1;assert.throws(()=>decodePng(corrupt,1,1),/PNG CRC/);
  const dir=await mkdtemp(resolve(tmpdir(),'rg8-world-validator-'));
  try{
    const plans=STYLES.flatMap(style=>[{backend:'metal',style,partition:'all'},{backend:'swiftshader',style,partition:'linux-a'},{backend:'swiftshader',style,partition:'linux-b'}]);
    for(const [i,plan] of plans.entries()){await mkdir(resolve(dir,String(i)));const cases=PARTITIONS[plan.partition].map(name=>({name}));await jsonFile(resolve(dir,String(i),'report.json'),{schema:'belle-rg8-world-proof-v1',...plan,passed:true,baseline:BASELINE,baselineTree:BASELINE_TREE,candidate:CANDIDATE,candidateTree:CANDIDATE_TREE,proofHead:'one-head',independentCases:cases,result:{completed:cases}});}
    assert.equal((await verifyUnionMetadata(dir)).jobs,12);
    const path=resolve(dir,'0','report.json'),good=JSON.parse(await readFile(path,'utf8'));await jsonFile(path,{...good,passed:false});await assert.rejects(()=>verifyUnionMetadata(dir),/Failed or incomplete job/);
    await jsonFile(path,{...good,proofHead:'mixed-head'});await assert.rejects(()=>verifyUnionMetadata(dir),/Mixed diagnostic source revisions/);
    await jsonFile(path,{...good,independentCases:good.independentCases.slice(1)});await assert.rejects(()=>verifyUnionMetadata(dir));
  }finally{await rm(dir,{recursive:true,force:true});}
  console.log('Independent raw-pixel, PNG, draw/matrix/shadow, and fixed-union negative controls passed');
}
if(process.argv[2]==='--self-test')await selfTest();
else if(process.argv[2]==='--verify-union'){
  const value=await verifyUnion(resolve(process.argv[3]));await jsonFile(resolve(process.argv[3],'union.json'),value);console.log(JSON.stringify(value));
}else await main();

