import {textureDownloadUrl} from './textureDownloadUrl.ts';
import {isSafeStartup} from './safeStartup.ts';
import {makeRenderResize} from './renderResize.ts';
import * as T from 'three';
import {installShadowBudget} from '../../../ride-core/src/shadowBudget.ts';
import {budgetPixelRatio,makeTextureBudget} from './renderBudget.ts';
export type GraphicsChoice='auto'|'low'|'balanced'|'high'|'ultra';
export type GraphicsTuning={resolution:number;fps:number;shadows:number;textureSize:number;distance:number;aa:'auto'|'off'|'on'};
const TUNING_KEY='swoop-graphics-tuning.v1';
export function parseGraphicsTuning(raw:string|null):Partial<GraphicsTuning>{
 const out:Partial<GraphicsTuning>={};try{const saved=JSON.parse(raw??'{}');if(!saved||typeof saved!=='object')return out;
  const allowed={resolution:[.5,.75,1,1.25,1.5],fps:[30,60,90,120],shadows:[0,1024,2048,4096],textureSize:[512,1024,2048,4096],distance:[180,300,460,600]};
  for(const key of Object.keys(allowed) as (keyof typeof allowed)[])if(allowed[key].includes(saved[key]))out[key]=saved[key];
  if(['auto','off','on'].includes(saved.aa))out.aa=saved.aa;
 }catch{}return out;
}
// Repair the old Smooth shortcut's overrides after the player selected another preset.
export function savedGraphicsTuning(choice:string,raw:string|null){
 const t=parseGraphicsTuning(raw);
 return choice!=='low'&&t.fps===60&&t.shadows===0&&t.textureSize===512&&t.distance===180&&t.resolution===1?{}:t;
}
export const GRAPHICS_PRESETS={low:{label:'Smooth · phones / weak systems',pixelRatio:.8,minRatio:.5,shadows:0,distance:180,fps:30,textureSize:512,maxPixels:600000,anisotropy:1},balanced:{label:'Balanced',pixelRatio:1.25,minRatio:1,shadows:1024,distance:300,fps:60,textureSize:1024,maxPixels:1800000,anisotropy:4},high:{label:'HD · high detail',pixelRatio:2,minRatio:1.5,shadows:2048,distance:460,fps:60,textureSize:2048,maxPixels:6000000,anisotropy:8},ultra:{label:'Ultra · maximum detail',pixelRatio:2,minRatio:1.5,shadows:4096,distance:600,fps:60,textureSize:4096,maxPixels:8000000,anisotropy:16}} as const;
export function antialiasForDevice(aa:string,cores=4,memory?:number,mobile=false){return aa==='on'||aa!=='off'&&!mobile&&cores>=4&&(memory===undefined||memory>=4);}
export function presetAntialias(choice:string,aa?:string){return aa&&aa!=='auto'?aa:choice==='high'||choice==='ultra'?'on':'auto';}
export function startupAntialias(){if(isSafeStartup())return false;let aa='auto';try{aa=presetAntialias(localStorage.getItem('swoop-graphics-quality')??'auto',parseGraphicsTuning(localStorage.getItem(TUNING_KEY)).aa);}catch{}const mobile=/Android|iPhone|iPad|Mobile|OculusBrowser/i.test(navigator.userAgent)||navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent);return antialiasForDevice(aa,navigator.hardwareConcurrency||4,(navigator as Navigator&{deviceMemory?:number}).deviceMemory,mobile);}
export function resolveGraphics(value:string,cores=4,memory?:number,mobile=false,gpu=''){
 if(value==='low'||value==='balanced'||value==='high'||value==='ultra')return value;
 if(/swiftshader|llvmpipe|software|microsoft basic|mali-4|adreno [23]/i.test(gpu)||cores<=2||memory!==undefined&&memory<=2)return 'low';
 // CPU count and RAM do not establish sustained mobile GPU/thermal capacity.
 // Start these large maps at Smooth; explicit quality choices above still win.
 if(mobile)return 'low';
 if(memory!==undefined&&memory<=4)return cores<=4?'low':'balanced';
 // The first busy arena view must fit the budget before adaptation has samples.
 // A GPU name or core count is not a measurement of this scene's render cost.
 return 'balanced';
}
export function startupTextureBudget(){
 const mobile=typeof navigator!=='undefined'&&(/Android|iPhone|iPad|Mobile|OculusBrowser/i.test(navigator.userAgent)||navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent));
 let choice='auto',tuning:Partial<GraphicsTuning>={};try{choice=localStorage.getItem('swoop-graphics-quality')??'auto';tuning=savedGraphicsTuning(choice,localStorage.getItem(TUNING_KEY));}catch{}
 const preset=GRAPHICS_PRESETS[resolveGraphics(choice,4,undefined,mobile)];return {mobile,maxSize:isSafeStartup()?512:tuning.textureSize??preset.textureSize};
}
export function createGraphicsQuality(renderer:T.WebGLRenderer,scene:T.Scene,canvas:HTMLCanvasElement,onApply?:()=>void){
 T.DefaultLoadingManager.setURLModifier(url=>textureDownloadUrl(new URL(url,location.href).href,startupTextureBudget().maxSize,location.href));
 installShadowBudget(renderer,scene,canvas);
 let choice:GraphicsChoice='auto';try{const saved=localStorage.getItem('swoop-graphics-quality');if(['auto','low','balanced','high','ultra'].includes(saved??''))choice=saved as GraphicsChoice;}catch{}
 let tuning:Partial<GraphicsTuning>={};try{tuning=savedGraphicsTuning(choice,localStorage.getItem(TUNING_KEY));}catch{}
 if(isSafeStartup()){choice='low';tuning={};}
 const cores=navigator.hardwareConcurrency||4,memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
 const mobile=/Android|iPhone|iPad|Mobile|OculusBrowser/i.test(navigator.userAgent)||navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent);
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';
 let autoTier:ReturnType<typeof resolveGraphics>|undefined;
 const resolved=()=>choice==='auto'&&autoTier?autoTier:resolveGraphics(choice,cores,memory,mobile,gpu);
 const preset=()=>{const p=GRAPHICS_PRESETS[resolved()];return {...p,fps:tuning.fps??p.fps,shadows:tuning.shadows??(choice==='auto'?0:p.shadows),textureSize:tuning.textureSize??p.textureSize,distance:tuning.distance??p.distance};};
 let current=preset();
 const fields:HTMLSelectElement[]=[],descriptions:HTMLElement[]=[],originalShadows=new WeakMap<T.Light,boolean>();
 const tuningFields:{key:keyof GraphicsTuning,input:HTMLSelectElement}[]=[],restartButtons:HTMLButtonElement[]=[];
 const budgetTextures=makeTextureBudget({retainOriginals:!mobile});let residentTextureLimit=current.textureSize;
 let resolutionScale=1,adaptiveDetail=1;
 const resizeTarget=makeRenderResize(renderer);const resize=()=>{const base=Math.max(devicePixelRatio,mobile?.5:current.minRatio)*(tuning.resolution??1),ratio=budgetPixelRatio(base,current.pixelRatio,innerWidth,innerHeight,current.maxPixels)*resolutionScale;resizeTarget(innerWidth,innerHeight,ratio);canvas.dataset.pixelRatio=String(renderer.getPixelRatio());};
 function applyAssets(root:T.Object3D){
  budgetTextures(root,current.textureSize);
  if(mobile)residentTextureLimit=Math.min(residentTextureLimit,current.textureSize);
  const seen=new Set<T.Material>(),anisotropy=Math.min(current.anisotropy,renderer.capabilities.getMaxAnisotropy());
  root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(seen.has(material))continue;seen.add(material);for(const value of Object.values(material)){const texture=value as T.Texture;if(texture?.isTexture&&!texture.isRenderTargetTexture&&texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}}}});
 }
 function apply(refreshAssets=true){current=preset();if(choice==='auto'){current.distance=Math.max(140,Math.round(current.distance*adaptiveDetail));}resize();renderer.shadowMap.enabled=current.shadows>0;
  scene.traverse(o=>{const light=o as T.DirectionalLight;if(light.isLight&&light.shadow){if(!originalShadows.has(light))originalShadows.set(light,light.castShadow);light.castShadow=!!current.shadows&&!!originalShadows.get(light);const size=current.shadows||512;if(light.shadow.mapSize.x!==size){light.shadow.mapSize.set(size,size);light.shadow.map?.dispose();light.shadow.map=null;}}
  });if(refreshAssets)applyAssets(scene);
  if(scene.fog instanceof T.Fog){scene.fog.near=current.distance*.32;scene.fog.far=current.distance*1.4;}
  renderer.shadowMap.needsUpdate=true;document.documentElement.dataset.renderQuality=resolved()==='low'?'compact':'detailed';document.documentElement.dataset.drawDistance=String(current.distance);
  Object.assign(canvas.dataset,{qualityChoice:choice,quality:resolved(),frameLimit:String(current.fps),shadowSize:String(current.shadows),textureLimit:String(current.textureSize),pixelRatio:String(renderer.getPixelRatio()),antialias:String(gl.getContextAttributes()?.antialias),adaptiveDetail:String(adaptiveDetail),qualityReason:choice!=='auto'?'Manual selection':autoTier?'Adjusted for sustained slow frames':mobile?'Mobile device':resolved()==='high'?'Desktop hardware':'Hardware performance budget'});
  for(const s of fields)s.value=choice;for(const d of descriptions)d.textContent=current.label+' · '+current.fps+' FPS target · '+(current.shadows?current.shadows+'px shadows':'shadows off')+' · '+(gl.getContextAttributes()?.antialias?'antialiasing on':'antialiasing off')+'. Saved for all three games on this device.';
  const sharperTextures=mobile&&current.textureSize>residentTextureLimit;
  for(const {key,input}of tuningFields)input.value=String(tuning[key]??'auto');for(const button of restartButtons){button.hidden=!sharperTextures&&antialiasForDevice(presetAntialias(choice,tuning.aa),cores,memory,mobile)===!!gl.getContextAttributes()?.antialias;button.textContent=sharperTextures?'Load sharper textures & restart game':'Apply antialiasing & restart game';}
  if(sharperTextures)for(const description of descriptions)description.textContent+=' Restart to load the higher texture detail.';
  onApply?.();
 }
 function mount(parent:HTMLElement){const field=document.createElement('fieldset');field.className='touchSettings graphicsSettings';const legend=document.createElement('legend');legend.textContent='Graphics & performance';const label=document.createElement('label');label.textContent='Graphics preset';const select=document.createElement('select');select.setAttribute('aria-label','Graphics detail');select.add(new Option('Automatic · match this device','auto'));for(const [v,p]of Object.entries(GRAPHICS_PRESETS))select.add(new Option(p.label,v));select.value=choice;const description=document.createElement('p');description.setAttribute('role','status');select.onchange=()=>{choice=select.value as GraphicsChoice;tuning={};autoTier=undefined;resolutionScale=1;adaptiveDetail=1;try{localStorage.setItem('swoop-graphics-quality',choice);localStorage.removeItem(TUNING_KEY);}catch{}apply();};fields.push(select);descriptions.push(description);label.append(select);field.append(legend,label,description);
  const stable30=document.createElement('button');stable30.type='button';stable30.textContent='Stable · 30 FPS target';stable30.onclick=()=>{choice='low';autoTier=undefined;resolutionScale=1;adaptiveDetail=1;tuning={fps:30,shadows:0,textureSize:512,distance:180,resolution:1};try{localStorage.setItem('swoop-graphics-quality',choice);localStorage.setItem(TUNING_KEY,JSON.stringify(tuning));}catch{}apply();};field.append(stable30);
  const smooth60=document.createElement('button');smooth60.type='button';smooth60.textContent='Smooth · 60 FPS target';smooth60.onclick=()=>{choice='low';autoTier=undefined;resolutionScale=1;adaptiveDetail=1;tuning={...tuning,fps:60,shadows:0,textureSize:512,distance:180,resolution:1};try{localStorage.setItem('swoop-graphics-quality',choice);localStorage.setItem(TUNING_KEY,JSON.stringify(tuning));}catch{}apply();};field.append(smooth60);
  const advanced=document.createElement('details');advanced.className='graphicsAdvanced';const summary=document.createElement('summary');summary.textContent='Advanced graphics controls';advanced.append(summary);
  const specs:[keyof GraphicsTuning,string,[string,string][]][]=[['resolution','Resolution',[['auto','Preset'],['0.5','50% · fastest'],['0.75','75% · faster'],['1','100%'],['1.25','125% · sharper'],['1.5','150% · sharpest']]],['fps','Frame-rate limit',[['auto','Preset'],['30','30 FPS'],['60','60 FPS'],['90','90 FPS'],['120','120 FPS']]],['shadows','Shadow detail',[['auto','Preset'],['0','Off'],['1024','Low'],['2048','High'],['4096','Ultra']]],['textureSize','Texture detail',[['auto','Preset'],['512','Smooth · 512px'],['1024','Balanced · 1024px'],['2048','HD · 2048px'],['4096','Ultra · 4096px']]],['distance','Viewing distance',[['auto','Preset'],['180','Short · 180m'],['300','Medium · 300m'],['460','Far · 460m'],['600','Extra far · 600m']]],['aa','Antialiasing',[['auto','Automatic'],['off','Off · faster'],['on','On · smoother edges (MSAA)']]]];
  const restart=document.createElement('button');restart.type='button';restart.textContent='Apply antialiasing & restart game';restart.hidden=true;restart.onclick=()=>location.reload();restartButtons.push(restart);
  for(const [key,title,options]of specs){const row=document.createElement('label');row.textContent=title;const input=document.createElement('select');input.setAttribute('aria-label',title);for(const [value,text]of options)input.add(new Option(text,value));input.value=String(tuning[key]??'auto');tuningFields.push({key,input});input.onchange=()=>{if(input.value==='auto')delete tuning[key];else if(key==='aa')tuning.aa=input.value as GraphicsTuning['aa'];else tuning[key]=Number(input.value);try{localStorage.setItem(TUNING_KEY,JSON.stringify(tuning));}catch{}apply();};row.append(input);advanced.append(row);}
  const help=document.createElement('p');help.textContent='Other controls apply now. Changing antialiasing restarts the game. Higher FPS depends on the display and device. VR uses the headset refresh rate.';advanced.append(help);field.append(restart,advanced);parent.append(field);apply();}
 window.addEventListener('storage',event=>{if(event.key!=='swoop-graphics-quality'&&event.key!==TUNING_KEY)return;
  try{const saved=localStorage.getItem('swoop-graphics-quality');choice=['auto','low','balanced','high','ultra'].includes(saved??'')?saved as GraphicsChoice:'auto';tuning=savedGraphicsTuning(choice,localStorage.getItem(TUNING_KEY));autoTier=undefined;resolutionScale=1;adaptiveDetail=1;apply();}catch{}
 });
 apply();return {apply,applyAssets,mount,resize,downgradeAuto(){if(choice!=='auto'||resolved()==='low')return false;autoTier=resolved()==='high'?'balanced':'low';resolutionScale=1;apply();return true;},setAdaptiveDetail(detail:number){const next=choice==='auto'?T.MathUtils.clamp(detail,.65,1):1;if(next!==adaptiveDetail){adaptiveDetail=next;apply(false);}},setResolutionScale(scale:number){resolutionScale=T.MathUtils.clamp(scale,.65,1);resize();},get choice(){return choice;},get current(){return current;}};
}
