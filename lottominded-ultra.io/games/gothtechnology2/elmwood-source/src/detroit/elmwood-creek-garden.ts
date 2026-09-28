import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ElmwoodTerrain,inElmwoodPond} from './elmwood-terrain.ts';
import {inRing,ELMWOOD_PARKING,ELMWOOD_YOUNG} from './elmwood-details.ts';

export type CreekPlant={x:number;north:number;scale:number;kind:number};
/** Plant bands beside the mapped open creek, excluding paths and every structure. */
export function elmwoodCreekPlantings(terrain:ElmwoodTerrain,boundary:number[][]){
 const flowers:CreekPlant[]=[],shrubs:number[][]=[];
 const creeks=terrain.features.filter(f=>f.tags.waterway==='stream'&&!f.tags.tunnel);
 const buildings=terrain.features.filter(f=>f.kind==='building');
 const clear=(x:number,n:number,r:number)=>{
  if(!inRing(x,n,boundary))return false;
  if(Math.hypot(x-ELMWOOD_YOUNG.x,n-ELMWOOD_YOUNG.north)>2.5+r&&!inRing(x,n,terrain.features.find(f=>f.tags.water==='pond')?.points??[])&&terrain.nearest(x,n).distance>2.8+r&&!inRing(x,n,ELMWOOD_PARKING)){
   for(let i=0;i<8;i++){const px=x+Math.cos(i*Math.PI/4)*r,pn=n+Math.sin(i*Math.PI/4)*r;
    if(inElmwoodPond(px,pn,terrain.features)||buildings.some(f=>inRing(px,pn,f.points)))return false;}
   return !terrain.placements.some(p=>{
    if(p.asset==='grass-tuft'||p.asset==='fallen-leaf-patch')return false;
    const radius=p.layer!=='estimated'?(p.asset==='elmwood-park-bench'?2.5:8):p.asset==='ledger'?1.9:1.4;
    return Math.hypot(x-p.position[0],n-p.position[1])<radius;
   });
  }return false;
 };
 let step=0;
 for(const f of creeks)for(let j=1;j<f.points.length;j++){
  const a=f.points[j-1],b=f.points[j],dx=b[0]-a[0],dn=b[1]-a[1],len=Math.hypot(dx,dn);if(len<.01)continue;
  for(let d=1;d<len;d+=1.15,step++)for(const side of [-1,1]){
   // Broken drifts and grass gaps, not a solid hedge down the water channel.
   if(step%19>15)continue;
   const t=d/len,offset=side*(3.9+.7*Math.sin(step*.77));
   const x=a[0]+dx*t-dn/len*offset,n=a[1]+dn*t+dx/len*offset;
   if(clear(x,n,.72))flowers.push({x,north:n,scale:.75+(step%5)*.09,kind:Math.floor(step/9)%3});
   if(step%6===2){const sx=x-dn/len*side*1.8,sn=n+dx/len*side*1.8;if(clear(sx,sn,1))shrubs.push([sx,sn,.60]);}
  }
 }
 // Larger garden drifts remain within the established entrance, chapel and memorial lawns.
 const gardens:CreekPlant[]=[];
 const zones=[[18,-14,10,5],[-13,-13,13,4],[-12,42,18,7],[-61.94,331.29,14,11],[-135,445,12,7],[ELMWOOD_YOUNG.x,ELMWOOD_YOUNG.north,5,4]];
 for(const [bx,bn,rx,rn]of zones)for(let i=0;i<250;i++){
  const a=i*2.399963,r=Math.sqrt((i+.5)/250),x=bx+Math.cos(a)*rx*r,n=bn+Math.sin(a)*rn*r;
  // Gentle patches with grass between them; never fill the monument's access apron.
  if(Math.sin(x*.63)+Math.cos(n*.48)<-.3||!clear(x,n,.75))continue;
  gardens.push({x,north:n,scale:.85+(i%5)*.07,kind:Math.floor(i/19)%5});
 }
 const pond=terrain.features.find(f=>f.tags.water==='pond')?.points??[];
 const center=pond.reduce((sum,p)=>[sum[0]+p[0]/pond.length,sum[1]+p[1]/pond.length],[0,0]);
 for(let j=1;j<pond.length;j++){const a=pond[j-1],b=pond[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=0;d<len;d+=1.3){const t=d/len,x=a[0]+(b[0]-a[0])*t,n=a[1]+(b[1]-a[1])*t,dx=x-center[0],dn=n-center[1],r=Math.hypot(dx,dn)||1,px=x+dx/r*3.5,pn=n+dn/r*3.5;
   for(const row of [0,1]){const shift=.75*Math.sin(d*1.3+j)+row*1.3,qx=px+dx/r*shift,qn=pn+dn/r*shift;if(j%7<5&&Math.sin(d*.6+j)>.0&&clear(qx,qn,.75))gardens.push({x:qx,north:qn,scale:.72+(j%4)*.08,kind:(j+Math.floor(d/8))%3});}
  }
 }
 return {flowers,shrubs,gardens};
}

export function makeElmwoodCreekGarden(world:T.Group,terrain:ElmwoodTerrain,flowers:CreekPlant[]){
 const root=new T.Group();root.name='Elmwood creek and garden flower drifts';world.add(root);
 const materials:T.MeshStandardMaterial[]=[];const o=new T.Object3D();
 for(let kind=0;kind<5;kind++){
  const list=flowers.filter(p=>p.kind===kind).sort((a,b)=>Math.sin(a.x*12.9898+a.north*78.233)-Math.sin(b.x*12.9898+b.north*78.233)),parts:T.BufferGeometry[]=[];
  const add=(g:T.BufferGeometry,color:string)=>{const c=new T.Color(color),rgb=new Float32Array(g.attributes.position.count*3);for(let i=0;i<g.attributes.position.count;i++)c.toArray(rgb,i*3);g.setAttribute('color',new T.BufferAttribute(rgb,3));parts.push(g.index?g.toNonIndexed():g);};
  for(let i=0;i<9;i++){
   const a=i*2.399963,r=.16+Math.sqrt(i/9)*.36,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.36+(i%4)*.10;
   const stem=new T.CylinderGeometry(.009,.013,h,4);stem.translate(x,h/2,z);add(stem,'#45623b');
   for(let side=-1;side<=1;side+=2){const leaf=new T.SphereGeometry(.07,4,2);leaf.scale(1.6,.15,.65);leaf.rotateZ(side*.4);leaf.rotateY(a);leaf.translate(x+Math.cos(a)*side*.07,h*.52,z+Math.sin(a)*side*.07);add(leaf,'#536f3c');}
   for(let leaf=0;leaf<5;leaf++){const a=leaf*2.399+i,g=new T.SphereGeometry(.085,4,2);g.scale(.5,.12,1.8);g.rotateX(.3);g.rotateY(a);g.translate(x+Math.sin(a)*.10,.08+(leaf%2)*.035,z+Math.cos(a)*.10);add(g,'#49763e');}
   for(let petal=0;petal<8;petal++){
    const p=petal*Math.PI/4,g=new T.SphereGeometry(.045,4,2);g.scale(.72,.24,1.5);g.rotateY(-p);g.translate(x+Math.sin(p)*.065,h-.014,z+Math.cos(p)*.065);add(g,['#efbd3c','#a880d0','#eee6db','#d579a4','#da8b4e'][kind]);
   }
   const center=new T.SphereGeometry(.032,5,3);center.scale(1,.6,1);center.translate(x,h+.012,z);add(center,kind===0?'#59462d':'#caa943');
  }
  const mat=new T.MeshStandardMaterial({name:'Bloody Run bank flowers '+kind,vertexColors:true,roughness:.91});materials.push(mat);
  const geo=mergeGeometries(parts),mesh=new T.InstancedMesh(geo,mat,list.length);root.add(mesh);mesh.userData.flowerCapacity=list.length;mesh.receiveShadow=true;
  list.forEach((p,i)=>{o.position.set(p.x,terrain.height(p.x,p.north)-.018,-p.north);o.rotation.set(0,i*2.399,0);o.scale.setScalar(p.scale);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});mesh.computeBoundingSphere();
  for(const g of parts)g.dispose();
 }
 // Ground-conforming foundation skirts beneath the newly placed stone buildings.
 const stone=new T.MeshStandardMaterial({name:'Mausoleum footing weathered stone',color:'#777a72',roughness:.94});materials.push(stone);
 for(const p of terrain.placements as Array<typeof terrain.placements[number]&{footprint?:number[]}>){
  if(!p.footprint)continue;const [w,d]=p.footprint,c=Math.cos(p.rotation),s=Math.sin(p.rotation),verts:number[]=[];
  const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[p.position[0]+c*u-s*v,p.position[1]+s*u+c*v]);
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],v=[[a[0],terrain.surfaceGround(a[0],a[1])-.18,-a[1]],[b[0],terrain.surfaceGround(b[0],b[1])-.18,-b[1]],[b[0],p.position[2]+.06,-b[1]],[a[0],p.position[2]+.06,-a[1]]];for(const k of [0,2,1,0,3,2])verts.push(...v[k]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();const base=new T.Mesh(g,stone);base.receiveShadow=true;base.castShadow=true;world.add(base);
 }
 return {root,materials,count:flowers.length*9,setSeason:(season:string)=>{root.visible=season!=='winter';}};
}
