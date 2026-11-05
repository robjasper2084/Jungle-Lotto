import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {segment,type ParkMap,type ParkTerrain,type Point} from './terrain.ts';
/** CC0 Blender pigeon, mujtaba-io; shared geometry/materials, bounded nearby mixers. */
export async function addBirds(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const source=await new GLTFLoader().loadAsync('./belle/birds/pigeon.glb');
 const anchors:Point[]=[];const places=[map.landmarks.find(l=>l.id===map.aquarium?.id),map.landmarks.find(l=>l.id==='368854132'),map.landmarks.find(l=>l.id==='9146545'),map.landmarks.find(l=>l.id==='368859182'),...(map.facilities?.sites.filter(s=>s.kind==='shelter').filter((_,i)=>i%6===0).map(s=>({x:s.center[0],z:s.center[1]}))||[])].filter(Boolean) as {x:number;z:number}[];
 for(const place of places){let p:Point|undefined;for(let radius=11;radius<=35&&!p;radius+=6)for(let a=0;a<12;a++){const q:Point=[place.x+Math.sin(a*Math.PI/6)*radius,place.z+Math.cos(a*Math.PI/6)*radius];if(terrain.land(...q)&&!terrain.obstructed(...q,2)&&!map.roads.some(r=>r.points.slice(1).some((v,i)=>segment(...q,r.points[i],v).d<r.width/2+1.4))){p=q;break;}}if(p)anchors.push(p);}
 const birds:{root:T.Group;mixer:T.AnimationMixer;anchor:Point;flight:boolean;phase:number;height:number}[]=[];
 for(const [i,p]of anchors.entries())for(let j=0;j<3;j++){
  const flight=j===2,object=clone(source.scene),root=new T.Group();root.name=flight?'Park pigeon · flight':'Park pigeon · resting';root.add(object);root.visible=false;scene.add(root);root.scale.setScalar(.95+j*.04);const mixer=new T.AnimationMixer(object),clip=source.animations.find(a=>a.name===(flight?'Flight':'Idle'));if(clip)mixer.clipAction(clip).play();object.traverse(o=>{if((o as T.Mesh).isMesh){o.frustumCulled=false;o.castShadow=false;o.receiveShadow=true;}});
  const anchor:Point=[p[0]+(j===1?1.2:0),p[1]+(j===1?.9:0)];const nearbyTop=Math.max(0,...map.buildings.filter(b=>b.points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<55)).map(b=>b.height));birds.push({root,mixer,anchor,flight,phase:i*1.71+j*.7,height:Math.max(11,nearbyTop+5)});
 }
 let maxVisible=9;return{stats:{instances:birds.length,trianglesPerBird:1010,source:'CC0 Blender pigeon by mujtaba-io'},setQuality(q:string){maxVisible=q==='smooth'?6:9;},update(time:number,x:number,z:number){let visible=0;for(const b of birds){const distance=Math.hypot(x-b.anchor[0],z-b.anchor[1]);b.root.visible=distance<(b.flight?120:55)&&visible<maxVisible;if(!b.root.visible)continue;visible++;if(b.flight){const a=time*.22+b.phase,dx=Math.cos(a)*18,dz=-Math.sin(a)*12;b.root.position.set(b.anchor[0]+Math.sin(a)*18,2+b.height+Math.sin(a*2)*.6,b.anchor[1]+Math.cos(a)*12);b.root.rotation.set(0,Math.atan2(dx,dz),Math.sin(a)*.12);b.mixer.setTime(time*1.4+b.phase);}else{b.root.position.set(b.anchor[0],terrain.height(...b.anchor)+.015,b.anchor[1]);b.root.rotation.y=b.phase;b.mixer.setTime(time*.55+b.phase);}}}};
}
