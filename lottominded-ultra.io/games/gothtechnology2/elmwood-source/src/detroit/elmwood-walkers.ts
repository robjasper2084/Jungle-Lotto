import * as T from 'three';
import type {GLTF} from './compressedGLTFLoader.ts';
import type {ElmwoodTerrain} from './elmwood-terrain.ts';
import type {DogTarget} from './elmwood-companion.ts';
import {createGroundSample} from '../simulation/world.ts';
import {ElmwoodWalkerView} from './elmwood-walker-view.ts';
import {CyclistView} from './actors.ts';
import {clearVisitorStep,visitorSteering} from './elmwood-traffic-steering.ts';
export type DogThreat={x:number;z:number;chasing:boolean};
export function makeElmwoodWalkers(scene:T.Scene,terrain:ElmwoodTerrain,assets:Map<string,GLTF>){
  const root=new T.Group();root.name='Elmwood visitors and cyclists';scene.add(root);
  const path=terrain.features.find(f=>f.id==='59197492')!.points,sample=createGroundSample();
  const waters=terrain.features.filter(f=>f.kind==='water'||f.tags.water||f.tags.waterway).flatMap(f=>f.points);
  const visitorPaths=terrain.features.filter(f=>f.kind==='path'&&f.points.length>2&&f.points.some((p,i,a)=>i>0&&Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>8)).map(f=>f.points);
  const seed=Math.floor(Math.random()*0xffffffff)>>>0;let rng=seed;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const walkers=Array.from({length:20},(_,i)=>{
    const path=visitorPaths[Math.floor(random()*visitorPaths.length)]??terrain.features.find(f=>f.id==='59197492')!.points,fraction=.08+random()*.84;
    const index=Math.floor((path.length-1)*fraction),p=path[index],view=new ElmwoodWalkerView(assets.get('DS_Pedestrian_01')!);root.add(view.root);view.root.position.set(p[0],terrain.height(p[0],p[1]),-p[1]);
    return {view,path,index,step:random()<.5?-1:1,speed:0,heading:0,blocked:0,flee:0,photo:0,photoClock:5+random()*65,photographer:i%3!==1,target:{id:'walker-'+i,kind:'person',x:p[0],z:-p[1],radius:.4} as DogTarget};
  });
  const cyclists=[.37,.76].map((fraction,i)=>{const index=Math.floor((path.length-1)*fraction),p=path[index],view=new CyclistView(assets,i+4);root.add(view.root);view.root.position.set(p[0],terrain.height(p[0],p[1]),-p[1]);return {view,index,step:i?-1:1,speed:0,heading:0,blocked:0};});
  function nextVisitor(w:{path:number[][];index:number;step:number}){
   const next=w.index+w.step;if(next>=0&&next<w.path.length){w.index=next;return;}
   const end=w.path[w.index],choices=visitorPaths.flatMap(path=>path===w.path?[]:path.flatMap((p,index)=>Math.hypot(p[0]-end[0],p[1]-end[1])<1.2?[-1,1].filter(step=>index+step>=0&&index+step<path.length).map(step=>({path,index:index+step,step})):[]));
   if(choices.length)Object.assign(w,choices[Math.floor(random()*choices.length)]);else{w.step*=-1;w.index=Math.max(0,Math.min(w.path.length-1,w.index+w.step));}
  }
  function nextIndex(index:number,step:number,path:number[][]){index+=step;if(index>=path.length||index<0){step*=-1;index=Math.max(0,Math.min(path.length-1,index));}return {index,step};}
  function lanePoint(index:number,step:number,offset:number,path:number[][]){const p=path[index],q=path[Math.max(0,Math.min(path.length-1,index+step))],dx=q[0]-p[0],dz=p[1]-q[1],length=Math.hypot(dx,dz)||1;return {x:p[0]+dz/length*offset,z:-p[1]-dx/length*offset};}
  return {root,seed,get fleeing(){return walkers.filter(w=>w.flee>0).length;},get photographing(){return walkers.filter(w=>w.photo>0).length;},get cyclists(){return cyclists.length;},get count(){return walkers.length;},get positions(){return walkers.map(w=>({x:w.target.x,z:w.target.z,photo:w.photo>0}));},targets:walkers.map(w=>w.target),update(dt:number,dogs:readonly DogThreat[],riders:readonly {x:number;z:number}[]=[]){
    if(dt<=0)return;dt=Math.min(dt,.05);
    for(const w of walkers){
      const t=w.target,oldX=t.x,oldZ=t.z,dog=dogs.filter(d=>d.chasing).sort((a,b)=>Math.hypot(a.x-t.x,a.z-t.z)-Math.hypot(b.x-t.x,b.z-t.z))[0],distance=dog?Math.hypot(dog.x-t.x,dog.z-t.z):Infinity;
      if(distance<9){w.flee=3;w.photo=0;w.photoClock=25;}else w.flee=Math.max(0,w.flee-dt);
      const riderNear=riders.some(r=>Math.hypot(r.x-t.x,r.z-t.z)<4);if(riderNear){w.photo=0;w.photoClock=Math.max(w.photoClock,8);}
      if(w.photographer&&!w.flee&&!riderNear){w.photoClock-=dt;if(w.photoClock<=0){w.photo=7;w.photoClock=35+w.index%15;}}
      if(w.photo>0)w.photo=Math.max(0,w.photo-dt);
      if(w.photo>0){
        const subject=waters.reduce<number[]|undefined>((best,p)=>!best||Math.hypot(p[0]-t.x,p[1]+t.z)<Math.hypot(best[0]-t.x,best[1]+t.z)?p:best,undefined);
        if(subject){const angle=Math.atan2(subject[0]-t.x,-subject[1]-t.z),delta=Math.atan2(Math.sin(angle-w.heading),Math.cos(angle-w.heading));w.heading+=T.MathUtils.clamp(delta,-dt,dt);}
        w.speed=0;
      }else{
        let point=lanePoint(w.index,w.step,.9,w.path),tx=point.x,tz=point.z;
        if(w.flee&&dog){const length=distance||1;tx=t.x+(t.x-dog.x)/length*5;tz=t.z+(t.z-dog.z)/length*5;}
        else if(Math.hypot(tx-t.x,tz-t.z)<1.2){nextVisitor(w);point=lanePoint(w.index,w.step,.9,w.path);tx=point.x;tz=point.z;}
        const contacts=[...riders,...dogs,...walkers.filter(other=>other!==w).map(other=>other.target),...cyclists.map(c=>({...c.view.root.position,radius:.6}))];
        const from={x:t.x,y:w.view.root.position.y,z:t.z},steer=visitorSteering(terrain,from,Math.atan2(tx-t.x,tz-t.z),.38,1.5,contacts);
        const delta=Math.atan2(Math.sin(steer.heading-w.heading),Math.cos(steer.heading-w.heading));w.heading+=T.MathUtils.clamp(delta,-dt*3,dt*3);w.speed+=((steer.clear?(w.flee?2.5:.9)*Math.max(0,Math.cos(delta)):0)-w.speed)*(1-Math.exp(-dt*5));
        const x=t.x+Math.sin(w.heading)*w.speed*dt,z=t.z+Math.cos(w.heading)*w.speed*dt;
        if(clearVisitorStep(terrain,from,x,z,.38,contacts)){t.x=x;t.z=z;}else w.speed=0;
        w.blocked=w.speed<.05?w.blocked+dt:0;if(w.blocked>3){nextVisitor(w);w.blocked=0;}
      }
      for(const d of dogs){const dx=t.x-d.x,dz=t.z-d.z,len=Math.hypot(dx,dz);if(len<.9){const px=d.x+(len?dx/len:1)*.9,pz=d.z+(len?dz/len:0)*.9,g=terrain.sampleGround(px,pz,sample);if(!g.offCourse&&Math.abs(g.height-w.view.root.position.y)<.4){t.x=px;t.z=pz;}}}
      const near=!riders.length||riders.some(r=>Math.hypot(r.x-t.x,r.z-t.z)<140);w.view.root.visible=near;
      w.view.root.position.set(t.x,terrain.height(t.x,-t.z),t.z);w.view.root.rotation.y=w.heading;if(near)w.view.update(Math.hypot(t.x-oldX,t.z-oldZ),dt,w.photo>0,(x,z)=>terrain.height(x,-z));
    }
    for(const c of cyclists){
      const p=c.view.root.position;let target=lanePoint(c.index,c.step,-.65,path);if(Math.hypot(target.x-p.x,target.z-p.z)<1.4){Object.assign(c,nextIndex(c.index,c.step,path));target=lanePoint(c.index,c.step,-.65,path);}
      const contacts=[...riders,...walkers.map(w=>w.target),...dogs,...cyclists.filter(other=>other!==c).map(other=>({...other.view.root.position,radius:.6}))];
      const steer=visitorSteering(terrain,p,Math.atan2(target.x-p.x,target.z-p.z),.6,2.6,contacts),delta=Math.atan2(Math.sin(steer.heading-c.heading),Math.cos(steer.heading-c.heading));c.heading+=T.MathUtils.clamp(delta,-dt*1.6,dt*1.6);
      const forward={x:Math.sin(c.heading),z:Math.cos(c.heading)};
      c.speed+=((steer.clear?2.7*Math.max(0,Math.cos(delta)):0)-c.speed)*(1-Math.exp(-dt*5));
      const x=p.x+forward.x*c.speed*dt,z=p.z+forward.z*c.speed*dt,g=terrain.sampleGround(x,z,sample);let travel=0;
      if(clearVisitorStep(terrain,p,x,z,.6,contacts)){travel=Math.hypot(x-p.x,z-p.z);p.set(x,g.height,z);}else c.speed=0;
      c.blocked=travel<.001?c.blocked+dt:0;if(c.blocked>3){Object.assign(c,nextIndex(c.index,c.step,path));c.blocked=0;}
      c.view.root.rotation.y=c.heading;c.view.update(travel/dt,dt);
    }
  }};
}
