import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const profileFor=(family,role,control)=>control?[.25,.92,.035]:role==='reference'?[.6,.32,.008]:family==='order-station'?[6,0,.0005]:[9,0,.002];
const profile=value=>value.map(Math.fround);

export function validateOrderCapture(metadata){
 if(!metadata.id?.startsWith('order-'))return;
 const proof=metadata.nativeProof;assert(proof?.kind==='material-order','Missing actual material-order proof');
 const role=metadata.id.endsWith('-late')?'late':'reference';assert.equal(proof.role,role);assert.equal(proof.family,metadata.id.slice(0,-role.length-1));
 assert.equal(proof.referenceCaseId,proof.family+'-reference');assert.equal(proof.phase,metadata.view);
 assert.equal(proof.expectedSide,proof.family==='order-station'?0:2,'Do not merge FrontSide and DoubleSide families');
 if(!metadata.subjectPresent){assert.equal(proof.rows.length,0);return {passed:true,absent:true};}
 assert(proof.rows.length>0,'Actual material-order subject did not draw');
 const ids=new Set(),tables=new Set(),uniforms=new Set();
 for(const row of proof.rows){
  assert.equal(row.role,role);assert.equal(row.side,proof.expectedSide);assert(row.ownerObjectsMatch&&row.activeTextureRestored,'Owner/sampler state receipt failed');
  assert.equal(row.baseIsStandard,role==='late','Original authored-base classification changed');
  assert.deepEqual(row.values.skinProfile.observed,profile(profileFor(proof.family,role,proof.control)),'Independent actual surface profile differs');
  assert.equal(row.values.skinPlanar.observed,false);assert.equal(row.profile,role==='reference'?'concrete|triplanar':proof.family==='order-station'?'paint|triplanar':'rubber|triplanar');
  assert.deepEqual(Object.keys(row.values).sort(),['skinProfile','skinPlanar','belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength'].sort());
  for(const value of Object.values(row.values))assert.deepEqual(value.observed,value.expected,'Actual native value differs from independently frozen input');
  assert.equal(row.values.belleCloudTime.observed,metadata.view===0?17:29);
  assert.equal(row.values.belleCloudCoverage.observed,Math.fround(metadata.view===0?.37:.61));assert.equal(row.values.belleCloudStrength.observed,Math.fround(metadata.view===0?.21:.33));
  const surface=proof.control||role==='reference'?'concrete':proof.family==='order-station'?'paint':'rubber';
  assert.equal(row.samplers.length,3);for(const sampler of row.samplers){
   const path=sampler.name==='belleCloudNoise'?null:'/belle/skins/'+surface+(sampler.name==='skinColor'?'-color.webp':'-detail.webp');
   assert.equal(sampler.expectedUrl,path);assert.equal(sampler.observedUrl,path);assert(sampler.boundExpected&&Number.isInteger(sampler.unit)&&sampler.unit>=0);
  }
  ids.add(row.materialId);tables.add(row.tableId);uniforms.add(row.profileUniformId);
 }
 assert.equal(ids.size,1,'Actual order target/reference each has one selected material');assert.equal(tables.size,1);assert.equal(uniforms.size,1);
 if(proof.family==='order-wheel')assert.deepEqual(proof.wheelLights,{braking:false,rear:'flash',rearIntensity:1.8,frontIntensity:2.2,frontMaterials:1,rearMaterials:1,beam:false});
 return {passed:true,draws:proof.rows.length,materialIds:[...ids],tableIds:[...tables],profileUniformIds:[...uniforms]};
}

// SHADER_NAME is allowed to differ only as an unused diagnostic definition.
// Every other source byte remains in the comparison; no generic key/source
// canonicalization is proposed or performed in the product.
function unusedDebugName(source){
 const identifiers=source.match(/\bSHADER_NAME\b/g)??[];assert.equal(identifiers.length,1,'Cannot normalize a used or repeated SHADER_NAME');
 assert(/^#define SHADER_NAME[^\r\n]*$/m.test(source));return source.replace(/^#define SHADER_NAME[^\r\n]*$/m,'#define SHADER_NAME __unused_fixture_name__');
}
// The only permitted move is these two complete, unchanged authored blocks.
// In particular, lines inside either helper function may not be reordered.
const surfaceVertex=`varying vec3 skinPosition;varying vec3 skinNormal;
#ifdef BELLE_ORIGINAL_SURFACE_COORDS
attribute vec3 originalSurfacePosition;attribute vec3 originalSurfaceNormal;
#endif
`;
const atmosphereVertex=`
varying vec3 belleAtmosphereWorld;
`;
const surfaceFragment=`varying vec3 skinPosition;varying vec3 skinNormal;uniform sampler2D skinColor;uniform sampler2D skinDetail;uniform vec3 skinProfile;uniform bool skinPlanar;
vec3 skinWeights(){
 vec3 w=normalize(skinNormal);w*=w;w*=w;w*=w;return w/max(.0001,w.x+w.y+w.z);
}
vec3 sampleSkin(sampler2D tex,vec3 p,vec3 dx,vec3 dy,vec3 w){
 if(skinPlanar)return textureGrad(tex,p.xz,dx.xz,dy.xz).rgb;
 vec3 value=vec3(0.);
 if(w.x>0.)value+=textureGrad(tex,p.zy,dx.zy,dy.zy).rgb*w.x;
 if(w.y>0.)value+=textureGrad(tex,p.xz,dx.xz,dy.xz).rgb*w.y;
 if(w.z>0.)value+=textureGrad(tex,p.xy,dx.xy,dy.xy).rgb*w.z;
 return value;
}
`;
const atmosphereFragment=`
varying vec3 belleAtmosphereWorld;
uniform sampler2D belleCloudNoise;
uniform vec3 belleSunDirection;
uniform float belleCloudTime,belleCloudCoverage,belleCloudStrength,belleAirStrength;
float belleCloudShade(){
 if(belleCloudStrength<.0001||belleSunDirection.y<.08)return 1.0;
 vec2 projected=belleAtmosphereWorld.xz+belleSunDirection.xz*(900.0-belleAtmosphereWorld.y)/max(.18,belleSunDirection.y);
 vec2 uv=projected*.00048+vec2(belleCloudTime*.00028,belleCloudTime*.00011);
 float field=texture2D(belleCloudNoise,uv).r;
 float threshold=mix(.75,.34,belleCloudCoverage);
 float shade=smoothstep(threshold-.035,threshold+.14,field);
 return 1.0-shade*belleCloudStrength;
}
`;
function knownBlockOrder(source){
 const fragment=source.includes('uniform sampler2D skinColor;'),surface=fragment?surfaceFragment:surfaceVertex,atmosphere=fragment?atmosphereFragment:atmosphereVertex;
 assert.equal(source.split(surface).length,2,'Exact complete surface declaration/helper block changed');assert.equal(source.split(atmosphere).length,2,'Exact complete atmosphere declaration/helper block changed');
 const surfaceFirst=source.includes(surface+atmosphere),atmosphereFirst=source.includes(atmosphere+surface);assert(surfaceFirst!==atmosphereFirst,'Known source blocks must be contiguous in exactly one order');
 return {canonical:atmosphereFirst?source.replace(atmosphere+surface,surface+atmosphere):source,surfaceFirst,surfaceSha256:sha(surface),atmosphereSha256:sha(atmosphere)};
}
export function compareOrderStage(before,after){
 const a=unusedDebugName(before),b=unusedDebugName(after),indexA=a.indexOf('void main()'),indexB=b.indexOf('void main()');assert(indexA>=0&&indexB>=0,'Native shader main is missing');
 assert.equal(a.slice(indexA),b.slice(indexB),'Native material-order main body changed');
 const first=knownBlockOrder(a),second=knownBlockOrder(b);assert.equal(first.canonical,second.canonical,'Native source changed beyond the exact two complete top-level blocks');
 for(const marker of ['varying vec3 skinPosition;varying vec3 skinNormal;','varying vec3 belleAtmosphereWorld;']){assert.equal(a.split(marker).length,2);assert.equal(b.split(marker).length,2);}
 return {passed:true,exactAfterUnusedName:a===b,beforeSha256:sha(before),afterSha256:sha(after),mainSha256:sha(a.slice(indexA)),canonicalStageSha256:sha(first.canonical),surfaceBlockSha256:first.surfaceSha256,atmosphereBlockSha256:first.atmosphereSha256,beforeSurfaceFirst:first.surfaceFirst,afterSurfaceFirst:second.surfaceFirst};
}

export function validateOrderBindings(late,reference){
 validateOrderCapture(late);validateOrderCapture(reference);
 const a=late.nativeProof,b=reference.nativeProof;assert.equal(a.family,b.family);assert.equal(a.role,'late');assert.equal(b.role,'reference');assert.equal(late.output,reference.output);assert.equal(late.side,reference.side);
 const x=a.rows[0],y=b.rows[0];assert(x&&y);assert.notEqual(x.materialId,y.materialId);assert.notEqual(x.tableId,y.tableId);assert.notEqual(x.profileUniformId,y.profileUniformId);assert.equal(x.ownerId,y.ownerId);
 if(late.side==='candidate')assert.equal(x.programId,y.programId,'Candidate actual native family did not share a program');else assert.notEqual(x.programId,y.programId,'Baseline order split was not exercised');
 return {passed:true,lateProgram:x.programId,referenceProgram:y.programId,lateTable:x.tableId,referenceTable:y.tableId,lateProfileUniform:x.profileUniformId,referenceProfileUniform:y.profileUniformId,ownerId:x.ownerId};
}
