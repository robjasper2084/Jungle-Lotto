// Modeled proof-contract inputs, not native render or performance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateBoatOrderCapture,validateBoatOrderBindings,compareBoatOrderStage,compareBoatAllMaterials,boatOrderCaseIds} from './boat-order-native-proof.mjs';

const f32=values=>values.map(Math.fround);
function capture(id='boat-order-response-late',side='candidate',control=false){
 const reference=id.endsWith('-reference'),vessel=reference?'reference':id.split('-')[2],family=id.includes('response')?'boat-order-response':'boat-order-ride',surface=reference?'concrete':vessel==='response'?'paint':vessel==='offshore'?'leather':'rubber',profile=reference?[.6,.32,.008]:vessel==='response'?[6,0,.0005]:vessel==='offshore'?[12,0,.001]:[9,0,.002],count=reference?1:2,materials=vessel==='response'?2:1;
 const direction=[.41,.84,.35],length=Math.hypot(...direction),values={skinProfile:f32(control?[.25,.92,.035]:profile),skinPlanar:false,belleSunDirection:f32(direction.map(x=>x/length)),belleCloudTime:17,belleCloudCoverage:Math.fround(.37),belleCloudStrength:Math.fround(.21)},rows=[];
 for(let i=0;i<count;i++){
  const material=reference?30:10+(materials===2?i:0),materialName=reference?'ordinary concrete':vessel==='response'?'Boat painted hull':vessel==='offshore'?'Charcoal marine upholstery':'Hydro cockpit charcoal';
  rows.push({kind:vessel,slot:i,mesh:'actual-mesh-'+i,materialName,materialId:material,programId:side==='candidate'||reference?1:2,side:family.endsWith('response')?0:2,tableId:material+100,profileUniformId:material+200,ownerId:7,ownerObjectsMatch:true,baseIsStandard:!reference,profile:surface+'|triplanar',values:Object.fromEntries(Object.entries(values).map(([name,value])=>[name,{expected:value,observed:value}])),samplers:['skinColor','skinDetail','belleCloudNoise'].map((name,unit)=>{const url=name==='belleCloudNoise'?null:'/belle/skins/'+(control?'concrete':surface)+(name==='skinColor'?'-color.webp':'-detail.webp');return {name,unit,textureId:unit+90,expectedUrl:url,observedUrl:url,boundExpected:true};}),activeTextureRestored:true});
 }
 return {id,side,view:0,output:'screen-msaa4',subjectPresent:true,contributionPresent:true,nativeProof:{kind:'boat-material-order',family,vessel,activeKind:vessel,referenceCaseId:family+'-reference',phase:0,control,expectedSide:family.endsWith('response')?0:2,expectedMaterialCount:materials,geometry:reference?undefined:[{slot:0},{slot:1},{slot:2}],selectedMeshes:rows.map(row=>row.mesh),rows,allRows:rows.map(row=>({kind:vessel,slot:row.slot,mesh:row.mesh,materialName:row.materialName,materialType:'MeshStandardMaterial',materialId:row.materialId,programId:row.programId,group:0,side:row.side,profile:row.profile,uniforms:values}))}};
}
const copy=value=>structuredClone(value);

test('all five actual case schemas preserve side, independent profiles and native binding inventories',()=>{
 assert.equal(boatOrderCaseIds.length,5);for(const id of boatOrderCaseIds)for(const side of ['baseline','candidate'])assert(validateBoatOrderCapture(capture(id,side)).passed);
 assert(validateBoatOrderCapture(capture('boat-order-response-late','candidate',true)).passed);assert(validateBoatOrderCapture(capture('boat-order-offshore-late','candidate',true)).passed);
});
test('both independent response hull materials must submit with distinct live tables',()=>{
 const good=capture();for(const field of ['materialId','tableId','profileUniformId']){const bad=copy(good);bad.nativeProof.rows[1][field]=bad.nativeProof.rows[0][field];assert.throws(()=>validateBoatOrderCapture(bad));}
 const missing=copy(good);missing.nativeProof.rows.pop();assert.throws(()=>validateBoatOrderCapture(missing));
 const substituted=copy(good);substituted.nativeProof.rows[1].materialName='Station white painted cladding';assert.throws(()=>validateBoatOrderCapture(substituted));
});
test('uniform values, actual sampler receipt and original authored-base classification are necessary',()=>{
 const good=capture('boat-order-offshore-late');for(const mutate of [r=>r.values.skinProfile.observed=[9,0,.002],r=>r.samplers[0].boundExpected=false,r=>r.samplers[1].observedUrl='/belle/skins/rubber-detail.webp',r=>r.ownerObjectsMatch=false,r=>r.activeTextureRestored=false,r=>r.baseIsStandard=false]){const bad=copy(good);mutate(bad.nativeProof.rows[0]);assert.throws(()=>validateBoatOrderCapture(bad));}
 const alias=copy(good);alias.nativeProof.allRows[1].slot=alias.nativeProof.allRows[0].slot;assert.throws(()=>validateBoatOrderCapture(alias));
});
test('absence and selected-only removal do not masquerade as visible native submissions',()=>{
 const hidden=capture();hidden.subjectPresent=false;hidden.nativeProof.rows=[];hidden.nativeProof.allRows=[];assert(validateBoatOrderCapture(hidden).absent);
 const removed=capture();removed.contributionPresent=false;removed.nativeProof.rows=[];assert(validateBoatOrderCapture(removed).passed);
 const falseVisible=copy(hidden);falseVisible.subjectPresent=true;assert.throws(()=>validateBoatOrderCapture(falseVisible));
});
test('reference and late materials require the same owner with independent tables and actual2-to1 programs',()=>{
 for(const side of ['baseline','candidate'])assert(validateBoatOrderBindings(capture('boat-order-response-late',side),capture('boat-order-response-reference',side)).passed);
 for(const side of ['baseline','candidate'])assert(validateBoatOrderBindings(capture('boat-order-hydroplane-late',side),capture('boat-order-ride-reference',side)).passed);
 const late=capture(),reference=capture('boat-order-response-reference');reference.nativeProof.rows[0].ownerId=8;assert.throws(()=>validateBoatOrderBindings(late,reference));
 const stale=capture();stale.nativeProof.rows.forEach(row=>row.programId=2);stale.nativeProof.allRows.forEach(row=>row.programId=2);assert.throws(()=>validateBoatOrderBindings(stale,capture('boat-order-response-reference')));
});

const surface=await readFile(new URL('../src/belle/realisticMaterials.ts',import.meta.url),'utf8'),atmosphere=await readFile(new URL('../src/belle/atmosphereShaders.ts',import.meta.url),'utf8');
function unique(text,pattern){const matches=[...text.matchAll(pattern)];assert.equal(matches.length,1);return matches[0][1];}
const surfaceVertex=unique(surface,/shader\.vertexShader=`([\s\S]*?)`\+shader\.vertexShader/g),surfaceFragment=unique(surface,/shader\.fragmentShader=`([\s\S]*?)`\+shader\.fragmentShader/g),atmosphereVertex=unique(atmosphere,/const WORLD_VERTEX=`([\s\S]*?)`;/g),atmosphereFragment=unique(atmosphere,/const WORLD_FRAGMENT=`([\s\S]*?)`;/g);
function stages(first){return {vertexSource:'#define SHADER_NAME modeled\n'+(first?surfaceVertex+atmosphereVertex:atmosphereVertex+surfaceVertex)+'void main(){gl_Position=vec4(0.);}',fragmentSource:'#define SHADER_NAME modeled\n'+(first?surfaceFragment+atmosphereFragment:atmosphereFragment+surfaceFragment)+'void main(){gl_FragColor=vec4(1.);}'};}
test('all-material source oracle allows only complete known blocks or unchanged non-surface shaders',()=>{
 const before=capture('boat-order-offshore-late','baseline'),after=capture('boat-order-offshore-late','candidate'),programs=[{id:2,linked:true,...stages(false)},{id:1,linked:true,...stages(true)}];assert(compareBoatAllMaterials(before,after,programs).passed);
 const changed=copy(programs);changed[1].fragmentSource=changed[1].fragmentSource.replace('vec4(1.)','vec4(.9)');assert.throws(()=>compareBoatAllMaterials(before,after,changed));
 const missing=copy(after);missing.nativeProof.allRows.pop();assert.throws(()=>compareBoatAllMaterials(before,missing,programs));
 assert(compareBoatOrderStage('#define SHADER_NAME A\nvoid main(){}','#define SHADER_NAME B\nvoid main(){}').passed);
 assert.throws(()=>compareBoatOrderStage('#define SHADER_NAME A\nvoid main(){float a=1.;}','#define SHADER_NAME A\nvoid main(){float a=2.;}'));
 assert.throws(()=>compareBoatOrderStage('#define SHADER_NAME A\nSHADER_NAME\nvoid main(){}','#define SHADER_NAME B\nSHADER_NAME\nvoid main(){}'));
});
