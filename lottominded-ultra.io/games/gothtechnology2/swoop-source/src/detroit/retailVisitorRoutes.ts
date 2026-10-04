import {RETAIL_FIXTURES} from './studioInteriorLayout.ts';
export type VisitorPoint={x:number;z:number};
export type VisitorAction='browse'|'look'|'photo'|'checkout';
export type VisitorStop=VisitorPoint&{look:VisitorPoint;action:VisitorAction;seconds:number};
export const VISITOR_IDS=['detroit-photographer','detroit-blonde-shopper','detroit-bob-shopper','detroit-cap-shopper','gallery-blue-visitor'] as const;
export function visitorStops(store:boolean):VisitorStop[]{return store?[
 {x:-5.7,z:-1.55,look:{x:-5.7,z:-2.7},action:'browse',seconds:9},
 {x:-3.7,z:1.7,look:{x:-3.7,z:.5},action:'browse',seconds:7},
 {x:0,z:.35,look:{x:0,z:-1.1},action:'browse',seconds:8},
 {x:5.7,z:1.6,look:{x:5.7,z:.2},action:'browse',seconds:7},
 {x:5.7,z:-2.45,look:{x:5.7,z:-3.8},action:'checkout',seconds:9},
 {x:-.4,z:-3.05,look:{x:0,z:-5.6},action:'photo',seconds:7},
 {x:-6.6,z:-4.65,look:{x:-6.6,z:-5.6},action:'look',seconds:6},
 ]:[
 {x:-6.6,z:-3.75,look:{x:-6.6,z:-5.7},action:'look',seconds:10},
 {x:0,z:-3.5,look:{x:0,z:-5.7},action:'photo',seconds:9},
 {x:6.6,z:-4.95,look:{x:6.6,z:-5.7},action:'look',seconds:8},
 {x:5.7,z:-2.45,look:{x:5.7,z:-3.8},action:'checkout',seconds:7},
 {x:-5.7,z:-.75,look:{x:-5.7,z:-1.9},action:'browse',seconds:8},
 {x:2.6,z:1.1,look:{x:0,z:.35},action:'look',seconds:6},
 {x:5.7,z:2.7,look:{x:5.7,z:3.47},action:'photo',seconds:7},
 ];}
/** A measured walking radius around Blender fixtures; reserve the hero/dog entry. */
export function visitorClear(store:boolean,p:VisitorPoint,people:VisitorPoint[]=[]){
 if(Math.abs(p.x)>8.35||p.z< -5.35||p.z>5.35||Math.abs(p.x)<1.3&&p.z>2.3)return false;
 const u=store?12:-12;
 return RETAIL_FIXTURES.filter(f=>Math.abs(f.u-u)<10).every(f=>Math.abs(p.x-(f.u-u))>f.width/2+.32||Math.abs(p.z-(f.v-3))>f.depth/2+.32)&&people.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>.62);
}
export function visitorSegmentClear(store:boolean,a:VisitorPoint,b:VisitorPoint,people:VisitorPoint[]=[]){
 const samples=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.10));
 for(let i=0;i<=samples;i++)if(!visitorClear(store,{x:a.x+(b.x-a.x)*i/samples,z:a.z+(b.z-a.z)*i/samples},people))return false;
 return true;
}
/** Eight-neighbour A* forbids diagonal corner cutting and uses real fixture bounds. */
export function visitorPath(store:boolean,start:VisitorPoint,end:VisitorPoint,people:VisitorPoint[]=[]):VisitorPoint[]{
 if(!visitorClear(store,start)||!visitorClear(store,end,people))return [];
 if(visitorSegmentClear(store,start,end,people))return [{...start},{...end}];
 const step=.25,cols=67,rows=43,point=(id:number)=>({x:-8.25+(id%cols)*step,z:-5.25+Math.floor(id/cols)*step});
 const nearest=(p:VisitorPoint)=>{let best=-1,distance=Infinity;for(let n=0;n<cols*rows;n++){const v=point(n),d=(v.x-p.x)**2+(v.z-p.z)**2;if(d<distance&&visitorClear(store,v,people)&&visitorSegmentClear(store,p,v,people)){distance=d;best=n;}}return best;};
 const first=nearest(start),last=nearest(end);if(first<0||last<0)return [];
 const score=new Map<number,number>([[first,0]]),parent=new Map<number,number>(),open=new Set([first]),closed=new Set<number>();
 while(open.size){let current=-1,best=Infinity;for(const id of open){const p=point(id),f=score.get(id)!+Math.hypot(p.x-end.x,p.z-end.z);if(f<best){best=f;current=id;}}
  if(current===last){const path=[end];let n=current;while(n!==first){path.push(point(n));n=parent.get(n)!;}path.push(point(first),start);path.reverse();const clean=[path[0]];let i=0;while(i<path.length-1){let j=path.length-1;while(j>i+1&&!visitorSegmentClear(store,path[i],path[j],people))j--;clean.push(path[j]);i=j;}return clean;}
  open.delete(current);closed.add(current);const col=current%cols,row=Math.floor(current/cols),a=point(current);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=col+dx,z=row+dz;if(x<0||x>=cols||z<0||z>=rows)continue;const n=z*cols+x,b=point(n);if(closed.has(n)||!visitorSegmentClear(store,a,b,people))continue;const g=score.get(current)!+Math.hypot(dx,dz)*step;if(g<(score.get(n)??Infinity)){score.set(n,g);parent.set(n,current);open.add(n);}}
 }
 return [];
}
export class VisitorJourney {
 readonly stops:VisitorStop[];position:VisitorPoint;index:number;action:VisitorAction;heading=0;speed=0;completed=0;
 private remaining:number;private route:VisitorPoint[]=[];private waypoint=1;private waiting=0;
 constructor(readonly store:boolean,readonly person:number){this.stops=visitorStops(store);this.index=(person*2)%this.stops.length;const stop=this.stops[this.index];this.position={x:stop.x,z:stop.z};this.action=stop.action;this.remaining=stop.seconds*.35+person*.8;this.heading=Math.atan2(stop.look.x-stop.x,stop.look.z-stop.z);}
 get stop(){return this.stops[this.index];}
 get walking(){return this.route.length>0;}
 step(dt:number,people:VisitorPoint[]=[]){
  this.speed=0;if(dt<=0)return;
  if(!this.walking){this.heading=Math.atan2(this.stop.look.x-this.position.x,this.stop.look.z-this.position.z);this.remaining-=dt;if(this.remaining>0)return;const next=(this.index+1)%this.stops.length,path=visitorPath(this.store,this.position,this.stops[next],people);if(!path.length){this.remaining=.7;return;}this.index=next;this.route=path;this.waypoint=1;}
  let target=this.route[this.waypoint],dx=target.x-this.position.x,dz=target.z-this.position.z,d=Math.hypot(dx,dz);const speed=.78+(this.person%3)*.085,step=Math.min(d,speed*dt),p={x:this.position.x+dx*step/Math.max(d,.001),z:this.position.z+dz*step/Math.max(d,.001)};
  if(!visitorClear(this.store,p,people)){this.waiting+=dt;if(this.waiting>1.2){const path=visitorPath(this.store,this.position,this.stop,people);if(path.length){this.route=path;this.waypoint=1;}this.waiting=0;}return;}
  this.waiting=0;this.heading=Math.atan2(dx,dz);this.position=p;this.speed=speed;
  if(d<=speed*dt+.002){this.position={...target};if(++this.waypoint>=this.route.length){this.route=[];this.remaining=this.stop.seconds;this.action=this.stop.action;this.completed++;this.speed=0;}}
 }
}
