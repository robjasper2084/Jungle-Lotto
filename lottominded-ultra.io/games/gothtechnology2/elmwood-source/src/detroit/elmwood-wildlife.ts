import {inRing} from './elmwood-details.ts';
export type BirdState={x:number;north:number;homeX:number;homeNorth:number;heading:number;phase:number;age:number;cooldown:number;mode:'roam'|'chase'|'return'|'flee';kind:'goose'|'duck';speed:number;swimming:boolean;stride?:number;waterBlend?:number};
export type WildlifeRider={x:number;north:number;active:boolean};
export type WildlifeDog={x:number;z:number;chasing:boolean};
export function stepBird(b:BirdState,dt:number,time:number,rider:WildlifeRider,ring:number[][],dogs:readonly WildlifeDog[]=[]){
 dt=Math.min(.05,Math.max(0,dt));if(!dt)return b;b.cooldown=Math.max(0,b.cooldown-dt);b.age+=dt;
 const distance=Math.hypot(rider.x-b.x,rider.north-b.north),homeDistance=Math.hypot(b.x-b.homeX,b.north-b.homeNorth);
 if(b.mode==='roam'&&rider.active&&distance<(b.kind==='goose'?6:3.5)&&b.cooldown===0){b.mode='chase';b.age=0;}
 if(b.mode==='chase'&&(!rider.active||b.age>5.5||homeDistance>16||distance>20)){b.mode='return';b.age=0;b.cooldown=14;}
 if(b.mode==='return'&&homeDistance<1.2){b.mode='roam';b.age=0;}
 const dog=dogs.reduce<WildlifeDog|undefined>((nearest,d)=>!nearest||Math.hypot(d.x-b.x,-d.z-b.north)<Math.hypot(nearest.x-b.x,-nearest.z-b.north)?d:nearest,undefined),dogDistance=dog?Math.hypot(dog.x-b.x,-dog.z-b.north):Infinity;
 if(dogDistance<(dog?.chasing?9:2.2)){b.mode='flee';b.age=0;b.cooldown=14;}
 if(b.mode==='flee'&&b.age>2.5){b.mode='return';b.age=0;}
 let tx=b.homeX+Math.sin(time*.15+b.phase)*2.1,tn=b.homeNorth+Math.cos(time*.11+b.phase)*1.7;
 if(b.mode==='chase'){tx=rider.x;tn=rider.north;}else if(b.mode==='return'){tx=b.homeX;tn=b.homeNorth;}
 else if(b.mode==='flee'&&dog){tx=b.x+(b.x-dog.x)/(dogDistance||1)*6;tn=b.north+(b.north+dog.z)/(dogDistance||1)*6;}
 const dx=tx-b.x,dn=tn-b.north,d=Math.hypot(dx,dn),desired=Math.atan2(dx,-dn),delta=Math.atan2(Math.sin(desired-b.heading),Math.cos(desired-b.heading));
 b.swimming=inRing(b.x,b.north,ring);
 const turn=b.swimming?1.05:b.mode==='chase'||b.mode==='flee'?2.7:1.5;
 b.heading+=Math.max(-dt*turn,Math.min(dt*turn,delta));
 const resting=b.mode==='roam'&&!b.swimming&&Math.sin(time*.32+b.phase)>.72;
 const pace=b.mode==='flee'?(b.swimming?1.4:b.kind==='goose'?3:2.3):b.mode==='chase'?(b.age<.55?.25:b.swimming?1.15:b.kind==='goose'?2.6:1.8):b.mode==='return'?.85:b.swimming?.40:.36;
 const target=d>(b.mode==='chase'?1.1:.45)&&!resting?pace*Math.max(0,Math.cos(delta)):0;
 b.speed+=(target-b.speed)*(1-Math.exp(-dt*4));
 const step=Math.min(d,b.speed*dt);b.x+=Math.sin(b.heading)*step;b.north-=Math.cos(b.heading)*step;
 for(const d of dogs){const dx=b.x-d.x,dn=b.north+d.z,len=Math.hypot(dx,dn),radius=.5+(b.kind==='goose'?.38:.25);if(len<radius){b.x=d.x+(len?dx/len:1)*radius;b.north=-d.z+(len?dn/len:0)*radius;}}
 b.swimming=inRing(b.x,b.north,ring);
 b.stride=(b.stride??b.phase)+step/(b.kind==='goose'?.38:.27)*Math.PI*2;
 b.waterBlend=(b.waterBlend??Number(b.swimming))+(Number(inRing(b.x,b.north,ring))-(b.waterBlend??Number(b.swimming)))*(1-Math.exp(-dt*4));
 return b;
}
