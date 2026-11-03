import layout from './yachtClubLayout.json' with {type:'json'};
export const YACHT=layout;
const c=Math.cos(layout.angle),s=Math.sin(layout.angle);
export function yachtWorld(u:number,v:number){return {x:layout.center[0]+c*u-s*v,z:layout.center[1]+s*u+c*v};}
export function yachtLocal(x:number,z:number){const dx=x-layout.center[0],dz=z-layout.center[1];return {u:c*dx+s*dz,v:-s*dx+c*dz};}
function polygon(u:number,v:number){let hit=false;const p=layout.polygon;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>v)!==(p[j][1]>v)&&u<(p[j][0]-p[i][0])*(v-p[i][1])/(p[j][1]-p[i][1])+p[i][0])hit=!hit;return hit;}
export function yachtInside(x:number,z:number){const {u,v}=yachtLocal(x,z);return u>-55&&u<67&&v>-21&&v<26&&polygon(u,v);}
export function yachtDeck(x:number,z:number,margin=0){const {u,v}=yachtLocal(x,z);return layout.piers.some(p=>Math.abs(u-p.u)<p.width/2+margin&&v>=p.end-margin&&v<=p.start+margin);}
export function yachtFloor(x:number,z:number){if(yachtDeck(x,z))return 2;const {u,v}=yachtLocal(x,z);if(u< -55||u>67||v< -21||v>26||!polygon(u,v))return null;const t=layout.stairs;if(u<=t.u1)return t.high;if(u<t.u0&&Math.abs(v-t.v)<t.width/2)return t.low+(t.high-t.low)*(t.u0-u)/(t.u0-t.u1);return 2;}
export function yachtRoom(x:number,z:number){if(yachtDeck(x,z))return 'Yacht Club · Marina piers';if(!yachtInside(x,z))return null;const {u,v}=yachtLocal(x,z);return 'Yacht Club · '+(u< -27?'Timber hall':u< -17?'Grand staircase':Math.abs(u+7)<4?'Commodores passage':u>16?'East lounge':'Main lobby');}
export function yachtBlocked(x:number,z:number,margin=0,y=3){const {u,v}=yachtLocal(x,z);if(u< -55-margin||u>67+margin||v< -21-margin||v>26+margin)return false;
 if(layout.walls.some(w=>{if(y>2+w.height)return false;const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],t=Math.max(0,Math.min(1,((u-w.a[0])*dx+(v-w.a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(u-w.a[0]-t*dx,v-w.a[1]-t*dz)<.23+margin;}))return true;
 // Upper hall retaining wall and the stair balustrades keep riders away from a drop.
 if(y<6.6&&Math.abs(u+27)<.18+margin&&Math.abs(v)>2.7-margin&&v>-17.9&&v<23.9)return true;
 if(y<6.6&&u< -17&&u> -27&&Math.abs(Math.abs(v)-2.7)<.12+margin)return true;
 return layout.solids.some(b=>y<2+b.height&&Math.abs(u-b.u)<b.w/2+margin&&Math.abs(v-b.v)<b.d/2+margin);
}
export function yachtRay(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=.4,flight=false){if(Math.hypot(o.x-layout.center[0],o.z-layout.center[1])>75+max)return null;const steps=Math.max(1,Math.ceil(max/.08));for(let i=0;i<=steps;i++){const t=max*i/steps,x=o.x+d.x*t,y=o.y+d.y*t,z=o.z+d.z*t;const local=yachtLocal(x,z);if(yachtBlocked(x,z,half,y)||(flight&&y>9.4&&((y<14&&yachtInside(x,z))||(y<20&&local.u>-14-half&&local.u< -half&&local.v> -11-half&&local.v<3+half))))return t;}return null;}
