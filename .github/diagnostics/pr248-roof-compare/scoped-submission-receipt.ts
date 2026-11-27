/** Read-only proof for an original ordinary mesh's camera-scoped draw range.
 * Bytes and callback text are copied synchronously at the actual submission.
 * Original render/shadow hooks alone restore the range. Hashing is deferred
 * until after the unchanged native capture/fence sequence. */
type Hash=(bytes:Uint8Array)=>Promise<string>;
type Range={start:number;count:number|'Infinity'};
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'] as const;
function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const whole=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
const sameRange=(a:Range,b:Range)=>Object.is(a.start,b.start)&&Object.is(a.count,b.count);
function range(value:any,label:string):Range{
 check(value&&whole(value.start),'Invalid '+label+' start');
 const count=value.count===Infinity||value.count==='Infinity'?'Infinity':value.count;
 check(count==='Infinity'||whole(count),'Invalid '+label+' count');
 return {start:value.start,count};
}
function active(value:Range,total:number,label:string){
 check(value.start<=total,'Invalid '+label+' start outside storage');
 const end=value.count==='Infinity'?total:value.start+value.count;
 check(Number.isSafeInteger(end)&&end>=value.start&&end<=total,'Invalid '+label+' end outside storage');
 return {start:value.start,count:end-value.start};
}
function copyAttribute(attribute:any,label:string){
 check(attribute&&typeof attribute==='object','Missing '+label);
 const interleaved=attribute.isInterleavedBufferAttribute===true,data=interleaved?attribute.data:attribute,array=data?.array;
 check(!attribute.isInstancedBufferAttribute&&!data?.isInstancedInterleavedBuffer&&attribute.meshPerAttribute==null&&data?.meshPerAttribute==null,'Instanced '+label+' is unsupported');
 check(ArrayBuffer.isView(array)&&!(array instanceof DataView)&&whole((array as any).length)&&Number.isSafeInteger((array as any).BYTES_PER_ELEMENT),'Unsupported '+label+' array');
 check(!(array instanceof BigInt64Array)&&!(array instanceof BigUint64Array),'Unsupported '+label+' bigint storage');
 const typed=array as any,itemSize=attribute.itemSize,offset=interleaved?attribute.offset:0,stride=interleaved?data.stride:itemSize;
 check(whole(attribute.count)&&Number.isSafeInteger(itemSize)&&itemSize>0&&whole(offset)&&Number.isSafeInteger(stride)&&stride>0&&offset+itemSize<=stride,'Invalid '+label+' layout');
 check(attribute.count===typed.length/stride&&typeof attribute.normalized==='boolean','Incomplete '+label+' storage');
 check(Number.isSafeInteger(data.usage),'Invalid '+label+' usage');
 const raw=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength).slice();
 const field:any={type:typed.constructor.name,bytes:raw.byteLength,count:attribute.count,itemSize,normalized:attribute.normalized,
  interleaved,offset,stride,gpuType:attribute.gpuType??null,usage:data.usage,meshPerAttribute:attribute.meshPerAttribute??null,sha256:null};
 return {field,raw};
}

export function snapshotScopedSubmission(submitted:any,object:any,group:unknown,quietRange:any,roof=false){
 if(submitted!==object?.geometry)return null;
 check(submitted&&quietRange!==submitted.drawRange,'Missing independent pre-render quiet range');
 const sourceRange=range(quietRange,'quiet range'),submittedRange=range(submitted.drawRange,'submitted range');
 if(sameRange(sourceRange,submittedRange))return null;
 check(roof===false,'Scoped range proof cannot cover an Aquarium roof exception');
 check(object.isMesh===true&&object.type==='Mesh'&&!object.isSkinnedMesh&&!object.isInstancedMesh&&!object.isBatchedMesh,'Scoped range owner is not an ordinary Mesh');
 check(object.count===1&&object.instanceMatrix==null&&object.instanceColor==null,'Scoped range owner has instance/count state');
 check(!submitted.isInstancedBufferGeometry&&submitted.type!=='InstancedBufferGeometry','Scoped range geometry is instanced');
 check(group===null,'Scoped range requires an observed null native group');
 check(Array.isArray(submitted.groups)&&submitted.groups.length===0,'Scoped range source groups are not empty');
 check(submitted.morphAttributes&&Object.keys(submitted.morphAttributes).length===0&&object.morphTargetInfluences==null,'Scoped range morph state is unsupported');
 check(typeof submitted.type==='string'&&submitted.type.length>0,'Missing scoped geometry type');
 const names=Object.keys(submitted.attributes).sort(),copies:{field:any;raw:Uint8Array}[]=[],attributes:any={};
 check(names.includes('position'),'Scoped range position storage is missing');
 for(const name of names){const item=copyAttribute(submitted.attributes[name],'attribute '+name);attributes[name]=item.field;copies.push(item);}
 const positionCount=attributes.position.count;check(Number.isSafeInteger(positionCount)&&positionCount>0,'Scoped range source positions are empty');
 let index:any=null,indexCount=0;
 if(submitted.index){
  const item=copyAttribute(submitted.index,'index');index=item.field;indexCount=index.count;
  check(!index.interleaved&&index.itemSize===1&&!index.normalized&&['Uint8Array','Uint16Array','Uint32Array'].includes(index.type),'Unsupported scoped index representation');
  check(indexCount>0,'Scoped range source index is empty');copies.push(item);
 }
 const total=index?indexCount:positionCount,sourceActive=active(sourceRange,total,'quiet range');
 check(sourceActive.start%3===0&&sourceActive.count%3===0,'Original scoped triangle range is unaligned');
 check(submittedRange.count!=='Infinity','Changed scoped range must have a finite submitted count');
 const submittedActive=active(submittedRange,total,'submitted range');
 check(submittedActive.start%3===0&&submittedActive.count%3===0,'Submitted scoped triangle range is unaligned');
 check(submittedActive.start>=sourceActive.start&&submittedActive.start+submittedActive.count<=sourceActive.start+sourceActive.count,'Submitted scope is outside the original active range');
 const callbackReferences=callbackNames.map(name=>{
  check(typeof object[name]==='function','Missing original '+name+' callback');
  return object[name];
 });
 const callbackCopies=callbackReferences.map(callback=>new TextEncoder().encode(JSON.stringify(Function.prototype.toString.call(callback))));
 const receipt:any={kind:'exact-original-scoped-range',objectType:'Mesh',objectCount:1,instanceMatrix:null,instanceColor:null,
  objectFlags:{skinned:false,instanced:false,batched:false},geometryType:submitted.type,
  sourcePositionCount:positionCount,sourceIndexCount:indexCount,sourceDrawRange:sourceRange,sourceActive,
  submittedDrawRange:submittedRange,submittedActive,actualGroupRecorded:true,actualGroup:null,sourceGroups:[],
  attributes,index,callbacks:callbackNames.map(()=>({functionSha256:null})),restoredRange:null,settled:false};
 let restored=false,settlement:Promise<any>|null=null;
 function restoredRange(){
  check(object.geometry===submitted,'Original scoped geometry identity was not restored');
  const actual=range(submitted.drawRange,'restored range');
  check(sameRange(actual,sourceRange),'Original scoped quiet range was not restored');
  for(let i=0;i<callbackNames.length;i++)check(object[callbackNames[i]]===callbackReferences[i],'Original scoped callback identity changed: '+callbackNames[i]);
  return actual;
 }
 return {receipt,
  assertRestored(){
   restored=false;receipt.restoredRange=null;
   const actual=restoredRange();receipt.restoredRange={...actual};restored=true;return receipt.restoredRange;
  },
  settle(hash:Hash){
   if(settlement)return settlement;
   settlement=(async()=>{
    try{
     check(restored,'Scoped range restoration was not proven after render');restoredRange();
     // Await every started hash even on failure. The retained nonenumerable
     // settleOwners closure must not retain synchronous geometry copies.
     const outcomes=await Promise.allSettled([...copies.map(item=>Promise.resolve().then(()=>hash(item.raw))),
      ...callbackCopies.map(bytes=>Promise.resolve().then(()=>hash(bytes)))]);
     const failure=outcomes.find(item=>item.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
     const values=outcomes.map(item=>{check(item.status==='fulfilled','Missing scoped hash settlement');return item.value;});
     check(values.every(value=>/^[a-f0-9]{64}$/.test(value)),'Invalid scoped source byte/callback hash');
     // Hashing yields to the browser. Require the same restored source and
     // callback references again before accepting the synchronous snapshot.
     restoredRange();
     for(let i=0;i<copies.length;i++)copies[i].field.sha256=values[i];
     for(let i=0;i<callbackCopies.length;i++)receipt.callbacks[i].functionSha256=values[copies.length+i];
     receipt.settled=true;return receipt;
    }finally{copies.length=0;callbackCopies.length=0;}
   })();
   return settlement;
  },
 };
}
