import {signSupports} from './signSupports.ts';
import * as T from 'three';
import {cutPoint,heightAt,hash,type DetroitWorld} from './world.ts';
import {GEO,cutWidth,nearestRamp} from './geo-profile.ts';
import {roadAt} from './geography.ts';

/** Reference-informed landmark locations in metres along the mapped Cut.
 * Fine positioning/dimensions are authored approximations, not a survey. */
export const CUT_LANDMARKS=[
 {id:'fit-park',name:'Fit Park',at:265,offset:8},
 {id:'campbell',name:'David Campbell Terrace',at:930.563,offset:11.957},
 {id:'grand-trunks',name:'Grand Trunks',at:1186,offset:-6.6},
 {id:'grand-trunks-north',name:'Grand Trunks',at:1437,offset:6.6},
 {id:'freight',name:'Dequindre Cut Freight Yard',at:2052,offset:-10},
 {id:'mogo',name:'MoGo / bike repair',at:2130,offset:-6.3},
] as const;
type Label=(g:T.Group,text:string,x:number,y:number,z:number,w?:number,h?:number,ry?:number)=>void;
export function buildCutLandmarks(world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group,label:Label){
 const steel=new T.MeshStandardMaterial({color:'#263b39',metalness:.55,roughness:.45}),wood=new T.MeshStandardMaterial({color:'#806548',roughness:.88}),stone=new T.MeshStandardMaterial({color:'#afa694',roughness:.98}),red=new T.MeshStandardMaterial({color:'#b43e34',roughness:.65}),cream=new T.MeshStandardMaterial({color:'#d4d4bc',roughness:.85});
 const bulb=new T.MeshStandardMaterial({color:'#ffe2ac',emissive:'#efbc70',emissiveIntensity:.55});
 let fixtures=0;
 function spot(d:number,u:number,name:string){const p=cutPoint(d,u),g=new T.Group();g.name=name;g.position.set(p.x,heightAt(p.x,p.z),p.z);g.rotation.y=p.heading;groupAt(p.x,p.z).add(g);fixtures++;return g;}
 function mesh(g:T.Group,geometry:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0){const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 function box(g:T.Group,x:number,y:number,z:number,w:number,h:number,depth:number,mat=steel){return mesh(g,new T.BoxGeometry(w,h,depth),mat,x,y,z);}
 function bar(g:T.Group,a:number[],b:number[],radius=.035,mat=steel){const v=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...b as [number,number,number]);const o=mesh(g,new T.CylinderGeometry(radius,radius,v.distanceTo(end),6),mat);o.position.copy(v).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(v).normalize());return o;}
 function solid(g:T.Group,w:number,h:number,depth:number){const s={x:g.position.x,y:g.position.y+h/2,z:g.position.z,hx:w/2,hy:h/2,hz:depth/2,kind:'landmark',yaw:g.rotation.y};world.solids.push(s);world.addBox(s);}
 function sign(d:number,u:number,text:string,w=3.2){const p=cutPoint(d,u),g=groupAt(p.x,p.z),yaw=p.heading+(u>0?1:-1)*Math.PI/2,y=heightAt(p.x,p.z)+1.85;
 for(const post of signSupports(p.x,p.z,yaw,w,y+.15,heightAt)){const pole=box(g,post.x,post.y,post.z,.085,post.height,.085);pole.name='Grounded sign post';box(g,post.x,post.base+.14,post.z,.23,.12,.23,stone);}
 label(g,text,p.x,y,p.z,w,.52,yaw);}

 function bench(d:number,u:number){const g=spot(d,u,'Slatted trail bench');for(const z of [-.65,.65])box(g,0,.25,z,.55,.5,.065);for(let x=-.22;x<=.23;x+=.11)box(g,x,.48,0,.09,.065,1.65,wood);for(let y=.65;y<1;y+=.12)box(g,-.27,y,0,.065,.09,1.65,wood);solid(g,.62,1,1.75);}
 // Google Maps Campbell Terrace pin: 42.3406046, -83.0315474.
 // West bank immediately north of the Lafayette ramp foot; dimensions are approximate.
 const c=CUT_LANDMARKS[1],stage=spot(c.at,c.offset,'David Campbell Terrace stage');
 const top=Math.max(...[-2,2].flatMap(x=>[-6,6].map(z=>{const p=cutPoint(c.at+z,c.offset+x);return heightAt(p.x,p.z);})))+.50;
 const deckHeight=top-stage.position.y;box(stage,0,deckHeight/2,0,4,deckHeight,12,stone);solid(stage,4,deckHeight,12);
 // Curved silver canopy, exposed timber ribs and a concrete rear wall.
 box(stage,-2.1,deckHeight+1.55,0,.20,3.1,12,stone);
 const roofY=(z:number)=>deckHeight+2.9+.72*(1-(z/6)**2);
 for(const z of [-5.6,0,5.6]){bar(stage,[-1.9,deckHeight,z],[-1.9,roofY(z)+.12,z],.075);bar(stage,[-1.9,roofY(z)+.85,z],[1.8,roofY(z)+.08,z],.035,cream);}
 const canopy=new T.BufferGeometry(),verts:number[]=[];for(let i=0;i<32;i++){const za=-6+i*12/32,zb=za+12/32;for(const [x,z]of [[-2.3,za],[2.5,za],[2.5,zb],[-2.3,za],[2.5,zb],[-2.3,zb]])verts.push(x,roofY(z)+x*.04,z);}canopy.setAttribute('position',new T.Float32BufferAttribute(verts,3));canopy.computeVertexNormals();const shell=cream.clone();shell.side=T.DoubleSide;mesh(stage,canopy,shell);
 for(let z=-5.8;z<=5.8;z+=.65)bar(stage,[-2.05,roofY(z)-.13,z],[2.4,roofY(z)-.13,z],.065,wood);
 for(const x of [-2.3,2.5])for(let i=0;i<32;i++){const z=-6+i*12/32;bar(stage,[x,roofY(z)+x*.04,z],[x,roofY(z+12/32)+x*.04,z+12/32],.075,cream);}
 // Three curved grass terraces around the stage front, opening toward the Cut.
 const grass=new T.MeshStandardMaterial({color:'#607749',roughness:1});
 for(let tier=0;tier<3;tier++){const r=1.1+tier*.9,y=deckHeight-(tier+1)*.16;const v:number[]=[];for(let i=0;i<40;i++){const a=-Math.PI/2+i*Math.PI/40,bb=a+Math.PI/40;for(const [rr,t] of [[r,a],[r+.75,a],[r+.75,bb],[r,a],[r+.75,bb],[r,bb]])v.push(1.4+Math.cos(t)*rr,y,Math.sin(t)*(5.1+rr*.35));bar(stage,[1.4+Math.cos(a)*(r+.78),y-.07,Math.sin(a)*(5.1+(r+.78)*.35)],[1.4+Math.cos(bb)*(r+.78),y-.07,Math.sin(bb)*(5.1+(r+.78)*.35)],.10,stone);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.computeVertexNormals();const mat=grass.clone();mat.side=T.DoubleSide;mesh(stage,geo,mat);}
 for(const z of [-5.3,5.3]){box(stage,1,deckHeight+.4,z,.45,.8,.4,steel);mesh(stage,new T.CylinderGeometry(.35,.25,.45,8),steel,2.4,deckHeight+.2,z);}

 sign(c.at-9,6.5,'DAVID CAMPBELL TERRACE',4.1);for(const at of [c.at-16,c.at+16])bench(at,5.1);
 // Woodbridge Fit Park: pull-up frames, elliptical stations and seated presses.
 sign(254,5.2,'FIT PARK',2.6);
 for(let i=0;i<5;i++){const g=spot(263+i*3.7,7.2,'Fit Park exercise station');
  if(i%2===0){for(const z of [-.55,.55])bar(g,[0,0,z],[0,2.2,z],.065,red);bar(g,[0,2.2,-.6],[0,2.2,.6],.055);bar(g,[0,1.35,-.55],[.55,1.15,-.55]);box(g,.38,.62,0,.5,.1,.55);}
  else{bar(g,[0,0,0],[0,1.5,0],.09,red);for(const z of [-.3,.3]){bar(g,[-.45,.2,z],[.35,1.25,z]);box(g,-.4,.2,z,.6,.07,.22);bar(g,[.35,1.25,z],[.5,1.5,z]);}}
  solid(g,1.3,2.2,1.45);
 }
 // Grand Trunks: timber stepping and balance features underneath the overpasses.
 for(const site of CUT_LANDMARKS.filter(l=>l.id.startsWith('grand-trunks'))){for(let i=0;i<7;i++){const g=spot(site.at-4+i*1.25,site.offset+(i%2)*.65,'Grand Trunks stepping timber'),h=.22+(i%3)*.1;mesh(g,new T.CylinderGeometry(.32,.38,h,10),wood,0,h/2);solid(g,.72,h,.72);}sign(site.at+6,site.offset,'GRAND TRUNKS',2.6);}
 // Freight Yard gathering space in front of the existing nine containers.
 for(let i=0;i<7;i++){const g=spot(2032+i*5,-8.4,'Freight Yard picnic table');box(g,0,.77,0,1.7,.1,.8,wood);for(const z of [-.65,.65]){box(g,0,.44,z,1.7,.09,.25,wood);for(const x of [-.6,.6])bar(g,[x,0,z],[x,.74,0],.05);}solid(g,1.8,.85,1.6);}
 sign(2087,-7.8,'DEQUINDRE CUT FREIGHT YARD',5.2);
 for(const at of [2024,2042,2060,2078]){const g=spot(at,-11,'Freight Yard festoon mast');bar(g,[0,0,0],[0,4.2,0],.05);}
 for(let d=2024;d<2078;d+=1.5){const p=cutPoint(d,-11),g=groupAt(p.x,p.z);const y=heightAt(p.x,p.z)+4.2-.36*Math.sin((d-2024)%18/18*Math.PI);const o=new T.Mesh(new T.SphereGeometry(.055,6,4),bulb);o.position.set(p.x,y,p.z);g.add(o);}
 // Red MoGo dock row and a maintenance stand / foot pump.
 sign(2122,-5.2,'MOGO / BIKE REPAIR',3.5);
 for(let i=0;i<7;i++){const g=spot(2128+i*1.2,-6.3,'MoGo cycle dock');box(g,0,.4,0,.2,.8,.18);for(const z of [-.62,.62]){const wheel=mesh(g,new T.TorusGeometry(.31,.035,5,16),steel,0,.33,z);wheel.rotation.y=Math.PI/2;}bar(g,[0,.4,-.6],[0,.85,-.1],.028,red);bar(g,[0,.85,-.1],[0,.4,.15],.028,red);bar(g,[0,.4,.15],[0,.4,-.6],.028,red);bar(g,[0,.85,-.1],[0,.85,.45],.028,red);bar(g,[0,.85,.45],[0,.33,.62],.028,red);bar(g,[-.2,1.05,.5],[.2,1.05,.5],.028);box(g,0,.94,-.15,.22,.055,.25);solid(g,.55,1.1,1.4);}
 const repair=spot(2118,-5.4,'Bike service stand');box(repair,0,.65,0,.14,1.3,.14,red);bar(repair,[-.35,1.25,0],[.35,1.25,0],.04);bar(repair,[.5,0,0],[.5,.65,0],.055);bar(repair,[.3,.68,0],[.7,.68,0],.03);
 for(const at of [110,570,1030,1630,2270,2520]){bench(at,5.2);const g=spot(at+3,5.1,'Trail waste and recycling');for(const z of [-.35,.35]){mesh(g,new T.CylinderGeometry(.25,.25,.85,10),steel,0,.425,z);mesh(g,new T.CylinderGeometry(.27,.27,.045,10),cream,0,.87,z);}solid(g,.6,.9,1.3);}
 for(const at of [65,840,1685,2260])sign(at,-5.3,'DETROIT RIVERFRONT CONSERVANCY',4.6);
 return {sites:CUT_LANDMARKS,fixtures};
}

export type FlowerSite={x:number;y:number;z:number;at:number;type:number;scale:number;rotation:number};
/** Color drifts on the planted banks, leaving entrances, streets and landmarks open. */
export function flowerSites(blocked:(x:number,z:number)=>boolean=()=>false):FlowerSite[]{
 const sites:FlowerSite[]=[];
 for(const [start,end,side]of [[350,420,1],[550,685,-1],[760,870,1],[970,1120,1],[1010,1140,-1],[1250,1390,1],[1550,1620,-1],[1650,1720,1],[1975,2010,1],[2290,2410,-1],[2440,2520,1]]){
  for(let d=start;d<end;d+=.85)for(let band=0;band<5;band++){
   const seed=d*57+band*89;if(hash(seed)<.2)continue;const at=d+hash(seed+4)*.6,u=side*(cutWidth(d)/2+1.5+band*.68+hash(seed+7)*.4),p=cutPoint(at,u),r=nearestRamp(p.x,p.z);
   if(r.distance<r.width/2+1||GEO.bridges.some(b=>Math.abs(b.at-at)<12)||roadAt(p.x,p.z)||blocked(p.x,p.z))continue;
   const type=band===4?3:Math.floor(at/13)%3;
   sites.push({...p,at,y:heightAt(p.x,p.z)+.018,type,scale:.7+hash(seed+2)*.55,rotation:hash(seed+1)*Math.PI*2});
  }
 }
 return sites;
}
function flowerGeometry(type:number){
 const positions:number[]=[],colors:number[]=[],green=new T.Color('#4f6e32'),bloom=new T.Color(['#de581b','#e3b943','#a8322c','#9873b9'][type]);
 function tri(a:number[],b:number[],c:number[],color:T.Color){positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);}
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7,dx=Math.cos(a),dz=Math.sin(a);for(let j=0;j<5;j++){const t=j/5,u=(j+1)/5,w=.022*(1-t),w2=.022*(1-u),x=.42*t*t,z=.55*Math.sin(t*Math.PI*.77),x2=.42*u*u,z2=.55*Math.sin(u*Math.PI*.77);const l=[dx*x-dz*w,z,dz*x+dx*w],r=[dx*x+dz*w,z,dz*x-dx*w],l2=[dx*x2-dz*w2,z2,dz*x2+dx*w2],r2=[dx*x2+dz*w2,z2,dz*x2-dx*w2];tri(l,r,l2,green);tri(r,r2,l2,green);}}
 for(let axis=0;axis<2;axis++){const x=axis?.007:0,z=axis?0:.007;tri([-x,0,-z],[x,0,z],[x,.68,z],green);tri([-x,0,-z],[x,.68,z],[-x,.68,-z],green);}
 for(let head=0;head<(type===3?4:2);head++){const y=.62+head*.1,cx=head*.04;
  for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a),dz=Math.sin(a),r=type===3?.035:.065,w=type===3?.018:.025;const start=[cx,y,0],left=[cx+dx*r-dz*w,y+.025,dz*r+dx*w],tip=[cx+dx*r*1.9,y-.025,dz*r*1.9],right=[cx+dx*r+dz*w,y+.025,dz*r-dx*w];tri(start,left,tip,bloom);tri(start,tip,right,bloom);tri([cx,y+.012,0],[cx+dx*.018,y+.022,dz*.018],[cx+Math.cos(a+1)*.018,y+.022,Math.sin(a+1)*.018],new T.Color('#c6a238'));}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
export function buildCutFlowers(scene:T.Scene,world:DetroitWorld){
 const sites=flowerSites((x,z)=>world.solids.some(s=>Math.hypot(s.x-x,s.z-z)<Math.hypot(s.hx,s.hz)+.3)),groups:{group:T.Group;at:number}[]=[],mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.94}),geometries=[0,1,2,3].map(flowerGeometry),dummy=new T.Object3D();
 for(let start=300;start<2550;start+=50){const group=new T.Group();group.name='Dequindre flower drifts '+start;
  for(let type=0;type<4;type++){const list=sites.filter(p=>p.at>=start&&p.at<start+50&&p.type===type);if(!list.length)continue;const m=new T.InstancedMesh(geometries[type],mat,list.length);m.receiveShadow=true;for(const [i,p]of list.entries()){dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.computeBoundingSphere();group.add(m);}
  if(group.children.length){scene.add(group);groups.push({group,at:start+25});}
 }
 return {count:sites.length,update(x:number,z:number,compact:boolean){for(const c of groups){const p=cutPoint(c.at);c.group.visible=Math.hypot(p.x-x,p.z-z)<(compact?90:165);}}};
}
