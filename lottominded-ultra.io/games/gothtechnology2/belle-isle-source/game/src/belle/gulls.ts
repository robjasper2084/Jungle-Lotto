import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared, lightweight gull meshes: body and two articulated wings, no texture download. */
export function addGulls(scene:T.Scene){
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,side:T.DoubleSide});
 const colored=(g:T.BufferGeometry,color:number)=>{const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));const out=g.index?g.toNonIndexed():g;if(out!==g)g.dispose();return out;};
 const ell=(p:number[],scale:number[],color:number)=>{const g=new T.SphereGeometry(1,10,7);g.scale(...scale as [number,number,number]);g.translate(...p as [number,number,number]);return colored(g,color);};
 const parts=[ell([0,0,0],[.12,.12,.34],0xe6e8e2),ell([0,.06,.31],[.09,.09,.12],0xf1f1e8),ell([0,.045,.43],[.028,.026,.10],0xd8ae57),ell([0,0,-.34],[.14,.025,.18],0xedefe6)];
 for(const side of [-1,1])parts.push(ell([side*.08,.09,.36],[.009,.011,.01],0x172229));
 const body=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
 const wing=new T.BufferGeometry();wing.setAttribute('position',new T.Float32BufferAttribute([0,0,.13,.38,.015,.04,.47,0,-.21,0,0,.13,.47,0,-.21,.02,0,-.22,.38,.015,.04,.78,-.025,-.28,.47,0,-.21],3));
 wing.computeVertexNormals();const wingColor:number[]=[];for(let i=0;i<9;i++){const c=new T.Color(i>=6?0x344047:0xbfc9cf);wingColor.push(c.r,c.g,c.b);}wing.setAttribute('color',new T.Float32BufferAttribute(wingColor,3));wing.computeBoundingSphere();
 const anchors=[[199,1310],[264,475],[800,900],[1950,700],[2390,150],[3100,80],[3930,-185]];
 const birds=anchors.flatMap(([x,z],j)=>Array.from({length:2},(_,i)=>{const root=new T.Group();root.name='Seagull · circling water';root.add(new T.Mesh(body,material));const wings=[-1,1].map(side=>{const pivot=new T.Group();pivot.scale.x=side;pivot.add(new T.Mesh(wing,material));root.add(pivot);return pivot;});root.visible=false;scene.add(root);return{root,wings,x,z,phase:j*1.17+i*2.4,height:18+i*7,radius:30+i*14};}));
 let maxVisible=6;
 return {stats:{instances:birds.length,maxDraws:18},setQuality(q:string){maxVisible=q==='smooth'?4:6;},update(time:number,x:number,z:number){let visible=0;for(const b of birds){b.root.visible=Math.hypot(x-b.x,z-b.z)<360&&visible<maxVisible;if(!b.root.visible)continue;visible++;const t=time*.09+b.phase;const flap=Math.max(0,Math.sin(time*.45+b.phase));b.root.position.set(b.x+Math.sin(t)*b.radius,b.height+Math.sin(t*1.7)*1.4,b.z+Math.cos(t)*b.radius*.72);b.root.rotation.set(0,Math.atan2(Math.cos(t),-.72*Math.sin(t)),.12);b.wings.forEach((wing,i)=>{wing.rotation.z=(i===0?-1:1)*(.12+Math.sin(time*5.8+b.phase)*.38*flap);});}}};
}
