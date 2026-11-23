import * as T from 'three';
import type {ParkMap} from './terrain.ts';

/** Localized stone revetment upstream of the Woodside Drive road bridge. */
export function addWoodsideBank(scene:T.Scene,map:ParkMap){
 const stones:T.Matrix4[]=[],dummy=new T.Object3D();
 for(const water of map.water)for(let i=1;i<water.points.length;i++){
  const [x,z]=water.points[i-1],[ex,ez]=water.points[i];
  if(Math.max(x,ex)<2686||Math.min(x,ex)>2714||Math.max(z,ez)<730||Math.min(z,ez)>780)continue;
  const n=Math.ceil(Math.hypot(ex-x,ez-z)/.9);
  for(let j=0;j<n;j++){
   const t=(j+.5)/n,px=x+(ex-x)*t,pz=z+(ez-z)*t;
   if(px<2686||px>2714||pz<730||pz>780)continue;
   const k=stones.length,scale=.82+.14*Math.sin(k*2.8);
   dummy.position.set(px,1.52+.12*Math.cos(k*1.5),pz);
   dummy.rotation.set(k*.27,k*2.4,k*.43);
   dummy.scale.set(scale,.67,scale*.9);dummy.updateMatrix();stones.push(dummy.matrix.clone());
  }
 }
 if(!stones.length)return;
 const mesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:0xaaa79a,roughness:.98,flatShading:true}),stones.length);
 stones.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color().setScalar(.76+.20*Math.abs(Math.sin(i*1.7))));});
 mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.name='Nashua Canal · Woodside stone banks';scene.add(mesh);
}
