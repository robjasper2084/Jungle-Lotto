// Fail-closed production acceptance: report fields are only claims until the
// referenced exact-head artifacts and independent GitHub review are verified.
// This module never changes the game, repository or deployment.
const DISTRICTS=['belle-isle','swoop-detroit','elmwood'];
const ROUTES=['belle-swoop','swoop-elmwood'];
const HEX64=/^[a-f0-9]{64}$/i;
const SHA=/^[a-f0-9]{40}$/i;
export const REQUIRED_DISTRICTS=Object.freeze(DISTRICTS);
export const REQUIRED_ROUTES=Object.freeze(ROUTES);

const isFinitePositive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const safeFile=f=>typeof f==='object'&&f!==null&&typeof f.path==='string'&&
  f.path.length>0&&!f.path.startsWith('/')&&!f.path.includes('\\')&&!f.path.split('/').includes('..')&&
  HEX64.test(f.sha256??'');

/** Validate manifest claims; evidence file hashes and peer reviews are checked by the CLI. */
export function validateAcceptance(report,headSha){
 const errors=[];
 const fail=(condition,reason)=>{if(!condition)errors.push(reason);};
 fail(SHA.test(headSha??''),'Missing exact Git head SHA');
 fail(!!report&&typeof report==='object','Missing evidence report');
 if(!report||typeof report!=='object')return errors;
 fail(report.headSha===headSha,'Evidence was not captured for this exact head');
 const conditions=report.conditions??{};
 fail(/^\d{4}-\d{2}-\d{2}$/.test(conditions.date??'')&&Number.isFinite(conditions.solarHour)&&
  conditions.solarHour>=0&&conditions.solarHour<=24&&typeof conditions.weather==='string'&&conditions.weather.length>0,
 'Missing shared solar date/hour and weather');
 for(const district of DISTRICTS){
  const v=report.screenshots?.[district];
  fail(v?.reviewed===true,'Missing human screenshot comparison: '+district);
  for(const version of ['baseline','candidate']){
   const shot=v?.[version];
   fail(safeFile(shot?.artifact),'Missing hashed '+version+' screenshot: '+district);
   const pose=shot?.camera;
   fail(pose&&Array.isArray(pose.position)&&pose.position.length===3&&pose.position.every(Number.isFinite)&&
      Array.isArray(pose.direction)&&pose.direction.length===3&&pose.direction.every(Number.isFinite)&&
      isFinitePositive(pose.fovDegrees),'Invalid '+version+' camera pose: '+district);
  }
  if(v?.baseline?.camera&&v?.candidate?.camera)
   fail(JSON.stringify(v.baseline.camera)===JSON.stringify(v.candidate.camera),'Different camera between baseline and candidate: '+district);
  const build=report.builds?.[district];
  fail(build?.result==='success'&&build.headSha===headSha&&safeFile(build.artifact),'Missing exact-head clean build log: '+district);
 }
 for(const route of ROUTES){
  const cross=report.traversal?.[route];
  fail(cross?.result==='pass'&&cross.bothDirections===true&&cross.physicalSeam===true&&
    cross.noLightPops===true&&cross.noClipping===true&&cross.noShaderHitches===true&&
    cross.noNetworkErrors===true&&safeFile(cross.artifact),
    'Missing real, two-way seamless traversal proof: '+route);
 }
 for(const [profile,budget] of [['desktop',1000/60],['mobile',1000/30]]){
  const p=report.performance?.[profile];
  fail(isFinitePositive(p?.durationSeconds)&&p.durationSeconds>=600&&
    isFinitePositive(p.meanFrameMs)&&p.meanFrameMs<=budget&&
    isFinitePositive(p.p95FrameMs)&&p.p95FrameMs<=budget&&
    typeof p.device==='string'&&p.device.trim().length>2&&
    typeof p.browser==='string'&&p.browser.trim().length>2&&
    safeFile(p.artifact),'Missing measured 10-minute '+profile+' FPS evidence (p95 budget '+budget.toFixed(2)+' ms)');
 }
 fail(report.lut?.state==='deferred'||(report.lut?.state==='applied'&&report.lut?.baseStabilized===true&&safeFile(report.lut?.artifact)),
 'LUT must be deferred until validated, or have post-baseline evidence');
 return errors;
}
export function evidenceFiles(report){
 const files=[];
 for(const district of DISTRICTS){
  const s=report.screenshots?.[district],b=report.builds?.[district];
  for(const item of [s?.baseline?.artifact,s?.candidate?.artifact,b?.artifact])if(item)files.push(item);
 }
 for(const route of ROUTES)if(report.traversal?.[route]?.artifact)files.push(report.traversal[route].artifact);
 for(const profile of ['desktop','mobile'])if(report.performance?.[profile]?.artifact)files.push(report.performance[profile].artifact);
 if(report.lut?.state==='applied'&&report.lut?.artifact)files.push(report.lut.artifact);
 return files;
}
/** An approval is only valid if it came from another user on the current head. */
export function hasExactHeadPeerApproval(reviews,headSha,authorLogin){
 if(!Array.isArray(reviews)||!SHA.test(headSha??''))return false;
 const latest=new Map();
 for(const r of reviews)if(typeof r?.user?.login==='string')latest.set(r.user.login.toLowerCase(),r);
 return [...latest.values()].some(r=>r.state==='APPROVED'&&r.commit_id===headSha&&
   r.user.login.toLowerCase()!==String(authorLogin??'').toLowerCase());
}
