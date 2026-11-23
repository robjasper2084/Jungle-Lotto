import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import lettering from './cadillacTrunkLettering.json' with {type:'json'};

/** Measured inside silver-cadillac.glb. Positive Z points toward the bonnet.
 * The enclosure stays below the closed lid and its attached sign. */
export const CADILLAC_TRUNK_INSTALL={
 branding:'I LOVE DETROIT',
 enclosure:{min:[-.66,.55,-2.62],max:[.66,.83,-1.69]},
 speakerCenters:[[-.39,.802,-1.98],[.39,.802,-1.98],[0,.802,-2.30]],
 speakerRadius:.208,
 sign:{center:[0,.91,-2.11],width:1.20,height:.72,slope:.108},
 audioPosition:[0,.79,-2.15],
} as const;

type Finish='gold'|'red'|'black'|'metal'|'light';
const rounded=(x:number,y:number,w:number,h:number,r:number)=>{
 const p=new T.Shape(),left=x-w/2,right=x+w/2,bottom=y-h/2,top=y+h/2;
 p.moveTo(left+r,bottom);p.lineTo(right-r,bottom);p.quadraticCurveTo(right,bottom,right,bottom+r);
 p.lineTo(right,top-r);p.quadraticCurveTo(right,top,right-r,top);p.lineTo(left+r,top);
 p.quadraticCurveTo(left,top,left,top-r);p.lineTo(left,bottom+r);p.quadraticCurveTo(left,bottom,left+r,bottom);
 return p;
};
function hole(shape:T.Shape,x:number,y:number,radius:number){
 const p=new T.Path();p.absellipse(x,y,radius,radius,0,Math.PI*2,true,0);shape.holes.push(p);
}
function extrusion(shape:T.Shape,depth:number,bevel=0){
 return new T.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:8,bevelEnabled:bevel>0,
  bevelSegments:2,bevelSize:bevel,bevelThickness:bevel});
}
function deckGeometry(shape:T.Shape,bottom:number,depth:number,bevel=0){
 return extrusion(shape,depth,bevel).rotateX(-Math.PI/2).translate(0,bottom,0);
}
class Batches{
 private readonly parts=new Map<Finish,T.BufferGeometry[]>();
 add(finish:Finish,geometry:T.BufferGeometry){
  if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
  // All generated parts carry position, normal and UV attributes. Keeping a
  // single mesh per finish avoids a separate draw for every screw and cone.
  const list=this.parts.get(finish)??[];list.push(geometry);this.parts.set(finish,list);
 }
 finish(group:T.Group,materials:Record<Finish,T.MeshStandardMaterial>){
  for(const [finish,parts] of this.parts){
   const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
   if(!geometry)throw new Error('Cadillac trunk geometry could not be combined');
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new T.Mesh(geometry,materials[finish]);mesh.name=group.name+'_'+finish;
   mesh.castShadow=finish!=='light';mesh.receiveShadow=finish!=='light';group.add(mesh);
  }
  this.parts.clear();
 }
}

/** Original trunk hardware based on the supplied three-subwoofer reference.
 * The exact vector lettering is embedded locally, including its font license;
 * this asset needs no canvas, texture download, third-party logo or animation.
 * Construct while the extracted lid is in its closed rest pose. */
export class CadillacTrunk{
 readonly root=new T.Group();
 readonly lidPanel=new T.Group();
 readonly audioAnchor=new T.Object3D();
 private readonly materials:Record<Finish,T.MeshStandardMaterial>;
 private readonly enclosureBounds:T.Box3;
 private readonly signBounds:T.Box3;
 private open=0;
 private disposed=false;
 constructor(body:T.Object3D,lid:T.Object3D){
  this.root.name='Cadillac_Trunk_Sound_System';this.lidPanel.name='Cadillac_I_LOVE_DETROIT';
  this.root.userData.speakerCount=3;this.lidPanel.userData.text=CADILLAC_TRUNK_INSTALL.branding;
  this.root.userData.design='Three recessed subwoofers in a gold enclosure with red insets';
  this.materials={
   gold:new T.MeshStandardMaterial({name:'Cadillac trunk gold fiberglass',color:0xb98438,roughness:.47,metalness:.24}),
   red:new T.MeshStandardMaterial({name:'Cadillac trunk crimson insets',color:0x9e1125,roughness:.63,metalness:.05}),
   black:new T.MeshStandardMaterial({name:'Cadillac subwoofer cones and surrounds',color:0x101114,roughness:.45,metalness:.15}),
   metal:new T.MeshStandardMaterial({name:'Cadillac speaker fasteners',color:0x85888d,roughness:.29,metalness:.85}),
   light:new T.MeshStandardMaterial({name:'I LOVE DETROIT warm illuminated letters',color:0xffecd2,emissive:0xff7225,emissiveIntensity:.85,roughness:.35,metalness:.05}),
  };
  const cabinet=new Batches();
  // Rounded shell and a shallow sculpted top: the recessed drivers cover the
  // three circular apertures, instead of sitting on an uncut solid slab.
  const shell=rounded(0,2.155,1.28,.89,.105);
  for(const [x,,z] of CADILLAC_TRUNK_INSTALL.speakerCenters)hole(shell,x,-z,.214);
  cabinet.add('gold',deckGeometry(shell,.565,.185,.014));
  const top=rounded(0,2.155,1.28,.89,.105);
  for(const [x,,z] of CADILLAC_TRUNK_INSTALL.speakerCenters)hole(top,x,-z,.214);
  cabinet.add('gold',deckGeometry(top,.765,.020,.015));

  const inset=new T.Shape();
  inset.moveTo(-.625,1.86);inset.quadraticCurveTo(-.625,1.73,-.49,1.73);
  inset.lineTo(.49,1.73);inset.quadraticCurveTo(.625,1.73,.625,1.86);
  inset.lineTo(.625,2.13);inset.quadraticCurveTo(.625,2.20,.49,2.24);
  inset.lineTo(.26,2.50);inset.quadraticCurveTo(0,2.555,-.26,2.50);
  inset.lineTo(-.49,2.24);inset.quadraticCurveTo(-.625,2.20,-.625,2.13);inset.closePath();
  for(const [x,,z] of CADILLAC_TRUNK_INSTALL.speakerCenters)hole(inset,x,-z,.214);
  cabinet.add('red',deckGeometry(inset,.801,.004));
  for(const x of [-.405,0,.405])cabinet.add('red',deckGeometry(rounded(x,2.565,.355,.060,.020),.801,.005));

  // Concave baskets, domed dust caps, thick rolled surrounds and visible bolts
  // use geometry, so the same forms survive both WebGL and GLB review exports.
  const profile=[new T.Vector2(0,-.043),new T.Vector2(.035,-.044),new T.Vector2(.068,-.052),
   new T.Vector2(.078,-.070),new T.Vector2(.125,-.052),new T.Vector2(.173,-.017),
   new T.Vector2(.187,-.008),new T.Vector2(.195,-.005),new T.Vector2(.200,-.022),
   new T.Vector2(.171,-.047),new T.Vector2(.080,-.093),new T.Vector2(0,-.093)];
  for(const [x,y,z] of CADILLAC_TRUNK_INSTALL.speakerCenters){
   cabinet.add('black',new T.LatheGeometry(profile,32).translate(x,y,z));
   cabinet.add('black',new T.TorusGeometry(.194,.014,8,32).rotateX(Math.PI/2).translate(x,y,z));
   for(let bolt=0;bolt<6;bolt++){
    const angle=bolt*Math.PI/3,px=x+Math.cos(angle)*.202,pz=z+Math.sin(angle)*.202;
    cabinet.add('metal',new T.CylinderGeometry(.005,.005,.004,6).translate(px,.818,pz));
   }
  }
  cabinet.finish(this.root,this.materials);
  this.audioAnchor.name='Cadillac_Trunk_Audio_Anchor';this.audioAnchor.position.fromArray(CADILLAC_TRUNK_INSTALL.audioPosition);
  this.root.add(this.audioAnchor);body.add(this.root);

  const sign=new Batches(),panel=CADILLAC_TRUNK_INSTALL.sign;
  sign.add('gold',extrusion(rounded(0,0,panel.width,panel.height,.075),.012,.005));
  sign.add('red',extrusion(rounded(0,0,panel.width-.090,panel.height-.090,.050),.005).translate(0,0,.014));
  const font=new FontLoader().parse(lettering),lines=['I LOVE','DETROIT'];
  const letters=lines.map(text=>new TextGeometry(text,{font,size:1,depth:.025,curveSegments:4,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1}));
  const widths=letters.map(geometry=>{geometry.computeBoundingBox();return geometry.boundingBox!.max.x-geometry.boundingBox!.min.x;});
  const scale=1.035/Math.max(...widths);
  letters.forEach((geometry,i)=>{
   geometry.scale(scale,scale,scale);geometry.computeBoundingBox();const box=geometry.boundingBox!;
   geometry.translate(-(box.min.x+box.max.x)/2,(i===0?.165:-.165)-(box.min.y+box.max.y)/2,.021);
   sign.add('light',geometry);
  });
  sign.finish(this.lidPanel,this.materials);
  // Rear viewers look toward +Z, so their screen-right direction is -X.
  // This basis keeps the phrase upright on the opened lid rather than mirrored.
  const right=new T.Vector3(-1,0,0),up=new T.Vector3(0,-panel.slope,-1).normalize();
  const normal=right.clone().cross(up).normalize();
  const placement=new T.Matrix4().makeBasis(right,up,normal).setPosition(new T.Vector3().fromArray(panel.center));
  body.updateWorldMatrix(true,false);lid.updateWorldMatrix(true,false);
  placement.premultiply(body.matrixWorld).premultiply(lid.matrixWorld.clone().invert());
  placement.decompose(this.lidPanel.position,this.lidPanel.quaternion,this.lidPanel.scale);
  lid.add(this.lidPanel);this.root.updateMatrixWorld(true);this.lidPanel.updateMatrixWorld(true);
  this.enclosureBounds=this.localBounds(this.root,body);this.signBounds=this.localBounds(this.lidPanel,body);
  this.setOpen(0);
 }
 private localBounds(root:T.Object3D,space:T.Object3D){
  space.updateWorldMatrix(true,false);root.updateWorldMatrix(true,true);
  const inverse=space.matrixWorld.clone().invert(),box=new T.Box3(),point=new T.Vector3();
  root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;
   const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),position=mesh.geometry.getAttribute('position');
   for(let i=0;i<position.count;i++)box.expandByPoint(point.fromBufferAttribute(position,i).applyMatrix4(matrix));
  });return box;
 }
 setOpen(amount:number){
  this.open=T.MathUtils.clamp(amount,0,1);
  // Closed-trunk equipment is fully occluded; omit its draws and shadows.
  this.root.visible=this.lidPanel.visible=this.open>.015;
 }
 diagnostics(){
  let meshes=0,triangles=0,vertices=0;
  for(const root of [this.root,this.lidPanel])root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;
   meshes++;vertices+=mesh.geometry.getAttribute('position').count;
   triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
  });
  return{branding:CADILLAC_TRUNK_INSTALL.branding,speakerCount:3,open:this.open,visible:this.root.visible,
   meshes,triangles,vertices,textures:0,perFrameVertexUpdates:0,
   enclosureBounds:{min:this.enclosureBounds.min.toArray(),max:this.enclosureBounds.max.toArray()},
   closedSignBounds:{min:this.signBounds.min.toArray(),max:this.signBounds.max.toArray()},
   audioAnchor:this.audioAnchor.position.toArray()};
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const root of [this.root,this.lidPanel]){root.traverse(object=>{if((object as T.Mesh).isMesh)(object as T.Mesh).geometry.dispose();});root.removeFromParent();}
  for(const material of Object.values(this.materials))material.dispose();
 }
}
