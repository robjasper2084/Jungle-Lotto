import {createHash} from 'node:crypto';

export const PINNED_BASE='893f769838166e6e35624b7b979ed5cbb8414507';
export const GAME_ROOT='lottominded-ultra.io/games/gothtechnology2';
export const BELLE_ROOT=GAME_ROOT+'/belle-isle-source/game';
export const SOURCE_DIGESTS=Object.freeze({
  [BELLE_ROOT+'/src/belle/main.ts']:'f4b9852e9b6a82521e28a72106e19bb37ca34bed8e6f393708cf4f0485e7001f',
  [BELLE_ROOT+'/src/belle/world.ts']:'0e856ab2fa168b0455ef60de288f7081208b9f7e28960ce9a6f87b1ad2a7637d',
  [BELLE_ROOT+'/src/belle/detroitScene.ts']:'b8259828a177be7f03f032b782a6a51ebd9fb161f688a0edba50dcef52e6cb9c',
  [BELLE_ROOT+'/src/belle/detroitAssets.ts']:'dc4e9be74658fba8bb52f3ec2d9b01d016aad2818aa4627ca9603a8d779d8f9e',
  [BELLE_ROOT+'/src/belle/detroitProps.ts']:'58c3066a32ecf64720a052739f73e0e9fa704781f1d25ba160e2c778d942ea52',
  [BELLE_ROOT+'/src/belle/parkCompanion.ts']:'8107630e0c623defb3b704eba97cd97264027f1050f05a0b30880893508f0e29',
  [BELLE_ROOT+'/src/belle/startupWork.ts']:'861a0a0132322234d68d92ab1bc6dfa2c82b3aadeb95e4b01e036556562a1899',
  [BELLE_ROOT+'/index.html']:'a0ebd460f7cad9744fc70675b121d5cee26a3f949c9304500b8e7b1eb1265baf',
  [GAME_ROOT+'/swoop-source/src/detroit/compressedGLTFLoader.ts']:'342ff64c1bb8ab410f9797c15a139bae1104358c9795b818271bc67919d11cd6',
  [GAME_ROOT+'/swoop-source/src/detroit/foodTrucks.ts']:'8ac473bdbc66556606316ca72492165473a952e927da14c5603bec183fef1a67',
  [GAME_ROOT+'/swoop-source/src/detroit/scenery.ts']:'9559295186403130a47ab8eeabb78535fb4995e0fb845188753b9153bb13d8ef',
  [GAME_ROOT+'/swoop-source/src/detroit/world.ts']:'791403098979325b32ffa51247224d2363c12357c8d8d6186d0f71bb3389ba7b',
  [GAME_ROOT+'/swoop-source/src/detroit/architectureData.ts']:'dcaf68287d2d6f9f9d75ef34161d70cfe128559359a5e68ae390dde4649ef049',
  [GAME_ROOT+'/swoop-source/src/detroit/atwater.ts']:'2bb6af80b5e62fa83b735ad9af45846eae740dfb2bcc158c1058658ede34516b',
  [GAME_ROOT+'/swoop-source/src/detroit/architecture.ts']:'8f9d2229f916b9f1318eb559f46ba60141346351dcf9d19057c4a14e196bb4b9',
});

export const digest=content=>createHash('sha256').update(content).digest('hex');
export function assertPinnedInput(content,relativePath){
  const expected=SOURCE_DIGESTS[relativePath];
  if(!expected)throw Error('Unrecognized preview patch target: '+relativePath);
  const actual=digest(content);
  if(actual!==expected)throw Error('Preview adapter source has changed: '+relativePath+'. Reconcile against '+PINNED_BASE+' before updating its explicit digest.');
}

export function replaceExactlyOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  if(first<0||source.indexOf(needle,first+needle.length)>=0)throw Error('Expected exactly one '+label+' hook; refusing partial preview integration.');
  return {start:first,end:first+needle.length,replacement};
}

export function applyEdits(source,edits){
  const sorted=[...edits].sort((a,b)=>a.start-b.start);
  for(let i=0;i<sorted.length;i++){
    const e=sorted[i];
    if(e.start<0||e.end<e.start||e.end>source.length||(i&&e.start<sorted[i-1].end))throw Error('Overlapping or invalid preview source edits');
  }
  let result=source;
  for(const e of sorted.reverse())result=result.slice(0,e.start)+e.replacement+result.slice(e.end);
  return result;
}

/** A held preview must not even compile the production room transport. */
export function assertOfflineRoomBoundary(moduleIds){
  for(const raw of moduleIds){
    const id=raw.replaceAll('\\','/').split('?')[0];
    if(id.endsWith('/src/belle/onlineRooms.ts')||id.includes('/node_modules/@supabase/realtime-js/'))throw Error('Production online rooms cannot enter the unpublished preview: '+id);
  }
}

export const PREVIEW_CUT_TRAVEL_BODY=`
if(scenePreparing||travel.disabled)return;
const wasPreparing=scenePreparing,previousLabel=travel.textContent;
let message=c.querySelector<HTMLParagraphElement>('[data-preview-travel-status]');
if(!message){message=document.createElement('p');message.dataset.previewTravelStatus='true';message.setAttribute('role','status');c.append(message);}
message.hidden=false;message.textContent='Preparing your destination…';
scenePreparing=true;travel.disabled=true;travel.textContent='Preparing…';travel.dataset.previewTravelState='preparing';travel.setAttribute('aria-busy','true');
try{
 clear();resetFrameClock=true;
 await preparePreviewTravel(lm);
 destination=lm;jump(lm.x,lm.z,lm.yaw??0);first=false;cameraPitch=.1;el<HTMLDialogElement>('guide').close();if(!active)start.click();
 travel.dataset.previewTravelState='ready';travel.textContent=previousLabel;message.textContent='';message.hidden=true;
}catch(error){
 travel.dataset.previewTravelState='failed';travel.textContent='Retry travel';message.textContent='This destination could not load. Choose Retry travel to try again.';
 const guide=el<HTMLDialogElement>('guide');if(!guide.open)guide.showModal();console.warn('Preview destination preparation failed',error);
}finally{scenePreparing=wasPreparing;resetFrameClock=true;travel.disabled=false;travel.removeAttribute('aria-busy');}
return;
`;

export function belleMainEdits(source,{verify=true}={}){
  if(verify)assertPinnedInput(source,BELLE_ROOT+'/src/belle/main.ts');
  return [replaceExactlyOnce(source,
    "import {createWorld} from './world.ts';import {ParkTerrain,inside,type Landmark,type ParkMap} from './terrain.ts';",
    "import {createWorld} from '@dequindre-preview/host';import {ParkTerrain} from '@dequindre-preview/terrain';import {inside,type Landmark,type ParkMap} from './terrain.ts';",
    'Belle Isle runtime import'),
    replaceExactlyOnce(source,"import type {BelleOnlineRooms} from './onlineRooms.ts';","import type {BelleOnlineRooms} from '@dequindre-preview/offlineRooms';",'offline preview room type import'),
    replaceExactlyOnce(source,"void import('./onlineRooms.ts').then(({BelleOnlineRooms})=>","void import('@dequindre-preview/offlineRooms').then(({BelleOnlineRooms})=>",'offline preview room runtime import'),
    replaceExactlyOnce(source,"import {ParkCompanion,boerboelModel} from './parkCompanion.ts';","import {ParkCompanion,boerboelModel} from './parkCompanion.ts';import {registerCompanionProvider} from '@dequindre-preview/companionBridge';",'visible companion obstacle provider import'),
    replaceExactlyOnce(source,'const companion=new ParkCompanion(scene,terrain);','const companion=new ParkCompanion(scene,terrain);registerCompanionProvider(()=>companion.previewNavigationPose);','visible companion obstacle provider registration'),
    replaceExactlyOnce(source,"import {ManualLoopProbe} from './loopDiagnostics.ts';","import {ManualLoopProbe} from './loopDiagnostics.ts';import {preparePreviewTravel} from '@dequindre-preview/previewTravel';",'prepared preview destination import'),
    replaceExactlyOnce(source,"travel.onclick=()=>{if(lm.id===BRIDGE_PICTURE_VIEW_ID){",
      "travel.onclick=async()=>{if(lm.id.startsWith('preview-cut-')){"+PREVIEW_CUT_TRAVEL_BODY+"}if(lm.id===BRIDGE_PICTURE_VIEW_ID){",'native preview landmark travel'),
    replaceExactlyOnce(source,'c.append(go,travel);',"if(lm.id.startsWith('preview-cut-'))travel.dataset.cutTravel=lm.id;c.append(go,travel);",'native preview landmark button identifier'),
  ];
}

export function belleCompanionEdits(source,{verify=true}={}){
  if(verify)assertPinnedInput(source,BELLE_ROOT+'/src/belle/parkCompanion.ts');
  const edits=[replaceExactlyOnce(source,' relocate(){',
    ' get previewNavigationPose(){return this.view?.root.visible&&this.enabled&&!this.inVehicle?this.dog:undefined;}\n relocate(){','visible ground companion navigation pose'),
    replaceExactlyOnce(source,"import {companionAnchor,type CompanionAnchor} from './companionSafety.ts';","import {companionAnchor,type CompanionAnchor} from './companionSafety.ts';import {CompanionGround} from '@dequindre-preview/companionGround';",'source companion ground-contact import'),
    replaceExactlyOnce(source,'readonly dog:ElmwoodCompanion;','private readonly previewGround:CompanionGround;readonly dog:ElmwoodCompanion;','source companion ground-contact field'),
    replaceExactlyOnce(source,"const ground={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};","this.previewGround=new CompanionGround(terrain,()=>this.dog);const ground={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};",'source companion ground-contact construction'),
    replaceExactlyOnce(source,'terrain.sampleGround(x,z,ground);','this.previewGround.sampleGround(x,z,ground);','source companion ground-contact sample'),
    replaceExactlyOnce(source,'companionAnchor(this.anchor,rider,this.terrain.land(rider.x,rider.z),this.terrain.height(rider.x,rider.z))','this.previewGround.anchor(this.anchor,rider)','source companion ground-contact anchor'),
  ];
  const reset='this.dog.reset(this.anchor);';let index=source.indexOf(reset),count=0;
  while(index>=0){edits.push({start:index,end:index+reset.length,replacement:'this.previewGround.reset(()=>this.dog.reset(this.anchor));'});count++;index=source.indexOf(reset,index+reset.length);}
  if(count!==3)throw Error('Expected exactly three original companion reset hooks; refusing partial ground contact integration.');
  return edits;
}

/** Keep Belle's complete hidden-asset preparation; added source districts use
 * their established view union to select textures. Uploading, caching, shader
 * compilation, pacing and cancellation remain the original implementation.
 */
export function belleStartupWorkEdits(source,{verify=true}={}){
  if(verify)assertPinnedInput(source,BELLE_ROOT+'/src/belle/startupWork.ts');
  return [
    replaceExactlyOnce(source,"import type {Object3D,Texture,WebGLRenderer} from 'three';",
      "import type {Object3D,Texture,WebGLRenderer} from 'three';\nimport {shouldWarmPreviewTexture} from '@dequindre-preview/sourceTextureWarmup';",
      'source-only texture warmup predicate import'),
    replaceExactlyOnce(source,'root.traverse(object=>{const material=',
      'root.traverse(object=>{if(!shouldWarmPreviewTexture(object))return;const material=',
      'source-only texture warmup eligibility'),
  ];
}

export function belleDistrictEdits(source,relativePath,{verify=true}={}){
  const scene=relativePath===BELLE_ROOT+'/src/belle/detroitScene.ts';
  if(!scene&&![BELLE_ROOT+'/src/belle/detroitAssets.ts',BELLE_ROOT+'/src/belle/detroitProps.ts'].includes(relativePath))return [];
  if(verify)assertPinnedInput(source,relativePath);
  return [replaceExactlyOnce(source,
    scene?"import {districts,districtHeight} from './detroitGround.ts';":"import {districts} from './detroitGround.ts';",
    "import {districts} from '@dequindre-preview/visualDistricts';"+(scene?"import {districtHeight} from './detroitGround.ts';":''),
    'mainland visual district data import')];
}

export function belleWorldEdits(source,{verify=true}={}){
  if(verify)assertPinnedInput(source,BELLE_ROOT+'/src/belle/world.ts');
  return [replaceExactlyOnce(source,
    "import {addDetroitDistricts} from './detroitScene.ts';",
    "import {addDetroitDistricts} from '@dequindre-preview/hostDistrict';",
    'mainland district renderer import')];
}

/** Static compilation changes only: no fetch/loader monkey patch and no writes
 * to Belle's document settings. Source files on disk remain byte-for-byte intact. */
export function swoopEdits(source,relativePath){
  if(!relativePath.startsWith(GAME_ROOT+'/swoop-source/src/')||!/\.(?:ts|json)$/.test(relativePath))return [];
  // Vite invokes this pre-transform before its JSON module plugin. Namespace
  // data values in the same source boundary as TS constants and loader calls.
  if(relativePath.endsWith('.json'))return swoopAssetEdits(source);
  if(/\/(?:main|boot)\.ts$/.test(relativePath))throw Error('The preview must share Belle Isle runtime; importing a second Swoop entry is forbidden.');
  const edits=[];
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/architectureData.ts')assertPinnedInput(source,relativePath);
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/atwater.ts'){
    assertPinnedInput(source,relativePath);
    edits.push(replaceExactlyOnce(source,"loadAsync('./'+SKYLINE_PATH)",'loadAsync(SKYLINE_PATH)','absolute source skyline asset URL'));
  }
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/architecture.ts'){
    assertPinnedInput(source,relativePath);
    edits.push(replaceExactlyOnce(source,"gltf.loadAsync('./'+path)",'gltf.loadAsync(path)','absolute source architecture asset URLs'));
  }
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/world.ts'){
    assertPinnedInput(source,relativePath);
    const first="import {JAZZ_CLUBS,jazzGrade} from './jazzSites.ts';";
    edits.push(replaceExactlyOnce(source,first,"import {previewTrafficDistance,previewTrafficObservers} from '@dequindre-preview/swoopTrafficFocus';\n"+first,'multi-observer traffic dependency'));
    for(const [needle,replacement,expected]of [
      ['Math.hypot(x-px,z-pz)','previewTrafficDistance(x,z,px,pz)',3],
      ['Math.hypot(t.x-px,t.z-pz)','previewTrafficDistance(t.x,t.z,px,pz)',1],
      ['Math.hypot(pos.x-px,pos.z-pz)','previewTrafficDistance(pos.x,pos.z,px,pz)',1],
    ]){
      let index=source.indexOf(needle),count=0;
      while(index>=0){edits.push({start:index,end:index+needle.length,replacement});count++;index=source.indexOf(needle,index+needle.length);}
      if(count!==expected)throw Error('Source traffic observation hook count changed: '+needle);
    }
    edits.push(replaceExactlyOnce(source,'!this.trafficBodies.has(id)&&Math.abs(this.rideIntent.speed)>1','!this.trafficBodies.has(id)&&previewTrafficObservers(px,pz,this.rideIntent).some(o=>Math.abs(o.speed)>1)','multi-observer encounter activation'));
    edits.push(replaceExactlyOnce(source,'const p={x:px,y:heightAt(px,pz),z:pz};\n        if(!encounterOptions(this,p,this.rideIntent.heading,this.rideIntent.speed,prospective).feasible){this.rejectedEncounters++;continue;}',
      'if(previewTrafficObservers(px,pz,this.rideIntent).some(o=>Math.abs(o.speed)>1&&!encounterOptions(this,{x:o.x,y:heightAt(o.x,o.z),z:o.z},o.heading,o.speed,prospective).feasible)){this.rejectedEncounters++;continue;}',
      'multi-observer encounter feasibility'));
  }
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/foodTrucks.ts'){
    assertPinnedInput(source,relativePath);
    edits.push(replaceExactlyOnce(source,"import {FoodVendorMedia} from './foodVendorMedia.ts';","import {FoodVendorMedia} from '@dequindre-preview/staticVendorMedia';",'food vendor idle poster import'));
  }
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/compressedGLTFLoader.ts'){
    assertPinnedInput(source,relativePath);
    edits.push(replaceExactlyOnce(source,"import {startupTextureBudget} from './graphicsQuality.ts';",'','Swoop texture quality import'));
    const calls=[...source.matchAll(/startupTextureBudget\(\)/g)];
    if(calls.length!==2)throw Error('Expected exactly two original-texture budget hooks');
    for(const match of calls)edits.push({start:match.index,end:match.index+match[0].length,replacement:'({mobile:false,maxSize:Number.POSITIVE_INFINITY})'});
  }
  if(relativePath===GAME_ROOT+'/swoop-source/src/detroit/scenery.ts'){
    assertPinnedInput(source,relativePath);
    edits.push(replaceExactlyOnce(source,"mobile=matchMedia('(max-width:700px)')",'mobile={matches:false}','full geometry on compact screens'));
  }
  const settings=/document\.documentElement\.dataset\.(drawDistance|renderQuality|reducedMotion)/g;
  for(const match of source.matchAll(settings)){
    const after=source.slice(match.index+match[0].length);
    if(/^\s*(?:=(?!=)|\+\+|--|\+=|-=)/.test(after))throw Error('Swoop global quality writer cannot enter the shared preview: '+relativePath);
    edits.push({start:match.index,end:match.index+match[0].length,replacement:'globalThis.__dequindrePreviewSettings.'+match[1]});
  }
  edits.push(...swoopAssetEdits(source));
  return edits;
}

/** Recognize bare, root-relative and explicitly relative source asset values.
 * Already namespaced paths, module imports, data/blob URLs and remote URLs do
 * not match. Consumers above no longer prepend './' to transformed data URLs.
 * GLB image/buffer URIs are untouched and resolve relative to the model URL.
 */
function swoopAssetEdits(source){
  const edits=[],assets=/(["'`])(?:\.\/|\/)?(exports|textures|audio|shared-textures)\//g;
  for(const match of source.matchAll(assets))edits.push({start:match.index+1,end:match.index+match[0].length,replacement:'/__swoop-assets__/'+match[2]+'/'});
  return edits;
}

export function previewHtml(source){
  assertPinnedInput(source,BELLE_ROOT+'/index.html');
  return applyEdits(source,[
    replaceExactlyOnce(source,'<script type="module" src="/src/belle/entry.ts"></script>',
      '<script type="module" src="/__dequindre-preview-bootstrap__.ts"></script>\n<script type="module" src="/__dequindre-belle-entry__.ts"></script>','source HTML entry'),
  ]);
}
