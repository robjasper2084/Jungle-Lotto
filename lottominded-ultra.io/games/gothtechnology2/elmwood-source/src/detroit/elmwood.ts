import {makeElmwoodVR} from './elmwood-vr.ts';
import {makeElmwoodQuality} from './elmwood-quality.ts';
import * as T from 'three';







import {OrbitControls} from 'three/addons/controls/OrbitControls.js';







import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';







import {makeElmwoodRide} from './elmwood-ride.ts';



import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';



import {ElmwoodTerrain} from './elmwood-terrain.ts';



import {ELMWOOD_YOUNG} from './elmwood-details.ts';



import {makeElmwoodEnvironment} from './elmwood-environment.ts';



import {makeElmwoodWeather,makeElmwoodWater,elmwoodSun,validElmwoodDate,type ElmwoodWeather} from './elmwood-weather.ts';



import {makeElmwoodSitePolish} from './elmwood-site-polish.ts';

import {configureElmwoodFoliage,seasonElmwoodFoliage} from './elmwood-foliage.ts';

import {elmwoodCreekPlantings,makeElmwoodCreekGarden} from './elmwood-creek-garden.ts';

import {ElmwoodPerformance} from './elmwood-performance.ts';

import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';





type Asset={id:string;label:string;vertices:number;triangles:number;dimensionsM:number[];confidence:string;glb:string};







type Placement={asset:string;position:number[];rotation:number;pitch?:number;roll?:number;scale:number;layer:string;confidence:string};







const el=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;







const canvas=el<HTMLCanvasElement>('view'),renderer=new T.WebGLRenderer({canvas,antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(Math.max(1,innerWidth),Math.max(1,innerHeight));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;







const scene=new T.Scene();scene.background=new T.Color('#b4c5bb');scene.fog=new T.FogExp2('#b4c5bb',.0005);const camera=new T.PerspectiveCamera(47,innerWidth/innerHeight,.1,4000);camera.position.set(460,650,550);const controls=new OrbitControls(camera,canvas);controls.target.set(-150,0,-410);controls.enableDamping=true;controls.maxDistance=2200;controls.minDistance=1;controls.maxPolarAngle=Math.PI*.495;







const hemi=new T.HemisphereLight('#dceaff','#495539',.8);scene.add(hemi);const sun=new T.DirectionalLight('#fff4df',3.2);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<750?1024:2048,innerWidth<750?1024:2048);sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;renderer.shadowMap.type=T.PCFSoftShadowMap;







const quality=makeElmwoodQuality(renderer,sun,scene,canvas);
const weather=makeElmwoodWeather(scene,camera,sun,hemi,renderer);



const pmrem=new T.PMREMGenerator(renderer);new RGBELoader().load('/elmwood/forest_grove_2k.hdr',hdr=>{const env=pmrem.fromEquirectangular(hdr);scene.environment=env.texture;scene.environmentIntensity=.65;hdr.dispose();pmrem.dispose();},undefined,e=>console.warn('Reflection environment unavailable',e));







const world=new T.Group(),dressing=new T.Group(),library=new T.Group();scene.add(world,library);world.add(dressing);library.visible=false;const loader=new GLTFLoader(),cache=new Map<string,T.Group>(),sharedMaterials=new Map<string,T.Material>(),sharedTextures=new Map<string,T.Texture>();const wind={value:0};let assets:Asset[]=[],placements:Placement[]=[],selection:T.Object3D|undefined;let stats='';







let rideControls:ReturnType<typeof makeElmwoodRide>|undefined;



let landmarkPass:{pond:{center:number[];ring:number[][]};avenueTrees:number}|undefined;



let treeTours:{sources:Record<string,string>;stops:Array<{species:string;tourStops:Array<{tour:string;number:number}>;placement:Placement}>}|undefined;

let creekGarden:ReturnType<typeof makeElmwoodCreekGarden>|undefined;

let environment:ReturnType<typeof makeElmwoodEnvironment>|undefined;



const landscapeTiles:T.Group[]=[];



function notice(s:string){el('status').textContent=s;}







async function load(id:string){







 if(cache.has(id))return cache.get(id)!;







 const gltf=await loader.loadAsync(`/elmwood/models/${id==='flying-geese-study'?'flying-geese-baked':id}.glb`);







 gltf.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=true;o.receiveShadow=true;







 const mm=Array.isArray(o.material)?o.material:[o.material];const reused=mm.map(m=>{







  const key=m.name.startsWith('leaf')?`${id}:${m.name}`:m.name;if(sharedMaterials.has(key))return sharedMaterials.get(key)!;







  if(m instanceof T.MeshStandardMaterial){







   for(const prop of ['map','normalMap','roughnessMap','metalnessMap','aoMap'] as const){const tex=m[prop];if(tex){const tk=tex.name+':'+tex.colorSpace;if(sharedTextures.has(tk))m[prop]=sharedTextures.get(tk)!;else sharedTextures.set(tk,tex);}}







   if(m.map)m.map.anisotropy=4;



   if(m.name==='Elmwood Pond Water'||/water/i.test(m.name)){m=makeElmwoodWater(m,weather.uniforms);}



   if(m.name==='Reference Muted historic glazing')m.envMapIntensity=.18;







   if(m.name.startsWith('leaf')){configureElmwoodFoliage(m);m.userData.species=id;m.onBeforeCompile=(shader:Parameters<T.MeshStandardMaterial['onBeforeCompile']>[0])=>{shader.uniforms.elmwoodWind=wind;shader.uniforms.elmwoodWindStrength=weather.uniforms.wind;shader.vertexShader='uniform float elmwoodWind,elmwoodWindStrength;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(elmwoodWind*1.6+position.y*.9+position.z*.7)*min(max(position.y,0.0)*.003, .05)*elmwoodWindStrength;');};m.customProgramCacheKey=()=> 'elmwood-leaf-wind-v2';}







  }weather.attach(m);sharedMaterials.set(key,m);return m;







 });o.material=Array.isArray(o.material)?reused:reused[0];});cache.set(id,gltf.scene);return gltf.scene;







}







function pos(p:number[]){return new T.Vector3(p[0],p[2],-p[1]);}







function fit(object:T.Object3D){const b=new T.Box3().setFromObject(object);const c=b.getCenter(new T.Vector3()),s=b.getSize(new T.Vector3());const d=Math.max(s.x,s.y,s.z,2);controls.target.copy(c);camera.position.copy(c).add(new T.Vector3(d*.9,d*.65,d*1.3));controls.update();}







let lastSolarDate=el<HTMLInputElement>('date').value;

const dateNotice=document.createElement('small');dateNotice.setAttribute('role','status');el('date').after(dateNotice);

function updateSun(){

 const date=el<HTMLInputElement>('date');

 if(validElmwoodDate(date.value)){lastSolarDate=date.value;dateNotice.textContent='';}

 else{date.value=lastSolarDate;dateNotice.textContent=' Previous valid date retained.';}

 const hour=Number(el<HTMLInputElement>('time').value),solar=elmwoodSun(hour,el<HTMLInputElement>('date').value);sun.position.copy(controls.target).add(new T.Vector3(solar.x,solar.y,solar.z).multiplyScalar(500));sun.target.position.copy(controls.target);el('hour').textContent=`${Math.floor(hour).toString().padStart(2,'0')}:${Math.round((hour%1)*60).toString().padStart(2,'0')}`;const radius=library.visible?30:85;Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:1,far:1100});sun.shadow.camera.updateProjectionMatrix();}



el<HTMLSelectElement>('weather').onchange=()=>weather.set(el<HTMLSelectElement>('weather').value as ElmwoodWeather);















type PhotoReference={file:string;label:string;note:string;source:string};



const patinaSource='https://stlouispatina.com/elmwood-cemetery-detroit/';



const chapelPanorama='https://www.google.com/maps/place/Elmwood+Cemetery/@42.3491851,-83.0192936,3a,75y,260h,90t/data=!3m8!1e1!3m6!1sCIHM0ogKEICAgIDc9ce4dw!2e10!3e11';



const patinaCredit='Chris Naffziger / Saint Louis Patina, 2023. Copyright retained; visual reference only.';



const landmarkPhotos:Record<string,PhotoReference[]>={



 'elmwood-chapel':[{file:'chapel-official-reference.jpg',label:'Official front photograph',note:'Cross-checked against Jonathan Brandt’s September 2014 Google Maps panorama: warm gray stone, brown woodwork, subdued glazing and weathered roofing. Colors are visual estimates; hidden elevations remain inferred.',source:'https://elmwoodhistoriccemetery.org/foundation/bequests'}],



 'elmwood-gatehouse':[{file:'patina/1803.jpg',label:'Street approach · 2023',note:patinaCredit+' Shows the glazed entrance, flanking wings, gates and relationship to the street.',source:patinaSource},{file:'gatehouse-reference.jpg',label:'Official facade detail',note:'Official cemetery photograph; tracery and stone-carving reference.',source:'https://elmwoodhistoriccemetery.org/foundation/history-of-elmwood-cemetery'}],



 'buhl-mausoleum':[{file:'patina/1790.jpg',label:'Front and right side · 2023',note:patinaCredit+' Model revised from the rough stone courses, curved supports, side window and layered cornice. Dimensions and site placement remain unmeasured.',source:patinaSource},{file:'buhl-reference.jpg',label:'Earlier frontal reference',note:'Earlier reference retained to compare the entrance composition.',source:'https://elmwoodhistoriccemetery.org/'}],



 'schmidt-mausoleum':[{file:'patina/1797.jpg',label:'Front detail · 2023',note:patinaCredit+' Clearly shows Ionic capitals, pediment wreath, bronze door panels and projecting porch.',source:patinaSource},{file:'schmidt-full-reference.jpg',label:'Surroundings · 2025',note:'Erin Marie Miller, 2025. Copyright retained; visual reference only. Useful for vegetation, approach and proportions.',source:'https://www.erinmariemiller.com/blog/2025/11/4/buried-history-elmwood-cemetery'}],



 'hammond-bank-vault':[{file:'patina/1794.jpg',label:'Hammond vault · frontal reference',note:patinaCredit+' Round-arched 1888 facade, iron grille and hillside retaining masonry. Placed using the official Center Tree Tour symbol; exact coordinates unmeasured.',source:patinaSource}],



 'davis-hillside-vault':[{file:'patina/1793.jpg',label:'Frontal facade · 2023',note:patinaCredit+' Low gable, shallow entrance arch and iron scrollwork. Official Center Tree Tour symbol supplies approximate site placement.',source:patinaSource}]



};



const photoSelect=document.createElement('select');photoSelect.setAttribute('aria-label','Reference photograph');el('landmark-photo').before(photoSelect);



const photoSource=document.createElement('a');photoSource.textContent='Original photograph source';photoSource.target='_blank';photoSource.rel='noopener';el('photo-note').after(photoSource);



const galleryLink=document.createElement('a');galleryLink.href='/elmwood/reference-gallery.html';galleryLink.target='_blank';galleryLink.rel='noopener';galleryLink.textContent='Browse 21 Detroit reference photographs';galleryLink.style.display='block';el('photo-toggle').after(galleryLink);



const panoramaLink=document.createElement('a');panoramaLink.href=chapelPanorama;panoramaLink.target='_blank';panoramaLink.rel='noopener';panoramaLink.textContent='Chapel panorama · September 2014 ↗';panoramaLink.style.display='block';galleryLink.after(panoramaLink);



const graveMapLink=document.createElement('a');graveMapLink.href=`https://www.google.com/maps?q=${ELMWOOD_YOUNG.latitude},${ELMWOOD_YOUNG.longitude}&t=k`;graveMapLink.target='_blank';graveMapLink.rel='noopener';graveMapLink.textContent='Coleman A. Young · satellite location ↗';graveMapLink.style.display='none';panoramaLink.after(graveMapLink);



const firemenMapLink=document.createElement('a');firemenMapLink.href='https://www.google.com/maps?q=42.351335,-83.021390&t=k';firemenMapLink.textContent='Firemen’s Lot · satellite reference ↗';firemenMapLink.target='_blank';firemenMapLink.rel='noopener';firemenMapLink.style.display='none';graveMapLink.after(firemenMapLink);



function updateLandmarkPhoto(reset=true){



 const refs=landmarkPhotos[el<HTMLSelectElement>('asset').value]??[];



 if(reset){photoSelect.replaceChildren(...refs.map((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=r.label;return o;}));}



 const ref=refs[Number(photoSelect.value)||0],img=el<HTMLImageElement>('landmark-photo');img.hidden=!ref;photoSelect.hidden=refs.length<2;photoSource.hidden=!ref;



 if(ref){img.src='/elmwood/references/'+ref.file;img.alt=ref.label;el('photo-note').textContent=ref.note;photoSource.href=ref.source;}



 else el('photo-note').textContent='No verified photographic match is attached to this asset. Browse the reference gallery for documented site context.';



}



photoSelect.onchange=()=>updateLandmarkPhoto(false);



el('photo-toggle').onclick=()=>{const panel=el('photo-review');panel.style.display=panel.style.display==='block'?'none':'block';updateLandmarkPhoto();};







async function choose(){



 // Remember early selections; the initial load calls choose again once their scene exists.



 if(!environment){el('detail').textContent='Loading the selected landmark…';return;}



 rideControls?.stop();updateLandmarkPhoto();const id=el<HTMLSelectElement>('asset').value;



 graveMapLink.style.display=id==='view-young'?'block':'none';



 firemenMapLink.style.display=id==='firemen-memorial'||id==='firemen-hydrant'?'block':'none';



 if(['view-pond','view-geese','view-car-lot','view-avenue','view-young','view-gates','view-grove','view-parking','view-bridges','view-crypts','view-creek','view-bench','view-creek-bench'].includes(id)){



  world.visible=true;library.visible=false;el<HTMLSelectElement>('mode').value='site';



  const p=id==='view-geese'?[environment!.birds[0].state.x,environment!.birds[0].state.north,environment!.birds[0].rig.g.position.y]:id==='view-car-lot'?[-12.325,13.715,1]:id==='view-creek'?[-110,293,-4]:id==='view-creek-bench'?[-32,160.12,-4.373825124686446]:id==='view-bench'?[15,62,0]:id==='view-parking'?[-5,22,1]:id==='view-bridges'?[-136.3515,317.686,-3.06]:id==='view-crypts'?[-125.777,339.466,2.2]:id==='view-pond'?landmarkPass!.pond.center:id==='view-grove'?[24,111,1]:[-10,55,1];const c=id==='view-young'?environment!.young.position.clone():id==='view-gates'?environment!.gate.position.clone():pos(p);



  controls.target.copy(c);camera.position.copy(c).add(id==='view-geese'?new T.Vector3(2,1.1,2):id==='view-car-lot'?new T.Vector3(6,3,7):id==='view-creek'?new T.Vector3(14,10,18):id==='view-creek-bench'?new T.Vector3(4,2.5,6):id==='view-bench'?new T.Vector3(5,3,7):id==='view-parking'?new T.Vector3(28,35,32):id==='view-bridges'?new T.Vector3(11,5,9):id==='view-crypts'?new T.Vector3(12,8,14):id==='view-pond'?new T.Vector3(25,78,55):id==='view-young'?new T.Vector3(2,2.7,5):id==='view-gates'?new T.Vector3(13,6,-10):id==='view-grove'?new T.Vector3(63,110,135):new T.Vector3(18,9,30));



  el('detail').textContent=id==='view-pond'?'Elmwood Pond · fountain, swimming ducks and protective geese. Shoreline and water height are approximate.':id==='view-young'?'Coleman A. Young · Hazel Dell, heritage tour stop 30. Placed at the recorded grave GPS: 42.3492177, −83.0196698. Contributor coordinates checked against Google satellite imagery; not survey-certified.':id==='view-gates'?'Elmwood entrance · open iron gates and low driveway curbs. Exact dimensions inferred from photographs.':`Tree-lined lanes · ${landmarkPass!.avenueTrees} mature trees along mapped roads. Individual trunk positions are estimated.`;



  if(id==='view-geese')el('detail').textContent='Canada geese - approximately 0.86 m tall with Higgsfield plumage, metre-scale Blender models, walking, grazing, swimming and a brief protective chase.';

  if(id==='view-car-lot')el('detail').textContent='Black 2018 Chrysler 300S Sport - parked in the gatehouse bay as requested. A second car is parked on the grass beside the Davis/Schmidt lane.';

  if(id==='view-grove')el('detail').textContent='Black walnut grove · the two marked lawns behind the gatehouse, beside Bloody Run. Estimated grave markers removed; walnut spacing follows the open paths and creek. Junction bench faces the lane. Individual placements are approximate.';



  if(id==='view-parking')el('detail').textContent='Gatehouse parking forecourt · satellite-informed paved outline, bays and wheel stops. Parking markings and planting edges interpreted.';



  if(id==='view-bridges')el('detail').textContent='Three Bloody Run crossings · each bridge follows its mapped span, with full-height parapets and rideable deck transitions. Decorative stonework and widths are photo estimates.';



  if(id==='view-crypts')el('detail').textContent='Mapped hillside crypt · entrance cleared above the sloping grade. The family identity and exact facade remain unverified. Buhl, Alger, Schmidt, Hammond and Davis can now be focused separately in the cemetery.';

  if(id==='view-creek')el('detail').textContent='Bloody Run Creek · bank-side flower drifts, low bushes and the requested weeping willow cluster. Planting follows the mapped creek with clear paths and bridges; individual flowers and species are interpreted.';

  if(id==='view-bench')el('detail').textContent='Second junction bench · placed in the marked grass verge facing the curved lane, with room for riders to pass.';



  controls.update();updateSun();return;



 }



 if(id.startsWith('tree-tour-')){

 const stop=treeTours!.stops[Number(id.slice(10))],p=stop.placement,c=pos(p.position);

 const height=(assets.find(a=>a.id===p.asset)?.dimensionsM[2]??16)*p.scale;

 world.visible=true;library.visible=false;el<HTMLSelectElement>('mode').value='site';controls.target.copy(c).add(new T.Vector3(0,height*.45,0));camera.position.copy(c).add(new T.Vector3(18,Math.max(30,height+12),21));controls.update();

 el('detail').textContent=stop.species+' - '+stop.tourStops.map(s=>s.tour+' tour '+s.number).join(' / ')+'. Species follows the official Tree Tour. Trunk location is diagram-aligned; crown and leaf geometry are an approximation.';updateSun();return;

 }

 const a=assets.find(x=>x.id===id)!;library.clear();const model=(await load(id)).clone(true);library.add(model);selection=model;el('detail').textContent=`${a.label} · ${a.triangles.toLocaleString()} triangles · ${a.dimensionsM.map(x=>x.toFixed(1)).join(' × ')} m. ${a.confidence.replace(/\.$/,'')}.`;if(library.visible)fit(model);else{const p=placements.find(x=>x.asset===id);if(p){const c=pos(p.position),davis=id==='davis-hillside-vault'||id==='hammond-bank-vault';controls.target.copy(c).add(new T.Vector3(0,id==='elmwood-park-bench' ? .5 : id==='firemen-memorial' ? 5.2 : davis?1.6:id==='chrysler-300s-2018'?.7:3,0));const distance=davis?15:12;camera.position.copy(c).add(id==='elmwood-park-bench'?new T.Vector3(-4,2.3,3.5):id==='firemen-memorial'?new T.Vector3(-19,11,14):/crypt|mausoleum|vault/.test(id)?new T.Vector3(Math.sin(p.rotation)*distance+Math.cos(p.rotation)*3,davis?4.3:3.8,Math.cos(p.rotation)*distance-Math.sin(p.rotation)*3):id==='chrysler-300s-2018'?new T.Vector3(Math.sin(p.rotation)*7+Math.cos(p.rotation)*4,2.6,Math.cos(p.rotation)*7-Math.sin(p.rotation)*4):new T.Vector3(19,6,27));}else el('detail').textContent+=' This asset has no verified site position. Switch to individual asset review.';}updateSun();



}







el<HTMLSelectElement>('mode').onchange=()=>{

 const review=el<HTMLSelectElement>('mode').value==='library',select=el<HTMLSelectElement>('asset');

 for(const option of select.options)option.disabled=review&&(option.value.startsWith('view-')||option.value.startsWith('tree-tour-'));

 if(review&&(select.value.startsWith('view-')||select.value.startsWith('tree-tour-')))select.value='elmwood-gatehouse';

 library.visible=review;world.visible=!library.visible;scene.fog=library.visible?null:new T.FogExp2('#b4c5bb',.0005);void choose();};el<HTMLSelectElement>('asset').onchange=()=>void choose();el('focus').onclick=()=>void choose();el('top').onclick=()=>{rideControls?.stop();notice('Top-down overview · drag to explore or start another ride.');if(library.visible&&selection){fit(selection);camera.position.copy(controls.target).add(new T.Vector3(.01,55,0));}else{controls.target.set(-130,0,-450);camera.position.set(-130,1100,-449.9);}controls.update();};el<HTMLInputElement>('dressing').onchange=()=>{dressing.visible=el<HTMLInputElement>('dressing').checked;};el<HTMLInputElement>('time').oninput=updateSun;el<HTMLInputElement>('date').onchange=updateSun;el('audit-toggle').onclick=()=>{const a=el('audit');a.style.display=a.style.display==='block'?'none':'block';};







el<HTMLSelectElement>('season').onchange=()=>{const season=el<HTMLSelectElement>('season').value;creekGarden?.setSeason(season);for(const m of sharedMaterials.values())if(m instanceof T.MeshStandardMaterial&&m.name.startsWith('leaf')){seasonElmwoodFoliage(m,season);}};







try{







 [assets,placements,landmarkPass,treeTours]=await Promise.all([fetch('/elmwood/asset-manifest.json').then(r=>r.json()),fetch('/elmwood/placements.json').then(r=>r.json()),fetch('/elmwood/landmark-improvements.json').then(r=>r.json()),fetch('/elmwood/tree-tours.json').then(r=>r.json())]);







 placements=placements.filter(p=>p.layer==='mapped'||Math.hypot(p.position[0]-ELMWOOD_YOUNG.x,p.position[1]-ELMWOOD_YOUNG.north)>4);



 el<HTMLSelectElement>('asset').replaceChildren(...[{id:'view-pond',label:'Pond, fountain and wildlife'},{id:'view-geese',label:'Canada geese - shore view'},{id:'view-car-lot',label:'Chrysler - gatehouse parking'},{id:'view-creek',label:'Bloody Run flowers and willows'},{id:'view-bench',label:'Second junction bench'},{id:'view-creek-bench',label:'New creek overlook bench'},{id:'view-parking',label:'Gatehouse parking and planting'},{id:'view-bridges',label:'Bloody Run stone bridges'},{id:'view-crypts',label:'Pond-side crypt'},{id:'view-grove',label:'Black walnut grove and junction bench'},{id:'view-young',label:'Coleman A. Young · Hazel Dell'},{id:'view-gates',label:'Entrance gates and curbs'},{id:'view-avenue',label:'Tree-lined entrance lanes'},...assets,...treeTours!.stops.map((s,i)=>({id:'tree-tour-'+i,label:'Tree Tour - '+s.species}))].map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.label;return o;}));



 el<HTMLSelectElement>('asset').value='elmwood-gatehouse';







 const foundation=await load('elmwood-foundation');

 // Smooth shared terrain normals after the pond DEM edits; preserve the measured elevations.

 foundation.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('USGS_')){const g=o.geometry.clone();g.deleteAttribute('normal');g.deleteAttribute('tangent');o.geometry=mergeVertices(g,.001);o.geometry.computeVertexNormals();g.dispose();}});

 world.add(foundation);





 const ids=[...new Set(placements.map(p=>p.asset).filter(id=>assets.some(a=>a.id===id)))];







 // Bounded loading prevents a burst of texture decoding across every asset.







 for(let i=0;i<ids.length;i+=3)await Promise.all(ids.slice(i,i+3).map(load));







 for(const id of ids){



  const ps=placements.filter(p=>p.asset===id),source=cache.get(id)!;source.updateMatrixWorld(true);



  if(ps[0].layer==='mapped'||ps[0].layer==='reference'){for(const p of ps){const clone=source.clone(true);clone.position.copy(pos(p.position));clone.rotation.set(p.pitch??0,p.rotation,p.roll??0,'YXZ');clone.scale.setScalar(p.scale);world.add(clone);}}



  else{



   const tiles=new Map<string,Placement[]>();for(const p of ps){const key=Math.floor(p.position[0]/80)+','+Math.floor(p.position[1]/80);const bucket=tiles.get(key)??[];bucket.push(p);tiles.set(key,bucket);}



   for(const [key,bucket] of tiles){const tile=new T.Group(),[x,north]=key.split(',').map(Number);tile.userData.center=new T.Vector3(x*80+40,0,-north*80-40);dressing.add(tile);landscapeTiles.push(tile);



    source.traverse(o=>{if(!(o instanceof T.Mesh))return;const inst=new T.InstancedMesh(o.geometry,o.material,bucket.length);inst.castShadow=true;inst.receiveShadow=true;const m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3();bucket.forEach((p,i)=>{q.setFromAxisAngle(new T.Vector3(0,1,0),p.rotation);s.setScalar(p.scale);m.compose(pos(p.position),q,s);m.multiply(o.matrixWorld);inst.setMatrixAt(i,m);});inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();tile.add(inst);});



   }



  }



 }







 const [grid,site]=await Promise.all([fetch('/elmwood/terrain.json').then(r=>r.json()),fetch('/elmwood/site.json').then(r=>r.json())]);



 const terrain=new ElmwoodTerrain(grid,site.features,placements);



 environment=makeElmwoodEnvironment(scene,world,foundation,terrain,landmarkPass!.pond);



 const planting=elmwoodCreekPlantings(terrain,site.boundary);

 creekGarden=makeElmwoodCreekGarden(world,terrain,[...planting.flowers,...planting.gardens]);creekGarden.materials.forEach(m=>weather.attach(m));quality.apply();

 Object.assign(canvas.dataset,{treeTourTrees:String(treeTours!.stops.length),creekFlowers:String(planting.flowers.length*9),gardenFlowers:String(planting.gardens.length*9),creekShrubs:String(planting.shrubs.length)});

 const polish=makeElmwoodSitePolish(world,terrain,planting.shrubs);polish.materials.forEach(m=>weather.attach(m));



 world.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])weather.attach(m);});



 const audit=await fetch('/elmwood/placement-audit.json').then(r=>r.json());const ul=document.createElement('ul');for(const s of audit.unresolved){const li=document.createElement('li');li.textContent=s;ul.append(li);}el('audit-findings').append(ul);







 stats=`USGS 1m source / 2m display · 41 mapped paths · ${assets.length} assets · ${placements.filter(p=>p.layer!=='mapped').length.toLocaleString()} estimated landscape instances`;notice(stats);await choose();el('detail').dataset.loaded='true';







}catch(e){el('error').textContent=String(e);notice('Loading failed — see the error panel.');console.error(e);}







rideControls=makeElmwoodRide(scene,camera,controls,canvas,notice,()=>{world.visible=true;library.visible=false;el<HTMLSelectElement>('mode').value='site';for(const o of el<HTMLSelectElement>('asset').options)o.disabled=false;},()=>environment?.birds.map(({state:b},i)=>({id:'bird-'+i,kind:b.kind,x:b.x,z:-b.north,radius:b.kind==='goose'?.38:.25,water:b.swimming}))??[]);



const vr=makeElmwoodVR(scene,camera,renderer,canvas,rideControls);
const frameStats=new ElmwoodPerformance();

addEventListener('visibilitychange',()=>frameStats.resetWindow());

const performanceLabel=document.createElement('label'),performanceToggle=document.createElement('input'),performanceReadout=document.createElement('output');

performanceToggle.type='checkbox';performanceToggle.id='elmwood-performance';performanceLabel.append(performanceToggle,' Show measured performance');

performanceReadout.hidden=true;performanceReadout.style.display='none';performanceReadout.style.fontSize='12px';

performanceToggle.onchange=()=>{performanceReadout.hidden=!performanceToggle.checked;performanceReadout.style.display=performanceToggle.checked?'block':'none';};

el('date').after(performanceLabel,performanceReadout);

const started=performance.now();let lastFrame=started;const sunDirection=new T.Vector3();function animate(){const now=performance.now();if(!renderer.xr.isPresenting&&(document.hidden||document.querySelector<HTMLDialogElement>('#elmwood-main-menu')?.open||now-lastFrame<1000/quality.current.fps-.5))return;const t=(now-started)/1000,dt=Math.min(.1,(now-lastFrame)/1000);wind.value=quality.current.wind?t:0;vr.beforeFrame();rideControls?.update(dt);vr.afterFrame();const paused=canvas.dataset.riding==='true'&&canvas.dataset.paused==='true';sunDirection.copy(sun.position).sub(sun.target.position).normalize();weather.update(dt,sunDirection,world.visible,paused);sun.target.position.copy(controls.target);sun.position.copy(controls.target).addScaledVector(sunDirection,500);const chasing=environment?.update(dt,{x:Number(canvas.dataset.x)||0,north:-(Number(canvas.dataset.z)||0),active:canvas.dataset.riding==='true'},sunDirection.copy(sun.position).sub(sun.target.position),paused,weather.uniforms,rideControls?.dogThreats());canvas.dataset.weather=weather.mode;canvas.dataset.wetness=weather.uniforms.wet.value.toFixed(2);canvas.dataset.chasingBirds=String(chasing??0);canvas.dataset.fleeingBirds=String(environment?.birds.filter(b=>b.state.mode==='flee').length??0);lastFrame=now;if(controls.enabled&&(canvas.dataset.riding!=="true"||canvas.dataset.cameraMode!=="orbit"))controls.update();for(const tile of landscapeTiles){tile.visible=canvas.dataset.riding!=="true"||(rideControls?.nearPlayers(tile.userData.center,quality.current.distance)??true);}



if(!rideControls?.render(renderer))renderer.render(scene,camera);const measured=frameStats.rendered(now);canvas.dataset.frames=String(frameStats.frames);

if(measured){canvas.dataset.fps=frameStats.fps.toFixed(1);canvas.dataset.frameMsP95=frameStats.frameMsP95.toFixed(1);canvas.dataset.frameMsP99=frameStats.frameMsP99.toFixed(1);performanceReadout.textContent=frameStats.fps.toFixed(1)+' FPS · p95 '+frameStats.frameMsP95.toFixed(1)+' ms · '+renderer.info.render.calls+' draw calls';}canvas.dataset.drawCalls=String(renderer.info.render.calls);}renderer.setAnimationLoop(animate);addEventListener('resize',()=>{if(renderer.xr.isPresenting)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();quality.resize();});
















