import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared, deterministic silhouettes; native placement, seasons and distance pools remain in charge. */
export function referenceTree(id:string,low:boolean,height:number){
 let seed=Array.from(id).reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),81);
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const trunks:T.BufferGeometry[]=[],leaves:T.BufferGeometry[]=[],up=new T.Vector3(0,1,0),matrix=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 const pine=id==='pine',willow=id==='willow',birch=id==='birch',radius=height*(willow?.32:pine?.20:birch?.22:.29);
 function branch(a:T.Vector3,b:T.Vector3,r:number){const g=new T.CylinderGeometry(r*.27,r,a.distanceTo(b),low?5:7);q.setFromUnitVectors(up,b.clone().sub(a).normalize());matrix.compose(a.clone().add(b).multiplyScalar(.5),q,new T.Vector3(1,1,1));trunks.push(g.applyMatrix4(matrix));}
 branch(new T.Vector3(),new T.Vector3(.18,height*.91,0),birch?.17:.29);
 const centers:T.Vector3[]=[];
 for(let i=0;i<12;i++){const a=i*2.39996,level=i/12;const r=pine?radius*(1-level*.8):radius*(.42+random()*.24);const y=height*(pine?.26+level*.67:.56+level*.33);const c=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);centers.push(c);branch(new T.Vector3(0,y*.66,0),c,.075);}
 centers.push(new T.Vector3(0,height*.91,0));
 const leafShape=new T.Shape();[[-.04,-.25],[-.18,-.19],[-.12,-.02],[-.3,.10],[-.12,.12],[-.17,.29],[0,.42],[.17,.29],[.12,.12],[.3,.1],[.12,-.02],[.18,-.19],[.04,-.25]].forEach((p,i)=>i?leafShape.lineTo(p[0],p[1]):leafShape.moveTo(p[0],p[1]));leafShape.closePath();
 const leaf=new T.ShapeGeometry(leafShape).toNonIndexed();leaf.rotateX(-Math.PI/2);
 const count=low?700:1800;
 for(let i=0;i<count;i++){
  const c=centers[i%centers.length];let g:T.BufferGeometry;
  g=leaf.clone();const a=random()*Math.PI*2,v=random()*2-1,r=Math.pow(random(),.43)*radius*.68,s=Math.sqrt(1-v*v);const p=c.clone().add(new T.Vector3(Math.cos(a)*s*r,v*r*(willow?1.45:.8),Math.sin(a)*s*r));const size=(low?1.15:.75)+random()*(low?1.1:.8);matrix.compose(p,q.setFromEuler(new T.Euler((random()-.5)*2,random()*6,(random()-.5)*2)),new T.Vector3(size*(willow?.6:1),size,size*(willow?1.6:1)));
  g.applyMatrix4(matrix);color.setHSL(.22+random()*.035,.35,.37+random()*.13);const colors=new Float32Array(g.getAttribute('position').count*3);for(let j=0;j<colors.length;j+=3){colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));leaves.push(g);
 }
 for(const c of centers){const g=new T.IcosahedronGeometry(1,0),positions=g.getAttribute('position');for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i);v.multiplyScalar(.80+random()*.3);positions.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();matrix.compose(c,q.setFromEuler(new T.Euler(random(),random()*6,random())),new T.Vector3(radius*.35,radius*.38,radius*.35));g.applyMatrix4(matrix);const colors=new Float32Array(positions.count*3);color.setRGB(.055,.085,.025);for(let i=0;i<positions.count;i++){colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));leaves.push(g);}
 leaf.dispose();const trunk=mergeGeometries(trunks)!,canopy=mergeGeometries(leaves)!;trunks.forEach(g=>g.dispose());leaves.forEach(g=>g.dispose());
 return{trunk,leaves:canopy,bark:new T.MeshStandardMaterial({color:birch?0xb6aea1:0x70513a,roughness:.95}),foliage:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.87,side:T.DoubleSide})};
}
