import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareOrderStage} from './material-order-native-proof.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const cases={
 'boat-order-response-late':{family:'boat-order-response',vessel:'response',side:0,materials:2,draws:2,surface:'paint',profile:[6,0,.0005],names:['Boat painted hull']},
 'boat-order-response-reference':{family:'boat-order-response',vessel:'reference',side:0,materials:1,draws:1,surface:'concrete',profile:[.6,.32,.008],names:['ordinary concrete']},
 'boat-order-offshore-late':{family:'boat-order-ride',vessel:'offshore',side:2,materials:1,draws:2,surface:'leather',profile:[12,0,.001],names:['Charcoal marine upholstery']},
 'boat-order-hydroplane-late':{family:'boat-order-ride',vessel:'hydroplane',side:2,materials:1,draws:2,surface:'rubber',profile:[9,0,.002],names:['Hydro cockpit charcoal']},
 'boat-order-ride-reference':{family:'boat-order-ride',vessel:'reference',side:2,materials:1,draws:1,surface:'concrete',profile:[.6,.32,.008],names:['ordinary concrete']},
};
const names=['skinProfile','skinPlanar','belleSunDirection','belleCloudTime','belleCloudCoverage','belleCloudStrength'];
const unique=(rows,key)=>new Set(rows.map(row=>row[key]));
const vector=values=>values.map(Math.fround);

export function validateBoatOrderCapture(metadata){
 if(!metadata.id?.startsWith('boat-order-'))return;
 const spec=cases[metadata.id];assert(spec,'Unknown actual boat-order case');
 const proof=metadata.nativeProof;assert.equal(proof?.kind,'boat-material-order');
 assert.equal(proof.family,spec.family);assert.equal(proof.vessel,spec.vessel);assert.equal(proof.activeKind,spec.vessel);
 assert.equal(proof.referenceCaseId,spec.family+'-reference');assert.equal(proof.phase,metadata.view);assert([0,1].includes(metadata.view));assert.equal(proof.expectedSide,spec.side);assert.equal(proof.expectedMaterialCount,spec.materials);
 assert(!proof.control||metadata.side==='candidate'&&spec.vessel!=='reference','Control escaped the actual late candidate');
 const present=metadata.subjectPresent&&metadata.contributionPresent!==false;
 assert.equal(proof.rows.length,present?spec.draws:0,'Every selected actual boat primitive must submit exactly once');
 if(!metadata.subjectPresent){assert.equal(proof.allRows.length,0);return {passed:true,absent:true};}
 assert(proof.allRows.length>0,'Actual complete boat/reference rendered no visible primitives');
 const allKeys=proof.allRows.map(row=>row.slot+':'+row.group);assert.equal(new Set(allKeys).size,allKeys.length,'Ambiguous actual boat draw identity');
 for(const row of proof.allRows){assert.equal(row.kind,spec.vessel);assert(Number.isSafeInteger(row.slot)&&row.slot>=0);assert(Number.isSafeInteger(row.programId)&&row.programId>=0);assert(Number.isSafeInteger(row.materialId)&&row.materialId>=0);assert(typeof row.materialName==='string'&&typeof row.materialType==='string');}
 if(spec.vessel!=='reference'){assert(Array.isArray(proof.geometry)&&proof.geometry.length>2,'Complete original boat geometry receipt missing');assert.equal(proof.selectedMeshes.length,2);}
 const direction=metadata.view===0?[.41,.84,.35]:[-.27,.84,.46],length=Math.hypot(...direction);
 const expected={skinProfile:vector(proof.control?[.25,.92,.035]:spec.profile),skinPlanar:false,belleSunDirection:vector(direction.map(x=>x/length)),belleCloudTime:metadata.view===0?17:29,belleCloudCoverage:Math.fround(metadata.view===0?.37:.61),belleCloudStrength:Math.fround(metadata.view===0?.21:.33)};
 for(const row of proof.rows){
  assert.equal(row.kind,spec.vessel);assert.equal(row.side,spec.side);assert(spec.names.includes(row.materialName),'Selected a substitute boat material');assert(row.ownerObjectsMatch&&row.activeTextureRestored);
  assert.equal(row.baseIsStandard,spec.vessel!=='reference');assert.equal(row.profile,spec.surface+'|triplanar');assert.deepEqual(Object.keys(row.values).sort(),[...names].sort());
  for(const name of names){assert.deepEqual(row.values[name].expected,expected[name],'Incorrect independently frozen boat input');assert.deepEqual(row.values[name].observed,expected[name],'Stale actual boat uniform');}
  const surface=proof.control?'concrete':spec.surface;assert.equal(row.samplers.length,3);assert.deepEqual(row.samplers.map(row=>row.name).sort(),['belleCloudNoise','skinColor','skinDetail']);
  for(const sampler of row.samplers){const url=sampler.name==='belleCloudNoise'?null:'/belle/skins/'+surface+(sampler.name==='skinColor'?'-color.webp':'-detail.webp');assert.equal(sampler.expectedUrl,url);assert.equal(sampler.observedUrl,url);assert(sampler.boundExpected&&Number.isInteger(sampler.unit)&&sampler.unit>=0);}
  assert(proof.allRows.some(all=>all.slot===row.slot&&all.materialId===row.materialId&&all.programId===row.programId),'Selected receipt does not correspond to its actual complete-object draw');
 }
 if(present){
  for(const field of ['materialId','tableId','profileUniformId'])assert.equal(unique(proof.rows,field).size,spec.materials,'Independent per-material binding count changed');
  assert.equal(unique(proof.rows,'ownerId').size,1);assert.equal(unique(proof.rows,'programId').size,1,'Compatible late primitives must share their native program');
 }
 return {passed:true,selectedDraws:proof.rows.length,allDraws:proof.allRows.length,materialIds:[...unique(proof.rows,'materialId')],tableIds:[...unique(proof.rows,'tableId')],profileUniformIds:[...unique(proof.rows,'profileUniformId')]};
}

export function validateBoatOrderBindings(late,reference){
 validateBoatOrderCapture(late);validateBoatOrderCapture(reference);
 const a=late.nativeProof,b=reference.nativeProof;assert(a.vessel!=='reference'&&b.vessel==='reference');assert.equal(a.family,b.family);assert.equal(late.side,reference.side);assert.equal(late.view,reference.view);assert.equal(late.output,reference.output);assert(a.rows.length&&b.rows.length);
 const ref=b.rows[0];for(const row of a.rows){
  for(const field of ['materialId','tableId','profileUniformId'])assert.notEqual(row[field],ref[field],'Late and earlier reference aliased their independent binding');
  assert.equal(row.ownerId,ref.ownerId,'Compared different atmosphere owners');
  if(late.side==='candidate')assert.equal(row.programId,ref.programId,'Actual candidate boat family did not share a native program');else assert.notEqual(row.programId,ref.programId,'Baseline boat order split not exercised');
 }
 return {passed:true,latePrograms:[...unique(a.rows,'programId')],referenceProgram:ref.programId,lateTables:[...unique(a.rows,'tableId')],referenceTable:ref.tableId,ownerId:ref.ownerId};
}

function normalizeUnusedName(source){
 assert.equal((source.match(/\bSHADER_NAME\b/g)??[]).length,1,'Cannot normalize a used or repeated shader name');assert(/^#define SHADER_NAME[^\r\n]*$/m.test(source));return source.replace(/^#define SHADER_NAME[^\r\n]*$/m,'#define SHADER_NAME __boat_fixture_name__');
}
export function compareBoatOrderStage(before,after,{surfaceRequired=false}={}){
 if(!surfaceRequired&&before===after)return {passed:true,kind:'exact',beforeSha256:sha(before),afterSha256:sha(after)};
 const beforeSurface=before.includes('varying vec3 skinPosition;varying vec3 skinNormal;'),afterSurface=after.includes('varying vec3 skinPosition;varying vec3 skinNormal;');assert.equal(beforeSurface,afterSurface,'Surface family appeared or disappeared');
 if(surfaceRequired||beforeSurface)return {...compareOrderStage(before,after),kind:'exact-known-block-order'};
 const exact=before===after;assert(exact||normalizeUnusedName(before)===normalizeUnusedName(after),'Non-surface native shader changed');return {passed:true,kind:exact?'exact':'unused-debug-name-only',beforeSha256:sha(before),afterSha256:sha(after)};
}

/** Full native stages and values for every actual visible material, including
 * optical exclusions and untouched station/boat finishes. The only permitted
 * shader difference is the already audited complete top-level block move. */
export function compareBoatAllMaterials(before,after,programs){
 validateBoatOrderCapture(before);validateBoatOrderCapture(after);assert.equal(before.id,after.id);assert.equal(before.view,after.view);assert.equal(before.output,after.output);assert.equal(before.side,'baseline');assert.equal(after.side,'candidate');
 assert.deepEqual(before.nativeProof.geometry,after.nativeProof.geometry,'Complete actual boat geometry or material state changed');
 const a=before.nativeProof.allRows,b=after.nativeProof.allRows;assert.equal(a.length,b.length,'Actual complete-object draw inventory changed');
 const byKey=new Map(b.map(row=>[row.slot+':'+row.group,row]));assert.equal(byKey.size,b.length);const rows=[];
 for(const left of a){
  const right=byKey.get(left.slot+':'+left.group);assert(right,'Actual boat primitive disappeared');
  for(const field of ['kind','slot','group','mesh','materialName','materialType','side','profile','uniforms'])assert.deepEqual(left[field],right[field],'Actual boat input changed: '+field);
  const one=programs.find(program=>program.id===left.programId),two=programs.find(program=>program.id===right.programId);assert(one?.linked&&two?.linked,'Actual boat native program did not link');
  const stages=[];for(const stage of ['vertex','fragment']){assert(typeof one[stage+'Source']==='string'&&typeof two[stage+'Source']==='string','Full submitted boat source missing');stages.push({stage,...compareBoatOrderStage(one[stage+'Source'],two[stage+'Source'])});}
  rows.push({slot:left.slot,group:left.group,materialName:left.materialName,beforeProgram:one.id,afterProgram:two.id,stages,passed:true});
 }
 assert(rows.length>0);return {passed:true,rows};
}

export const boatOrderCaseIds=Object.freeze(Object.keys(cases));
