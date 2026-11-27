/** Accept only the exact display index set shipped with the pinned original
 * asset, selected by the original camera policy and restored after the render. */
import assert from 'node:assert/strict';
const same=(a,b,label)=>assert.deepStrictEqual(a,b,label);
const whole=n=>Number.isSafeInteger(n)&&n>=0;
const hash=value=>assert.match(value??'',/^[a-f0-9]{64}$/,'Missing exact display-index SHA-256');
const roofPath=p=>/107227742_STAGED_LOD[012](?:%|\/|#)/.test(p)&&p.includes('PatinatedCopperPanels');
const attributeFields=['type','bytes','count','itemSize','normalized','interleaved','offset','stride','gpuType','usage','meshPerAttribute','sha256'].sort();
function matrix(value,label){assert(Array.isArray(value)&&value.length===16&&value.every(Number.isFinite),'Invalid display-index '+label);}
function sphere(value,label){assert(value&&Array.isArray(value.center)&&value.center.length===3&&value.center.every(Number.isFinite)&&Number.isFinite(value.radius)&&value.radius>=0,'Invalid display-index '+label);}
function attribute(value,label){
 assert(value&&typeof value==='object','Missing display-index '+label);same(Object.keys(value).sort(),attributeFields,'Display-index attribute schema changed');
 assert(typeof value.type==='string'&&whole(value.bytes)&&whole(value.count)&&Number.isSafeInteger(value.itemSize)&&value.itemSize>0);
 assert(typeof value.normalized==='boolean'&&typeof value.interleaved==='boolean'&&whole(value.offset)&&Number.isSafeInteger(value.stride)&&value.stride>0&&value.offset+value.itemSize<=value.stride);
 if(!value.interleaved){assert.equal(value.offset,0);assert.equal(value.stride,value.itemSize);}
 assert(Number.isSafeInteger(value.usage));assert.equal(value.meshPerAttribute,null,'Instanced display-index storage');hash(value.sha256);
}
function pinnedIndex(value,pin,label){
 attribute(value,label);assert(pin,'Missing immutable display-index pin');
 for(const key of ['type','bytes','count','sha256'])same(value[key],pin[key],'Pinned display-index '+label+' '+key+' differs');
 assert(['Uint16Array','Uint32Array'].includes(value.type));assert.equal(value.bytes,value.count*(value.type==='Uint16Array'?2:4));
 assert.equal(value.itemSize,1);assert.equal(value.normalized,false);assert.equal(value.interleaved,false);assert.equal(value.offset,0);assert.equal(value.stride,1);assert(value.count>0&&value.count%3===0);
}
function callbacks(value,expected,count,label){
 assert(Array.isArray(value)&&value.length===count,'Missing original display-index '+label+' callbacks');
 for(const item of value){same(Object.keys(item),['functionSha256']);hash(item.functionSha256);}
 if(expected)same(value,expected,'Original display-index '+label+' callback code changed');
}
function registrationBounds(matrixWorld,sourceSphere,error){
 const a=matrixWorld,[x,y,z]=sourceSphere.center;
 const columns=Math.max(...[0,4,8].map(i=>Math.abs(a[i])+Math.abs(a[i+1])+Math.abs(a[i+2])));
 const rows=Math.max(...[0,1,2].map(i=>Math.abs(a[i])+Math.abs(a[i+4])+Math.abs(a[i+8])));
 const scale=Math.sqrt(rows*columns),w=1/(a[3]*x+a[7]*y+a[11]*z+a[15]);
 return {scale,error:scale*(error??Infinity),bounds:{center:[(a[0]*x+a[4]*y+a[8]*z+a[12])*w,(a[1]*x+a[5]*y+a[9]*z+a[13])*w,(a[2]*x+a[6]*y+a[10]*z+a[14])*w],radius:sourceSphere.radius*scale}};
}
function selection(value){
 const p=value.camera.projectionMatrix,eye=value.camera.matrixWorldInverse,c=value.bounds.center,error=value.error;
 const near=-(eye[2]*c[0]+eye[6]*c[1]+eye[10]*c[2]+eye[14])-value.bounds.radius;
 const pixelScale=Math.hypot(value.width*(Math.abs(p[0])+1+Math.abs(p[8])),value.height*(Math.abs(p[5])+1+Math.abs(p[9])))*.5;
 const subpixel=Number.isFinite(error)&&error>=0&&Number.isFinite(near)&&near>64+error&&Number.isFinite(pixelScale)&&pixelScale>0&&error*pixelScale<=(near-error)*.5;
 return {near,pixelScale,selected:!value.splitActive&&value.perspective&&!value.arrayCamera&&!value.xrPresenting&&value.target===null&&value.visible&&!value.castShadow&&subpixel?'reduced':'full'};
}

export function assertDisplayIndexSubmittedOwner(draw,object,sceneRoot,pins){
 const proof=draw?.displayIndexSubmission,source=object?.geometry;assert(proof&&source,'Missing display-index submitted owner proof');
 assert.equal(proof.kind,'exact-original-display-index');assert.equal(proof.settled,true,'Display-index byte/callback copies are unsettled');
 assert(draw.submittedOwnership==null&&draw.scopedSubmission==null,'Display-index proof conflicts with another native owner');
 assert.equal(pins?.schema,1);assert.equal(pins.metadata?.version,1);assert(Array.isArray(pins.entries));
 same(proof.assetBinding,{source:pins.source,assets:pins.assets,metadata:pins.metadata},'Immutable display-index asset/source binding changed');
 hash(pins.source?.sha256);for(const key of ['metadata','encodedIndices','model']){assert(typeof pins.assets?.[key]?.path==='string'&&whole(pins.assets[key].bytes));hash(pins.assets[key].sha256);}
 const matches=pins.entries.filter(entry=>entry.key===proof.assetKey);assert.equal(matches.length,1,'Display-index association is missing or ambiguous');const pin=matches[0];
 same(proof.entry,pin.entry,'Original display-index metadata entry changed');assert.equal(proof.assetKey,pin.entry.mesh+':'+pin.entry.primitive);
 same(draw.path,object.path,'Display-index owner path changed');assert.equal(object.isRoof,false);assert(!roofPath(draw.path),'Display-index proof cannot cover a roof exception');
 assert.equal(object.type,'Mesh');assert.equal(object.count,1);assert.equal(object.instanceMatrix,null);assert.equal(object.instanceColor,null);assert.equal(object.morphTargetInfluences,null);
 assert.equal(proof.objectType,'Mesh');assert.equal(proof.objectCount,1);assert.equal(proof.instanceMatrix,null);assert.equal(proof.instanceColor,null);same(proof.objectFlags,{skinned:false,instanced:false,batched:false});
 same(proof.identities,{quietIsFull:true,submittedIsReduced:true,submittedIsObjectGeometry:true,attributeObjectsShared:true,sourceAndDisplayIndexDistinct:true,restoredIsFull:true},'Original full/display geometry identity evidence is incomplete');
 assert.equal(proof.actualGroupRecorded,true);assert.equal(proof.actualGroup,null);assert.equal(draw.submittedGroup,null,'Actual native display-index group was not observed as null');
 assert.equal(draw.pass,'color','Original display indices cannot prove an auxiliary/shadow draw');
 assert.equal(object.visible,true);assert.equal(object.castShadow,false);assert.equal(draw.castShadow,false);
 same(proof.sourceGeometry,source,'Complete original full geometry bytes/layout/bounds changed');
 assert.equal(source.type,'BufferGeometry');same(source.groups,[]);same(source.morphAttributes,{});assert.equal(source.morphTargetsRelative,false);same(source.drawRange,{start:0,count:'Infinity'});
 const submitted=proof.submittedGeometry;assert(submitted,'Missing actual reduced geometry');
 same(Object.keys(submitted).sort(),Object.keys(source).sort(),'Display-index geometry schema changed');assert.equal(submitted.type,'BufferGeometry');same(submitted.groups,[]);same(submitted.morphAttributes,{});assert.equal(submitted.morphTargetsRelative,false);same(submitted.drawRange,{start:0,count:'Infinity'});
 same(submitted.boundingBox,source.boundingBox,'Original display-index bounding box changed');same(submitted.boundingSphere,source.boundingSphere,'Original display-index bounding sphere changed');
 assert(source.attributes?.position);same(Object.keys(submitted.attributes).sort(),Object.keys(source.attributes).sort(),'Display-index attribute membership changed');
 for(const name of Object.keys(source.attributes)){attribute(source.attributes[name],'source '+name);attribute(submitted.attributes[name],'submitted '+name);same(submitted.attributes[name],source.attributes[name],'Complete display-index attribute bytes/layout changed: '+name);}
 assert.equal(source.attributes.position.count,pin.entry.vertices);assert.equal(source.index?.count,pin.entry.originalCount);assert.equal(submitted.index?.count,pin.entry.count);assert(pin.entry.count<pin.entry.originalCount,'Display-index proof does not reduce original indices');
 pinnedIndex(source.index,pin.sourceIndex,'full source');pinnedIndex(submitted.index,pin.decodedIndex,'actual reduced');assert.equal(submitted.index.type,'Uint32Array');
 assert.equal(submitted.index.usage,35044,'Original reduced index usage changed');assert.equal(submitted.index.gpuType,1015,'Original reduced index GPU type changed');
 same(draw.submittedGeometry,{positionCount:pin.entry.vertices,indexCount:pin.entry.count,start:0,count:'Infinity'},'Display-index proof differs from native actual submitted range/count');
 assert(draw.calls===0||draw.calls===1,'Unexpected native display-index call count');assert.equal(draw.lines,0);assert.equal(draw.points,0);assert.equal(draw.triangles,pin.entry.count/3*draw.calls,'Native display-index triangle count does not match actual indices/calls');
 const r=proof.registration;assert(r,'Missing original display-index registration');same(r.path,object.path,'Original display-index registered source path changed');same(r.association,{meshes:pin.entry.mesh,primitives:pin.entry.primitive});matrix(r.matrixWorld,'registration matrix');same(r.matrixWorld,object.matrixWorld,'Original display-index registration/source matrix changed');
 sphere(r.sourceSphere,'source sphere');same(r.sourceSphere,source.boundingSphere);const computed=registrationBounds(r.matrixWorld,r.sourceSphere,pin.entry.error);sphere(r.bounds,'cached bounds');same({bounds:r.bounds,scale:r.scale,error:r.error},computed,'Original display-index scaled bounds/error changed');
 const view=proof.selection;assert(view,'Missing original display-index camera selection');
 same({perspective:view.perspective,arrayCamera:view.arrayCamera,xrPresenting:view.xrPresenting,target:view.target,splitActive:view.splitActive,visible:view.visible,castShadow:view.castShadow},{perspective:true,arrayCamera:false,xrPresenting:false,target:null,splitActive:false,visible:true,castShadow:false},'Original display-index selection gates differ');
 // These are the original fixed diagnostic drawing-buffer dimensions. Smaller
 // invented dimensions must never be accepted to relax the half-pixel bound.
 assert.equal(view.width,1280);assert.equal(view.height,800);
 same(view.bounds,r.bounds);same(view.error,r.error);assert(view.camera);
 same(Object.keys(view.camera).sort(),['matrixWorld','matrixWorldInverse','projectionMatrix'].sort());
 for(const name of ['matrixWorld','matrixWorldInverse','projectionMatrix']){matrix(view.camera[name],'selection '+name);same(view.camera[name],draw.camera?.[name],'Display-index selector camera differs from actual native camera');}
 same({near:view.near,pixelScale:view.pixelScale,selected:view.selected},selection(view),'Display-index selection differs from exact original projection policy');assert.equal(view.selected,'reduced','Original projection policy did not select the reduced asset');
 same(proof.restored,{geometryIsFull:true,sourceDrawRange:source.drawRange,matrixWorld:object.matrixWorld},'Original full display-index geometry restoration is incomplete');
 assert(sceneRoot&&sceneRoot.type==='Scene'&&sceneRoot.path==='Scene#0','Original display-index root scene is missing');
 callbacks(proof.callbacks?.object,object.callbacks,4,'mesh');callbacks(proof.callbacks?.scene,sceneRoot.callbacks,4,'composed scene');callbacks(proof.callbacks?.registeredScene,null,4,'registered selector scene');callbacks(proof.callbacks?.selector,null,1,'prepareDistant');
 return true;
}
