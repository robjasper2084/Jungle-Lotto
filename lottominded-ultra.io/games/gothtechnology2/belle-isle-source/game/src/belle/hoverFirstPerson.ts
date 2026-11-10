import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Anatomical grip pose fitted to the measured handlebar, not the old floating markers. */
export class HoverFirstPerson {
 readonly root=new T.Group();
 private limbs:{hand:T.Group;sleeve:T.Mesh;elbow:T.Mesh;side:number}[]=[];
 private hands:T.Group[]=[];private throttle?:T.Group;private twist=0;
 constructor(private bike:T.Object3D){
  this.root.name='Fitted first-person sleeves';bike.add(this.root);
  const cloth=new T.MeshStandardMaterial({name:'FPV woven black jacket',color:0x16191d,roughness:.96});
  const skin=new T.MeshStandardMaterial({name:'FPV natural brown skin',color:0x83553f,roughness:.73});
  const cuff=new T.MeshStandardMaterial({name:'FPV jacket cuff',color:0x24282b,roughness:.92});
  const rubber=new T.MeshStandardMaterial({name:'Throttle rubber',color:0x171b1d,roughness:.88});
  const alloy=new T.MeshStandardMaterial({color:0x67737b,roughness:.36,metalness:.8});
  const sphere=new T.SphereGeometry(1,20,14);
  const rounded=(parent:T.Object3D,material:T.Material,position:number[],scale:number[])=>{const m=new T.Mesh(sphere,material);m.position.fromArray(position);m.scale.fromArray(scale);parent.add(m);return m;};
  const tube=(points:T.Vector3[],radii:number[],material:T.Material)=>{
   const curve=new T.CatmullRomCurve3(points),segments=32,g=new T.TubeGeometry(curve,segments,1,10,false),p=g.attributes.position;
   for(let i=0;i<=segments;i++){const t=i/segments,c=curve.getPointAt(t),f=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(f)),r=T.MathUtils.lerp(radii[k],radii[k+1],f-k);for(let j=0;j<=10;j++){const id=i*11+j;p.setXYZ(id,c.x+(p.getX(id)-c.x)*r,c.y+(p.getY(id)-c.y)*r,c.z+(p.getZ(id)-c.z)*r);}}
   g.computeVertexNormals();return new T.Mesh(g,material);
  };
  const merge=(group:T.Group,material:T.Material)=>{const pieces=group.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&o.material===material),gs=pieces.map(p=>{p.updateMatrix();return p.geometry.clone().applyMatrix4(p.matrix);}),g=mergeGeometries(gs);if(g){group.remove(...pieces);group.add(new T.Mesh(g,material));}gs.forEach(g=>g.dispose());};
  // Remove only the oversized generated rubber ends; retain the red bar and switchgear.
  const original=bike.getObjectByName('HandlebarPivot_Mesh');
  if(original instanceof T.Mesh){const g=original.geometry.clone(),p=g.attributes.position,index=g.index,keep:number[]=[];for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),x=ids.reduce((v,j)=>v+p.getX(j),0)/3,y=ids.reduce((v,j)=>v+p.getY(j),0)/3,z=ids.reduce((v,j)=>v+p.getZ(j),0)/3;if(!(Math.abs(x)>.38&&y>.10&&z<-.12))keep.push(...ids);}g.setIndex(keep);g.computeBoundingBox();g.computeBoundingSphere();original.geometry=g;}
  for(const side of [-1,1]){
   const grip=bike.getObjectByName(side<0?'Grip_L':'Grip_R');if(!grip)continue;
   // Measured from the exported handlebar vertices: original markers were 24 cm forward.
   grip.position.set(side*.49,.18,-.263);grip.rotation.y=side*.35;
   const controls=new T.Group();controls.name=side>0?'Rotating throttle sleeve':'Left rubber grip';grip.add(controls);if(side>0)this.throttle=controls;
   const handle=new T.Mesh(new T.CylinderGeometry(.022,.022,.216,24),rubber);handle.rotation.z=Math.PI/2;controls.add(handle);
   for(let i=0;i<18;i++){const rib=new T.Mesh(new T.TorusGeometry(.022,.0014,5,24),rubber);rib.rotation.y=Math.PI/2;rib.position.x=(i-8.5)*.011;controls.add(rib);}
   merge(controls,rubber);
   for(const x of[-.11,.11]){const cap=new T.Mesh(new T.CylinderGeometry(.026,.026,.009,20),alloy);cap.rotation.z=Math.PI/2;cap.position.x=x;controls.add(cap);}
   const hand=new T.Group();hand.name='Fitted grip '+(side<0?'left':'right');controls.add(hand);this.hands.push(hand);
   // Smooth wrist-to-palm loft: a flattened, tapered hand rather than overlapping blobs.
   const rings=[[-.133,.029,.019,.018],[-.112,.031,.021,.020],[-.086,.037,.023,.025],[-.058,.043,.022,.032],[-.031,.045,.018,.032],[-.013,.041,.011,.027]];
   const vertices:number[]=[],uv:number[]=[],indices:number[]=[],n=24;
   for(let i=0;i<rings.length;i++){const[z,w,h,y]=rings[i];for(let j=0;j<=n;j++){const a=j/n*Math.PI*2;vertices.push(w*Math.cos(a),y+h*Math.sin(a),z);uv.push(j/n,i/(rings.length-1));if(i<rings.length-1&&j<n){const k=i*(n+1)+j;indices.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1);}}}
   const palm=new T.BufferGeometry();palm.setAttribute('position',new T.Float32BufferAttribute(vertices,3));palm.setAttribute('uv',new T.Float32BufferAttribute(uv,2));palm.setIndex(indices);palm.computeVertexNormals();hand.add(new T.Mesh(palm,skin));
   for(let i=0;i<4;i++){
    const x=(i-1.5)*.023,r=i===0||i===3?.030:.032,small=i===3?.88:1;
    const angles=[-.4,.12,.7,1.35,2.0,2.65,3.25,3.5],points=angles.map(a=>new T.Vector3(x,r*Math.cos(a),r*Math.sin(a)));
    hand.add(tube(points,[.0105*small,.011*small,.010*small,.0094*small,.0084*small,.006*small],skin));
    rounded(hand,skin,points[7].toArray(),[.006*small,.006*small,.006*small]);
   }
   const thumbPoints=[new T.Vector3(-side*.038,.026,-.082),new T.Vector3(-side*.053,.006,-.053),new T.Vector3(-side*.044,-.018,-.024),new T.Vector3(-side*.021,-.025,-.006)];
   hand.add(tube(thumbPoints,[.016,.015,.012,.009],skin));rounded(hand,skin,thumbPoints[3].toArray(),[.009,.009,.009]);
   const band=new T.Mesh(new T.CylinderGeometry(.040,.044,.035,24),cuff);band.rotation.x=Math.PI/2;band.position.set(0,.019,-.135);hand.add(band);
   merge(hand,skin);merge(hand,cuff);
   const sleeve=new T.Mesh(new T.CylinderGeometry(.044,.079,1,24,4),cloth);this.root.add(sleeve);
   const elbow=rounded(this.root,cloth,[0,0,0],[.079,.079,.079]);this.limbs.push({hand,sleeve,elbow,side});
  }
  this.setVisible(false);
 }
 setVisible(visible:boolean){this.root.visible=visible;this.hands.forEach(h=>h.visible=visible);}
 update(dt=0,throttle=0){
  this.twist=T.MathUtils.damp(this.twist,-T.MathUtils.clamp(throttle,0,1)*.30,10,dt);
  if(this.throttle)this.throttle.rotation.x=this.twist;
  this.bike.updateWorldMatrix(true,true);
  for(const a of this.limbs){
   const wrist=this.bike.worldToLocal(a.hand.localToWorld(new T.Vector3(0,.019,-.151))),elbow=new T.Vector3(a.side*.43,1.15,-.35),delta=wrist.clone().sub(elbow);
   a.sleeve.position.copy(elbow).addScaledVector(delta,.5);a.sleeve.scale.y=delta.length();a.sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());a.elbow.position.copy(elbow);
  }
 }
}
