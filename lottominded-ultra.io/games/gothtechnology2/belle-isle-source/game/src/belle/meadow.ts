import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {inside,segment,type ParkMap,type ParkTerrain} from './terrain.ts';

// Small, static clumps inspired by the supplied meadow photographs. No per-frame
// simulation, blended leaf cards or new texture downloads are needed.
export function addMeadow(scene:T.Scene,data:ParkMap,terrain:ParkTerrain){
 let seed=861;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const vertices:number[]=[],indices:number[]=[];
 for(let i=0;i<9;i++){
  const a=i*2.399,r=.05+rand()*.22,h=.45+rand()*.65,x=Math.cos(a)*r,z=Math.sin(a)*r,w=.022+rand()*.02,n=vertices.length/3;
  vertices.push(x-w,0,z,x+w,0,z,x+.10*Math.cos(a),h*.65,z+.10*Math.sin(a),x+.22*Math.cos(a),h,z+.22*Math.sin(a));
  indices.push(n,n+1,n+2,n+1,n+3,n+2);
 }
 const grassGeometry=new T.BufferGeometry();grassGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));grassGeometry.setIndex(indices);grassGeometry.computeVertexNormals();
 const blades=new T.InstancedMesh(grassGeometry,new T.MeshStandardMaterial({color:0x7d8950,roughness:1,side:T.DoubleSide}),1800);
 const stems=new T.InstancedMesh(new T.CylinderGeometry(.015,.025,.9,4).translate(0,.45,0),new T.MeshStandardMaterial({color:0x616437,roughness:1}),450);
 const petalGeos=[0,1,2].map(i=>new T.SphereGeometry(.11,5,3).scale(1.2,.5,.8).translate(Math.sin(i*2.094)*.08,.94,Math.cos(i*2.094)*.08));
 const flowerGeometry=mergeGeometries(petalGeos)!;petalGeos.forEach(g=>g.dispose());
 const flowers=new T.InstancedMesh(flowerGeometry,new T.MeshStandardMaterial({color:0xd4ad42,roughness:.95}),450);
 const routes=data.roads.flatMap(r=>r.points.slice(1).map((p,i)=>({a:r.points[i],b:p,w:r.width})));
 const dummy=new T.Object3D(),color=new T.Color();let count=0,flowerCount=0;
 // Concentrate detail around the garden/lagoon meadows and retain open lawns.
 const centers=[{x:1077,z:1228,r:76},{x:3230,z:520,r:160},{x:3580,z:150,r:130},{x:3105,z:16,r:28},{x:2290,z:-205,r:28}];
 for(let attempt=0;attempt<2600&&count<1800;attempt++){
  const c=centers[attempt%centers.length],a=rand()*Math.PI*2,r=Math.sqrt(rand())*c.r,x=c.x+Math.cos(a)*r,z=c.z+Math.sin(a)*r;
  const density=.5+.25*Math.sin(x*.07+z*.04)+.25*Math.sin(z*.11);
  if(rand()>density||!terrain.land(x,z)||!inside(x,z,data.island)||data.buildings.some(b=>inside(x,z,b.points))||routes.some(route=>segment(x,z,route.a,route.b).d<route.w*.5+2.5))continue;
  dummy.position.set(x,terrain.height(x,z)+.03,z);dummy.rotation.set(0,rand()*Math.PI*2,0);const scale=.5+rand()*.9;dummy.scale.set(scale,scale*(.6+rand()*.7),scale);dummy.updateMatrix();blades.setMatrixAt(count,dummy.matrix);blades.setColorAt(count++,color.setHSL(.14+rand()*.06,.20+rand()*.15,.30+rand()*.13));
  if(flowerCount<450&&rand()<.32){stems.setMatrixAt(flowerCount,dummy.matrix);flowers.setMatrixAt(flowerCount,dummy.matrix);flowers.setColorAt(flowerCount++,color.setHSL(rand()<.8?.115:.08,.5,.48+rand()*.15));}
 }
 blades.count=count;stems.count=flowers.count=flowerCount;
 for(const mesh of [blades,stems,flowers]){mesh.name='Clustered meadow planting';mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}
 // Low foundation shrubs seen at the Casino and Yacht Club. Maintain door,
 // road and shoreline clearance; individual plant positions are approximations.
 const shrubs=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x526239,roughness:.98}),160);
 let shrubCount=0;
 for(const id of ['106948123','264321737']){
  const building=data.buildings.find(b=>b.id===id);if(!building)continue;
  const points=building.points;
  for(let i=0;i<points.length-1&&shrubCount<160;i++){
   const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<7)continue;
   for(let d=2;d<length-2&&shrubCount<160;d+=1.8){
    // Gaps break up the hedge and leave short facade segments open.
    if((Math.floor(d/1.8)+i)%8<3)continue;
    let x=a[0]+dx*d/length-dz/length*2,z=a[1]+dz*d/length+dx/length*2;
    if(inside(x,z,points)){x=a[0]+dx*d/length+dz/length*2;z=a[1]+dz*d/length-dx/length*2;}
    if(!terrain.land(x,z)||data.buildings.some(b=>inside(x,z,b.points))||routes.some(r=>segment(x,z,r.a,r.b).d<r.w*.5+2.5))continue;
    const h=.45+rand()*.25;dummy.position.set(x,terrain.height(x,z)+h*.55,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(.65+rand()*.25,h,.55+rand()*.25);dummy.updateMatrix();shrubs.setMatrixAt(shrubCount,dummy.matrix);shrubs.setColorAt(shrubCount++,color.setHSL(.20+rand()*.07,.20,.30+rand()*.10));
   }
  }
 }
 shrubs.count=shrubCount;shrubs.name='Landmark foundation planting';shrubs.receiveShadow=true;shrubs.computeBoundingSphere();scene.add(shrubs);
 return {clumps:count,flowers:flowerCount,shrubs:shrubCount};
}
