import * as T from 'three';

import {loadElmwoodGoose} from './elmwood-goose.ts';



import {Sky} from 'three/addons/objects/Sky.js';



import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';



import {ElmwoodTerrain} from './elmwood-terrain.ts';



import {ELMWOOD_GATE,ELMWOOD_YOUNG,inRing} from './elmwood-details.ts';



import {stepBird,type BirdState,type WildlifeRider,type WildlifeDog} from './elmwood-wildlife.ts';







type Pond={center:number[];ring:number[][]};



const scratch=new T.Object3D();



function stoneMaterial(color:string,polished=false){



 const m=new T.MeshStandardMaterial({color,roughness:polished?.23:.87,metalness:polished?.12:0});



 m.onBeforeCompile=s=>{



  s.vertexShader='varying vec3 stoneP;\n'+s.vertexShader;



  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstoneP=(modelMatrix*vec4(position,1.)).xyz;');



  s.fragmentShader='varying vec3 stoneP;\nfloat grain(vec3 p){return fract(sin(dot(floor(p),vec3(127.1,311.7,74.7)))*43758.5453);}\n'+s.fragmentShader;



  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>



   float grit=grain(stoneP*170.);float mottling=grain(stoneP*6.);diffuseColor.rgb*=.84+.26*grit+.10*mottling;`);



 };m.customProgramCacheKey=()=> 'elmwood-mineral-grain';return m;



}



function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}



function box(parent:T.Object3D,m:T.Material,w:number,h:number,d:number,x=0,y=0,z=0){return mesh(parent,new T.BoxGeometry(w,h,d),m,x,y,z);}



function oval(g:T.BufferGeometry,s:number[],p:number[]){return g.clone().scale(s[0],s[1],s[2]).translate(p[0],p[1],p[2]);}



function painted(g:T.BufferGeometry,c:string){const color=new T.Color(c),count=g.getAttribute('position').count,a=new Float32Array(count*3);for(let i=0;i<count;i++)color.toArray(a,i*3);g.setAttribute('color',new T.BufferAttribute(a,3));return g;}







export function makeElmwoodEnvironment(scene:T.Scene,world:T.Group,foundation:T.Group,terrain:ElmwoodTerrain,pond:Pond){



 const root=new T.Group();root.name='Elmwood reference details and pond wildlife';world.add(root);



 const limestone=stoneMaterial('#a2a09a'),granite=stoneMaterial('#191e1d',true),iron=new T.MeshStandardMaterial({color:'#263633',roughness:.56,metalness:.68});



 const sky=new Sky();sky.scale.setScalar(2200);scene.add(sky);const skyU=sky.material.uniforms;skyU.turbidity.value=3;skyU.rayleigh.value=1.55;skyU.mieCoefficient.value=.006;skyU.mieDirectionalG.value=.82;



 const clouds=new T.Mesh(new T.SphereGeometry(1700,24,12),new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,uniforms:{sunHeight:{value:.7},cloudCover:{value:.16},cloudTime:{value:0},rain:{value:0}},vertexShader:'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 d;uniform float sunHeight,cloudCover,cloudTime,rain;



 float n(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(n(i),n(i+vec2(1,0)),f.x),mix(n(i+vec2(0,1)),n(i+1.),f.x),f.y);}



 void main(){vec3 v=normalize(d);vec2 p=v.xz/max(.15,v.y)*3.+vec2(cloudTime*.006,cloudTime*.002);float q=noise(p)*.65+noise(p*2.1)*.25+noise(p*4.3)*.1;float a=smoothstep(.69-cloudCover*.53,.87-cloudCover*.49,q)*smoothstep(.03,.2,v.y)*(.42+cloudCover*.56);gl_FragColor=vec4(mix(vec3(.92,.68,.46),vec3(.97-rain*.48),smoothstep(.02,.5,sunHeight))*mix(.10,1.,smoothstep(-.08,.1,sunHeight)),a);}` }));clouds.renderOrder=1;scene.add(clouds);







 // Existing broad horizontal stripes came from stretched stone UVs. Replace that material with fine mineral grain.



 world.traverse(o=>{if(o instanceof T.Mesh){const fix=(m:T.Material)=>/granite|weathered.stone/i.test(m.name)&&!m.name.includes('reference')?limestone:m;o.material=Array.isArray(o.material)?o.material.map(fix):fix(o.material);}});



 const curbMesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),limestone,terrain.curbs.length);root.add(curbMesh);curbMesh.castShadow=true;curbMesh.receiveShadow=true;



 terrain.curbs.forEach((c,i)=>{const sin=Math.sin(c.heading),cos=Math.cos(c.heading),a=terrain.ground(c.x-sin*c.length/2,c.north+cos*c.length/2),b=terrain.ground(c.x+sin*c.length/2,c.north-cos*c.length/2);scratch.position.set(c.x,(a+b)/2+.06,-c.north);scratch.rotation.set(-Math.atan2(b-a,c.length),c.heading,0,'YXZ');scratch.scale.set(c.width,.19,c.length);scratch.updateMatrix();curbMesh.setMatrixAt(i,scratch.matrix);});curbMesh.computeBoundingSphere();







 // Open iron leaves and masonry piers straddle the mapped entry driveway; the centre stays rideable.



 const gate=new T.Group();gate.name='Open Elmwood entrance gates';gate.position.set(ELMWOOD_GATE.x,terrain.ground(ELMWOOD_GATE.x,ELMWOOD_GATE.north),-ELMWOOD_GATE.north);gate.rotation.y=ELMWOOD_GATE.heading;root.add(gate);



 for(const side of [-1,1]){const px=side*(ELMWOOD_GATE.opening/2+.4);box(gate,limestone,.8,2.8,.85,px,1.4);box(gate,limestone,1,.18,1,px,2.86);mesh(gate,new T.ConeGeometry(.35,.38,4),limestone,px,3.14).rotation.y=Math.PI/4;



  const leaf=new T.Group();leaf.position.set(side*ELMWOOD_GATE.opening/2,0,0);leaf.rotation.y=side*1.48;gate.add(leaf);



  for(let i=0;i<13;i++){const x=-side*i*.2;box(leaf,iron,.035,1.9,.035,x,1.1);mesh(leaf,new T.ConeGeometry(.062,.16,4),iron,x,2.10);}



  for(const y of [.22,1.56,1.94])box(leaf,iron,2.5,.055,.06,-side*1.25,y);



  for(const y of [.24,1.86])box(gate,iron,.045,.055,4,px,y,-2.25);for(let i=0;i<18;i++)box(gate,iron,.04,1.8,.035,px,1.05,-.5-i*.22);



 }







 const young=new T.Group();young.name='Coleman A Young — Hazel Dell';young.position.set(ELMWOOD_YOUNG.x,terrain.ground(ELMWOOD_YOUNG.x,ELMWOOD_YOUNG.north),-ELMWOOD_YOUNG.north);young.rotation.y=ELMWOOD_YOUNG.heading;root.add(young);



 box(young,granite,2.1,.23,.85,0,.115);box(young,granite,1.82,1.25,.5,0,.855);box(young,granite,2.02,.22,.68,0,1.56);



 const inscription=document.createElement('canvas');inscription.width=1024;inscription.height=720;const ctx=inscription.getContext('2d')!;ctx.fillStyle='#141c1a';ctx.fillRect(0,0,1024,720);ctx.fillStyle='#d7c382';ctx.textAlign='center';



 for(const [line,y,size]of [['HONORABLE MAYOR',115,36],['COLEMAN A. YOUNG',208,65],['MAY 24, 1918 — NOV. 29, 1997',290,34],['DETROIT’S FIRST BLACK MAYOR',400,32],['1974 — 1993',462,37],['U.S. ARMY AIR CORPS',555,28],['TUSKEGEE AIRMAN',604,30]] as const){ctx.font=`${size}px Georgia`;ctx.fillText(line,512,y);}



 const faceTex=new T.CanvasTexture(inscription);faceTex.colorSpace=T.SRGBColorSpace;const faceMat=new T.MeshStandardMaterial({map:faceTex,roughness:.29,metalness:.18});mesh(young,new T.PlaneGeometry(1.59,1.12),faceMat,0,.88,.256);



 // Small memorial flags and flowers match the photograph without reproducing its pixels.



 const flagCanvas=document.createElement('canvas');flagCanvas.width=260;flagCanvas.height=140;const fc=flagCanvas.getContext('2d')!;for(let i=0;i<13;i++){fc.fillStyle=i%2?'#f5eee2':'#a52d39';fc.fillRect(0,i*140/13,260,140/13+1);}fc.fillStyle='#243450';fc.fillRect(0,0,110,76);fc.fillStyle='#eee9d7';for(let y=0;y<5;y++)for(let x=0;x<6;x++){fc.beginPath();fc.arc(10+x*17,8+y*14,1.6,0,Math.PI*2);fc.fill();}const ft=new T.CanvasTexture(flagCanvas);ft.colorSpace=T.SRGBColorSpace;



 for(const s of [-1,1]){mesh(young,new T.CylinderGeometry(.009,.009,1.1,6),iron,s*1.1,.55,.45);mesh(young,new T.PlaneGeometry(.39,.24),new T.MeshStandardMaterial({map:ft,side:T.DoubleSide,roughness:.8}),s*1.1+.19,.91,.45);}







 // Replace uniform low-poly shore pebbles with irregular, rounded fieldstone clusters.



 const oldRocks:T.Object3D[]=[];foundation.traverse(o=>{if(o.name.startsWith('Pond_bank_stone'))oldRocks.push(o);});oldRocks.forEach(o=>o.visible=false);



 const rockGeo=new T.IcosahedronGeometry(1,2),rp=rockGeo.getAttribute('position');for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),r=1+.13*Math.sin(x*7+y*5)*Math.cos(z*9);rp.setXYZ(i,x*r,y*r,z*r);}rockGeo.computeVertexNormals();const rockMat=stoneMaterial('#72746a');



 const rocks=new T.InstancedMesh(rockGeo,rockMat,oldRocks.length);rocks.castShadow=true;rocks.receiveShadow=true;root.add(rocks);foundation.updateMatrixWorld(true);



 oldRocks.forEach((o,i)=>{o.getWorldPosition(scratch.position);scratch.position.y+=.05;scratch.rotation.set(i*.71,i*2.39,i*.18);scratch.scale.set(.55+(i%5)*.13,.22+(i%4)*.06,.4+(i%3)*.12);scratch.updateMatrix();rocks.setMatrixAt(i,scratch.matrix);rocks.setColorAt(i,new T.Color().setHSL(.13,.05,.68+(i%7)*.035));});rocks.computeBoundingSphere();







 const water=pond.center[2],fountain=new T.Group();fountain.name='Elmwood pond fountain';fountain.position.set(pond.center[0],water+.03,-pond.center[1]);root.add(fountain);



 mesh(fountain,new T.CylinderGeometry(.55,.62,.13,20),iron);mesh(fountain,new T.CylinderGeometry(.05,.09,.28,12),iron,0,.14);



 const dropCount=420,dropArray=new Float32Array(dropCount*3),dropsGeometry=new T.BufferGeometry();dropsGeometry.setAttribute('position',new T.BufferAttribute(dropArray,3));



 const sprayMaterial=new T.PointsMaterial({color:'#edf8fa',size:.085,transparent:true,opacity:.64,depthWrite:false,sizeAttenuation:true});
 sprayMaterial.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_particle_fragment>', '#include <map_particle_fragment>\nfloat dropRadius=length(gl_PointCoord-.5);diffuseColor.a*=1.-smoothstep(.18,.5,dropRadius);');};sprayMaterial.customProgramCacheKey=()=> 'elmwood-soft-fountain-v1';const spray=new T.Points(dropsGeometry,sprayMaterial);spray.frustumCulled=false;fountain.add(spray);



 const rippleMaterial=new T.MeshBasicMaterial({color:'#c7e2dd',transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide});const ripples=Array.from({length:5},()=>{const r=mesh(fountain,new T.RingGeometry(.97,1,48),rippleMaterial.clone());r.rotation.x=-Math.PI/2;r.position.y=.045;r.castShadow=false;return r;});







 // Garden flowers are shared with the creek planting pass to keep graves and access lanes clear.
 const sphere=new T.SphereGeometry(1,12,9),birdMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.86});



 function birdModel(kind:'goose'|'duck'){



  const g=new T.Group(),goose=kind==='goose',body=goose?'#857b66':'#978e7c',breast=goose?'#c8c1a6':'#6f4538',parts=[painted(oval(sphere,[.25,.28,.48],[0,.47,0]),body),painted(oval(sphere,[.205,.21,.29],[0,.47,.23]),breast),painted(oval(sphere,[.13,.10,.28],[0,.48,-.43]),'#353a35')];



  mesh(g,mergeGeometries(parts),birdMat);



  const neck=new T.Group();neck.position.set(0,.60,.30);g.add(neck);



  const neckParts=[painted(oval(sphere,[.081,goose?.32:.13,.09],[0,goose?.22:.08,.035]),goose?'#292c28':'#174e36'),painted(oval(sphere,[.125,.14,.17],[0,goose?.53:.19,.08]),goose?'#242823':'#245a3d'),painted(oval(sphere,[.09,.033,.14],[0,goose?.49:.15,.27]),goose?'#232823':'#c7aa42')];



  if(goose)neckParts.push(painted(oval(sphere,[.125,.051,.10],[0,.465,.11]),'#f1eee0'));



  for(const side of [-1,1])neckParts.push(painted(oval(sphere,[.015,.018,.019],[side*.12,goose?.565:.22,.155]),'#060908'));



  mesh(neck,mergeGeometries(neckParts),birdMat);



  const wings:T.Group[]=[],legs:T.Group[]=[];



  for(const s of [-1,1]){const wing=new T.Group();wing.position.set(s*.20,.56,-.04);g.add(wing);wings.push(wing);mesh(wing,painted(oval(sphere,[.075,.19,.37],[s*.026,-.035,-.04]),goose?'#635f50':'#625f55'),birdMat);mesh(wing,painted(oval(sphere,[.08,.045,.17],[s*.04,-.05,-.04]),goose?'#acaa92':'#354f80'),birdMat);



   const leg=new T.Group();leg.position.set(s*.13,.30,0);g.add(leg);legs.push(leg);mesh(leg,painted(new T.CylinderGeometry(.018,.022,.23,6).translate(0,-.11,0),goose?'#3d453b':'#d48b32'),birdMat);mesh(leg,painted(oval(sphere,[.057,.018,.098],[0,-.235,.045]),goose?'#39433b':'#cf852e'),birdMat);



  }g.scale.setScalar(goose?.68:.55);return {g,neck:neck as T.Object3D,wings:wings as T.Object3D[],legs:legs as T.Object3D[],model:false};



 }



 const birds:{state:BirdState;rig:ReturnType<typeof birdModel>}[]=[];



 for(let i=0;i<14;i++){



  const kind=i<8?'goose':'duck',a=i*2.39996;let x=pond.center[0]+Math.cos(a)*8,n=pond.center[1]+Math.sin(a)*16;



  if(i<6){const p=pond.ring[Math.floor(i*pond.ring.length/6)],dx=p[0]-pond.center[0],dn=p[1]-pond.center[1],len=Math.hypot(dx,dn);x=p[0]+dx/len*3.8;n=p[1]+dn/len*3.8;const lane=terrain.nearest(x,n);x=lane.x+(x-lane.x)*.45;n=lane.north+(n-lane.north)*.45;}



  if(i===0){const lane=terrain.nearest(pond.center[0],pond.center[1]);x=lane.x+.8;n=lane.north+2;}



  const state:BirdState={x,north:n,homeX:x,homeNorth:n,heading:a,phase:i*1.73,age:0,cooldown:0,mode:'roam',kind,speed:0,swimming:inRing(x,n,pond.ring)},rig=birdModel(kind);root.add(rig.g);birds.push({state,rig});



 }



 loadElmwoodGoose().then(template=>{

  for(const {state,rig} of birds){if(state.kind!=='goose')continue;rig.g.clear();rig.g.scale.setScalar(.94+(state.phase%1)*.06);const model=template.clone(true);rig.g.add(model);rig.neck=model.getObjectByName('Neck')!;rig.wings=['L','R'].map(s=>model.getObjectByName('Wing_'+s)!);rig.legs=['L','R'].map(s=>model.getObjectByName('Leg_'+s)!);rig.model=true;}

  document.getElementById('view')!.dataset.gooseAsset='Blender / Higgsfield - 0.86 m';

 }).catch(e=>console.warn('Detailed goose unavailable; using small fallback',e));

 const wakeMat=new T.MeshBasicMaterial({color:'#c6ddd4',transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide});

 const wakes=birds.map(()=>{const w=mesh(root,new T.RingGeometry(.36,.39,24),wakeMat);w.rotation.x=-Math.PI/2;w.castShadow=false;return w;});

 const warning=document.createElement('div');warning.id='wildlife-warning';warning.setAttribute('role','status');warning.style.cssText='display:none;position:absolute;bottom:90px;left:24px;max-width:calc(100vw - 48px);padding:10px 14px;border-radius:8px;background:#24392ce8;color:#ffde8f;pointer-events:none;font:13px system-ui';document.body.append(warning);



 let elapsed=0;



 return {root,young,fountain,gate,birds,sky,update(dt:number,rider:WildlifeRider,sunDirection:T.Vector3,paused=false,weather?:{cloud:{value:number};time:{value:number};rain:{value:number};waterTime?:{value:number};waterDetail?:{value:number}},dogs:readonly WildlifeDog[]=[]){



  sky.visible=world.visible;clouds.visible=world.visible;skyU.sunPosition.value.copy(sunDirection).normalize();(clouds.material as T.ShaderMaterial).uniforms.sunHeight.value=sunDirection.y/sunDirection.length();



  if(weather){const u=(clouds.material as T.ShaderMaterial).uniforms;u.cloudCover.value=weather.cloud.value;u.cloudTime.value=weather.time.value;u.rain.value=weather.rain.value;skyU.turbidity.value=2.5+weather.cloud.value*7;skyU.rayleigh.value=1.6-weather.cloud.value*.5;}



  if(paused)return;elapsed+=dt;



  const fountainTime=weather?.waterTime?.value??elapsed,visibleDrops=(weather?.waterDetail?.value??1)<.5?180:dropCount;dropsGeometry.setDrawRange(0,visibleDrops);
  for(let i=0;i<visibleDrops;i++){const jet=i%12,theta=jet*Math.PI/6,phase=((fountainTime*(.78+(jet%3)*.05)+i*.618)%1),vy=jet<3?8:6.1,flight=2*vy/9.81,age=phase*flight,r=(jet<3?.48:1.8)*age;dropArray[i*3]=Math.cos(theta)*r;dropArray[i*3+1]=.20+vy*age-4.905*age*age;dropArray[i*3+2]=Math.sin(theta)*r;}dropsGeometry.attributes.position.needsUpdate=true;



  ripples.forEach((r,i)=>{const phase=(fountainTime*.22+i/5)%1;r.scale.setScalar(.8+phase*4.5);(r.material as T.MeshBasicMaterial).opacity=Math.sin(phase*Math.PI)*.09;});



  let chasing=0;



  for(let index=0;index<birds.length;index++){

   const {state:b,rig}=birds[index];stepBird(b,dt,elapsed,rider,pond.ring,dogs);if(b.mode==='chase')chasing++;

   const h=terrain.height(b.x,b.north),blend=b.waterBlend??0,cycle=b.stride??b.phase,moving=Math.min(1,b.speed*3),chase=b.mode==='chase';

   const immersion=b.kind==='goose'?.23:.14;

   const land=h+.007+Math.abs(Math.sin(cycle*2))*.009*moving;

   rig.g.position.set(b.x,land*(1-blend)+(water-immersion+Math.sin(elapsed*2+b.phase)*.008)*blend,-b.north);

   rig.g.rotation.set(0,b.heading,Math.sin(cycle)*.025*moving*(1-blend));

   const graze=!chase&&b.speed<.08?(Math.sin(elapsed*.8+b.phase)*.5+.5)*.62:0;

   rig.neck.rotation.x=chase?.20+Math.sin(cycle)*.025:graze+Math.sin(cycle)*.04*moving*(1-blend);

   rig.neck.rotation.y=Math.sin(elapsed*.55+b.phase)*.08*(1-moving);

   rig.wings.forEach((w,i)=>{const spread=chase&&b.age<1.3?.18+Math.sin(b.age*9)*.12:.012;w.rotation.z=(i?1:-1)*spread;});

   rig.legs.forEach((l,i)=>{const phase=cycle+i*Math.PI,swing=Math.sin(phase),lift=Math.max(0,Math.cos(phase));l.visible=blend<.95;l.rotation.x=swing*Math.min(.52,b.speed*.47)*(1-blend)+Math.sin(elapsed*4+i*Math.PI)*.3*blend;if(rig.model){l.position.y=.225+.213*(Math.cos(l.rotation.x)-1)+.07*Math.sin(l.rotation.x)+lift*.033*moving*(1-blend);l.position.z=-.015;}});

   const wake=wakes[index];wake.visible=blend>.6;wake.position.set(b.x,water+.015,-b.north);wake.scale.set(.72+b.speed*.13,1.15+b.speed*.38,1);wake.rotation.z=-b.heading;

  }



  warning.style.display=rider.active&&chasing?'block':'none';warning.textContent='Protective birds are chasing — keep moving to give them space.';



  return chasing;



 }};



}



