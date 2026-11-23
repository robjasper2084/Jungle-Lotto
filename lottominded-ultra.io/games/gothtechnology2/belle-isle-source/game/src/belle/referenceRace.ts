import * as T from 'three';

/** The new frame sits outside the existing scoring aperture. No race rules change. */
export function referenceGate(radius:number,height:number,ground=false){
 const group=new T.Group();group.name='Gold and cyan checkpoint frame';
 const gold=new T.MeshStandardMaterial({color:0xd7a54e,metalness:.7,roughness:.28,emissive:0x6e3b0b,emissiveIntensity:.12,transparent:true});
 const cyan=new T.MeshBasicMaterial({color:0x8dfaff,transparent:true});
 const arc=ground?Math.PI:Math.PI*2;
 const tube=Math.max(.28,radius*.035),rim=tube+.15;
 for(const [offset,width,material]of [[rim,tube,gold],[.12,.06,cyan],[tube*2+.32,.095,cyan]] as const){
  const ring=new T.Mesh(new T.TorusGeometry(radius+offset,width,8,64,arc),material);ring.scale.y=(height+offset)/(radius+offset);ring.position.y=ground?.1:0;group.add(ring);
 }
 for(let i=0;i<(ground?9:16);i++){const a=i/(ground?8:16)*arc;const rib=new T.Mesh(new T.BoxGeometry(tube*2+.12,.14,.38),gold);rib.position.set(Math.cos(a)*(radius+rim),Math.sin(a)*(height+rim)+(ground?.1:0),0);rib.rotation.z=a;group.add(rib);}
 return group;
}

/** Static chevrons are readable with reduced motion and add no lighting passes. */
export function referenceRoute(path:readonly {x:number;y:number;z:number}[],ground:boolean){
 const shape=new T.Shape();shape.moveTo(-.85,-.65);shape.lineTo(0,.2);shape.lineTo(.85,-.65);shape.lineTo(.85,-.15);shape.lineTo(0,.75);shape.lineTo(-.85,-.15);shape.closePath();
 const geo=new T.ShapeGeometry(shape);geo.rotateX(Math.PI/2);
 const sites:{x:number;y:number;z:number;heading:number}[]=[];
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=Math.hypot(b.x-a.x,b.z-a.z);for(let n=14;n<d;n+=ground?22:45){const t=n/d;sites.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+(ground?.15:0),z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)});}}
 const arrows=new T.InstancedMesh(geo,new T.MeshBasicMaterial({color:0x8cf7ec,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}),sites.length),dummy=new T.Object3D();
 for(const [i,p]of sites.entries()){dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.heading;dummy.scale.setScalar(ground?1.8:2.2);dummy.updateMatrix();arrows.setMatrixAt(i,dummy.matrix);}arrows.computeBoundingSphere();arrows.name='Course direction chevrons';return arrows;
}
