/** Additional exact evidence for original per-camera temporary draw ranges.
 * The original row remains authoritative, including every zero-triangle call.
 * This validator never substitutes the quiet range for the submitted range. */
import assert from 'node:assert/strict';
const same=(a,b,label)=>assert.deepStrictEqual(a,b,label);
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const roofPath=p=>/107227742_STAGED_LOD[012](?:%|\/|#)/.test(p)&&p.includes('PatinatedCopperPanels');
const fields=['type','bytes','count','itemSize','normalized','interleaved','offset','stride','gpuType','usage','meshPerAttribute','sha256'].sort();
function validAttribute(value,label){
 assert(value&&typeof value==='object','Missing scoped '+label);
 same(Object.keys(value).sort(),fields,'Scoped '+label+' schema changed');
 assert(typeof value.type==='string'&&value.type.length>0&&whole(value.bytes)&&whole(value.count));
 assert(Number.isSafeInteger(value.itemSize)&&value.itemSize>0&&typeof value.normalized==='boolean'&&typeof value.interleaved==='boolean');
 assert(whole(value.offset)&&Number.isSafeInteger(value.stride)&&value.stride>0&&value.offset+value.itemSize<=value.stride);
 if(!value.interleaved){assert.equal(value.offset,0);assert.equal(value.stride,value.itemSize);}
 assert(Number.isSafeInteger(value.usage));assert.equal(value.meshPerAttribute,null,'Scoped instanced attribute is unsupported');
 assert.match(value.sha256??'',/^[a-f0-9]{64}$/,'Missing complete scoped '+label+' byte hash');
}
function active(range,total,label){
 assert(range&&whole(range.start)&&range.start<=total,'Invalid '+label+' start');
 assert(range.count==='Infinity'||whole(range.count),'Invalid '+label+' count');
 const end=range.count==='Infinity'?total:range.start+range.count;
 assert(Number.isSafeInteger(end)&&end>=range.start&&end<=total,'Invalid '+label+' end');
 return {start:range.start,count:end-range.start};
}
export function assertScopedSubmittedOwner(draw,object){
 const proof=draw?.scopedSubmission,source=object?.geometry;
 assert(proof&&source,'Missing scoped native owner proof');
 assert.equal(proof.kind,'exact-original-scoped-range');assert.equal(proof.settled,true,'Scoped copy hashes are not settled');
 assert(draw.submittedOwnership==null,'Scoped proof cannot replace shared-owner proof');
 same(draw.path,object.path,'Scoped owner path changed');
 assert.equal(object.isRoof,false);assert(!roofPath(draw.path),'Scoped proof cannot cover a roof exception');
 assert.equal(object.type,'Mesh');assert.equal(object.count,1,'Scoped owner count is not one ordinary Mesh');
 assert.equal(object.instanceMatrix,null);assert.equal(object.instanceColor,null);assert.equal(object.morphTargetInfluences,null);
 same(source.morphAttributes,{},'Scoped source morph storage is unsupported');
 assert.notEqual(source.type,'InstancedBufferGeometry');
 assert.equal(proof.objectType,'Mesh');assert.equal(proof.objectCount,1);assert.equal(proof.instanceMatrix,null);assert.equal(proof.instanceColor,null);
 same(proof.objectFlags,{skinned:false,instanced:false,batched:false},'Scoped object flags changed');
 assert.equal(proof.geometryType,source.type);same(source.groups,[]);same(proof.sourceGroups,[]);
 assert.equal(proof.actualGroupRecorded,true,'Missing actual native group observation');assert.equal(proof.actualGroup,null,'Scoped actual native group is not null');
 assert(Object.hasOwn(draw,'submittedGroup'),'Actual direct-call group was not recorded');same(draw.submittedGroup,proof.actualGroup,'Actual direct-call group differs from scoped proof');
 same(Object.keys(proof.attributes).sort(),Object.keys(source.attributes).sort(),'Scoped attribute membership changed');
 assert(proof.attributes.position,'Scoped position storage is missing');
 for(const name of Object.keys(source.attributes)){
  validAttribute(proof.attributes[name],'attribute '+name);validAttribute(source.attributes[name],'source attribute '+name);
  same(proof.attributes[name],source.attributes[name],'Complete scoped attribute bytes/layout changed: '+name);
 }
 if(source.index){
  validAttribute(proof.index,'index');validAttribute(source.index,'source index');same(proof.index,source.index,'Complete scoped index bytes/layout changed');
  assert(!proof.index.interleaved&&proof.index.itemSize===1&&!proof.index.normalized&&['Uint8Array','Uint16Array','Uint32Array'].includes(proof.index.type));
 }else same(proof.index,null);
 const positions=source.attributes.position.count,indices=source.index?.count??0,total=source.index?indices:positions;
 assert(positions>0&&whole(positions)&&whole(indices)&&total>0);assert.equal(proof.sourcePositionCount,positions);assert.equal(proof.sourceIndexCount,indices);
 same(proof.sourceDrawRange,source.drawRange,'Scoped quiet range differs from the unchanged scene');
 same(proof.restoredRange,source.drawRange,'Original scoped range restoration is missing or different');
 const sourceActive=active(source.drawRange,total,'scoped quiet range');same(proof.sourceActive,sourceActive);
 assert(sourceActive.start%3===0&&sourceActive.count%3===0,'Original scoped triangle range is unaligned');
 assert(proof.submittedDrawRange.count!=='Infinity','Scoped actual range is not finite');
 const submittedActive=active(proof.submittedDrawRange,total,'scoped submitted range');same(proof.submittedActive,submittedActive);
 assert(submittedActive.start%3===0&&submittedActive.count%3===0,'Submitted scoped triangle range is unaligned');
 assert(submittedActive.start>=sourceActive.start&&submittedActive.start+submittedActive.count<=sourceActive.start+sourceActive.count,'Scoped actual range is outside original active range');
 assert(draw.calls===0||draw.calls===1,'Scoped ordinary Mesh must record zero or one native call');
 assert.equal(draw.lines,0,'Scoped triangle proof cannot cover native lines');assert.equal(draw.points,0,'Scoped triangle proof cannot cover native points');
 assert.equal(draw.triangles,submittedActive.count/3*draw.calls,'Scoped actual triangle counter differs from its submitted index/vertex range');
 assert.notDeepStrictEqual(proof.submittedDrawRange,source.drawRange,'Scoped proof has no actual range change');
 same(draw.submittedGeometry,{positionCount:positions,indexCount:indices,...proof.submittedDrawRange},'Scoped proof does not describe actual submitted geometry/range');
 assert(Array.isArray(proof.callbacks)&&proof.callbacks.length===4&&Array.isArray(object.callbacks)&&object.callbacks.length===4);
 for(const callback of proof.callbacks){same(Object.keys(callback),['functionSha256']);assert.match(callback.functionSha256??'',/^[a-f0-9]{64}$/,'Missing original scoped callback hash');}
 same(proof.callbacks,object.callbacks,'Original scoped callback text changed');
 return true;
}
