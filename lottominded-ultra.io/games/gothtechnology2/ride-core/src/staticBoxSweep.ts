import type {Vec3} from './terrain.ts';
export type StaticBox={x:number;y:number;z:number;hx:number;hy:number;hz:number;yaw:number;kind:string};
/** Exact swept sphere against an oriented box: face planes, edge cylinders,
 * corner spheres. Fractions share Rapier's segment query contract. */
export function staticBoxSweep(origin:Vec3,delta:Vec3,radius:number,box:StaticBox){
 const c=Math.cos(box.yaw),s=Math.sin(box.yaw),dx=origin.x-box.x,dz=origin.z-box.z;
 const p=[c*dx-s*dz,origin.y-box.y,s*dx+c*dz],v=[c*delta.x-s*delta.z,delta.y,s*delta.x+c*delta.z],h=[box.hx,box.hy,box.hz],r=Math.max(0,radius);
 let enter=0,exit=1;for(let a=0;a<3;a++){const extent=h[a]+r;if(Math.abs(v[a])<1e-12){if(Math.abs(p[a])>extent)return null;continue;}let lo=(-extent-p[a])/v[a],hi=(extent-p[a])/v[a];if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return null;}
 if(r===0)return enter;
 if(p.reduce((n,x,i)=>n+Math.max(0,Math.abs(x)-h[i])**2,0)<=r*r)return 0;
 let first=Infinity;const roots=(a:number,b:number,c:number,accept:(t:number)=>boolean)=>{const disc=b*b-4*a*c;if(a<1e-16||disc<0)return;const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1&&t<first&&accept(t))first=t;};
 for(let a=0;a<3;a++)for(const sign of [-1,1]){if(Math.abs(v[a])<1e-12)continue;const t=(sign*(h[a]+r)-p[a])/v[a];if(t>=0&&t<=1&&t<first&&p.every((x,i)=>i===a||Math.abs(x+v[i]*t)<=h[i]+1e-9))first=t;}
 for(let axis=0;axis<3;axis++){const a=(axis+1)%3,b=(axis+2)%3;for(const sa of [-1,1])for(const sb of [-1,1]){const u=p[a]-sa*h[a],w=p[b]-sb*h[b];roots(v[a]**2+v[b]**2,2*(u*v[a]+w*v[b]),u*u+w*w-r*r,t=>Math.abs(p[axis]+v[axis]*t)<=h[axis]+1e-9);}}
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const d=[p[0]-sx*h[0],p[1]-sy*h[1],p[2]-sz*h[2]];roots(v.reduce((n,x)=>n+x*x,0),2*d.reduce((n,x,i)=>n+x*v[i],0),d.reduce((n,x)=>n+x*x,0)-r*r,()=>true);}
 return Number.isFinite(first)?first:null;
}
