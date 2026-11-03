import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {activityLayout,courtFrame,fieldFrame,fieldDistance,clockWorld,clockHillHeight,clockAngles,floralClock,trailMarker,localPoint} from './activitiesPlan.ts';
import type {ParkMap,ParkTerrain} from './terrain.ts';
export function addActivities(scene:T.Scene,map:ParkMap,terrain:ParkTerrain,grass:T.MeshStandardMaterial){
 const root=new T.Group();root.name='Belle Isle courts and ballfields';scene.add(root);
 const paint=new T.MeshStandardMaterial({name:'Court paint blue',color:0x315f78,roughness:.94}),runoff=new T.MeshStandardMaterial({name:'Court paint green',color:0x477262,roughness:1}),white=new T.MeshStandardMaterial({name:'Court line markings',color:0xeee9d9,roughness:.85}),metal=new T.MeshStandardMaterial({name:'Sports powder coated steel',color:0x273a33,roughness:.65,metalness:.45}),red=new T.MeshStandardMaterial({name:'Sports rim orange',color:0xcb532d,roughness:.5,metalness:.3}),dirt=new T.MeshStandardMaterial({name:'Ballfield infield sand',color:0x99704d,roughness:1}),board=new T.MeshStandardMaterial({name:'Backboard sign',color:0xdddcd3,roughness:.8});
 const buckets=new Map<T.Material,T.BufferGeometry[]>(),wire:number[]=[];
 function add(g:T.BufferGeometry,m:T.Material,parent:T.Object3D,x=0,y=0,z=0,rx=0,ry=0,rz=0){const obj=new T.Object3D();obj.position.set(x,y,z);obj.rotation.set(rx,ry,rz);parent.add(obj);obj.updateWorldMatrix(true,false);g.applyMatrix4(obj.matrixWorld);parent.remove(obj);const list=buckets.get(m)||[];list.push(g);buckets.set(m,list);}
 function box(parent:T.Object3D,m:T.Material,w:number,h:number,d:number,x:number,y:number,z:number){add(new T.BoxGeometry(w,h,d),m,parent,x,y,z);}
 function plane(parent:T.Object3D,m:T.Material,w:number,l:number,x=0,z=0,y=.035){add(new T.PlaneGeometry(w,l),m,parent,x,y,z,-Math.PI/2);}
 function line(parent:T.Object3D,a:number[],b:number[]){parent.updateWorldMatrix(true,false);for(const p of[a,b]){const v=new T.Vector3(...p as [number,number,number]).applyMatrix4(parent.matrixWorld);wire.push(v.x,v.y,v.z);}}
 function marking(parent:T.Object3D,a:number[],b:number[],width=.065){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);add(new T.BoxGeometry(width,.012,length),white,parent,(a[0]+b[0])/2,.056,(a[1]+b[1])/2,0,Math.atan2(dx,dz));}
 function arc(parent:T.Object3D,x:number,z:number,r:number,a=0,b=Math.PI*2){for(let i=0;i<48;i++){const q=a+(b-a)*i/48,t=a+(b-a)*(i+1)/48;marking(parent,[x+Math.sin(q)*r,z+Math.cos(q)*r],[x+Math.sin(t)*r,z+Math.cos(t)*r]);}}
 function group(x:number,z:number,heading:number){const g=new T.Group();g.position.set(x,2,z);g.rotation.y=heading;g.updateMatrixWorld(true);return g;}
 for(const sport of activityLayout.sports){
  if(sport.sport==='tennis'||sport.sport==='basketball'){
   const f=courtFrame(sport.points),g=group(...f.center,f.heading),w=f.width,l=f.length;
   plane(g,runoff,w+2.2,l+6);plane(g,paint,w,l,0,0,.041);
   for(const x of[-w/2,w/2])marking(g,[x,-l/2],[x,l/2]);for(const z of[-l/2,l/2])marking(g,[-w/2,z],[w/2,z]);
   if(sport.sport==='tennis'){
    const sw=Math.min(8.23,w-2),service=Math.min(6.4,l/3);for(const x of[-sw/2,sw/2])marking(g,[x,-l/2],[x,l/2]);for(const z of[-service,service])marking(g,[-sw/2,z],[sw/2,z]);marking(g,[0,-service],[0,service]);
    for(const side of[-1,1]){add(new T.CylinderGeometry(.045,.045,1.12,10),metal,g,side*(w/2+.35),.56,0);marking(g,[-.06,side*l/2],[.06,side*(l/2-.17)]);}
    for(let x=-w/2-.3;x<=w/2+.3;x+=.24){const h=.914+.156*(Math.abs(x)/(w/2+.3))**2;line(g,[x,.06,0],[x,h,0]);}for(let y=.12;y<=.92;y+=.13)line(g,[-w/2-.3,y,0],[w/2+.3,y,0]);for(let i=0;i<32;i++){const x=-w/2-.3+(w+.6)*i/32,n=x+(w+.6)/32;line(g,[x,.914+.156*(Math.abs(x)/(w/2+.3))**2,0],[n,.914+.156*(Math.abs(n)/(w/2+.3))**2,0]);}
    box(g,white,.055,.95,.025,0,.475,0);
   }else{
    marking(g,[-w/2,0],[w/2,0]);arc(g,0,0,1.8);
    for(const side of[-1,1]){
     const end=side*l/2,free=end-side*5.5;plane(g,runoff,4.9,5.5,0,end-side*2.75,.044);for(const x of[-2.45,2.45])marking(g,[x,end],[x,free]);marking(g,[-2.45,free],[2.45,free]);arc(g,0,free,1.8);
     const hoopZ=end-side*1.2;arc(g,0,hoopZ,Math.min(6.25,w/2-.65),side===1?Math.PI/2:-Math.PI/2,side===1?Math.PI*1.5:Math.PI/2);
     box(g,metal,.16,3.75,.16,0,1.875,end+side*.6);box(g,metal,.12,.12,1.0,0,3.3,end+side*.1);box(g,board,1.8,1.05,.08,0,3.55,end-side*.35);for(const dx of[-.3,.3])box(g,metal,.025,.45,.018,dx,3.45,end-side*.405);for(const dy of[-.225,.225])box(g,metal,.6,.025,.018,0,3.45+dy,end-side*.405);
     box(g,metal,.075,.07,.65,0,3.05,end-side*.73);add(new T.TorusGeometry(.225,.022,6,24),red,g,0,3.05,hoopZ,Math.PI/2);
     for(let i=0;i<12;i++){const a=i*Math.PI/6,b=a+.25;line(g,[Math.sin(a)*.225,3.05,hoopZ+Math.cos(a)*.225],[Math.sin(b)*.13,2.64,hoopZ+Math.cos(b)*.13]);}for(const y of[2.78,2.92])for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6,r=.13+(y-2.64)*.23;line(g,[Math.sin(a)*r,y,hoopZ+Math.cos(a)*r],[Math.sin(b)*r,y,hoopZ+Math.cos(b)*r]);}
    }
   }
  }else{
   const f=fieldFrame(sport.points),g=group(...f.home,f.heading),b=f.base/Math.SQRT2;
   const shape=new T.Shape();shape.moveTo(0,0);for(let i=0;i<=48;i++){const a=-Math.PI/4+i*Math.PI/96;const r=fieldDistance(sport.points,a,29);shape.lineTo(Math.sin(a)*r,-Math.cos(a)*r);}shape.closePath();add(new T.ShapeGeometry(shape),dirt,g,0,.04,0,-Math.PI/2);
   for(const side of[-1,1]){const r=fieldDistance(sport.points,side*Math.PI/4,56.57)/Math.SQRT2;marking(g,[0,0],[side*r,r],.10);}
   const bases=[[0,0],[-b,b],[0,b*2],[b,b]];for(const p of bases)box(g,white,.38,.07,.38,p[0],.075,p[1]);
   add(new T.CylinderGeometry(2.1,2.6,.16,32),dirt,g,0,.08,12.7);box(g,white,.61,.025,.15,0,.18,12.7);
   for(const x of[-1.05,1.05]){for(const z of[-.8,1.5])marking(g,[x-.45,z],[x+.45,z]);for(const xx of[x-.45,x+.45])marking(g,[xx,-.8],[xx,1.5]);}
   for(const x of[-5,0,5])add(new T.CylinderGeometry(.06,.06,4.25,8),metal,g,x,2.125,-3.6);
   for(let x=-5;x<=5;x+=.32)line(g,[x,.15,-3.6],[x,4.2,-3.6]);for(let y=.2;y<=4.2;y+=.32)line(g,[-5,y,-3.6],[5,y,-3.6]);
   for(const side of[-1,1]){box(g,metal,3.8,.10,.5,side*9,.50,-1);for(const x of[-1.3,1.3])box(g,metal,.10,.5,.45,side*9+x,.25,-1);}
  }
 }
 for(const [material,geometries]of buckets){const geometry=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.name=material.name;mesh.receiveShadow=true;mesh.castShadow=material===metal||material===board;root.add(mesh);}
 const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(wire,3));root.add(new T.LineSegments(lines,new T.LineBasicMaterial({color:0xb0b8ad,transparent:true,opacity:.78})));
 // Mapped trail entrances keep the route clear; the signs are offset onto dry land.
 let trailCount=0;const signs=new T.Group();signs.name='Island trailhead markers';scene.add(signs);
 for(const trail of activityLayout.trails){const marker=trailMarker(trail,map,terrain);if(!marker)continue;trailCount++;const {point,heading:h}=marker;const ground=terrain.height(...point);const post=new T.Mesh(new T.BoxGeometry(.14,2.5,.14),metal);post.position.set(point[0],ground+1.25,point[1]);signs.add(post);const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#1b4036';ctx.fillRect(0,0,768,384);ctx.strokeStyle='#c5c9ae';ctx.lineWidth=10;ctx.strokeRect(12,12,744,360);ctx.fillStyle='#edeedc';ctx.textAlign='center';ctx.font='bold 34px sans-serif';ctx.fillText('BELLE ISLE · TRAIL',384,73);ctx.font='bold 45px sans-serif';const words=trail.name.replace(', Jr.','').split(' ');const middle=Math.ceil(words.length/2);ctx.fillText(words.slice(0,middle).join(' '),384,160,700);ctx.fillText(words.slice(middle).join(' '),384,217,700);ctx.font='52px sans-serif';ctx.fillText('↑',384,310);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const panel=new T.Mesh(new T.PlaneGeometry(2.3,1.15),new T.MeshStandardMaterial({name:'Trailhead sign',map:texture,roughness:.9,side:T.FrontSide}));panel.rotation.y=h;panel.position.set(point[0]+Math.sin(h)*.10,ground+2.05,point[1]+Math.cos(h)*.10);signs.add(panel);const back=panel.clone();back.rotation.y=h+Math.PI;back.position.set(point[0]-Math.sin(h)*.10,ground+2.05,point[1]-Math.cos(h)*.10);signs.add(back);
 }
 const clockRoot=new T.Group();clockRoot.name='Floral Clock Hill';scene.add(clockRoot);
 const verts:number[]=[],uv:number[]=[],idx:number[]=[];const c=floralClock;
 for(let z=0;z<=48;z++)for(let x=0;x<=40;x++){const lx=(x/40*2-1)*c.hillWidth,lz=c.hillOffset+(z/48*2-1)*c.hillDepth,p=clockWorld(lx,lz);verts.push(p[0],terrain.height(...p)+.018,p[1]);uv.push(lx/4,lz/4);if(x<40&&z<48){const i=z*41+x;idx.push(i,i+41,i+1,i+1,i+41,i+42);}}
 const hillG=new T.BufferGeometry();hillG.setAttribute('position',new T.Float32BufferAttribute(verts,3));hillG.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hillG.setIndex(idx);hillG.computeVertexNormals();const hillM=grass.clone();hillM.name='Clock hill lawn';const hill=new T.Mesh(hillG,hillM);hill.receiveShadow=true;clockRoot.add(hill);
 const faceRoot=new T.Group();faceRoot.position.set(c.center[0],terrain.height(...c.center as [number,number])+.15,c.center[1]);faceRoot.rotation.y=c.heading;clockRoot.add(faceRoot);const dial=new T.Group();dial.rotation.set(-Math.PI/2-.40,0,Math.PI);faceRoot.add(dial);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#334b25';ctx.fillRect(0,0,1024,1024);let seed=84;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};for(let i=0;i<15000;i++){const x=rand()*1024,y=rand()*1024;ctx.fillStyle=['#516235','#66793d','#7d8549','#415b30'][i%4];ctx.beginPath();ctx.ellipse(x,y,2+rand()*5,1+rand()*3,rand()*6.28,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#e8dbba';ctx.lineWidth=9;ctx.beginPath();ctx.arc(512,512,464,0,Math.PI*2);ctx.stroke();const romans=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];ctx.font='bold 65px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eee3b8';romans.forEach((n,i)=>{const a=i*Math.PI/6;ctx.fillText(n,512+Math.sin(a)*378,512-Math.cos(a)*378);});const dialTexture=new T.CanvasTexture(canvas);dialTexture.colorSpace=T.SRGBColorSpace;dialTexture.anisotropy=8;const disk=new T.Mesh(new T.CircleGeometry(c.radius,96),new T.MeshStandardMaterial({name:'Clock dial sign',map:dialTexture,roughness:.95,side:T.DoubleSide}));dial.add(disk);
 const blooms=new T.InstancedMesh(new T.IcosahedronGeometry(.105,0),new T.MeshStandardMaterial({name:'Floral clock flowers',color:0xffffff,roughness:.85}),1600),dummy=new T.Object3D(),colour=new T.Color();for(let i=0;i<1600;i++){const a=rand()*Math.PI*2,r=4.22+rand()*.75;dummy.position.set(Math.cos(a)*r,Math.sin(a)*r,.09+rand()*.12);dummy.scale.setScalar(.75+rand()*.5);dummy.updateMatrix();blooms.setMatrixAt(i,dummy.matrix);blooms.setColorAt(i,colour.setHex(i%5===0?0xe8d8ae:i%3===0?0xb95561:0x952e3e));}dial.add(blooms);
 const handM=new T.MeshStandardMaterial({name:'Clock hands sign',color:0xf5e8c0,roughness:.4,metalness:.5});function hand(length:number,width:number,z:number){const g=new T.Group(),shape=new T.Shape();shape.moveTo(-width,-.35);shape.lineTo(width,-.35);shape.lineTo(width*.6,length*.72);shape.lineTo(0,length);shape.lineTo(-width*.6,length*.72);shape.closePath();const m=new T.Mesh(new T.ShapeGeometry(shape),handM);m.position.z=z;g.add(m);dial.add(g);return g;}const hourHand=hand(2.35,.15,.30),minuteHand=hand(3.35,.10,.36);const hub=new T.Mesh(new T.SphereGeometry(.23,16,8),handM);hub.position.z=.42;dial.add(hub);
 return{stats:{tennis:activityLayout.sports.filter(s=>s.sport==='tennis').length,basketball:activityLayout.sports.filter(s=>s.sport==='basketball').length,baseball:activityLayout.sports.filter(s=>s.sport==='baseball').length,trails:trailCount},update(hour:number,x:number,z:number){const a=clockAngles(hour);hourHand.rotation.z=a.hour;minuteHand.rotation.z=a.minute;clockRoot.visible=Math.hypot(x-c.center[0],z-c.center[1])<850;root.visible=Math.hypot(x-1770,z-910)<1500;}};
}
