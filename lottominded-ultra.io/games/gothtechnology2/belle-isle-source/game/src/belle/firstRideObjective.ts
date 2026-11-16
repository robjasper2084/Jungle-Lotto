export type FirstRidePoint={name:string;x:number;z:number};
export function chooseFirstRideDestination<T extends FirstRidePoint>(points:readonly T[],spawn:{x:number;z:number}):T|undefined{
 const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&
  Math.hypot(p.x-spawn.x,p.z-spawn.z)>=130&&Math.hypot(p.x-spawn.x,p.z-spawn.z)<3500);
 const names=[/MacArthur Bridge/i,/Belle Isle Casino/i,/Nancy Brown Peace Carillon/i,/Belle Isle Aquarium/i,/Sunset Point/i];
 for(const name of names){const hit=valid.find(p=>name.test(p.name));if(hit)return hit;}
 return valid.slice().sort((a,b)=>Math.hypot(a.x-spawn.x,a.z-spawn.z)-Math.hypot(b.x-spawn.x,b.z-spawn.z))[0];
}
/** Optional, once-only introduction. Existing manual navigation always wins. */
export function createFirstRideObjective<T extends FirstRidePoint>(points:readonly T[],spawn:{x:number;z:number},clear:(target:T)=>void){
 const target=chooseFirstRideDestination(points,spawn);
 const element=document.createElement('aside');element.id='first-ride-objective';element.hidden=true;
 element.setAttribute('aria-label','Optional first ride objective');
 const heading=document.createElement('strong'),distance=document.createElement('span'),dismiss=document.createElement('button');
 heading.textContent='YOUR FIRST RIDE';distance.textContent=target?'Visit '+target.name:'Explore Belle Isle';
 dismiss.type='button';dismiss.textContent='Skip';dismiss.setAttribute('aria-label','Skip first ride objective');
 element.append(heading,distance,dismiss);document.body.append(element);
 let showing=false;
 const remember=()=>{try{localStorage.setItem('belle-first-ride-complete','1');}catch{}};
 dismiss.onclick=()=>{if(target)clear(target);remember();showing=false;element.hidden=true;};
 return {
  begin(current:T|undefined):T|undefined{
   let done=false;try{done=localStorage.getItem('belle-first-ride-complete')==='1';}catch{}
   if(done||current||!target)return undefined;
   showing=true;element.hidden=false;return target;
  },
  update(x:number,z:number,current:T|undefined,visible:boolean){
   if(!showing||!target)return;
   if(current!==target){showing=false;element.hidden=true;return;}
   const remaining=Math.hypot(target.x-x,target.z-z);
   if(remaining<45){remember();showing=false;element.hidden=true;return;}
   element.hidden=!visible;
   distance.textContent='Visit '+target.name+' · '+Math.round(remaining)+' m';
  },
  dismiss(){dismiss.click();}
 };
}
