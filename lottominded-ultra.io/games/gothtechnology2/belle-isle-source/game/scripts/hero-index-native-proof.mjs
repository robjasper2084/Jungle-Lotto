import assert from 'node:assert/strict';

// Validation-only native receipts, deliberately outside strict performance.
export function validateHeroCapture(capture){
 if(!capture.id.startsWith('hero-'))return null;
 const p=capture.nativeProof;assert(p&&Array.isArray(p.rows),'Hero capture lacks actual draw receipts');
 assert(['ink','detail','shadow'].includes(p.mode),'Unknown hero mode');
 assert([0,1,2].includes(p.phase)&&[0,208].includes(p.padding),'Unknown hero pose/palette');
 assert([0,1].includes(capture.view),'Unknown hero view');
 assert.deepEqual(capture.sunPosition,p.mode==='shadow'&&capture.view===1?[-4,6,-3]:[4,6,3],'Actual hero light direction differs from its frozen view');
 const shown=capture.subjectPresent,contributing=capture.contributionPresent;
 const colorCount=!shown||!contributing&&p.mode!=='shadow'?0:p.mode==='ink'?4:2;
 const shadowCount=shown&&contributing&&p.mode!=='ink'?2:0;
 const colors=p.rows.filter(r=>r.pass==='color'),shadows=p.rows.filter(r=>r.pass==='shadow');
 assert.equal(colors.length,colorCount,'Wrong actual hero color submission count');assert.equal(shadows.length,shadowCount,'Wrong actual hero shadow submission count');
 for(const row of p.rows){
  const expected=row.generated&&(capture.side==='baseline'||p.padding>0)?5123:5121;
  assert.equal(row.type,expected);assert.equal(row.stride,expected===5123?8:4);assert.equal(row.size,4);assert.equal(row.divisor,0);assert.equal(row.integer,false);
  assert.equal(row.normalized,capture.side==='candidate'&&row.generated&&p.control,'Wrong real normalization/control binding');
  assert(row.count>0&&Number.isInteger(row.programId),'Missing native hero program/count');
  assert(row.activeAttributes.some(a=>a.name==='skinIndex'&&a.type===35666&&a.size===1&&a.location>=0),'Missing float vec4 skinIndex input');
  assert(row.activeAttributes.some(a=>a.name==='skinWeight'&&a.type===35666),'Missing skinWeight input');
  assert(Number.isInteger(row.boneTextureUnit)&&row.boneTextureUnit>=0&&row.boneTextureSize.every(n=>Number.isInteger(n)&&n>0),'Missing real bone texture receipt');
 }
 if(colorCount===4){
  assert.deepEqual(colors.map(r=>r.count).sort((a,b)=>a-b),[3288,3288,14904,139710]);
  assert.equal(new Set(colors.map(r=>r.programId)).size,1,'Real outline cohort must share one shader program');
  assert.equal(new Set(colors.map(r=>[r.type,r.stride,r.normalized,r.integer,r.divisor].join(':'))).size,capture.side==='baseline'||p.padding>0||p.control?2:1,'Wrong observed outline layout inventory');
 }
 if(colorCount===2)assert.deepEqual(colors.map(r=>r.count).sort((a,b)=>a-b),[4536,10368]);
 if(shadowCount===2)assert.deepEqual(shadows.map(r=>r.count).sort((a,b)=>a-b),[4536,10368]);
 assert.equal(p.restoredAttribute,!p.control,'Control did not retain/restore the exact original attribute object');
 if(p.mode==='shadow'){
  assert(capture.shadow&&capture.shadow.width>0&&capture.shadow.height>0&&capture.shadow.bindingsRestored,'Missing actual RGBA shadow color-target capture');
  assert.deepEqual(capture.shadow.sunPosition,capture.sunPosition,'Shadow color receipt has a different light position');
  const matrix=capture.shadow.sunMatrixWorld;assert(Array.isArray(matrix)&&matrix.length===16&&matrix.every(Number.isFinite),'Missing actual shadow-light world matrix');
  assert.deepEqual(matrix.slice(12,15),capture.sunPosition,'Shadow-light world matrix differs from its reported position');
  const camera=capture.shadow.shadowCamera;assert(camera,'Missing actual hero light-space camera');
  assert.deepEqual([camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far],[-2,2,2,-2,.1,20],'Hero shadow framing differs from its fixed view');
  assert.equal(capture.shadow.width,256);assert.equal(capture.shadow.height,256);
  for(const value of [camera.matrixWorld,camera.projectionMatrix])assert(Array.isArray(value)&&value.length===16&&value.every(Number.isFinite),'Missing actual shadow camera matrix');
 }
 return {passed:true,colorCount,shadowCount,mode:p.mode,phase:p.phase,padding:p.padding,control:p.control};
}

export function compareHeroNativeSources(before,after,programs){
 const dictionary=new Map(programs.map(p=>[p.id,p])),a=before.nativeProof?.rows??[],b=after.nativeProof?.rows??[];
 const key=r=>[r.pass,r.name,r.count,r.generated].join('|');
 assert.equal(a.length,b.length,'Native hero stage inventory changed');
 const rows=[];
 for(const left of a){const matches=b.filter(r=>key(r)===key(left));assert.equal(matches.length,1,'Ambiguous corresponding native hero draw');
  const right=matches[0],x=dictionary.get(left.programId),y=dictionary.get(right.programId);assert(x&&y&&x.linked&&y.linked,'Missing linked hero source evidence');
  const equal=x.vertexSha256===y.vertexSha256&&x.fragmentSha256===y.fragmentSha256;
  assert(equal,'Skin-index storage proposal changed compiled shader source');
  rows.push({pass:left.pass,name:left.name,count:left.count,baselineProgram:left.programId,candidateProgram:right.programId,vertexSha256:x.vertexSha256,fragmentSha256:x.fragmentSha256,equal});
 }
 return {passed:true,rows};
}
