import type {ParkMap} from './terrain.ts';
/** Approved art direction ships on the normal game URL; review cameras remain opt-in. */
export const REFERENCE_STYLE=true;
export const SUNSET_REFERENCE=typeof location!=='undefined'&&new URLSearchParams(location.search).get('sunset')==='reference';
export const SUNSET_POINT={x:-187.01,z:1491.38};
export const SUNSET_GARDEN={x:-20,z:1450,radius:340};
export function inSunsetGarden(x:number,z:number){return Math.hypot(x-SUNSET_GARDEN.x,z-SUNSET_GARDEN.z)<SUNSET_GARDEN.radius;}
export function referenceSpawn(map:ParkMap,target={x:44,z:1497}){
 let best={...map.spawn},distance=Infinity;
 for(const road of map.roads){if(road.foot||road.width<4)continue;for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz;if(n<.01)continue;
  const t=Math.max(0,Math.min(1,((target.x-a[0])*dx+(target.z-a[1])*dz)/n));
  const x=a[0]+t*dx,z=a[1]+t*dz,d=Math.hypot(x-target.x,z-target.z);
  if(d<distance){distance=d;let heading=Math.atan2(dx,dz);if(dx*(-3127-x)+dz*(1983-z)<0)heading+=Math.PI;best={x,z,heading};}
 }}return best;
}
export function seedReferencePreferences(storage:Pick<Storage,'getItem'|'setItem'>,preview=false){
 const defaults:Record<string,string>={
  'belle-season-month':'10',
  'belle-sky-renderer':'layered',
  'belle-isle-sky-v1':JSON.stringify({hour:16.45,cycle:false,dayMinutes:60,clouds:'scattered'}),
  'belle-presentation-v1':JSON.stringify({preset:'cinematic',compact:true})
 };
 if(preview){defaults['belle-graphics-v1']=JSON.stringify({quality:'high',cap:60});defaults['belle-flight-mode']='drone';}
 for(const [key,value]of Object.entries(defaults))if(preview||storage.getItem(key)===null)storage.setItem(key,value);
}
export function prepareReferencePreferences(){
 try{seedReferencePreferences(localStorage,SUNSET_REFERENCE);}catch{}
 document.body.classList.add('sunset-reference');
 document.body.classList.toggle('sunset-local-preview',SUNSET_REFERENCE);
}
