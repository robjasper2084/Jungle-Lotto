import {TacticalMap,type MapLine} from './tacticalMap.ts';
import {CITY,riverEdge,pointOnCut,CUT_METRES} from './geography.ts';
import {northUp} from './routeMap.ts';
import {routeToCut} from './cutNavigation.ts';
import {MACK_STUDIO} from './mackStudioSite.ts';
import {pennyMap} from './pennyShopSite.ts';
import {MILLIKEN_BERM} from './millikenTerrain.ts';
export function detroitMinimap(pause:()=>void,focus:()=>void){
 const hud=new TacticalMap('Dequindre Cut',pause,focus),lines:MapLine[]=[];
 const river=[];for(let z=-1900;z<500;z+=40)river.push(northUp(riverEdge(z),z));river.push(northUp(-1800,500),northUp(-1800,-1900));
 lines.push({points:river,color:'#1c5261',width:0,fill:true});
 for(const b of CITY.buildings)lines.push({points:b.points.map(p=>northUp(p[0],p[1])),color:'#53675c',width:0,fill:true});
 for(const r of CITY.roads)lines.push({points:r.points.map(p=>northUp(p[0],p[1])),color:r.name==='Dequindre Cut Greenway'?'#8fac87':['path','footway','cycleway','pedestrian'].includes(r.kind)?'#788773':'#a8aba0',width:r.width});
 const cut=pointOnCut(0),mack=pointOnCut(CUT_METRES);
 const penny=pennyMap(0,0);
 hud.setMap(lines,[{point:northUp(cut.x,cut.z),text:'CUT ENTRANCE'},{point:northUp(MILLIKEN_BERM.x,MILLIKEN_BERM.z),text:'ZE MOUND'},{point:northUp(mack.x,mack.z),text:'MACK'},{point:northUp(MACK_STUDIO.x,MACK_STUDIO.z),text:'GOTHTECH STUDIO'},{point:northUp(penny.x,penny.z),text:'PENNY EXCHANGE / LOTTOMIND'}]);
 hud.setTrail(CITY.roads.filter(r=>r.name==='Dequindre Cut Greenway').map(r=>r.points.map(p=>northUp(p[0],p[1]))),'Dequindre Cut');
 let last={x:Infinity,z:Infinity};
 return{hud,update(x:number,z:number,heading:number,visible:boolean){
  if(Math.hypot(x-last.x,z-last.z)>4){last={x,z};const r=routeToCut(x,z);hud.setRoute(r.path.map(p=>northUp(p.x,p.z)),r.approach.map(p=>northUp(p.x,p.z)),r.arrived?'Dequindre Cut · on route':Number.isFinite(r.distance)?`CUT · ${Math.round(r.distance)} m`:'Join a mapped street');}
  const p=northUp(x,z),ahead=northUp(x-Math.sin(heading),z+Math.cos(heading));hud.update([{...p,heading:Math.atan2(ahead.x-p.x,-(ahead.y-p.y))}],visible);
 }};
}
