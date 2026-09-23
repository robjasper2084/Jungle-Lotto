import {CITY,pointOnCut} from './geography.ts';
import {GEO,MAP_ORIGIN} from './geo-profile.ts';
export function northUp(x:number,z:number){const dx=x-MAP_ORIGIN.x,dz=z-MAP_ORIGIN.z;return {x:-.5*dx-.8660254*dz,y:-.8660254*dx+.5*dz};}
export function createRouteMap(){
 const svg=document.getElementById('routeMap')!,ns='http://www.w3.org/2000/svg';
 const add=(tag:string,attrs:Record<string,string>)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);return n;};
 const line=(points:number[][],color:string,w=8)=>add('polyline',{points:points.map(p=>{const q=northUp(p[0],p[1]);return q.x+','+q.y;}).join(' '),fill:'none',stroke:color,'stroke-width':String(w)});
 for(const b of GEO.bridges)line(b.points,'#789489',12);
 for(const r of GEO.ramps)line(r.points,'#73d6d3',12);
 line(CITY.cut,'#e8d28b',14);
 for(const s of [{name:'MACK',at:2629},{name:'GRATIOT · 0,0,0',at:1748.513},{name:'RIVERWALK',at:0}]){const p=pointOnCut(s.at),q=northUp(p.x,p.z);add('text',{x:String(q.x+45),y:String(q.y),fill:'#eee9d5','font-size':'58'}).textContent=s.name;}
 const dot=add('circle',{cx:'0',cy:'0',r:'24',fill:'#fff',stroke:'#142b25','stroke-width':'9'});
 return(x:number,z:number)=>{const p=northUp(x,z);dot.setAttribute('cx',String(p.x));dot.setAttribute('cy',String(p.y));};
}
