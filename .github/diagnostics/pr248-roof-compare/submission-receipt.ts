/** Diagnostic-only copies of the exact source-owned span passed to native Three.
 * Shared page capacity and offsets are retained; they are never geometry proof.
 * Copy synchronously while the original helper's range is in scope. Hash only
 * after the framebuffer read/PNG capture, without changing any source arrays. */
type Geometry=any;
type Hash=(bytes:Uint8Array)=>Promise<string>;
function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const copy=(array:any,start=0,count=array.length-start)=>new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,count*array.BYTES_PER_ELEMENT).slice();
const identical=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
export function snapshotOwnedSubmission(submitted:Geometry,source:Geometry,group:unknown,roof=false){
 if(submitted===source)return null;
 check(source&&group===null,'Shared submission has no unambiguous original owner');
 const position=source.getAttribute('position'),total=source.index?.count??position?.count;
 check(position&&Number.isSafeInteger(total)&&total>0,'Original owned geometry is empty');
 const sourceStart=Math.max(0,source.drawRange.start),sourceEnd=Math.min(total,source.drawRange.start+source.drawRange.count);
 check(Number.isSafeInteger(sourceStart)&&Number.isSafeInteger(sourceEnd)&&sourceStart<=sourceEnd,'Original active range is invalid');
 const activeCount=sourceEnd-sourceStart,submittedStart=submitted.drawRange.start;
 check(Number.isSafeInteger(submittedStart)&&submittedStart>=0&&submitted.drawRange.count===activeCount,'Submitted active range does not match its original owner');
 check(!!source.index===!!submitted.index,'Shared index layout changed');
 const indexOffset=source.index?submittedStart-sourceStart:null;
 let vertexOffset:number;
 const hashes:{field:any;key:string;source:Uint8Array;actual:Uint8Array;prefixBytes?:number}[]=[];
 const receipt:any={kind:'exact-original-owner',sourcePositionCount:position.count,sourceIndexCount:source.index?.count??0,
  sourceDrawRange:{start:source.drawRange.start,count:Number.isFinite(source.drawRange.count)?source.drawRange.count:'Infinity'},
  sourceActive:{start:sourceStart,count:activeCount},submittedActive:{start:submittedStart,count:activeCount},indexOffset,vertexOffset:0,attributes:{},index:null};
 if(source.index){
  const a=source.index,b=submitted.index;
  check(!a.isInterleavedBufferAttribute&&!b.isInterleavedBufferAttribute&&a.itemSize===1&&b.itemSize===1&&a.array.constructor===b.array.constructor&&!a.normalized&&!b.normalized,'Unsupported shared index representation');
  check(Number.isSafeInteger(indexOffset)&&indexOffset!>=0&&indexOffset!+a.count<=b.count,'Owned index span is outside submitted storage');
  vertexOffset=b.array[indexOffset!]-a.array[0];
  check(Number.isSafeInteger(vertexOffset)&&vertexOffset>=0,'Invalid shared vertex relocation');
  const normalized=new a.array.constructor(a.count);
  for(let i=0;i<a.count;i++){
   const value=b.array[indexOffset!+i]-vertexOffset;
   check(Number.isSafeInteger(value)&&value>=0&&value<position.count&&value===a.array[i],'An actual submitted owner index changed');
   normalized[i]=value;
  }
  receipt.index={type:a.array.constructor.name,count:a.count,itemSize:1,normalized:false};
  hashes.push({field:receipt.index,key:'',source:copy(a.array),actual:copy(normalized),prefixBytes:roof?144*a.array.BYTES_PER_ELEMENT:undefined});
  const raw=copy(b.array,indexOffset!,a.count);
  hashes.push({field:receipt.index,key:'rawSubmittedSha256',source:raw,actual:raw});
 }else vertexOffset=submittedStart-sourceStart;
 check(Number.isSafeInteger(vertexOffset)&&vertexOffset>=0&&vertexOffset+position.count<=submitted.getAttribute('position').count,'Owned vertices are outside submitted storage');
 receipt.vertexOffset=vertexOffset;
 const names=Object.keys(source.attributes).sort();
 check(JSON.stringify(names)===JSON.stringify(Object.keys(submitted.attributes).sort()),'Shared attribute membership changed');
 for(const name of names){
  const a=source.getAttribute(name),b=submitted.getAttribute(name);
  check(!a.isInterleavedBufferAttribute&&!b.isInterleavedBufferAttribute&&ArrayBuffer.isView(a.array)&&ArrayBuffer.isView(b.array),'Unsupported shared attribute storage');
  check(a.array.constructor===b.array.constructor&&a.count===position.count&&a.itemSize===b.itemSize&&a.normalized===b.normalized&&a.gpuType===b.gpuType,'Shared attribute layout changed');
  const expected=copy(a.array),actual=copy(b.array,vertexOffset*a.itemSize,a.array.length);
  check(identical(expected,actual),'An actual submitted owner attribute changed: '+name);
  const field={type:a.array.constructor.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,gpuType:a.gpuType??null,usage:a.usage};
  receipt.attributes[name]=field;
  hashes.push({field,key:'',source:expected,actual,prefixBytes:roof?96*a.itemSize*a.array.BYTES_PER_ELEMENT:undefined});
 }
 return {receipt,async settle(hash:Hash){
  await Promise.all(hashes.map(async h=>{
   if(h.key){h.field[h.key]=await hash(h.actual);return;}
   const [sourceSha256,submittedSha256]=await Promise.all([hash(h.source),hash(h.actual)]);
   check(sourceSha256===submittedSha256,'Copied source/submission bytes diverged');
   Object.assign(h.field,{sourceSha256,submittedSha256});
   if(h.prefixBytes!==undefined){
    check(h.prefixBytes<=h.source.byteLength,'Original roof prefix exceeds owner storage');
    const [sourcePrefixSha256,submittedPrefixSha256]=await Promise.all([hash(h.source.subarray(0,h.prefixBytes)),hash(h.actual.subarray(0,h.prefixBytes))]);
    Object.assign(h.field,{sourcePrefixSha256,submittedPrefixSha256});
   }
  }));return receipt;
 }};
}
