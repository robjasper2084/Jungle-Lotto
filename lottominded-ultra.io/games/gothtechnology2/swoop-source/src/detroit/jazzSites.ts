export const JAZZ_CLUBS=[
 {id:'milliken',osmId:'978934325',name:'Jazz Network Foundation · Milliken',x:25.58,z:-1212.50,width:25.2,depth:10.5,floor:0,heading:0.0685,asset:'milliken-jazz-club'},
 {id:'mack',osmId:'379485657',name:'Jazz Network Foundation · Mack Avenue',x:2555.17,z:-1594.81,width:29.1,depth:10.2,floor:0,heading:-Math.PI/2-.0717,asset:'mack-jazz-club'},
] as const;
export type JazzSite=typeof JAZZ_CLUBS[number];
export function jazzMap(s:JazzSite,u:number,v:number){return{x:s.x+Math.cos(s.heading)*u+Math.sin(s.heading)*v,z:s.z-Math.sin(s.heading)*u+Math.cos(s.heading)*v};}
export function jazzCoordinates(s:JazzSite,x:number,z:number){const dx=x-s.x,dz=z-s.z;return{u:Math.cos(s.heading)*dx-Math.sin(s.heading)*dz,v:Math.sin(s.heading)*dx+Math.cos(s.heading)*dz};}
export function jazzGrade(x:number,z:number,height:number){for(const s of JAZZ_CLUBS){const p=jazzCoordinates(s,x,z),d=Math.max(Math.abs(p.u)-s.width/2,p.v-s.depth/2,-s.depth/2-2-p.v,0),blend=Math.max(0,1-d/2);height+=(s.floor-height)*blend*blend*(3-2*blend);}return height;}
export function jazzSolids(){return JAZZ_CLUBS.flatMap(s=>{
 const boxes=[[0,-s.depth/2,s.width,9.6,.24,4.8],[-s.width/2,0,.24,9.6,s.depth,4.8],[s.width/2,0,.24,9.6,s.depth,4.8],[-(s.width/4+.68),s.depth/2,s.width/2-1.36,3.65,.24,1.825],[(s.width/4+.68),s.depth/2,s.width/2-1.36,3.65,.24,1.825],[0,s.depth/2,2.72,6.4,.24,6.8],[0,-s.depth/2+1.5,8,.28,2.6,.16]];
 // Furniture shares its exact positions with the Blender master; central aisle is open.
 for(const v of [2.8,.9,-1])for(const u of [-4.4,-2.3,2.3,4.4])boxes.push([u,v,.7,1.22,.76,.61]);
 return boxes.map(([u,v,w,h,d,y])=>{const p=jazzMap(s,u,v);return{...p,y:s.floor+y,hx:w/2,hy:h/2,hz:d/2,yaw:s.heading,kind:'Jazz club · '+s.id};});
 });}
