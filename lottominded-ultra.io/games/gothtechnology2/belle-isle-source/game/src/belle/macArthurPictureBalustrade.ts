import {freezeStaticWorldTransforms} from './worldPerformancePolicy.ts';
/** OPT-IN AI-picture stone arch balustrade study, not an as-built survey.
 * Bound to existing MacArthur bridge collision side >=11.8, deck..deck+1.6.
 * No extra navigation meshes or physics bodies.
 */
import * as T from 'three';
import type {ParkMap} from './terrain.ts';
import {finishBridgeMaterial} from './bridgeMaterialFinish.ts';

export const PICTURE_BRIDGE_LEGACY='MacArthur_MacArthur_galvanized_crash_barrier';
export const PICTURE_BRIDGE_NAME='MacArthur picture-target carved stone balustrade';
export const PICTURE_BRIDGE_SIDE=12.04,PICTURE_BRIDGE_HEIGHT=1.52,PICTURE_BRIDGE_DEPTH=.22;
export type StonePanel={side:-1|1;s:number;x:number;y:number;z:number;heading:number;pitch:number;width:number};
export function planPictureBalustrade(bridge:ParkMap['bridge']):StonePanel[]{
 const {a,b,length,width}=bridge,actual=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(!Number.isFinite(length)||!Number.isFinite(width)||length<200||Math.abs(actual-length)>.1||Math.abs(width-26)>.2)
  throw Error('Mapped MacArthur geometry changed; do not infer a railing position');
 const count=Math.ceil(length/5.2),span=length/count,ux=(b[0]-a[0])/actual,uz=(b[1]-a[1])/actual;
 const heading=-Math.atan2(uz,ux),out:StonePanel[]=[];
 for(const side of [-1,1] as const)for(let i=0;i<count;i++){
  const s=(i+.5)*span,grade=4*Math.PI/length*Math.cos(Math.PI*s/length);
  out.push({side,s,x:a[0]+ux*s+uz*PICTURE_BRIDGE_SIDE*side,y:6+4*Math.sin(Math.PI*s/length)+.02,
   z:a[1]+uz*s-ux*PICTURE_BRIDGE_SIDE*side,heading,pitch:Math.atan(grade),width:span});
 }
 return out;
}
export function pictureStoneArch(width:number){
 if(!Number.isFinite(width)||width<3||width>6)throw Error('Invalid stone railing span');
 const half=width*.5,h=PICTURE_BRIDGE_HEIGHT,shape=new T.Shape();
 shape.moveTo(-half,0);shape.lineTo(half,0);shape.lineTo(half,h);shape.lineTo(-half,h);shape.closePath();
 const gap=new T.Path(),r=width*.405;
 gap.moveTo(-r,.22);gap.lineTo(r,.22);gap.lineTo(r,.88);
 for(let i=1;i<=12;i++){const a=i*Math.PI/12;gap.lineTo(r*Math.cos(a),.88+.30*Math.sin(a));}
 gap.closePath();shape.holes.push(gap);
 const geometry=new T.ExtrudeGeometry(shape,{depth:PICTURE_BRIDGE_DEPTH,steps:1,bevelEnabled:false,curveSegments:12});
 geometry.translate(0,0,-PICTURE_BRIDGE_DEPTH*.5);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function stagePictureBalustrade(scene:T.Scene,bridge:ParkMap['bridge'],landmarkRoot:T.Object3D){
 const legacy=landmarkRoot.getObjectByName(PICTURE_BRIDGE_LEGACY);
 if(!(legacy instanceof T.Mesh))throw Error('Original MacArthur crash barrier unavailable: fail closed');
 const panels=planPictureBalustrade(bridge),count=panels.length/2,geometry=pictureStoneArch(panels[0].width);
 const limestone=finishBridgeMaterial(new T.MeshStandardMaterial({name:'MacArthur carved buff limestone · conceptual',color:0xb7b5ad,roughness:.92,metalness:0,side:T.DoubleSide}),'aged-concrete');
 const group=new T.Group();group.name=PICTURE_BRIDGE_NAME;
 const old={visible:legacy.visible,castShadow:legacy.castShadow,flag:legacy.userData.staticSprayReplaced};
 const yaw=new T.Quaternion(),pitch=new T.Quaternion(),q=new T.Quaternion(),at=new T.Vector3(),scale=new T.Vector3(1,1,1),matrix=new T.Matrix4();
 try{
  for(const [lane,side] of ([-1,1] as const).entries()){
   const draw=new T.InstancedMesh(geometry,limestone,count);
   draw.name='MacArthur carved stone arch railing '+(side<0?'north':'south');
   draw.castShadow=true;draw.receiveShadow=true;
   for(let i=0;i<count;i++){
    const p=panels[lane*count+i];
    yaw.setFromAxisAngle(new T.Vector3(0,1,0),p.heading);
    pitch.setFromAxisAngle(new T.Vector3(0,0,1),p.pitch);q.copy(yaw).multiply(pitch);
    matrix.compose(at.set(p.x,p.y,p.z),q,scale);draw.setMatrixAt(i,matrix);
   }
   draw.instanceMatrix.needsUpdate=true;draw.computeBoundingSphere();group.add(draw);
  }
  scene.add(group);freezeStaticWorldTransforms([group]);
  // The existing mesh's draw visibility must stay off during dynamic landmark updates.
  legacy.userData.staticSprayReplaced=true;legacy.visible=false;legacy.castShadow=false;
 }catch(error){group.removeFromParent();geometry.dispose();limestone.dispose();throw error;}
 return {group,legacy,panels:panels.length,meshes:group.children.length,collisionChanged:false,asBuiltVerified:false,
  rollback(){group.removeFromParent();legacy.visible=old.visible;legacy.castShadow=old.castShadow;
   if(old.flag===undefined)delete legacy.userData.staticSprayReplaced;else legacy.userData.staticSprayReplaced=old.flag;
   geometry.dispose();limestone.dispose();
  }};
}
