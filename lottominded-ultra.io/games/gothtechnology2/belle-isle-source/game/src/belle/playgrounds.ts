import layouts from './playgrounds.json' with {type:'json'};
import volumes from './playgroundSolids.json' with {type:'json'};
export const playgrounds=layouts;
export const playgroundLandmarks=layouts.map(p=>({id:p.id,name:p.name,x:p.center[0],z:p.center[1],kind:'playground',description:p.description}));
type Vec={x:number;y:number;z:number};
const groups=layouts.map(site=>({site,solids:volumes.filter(v=>v.site===site.id)}));
/** Simple equipment volumes exported by the same Blender authoring script.
 * Paved play areas and access paths remain open; only equipment is solid.
 */
export function playgroundBlocked(x:number,z:number,margin=0){
 for(const group of groups){if(Math.hypot(x-group.site.center[0],z-group.site.center[1])>60+margin)continue;
  for(const v of group.solids){if(v.min[1]>4.1||v.max[1]<2.08)continue;
   if(x>v.min[0]-margin&&x<v.max[0]+margin&&z>v.min[2]-margin&&z<v.max[2]+margin)return true;
  }
 }return false;
}
export function playgroundRay(o:Vec,d:Vec,max:number,half=.4,flight=false){
 let hit=max+1;
 for(const group of groups){if(Math.hypot(o.x-group.site.center[0],o.z-group.site.center[1])>max+60+half)continue;
  for(const v of group.solids){
   let t0=0,t1=Math.min(hit,max);const vertical=flight?half:.2;
   for(const [p,dir,lo,hi] of [[o.x,d.x,v.min[0]-half,v.max[0]+half],[o.y,d.y,v.min[1]-vertical,v.max[1]+vertical],[o.z,d.z,v.min[2]-half,v.max[2]+half]]){
    if(Math.abs(dir)<1e-8){if(p<lo||p>hi){t0=max+1;break;}}
    else{const a=(lo-p)/dir,b=(hi-p)/dir;t0=Math.max(t0,Math.min(a,b));t1=Math.min(t1,Math.max(a,b));}
   }
   if(t0<=t1)hit=Math.min(hit,t0);
  }
 }return hit<=max?hit:null;
}
