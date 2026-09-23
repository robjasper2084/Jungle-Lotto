import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import {heightAt,type DetroitWorld} from './world.ts';
import {batchStaticGroup} from './static-batch.ts';
/** Authored extension beyond Mack, not a claim about a real Detroit skatepark. */
export const PARK={x:2780,z:-1465,halfX:60,halfZ:40};
export const PARK_SPAWN={name:'Freestyle Yard / pump & trick park',x:2723,z:-1465,heading:Math.PI/2};
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function parkLift(x:number,z:number){
 // A roll-in bowl with a flat bottom, rounded transition and rounded outer bank.
 const r=Math.hypot(x-20,z-13);
 const bowl=r<22?3.1*smooth(5,13,r)*(1-smooth(15,22,r)):0;
 // Broad tabletop: smooth takeoff, deck, and rollable landing. No invisible gaps.
 const tabletop=Math.abs(z+15)<5?1.8*smooth(-13,-5,x)*(1-smooth(4,13,x))*(1-smooth(1,5,Math.abs(z+15))):0;
 // Oval pump line with soft rollers and banked outer edge.
 const oval=Math.sqrt((x/49)**2+(z/30)**2),band=smooth(.77,.89,oval)*(1-smooth(1.04,1.15,oval));
 const pump=band*(.65+.45*Math.sin(Math.atan2(z/30,x/49)*8)+.85*smooth(.94,1.05,oval));
 return Math.max(bowl,tabletop,pump);
}
export function parkY(x:number,z:number){return .15+Math.max(0,heightAt(x,z))+parkLift(x-PARK.x,z-PARK.z);}
export function parkContains(x:number,z:number){return Math.abs(x-PARK.x)<=60&&Math.abs(z-PARK.z)<=40;}
export function parkTriangles(){const out:number[]=[];
 const v=(x:number,z:number)=>[x,parkY(x,z),z];
 for(let x=PARK.x-63;x<PARK.x+63;x++)for(let z=PARK.z-43;z<PARK.z+43;z++)out.push(...v(x,z),...v(x,z+1),...v(x+1,z),...v(x+1,z),...v(x,z+1),...v(x+1,z+1));
 return new Float32Array(out);
}
export function buildFreestylePark(scene:T.Scene,world:DetroitWorld){
 const group=new T.Group();group.name='Swoop Freestyle Yard';scene.add(group);
 const concrete=new T.MeshStandardMaterial({vertexColors:true,roughness:.88});
 const vertices=parkTriangles(),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const colors:number[]=[];for(let i=0;i<vertices.length;i+=3){const x=vertices[i]-PARK.x,z=vertices[i+2]-PARK.z,oval=Math.sqrt((x/49)**2+(z/30)**2);const c=new T.Color(oval>.83&&oval<1.08?'#346b70':Math.hypot(x-20,z-13)<16?'#d7b583':Math.abs(z+15)<5&&Math.abs(x)<14?'#a75d4a':'#b8bbb4');colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));const smoothGeometry=mergeVertices(geometry);smoothGeometry.computeVertexNormals();geometry.dispose();const mesh=new T.Mesh(smoothGeometry,concrete);mesh.receiveShadow=true;group.add(mesh);world.addRideSurface(vertices,true);
 // Broad, ground-following access path from the Mack landing to the yard gate.
 const path:number[]=[];for(let i=0;i<180;i++){const x=2550+i;for(const [a,b,c] of [[[x,-1462],[x,-1468],[x+1,-1462]],[[x+1,-1462],[x,-1468],[x+1,-1468]]]){const tri=[a,b,c];tri.reverse();for(const [px,pz] of tri)path.push(px,Math.max(0,heightAt(px,pz))+.15,pz);}}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(path,3));pg.computeVertexNormals();const pm=new T.Mesh(pg,new T.MeshStandardMaterial({color:'#929b95',roughness:.94}));pm.receiveShadow=true;group.add(pm);world.addRideSurface(new Float32Array(path),true);
 const fence=(x:number,z:number,hx:number,hz:number)=>world.addBox({x,y:.85,z,hx,hy:.85,hz,kind:'fence'});
 for(const z of [-1506,-1424])fence(2780,z,61,.12);
 fence(2841,-1465,.12,41);fence(2719,-1488,.12,18);fence(2719,-1442,.12,18);
 const steel=new T.MeshStandardMaterial({color:'#263638',metalness:.65,roughness:.4});
 function box(x:number,y:number,z:number,w:number,h:number,d:number){const m=new T.Mesh(new T.BoxGeometry(w,h,d),steel);m.position.set(x,y,z);m.castShadow=true;group.add(m);}
 // Edge barriers stay clear of the west entry and of the riding lines.
 for(const z of [-1506,-1424])for(let x=2720;x<=2840;x+=8){box(x,.75,z,.1,1.5,.1);box(x+4,1.4,z,8,.07,.07);}
 for(const x of [2719,2841])for(let z=-1504;z<=-1432;z+=8){if(x===2719&&z>=-1472&&z<=-1464)continue;box(x,.75,z,.1,1.5,.1);box(x,1.4,z+4,.07,.07,8);}
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#132f33';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#e6c579';ctx.font='bold 64px Arial';ctx.textAlign='center';ctx.fillText('SWOOP FREESTYLE YARD',512,95);ctx.font='30px Arial';ctx.fillStyle='white';ctx.fillText('PUMP LOOP  /  ROLL-IN BOWL  /  TABLETOP',512,157);ctx.fillText('Ride free · Hop + tricks · Find your own line',512,206);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const signGeo=new T.PlaneGeometry(10,2.5);const uv=signGeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));const sign=new T.Mesh(signGeo,new T.MeshStandardMaterial({map:texture,side:T.DoubleSide}));sign.position.set(2723,4,-1452);sign.rotation.y=-Math.PI/2;group.add(sign);box(2723,1.5,-1456,.14,3,.14);box(2723,1.5,-1448,.14,3,.14);
 batchStaticGroup(group);return group;
}
