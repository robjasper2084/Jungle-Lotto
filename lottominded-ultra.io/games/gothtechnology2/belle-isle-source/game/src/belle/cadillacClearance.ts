import * as T from 'three';
import type {CarGround} from './carController.ts';

/** Capture structural geometry once, before occupants and accessory meshes are
 * added. Live driving uses this numerical proxy, never a mesh traversal. */
export function cadillacLocalBounds(root:T.Object3D){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),bounds=new T.Box3(),matrix=new T.Matrix4();
  root.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    object.geometry.computeBoundingBox();
    if(object.geometry.boundingBox)bounds.union(object.geometry.boundingBox.clone().applyMatrix4(matrix.multiplyMatrices(inverse,object.matrixWorld)));
  });
  return bounds;
}

export function cadillacPartSweep(body:T.Object3D,part:T.Object3D,angle:number){
  const bounds=cadillacLocalBounds(part),result=new T.Box3(),matrix=new T.Matrix4(),rotation=new T.Quaternion();
  body.updateWorldMatrix(true,false);part.parent!.updateWorldMatrix(true,false);
  const parent=new T.Matrix4().multiplyMatrices(body.matrixWorld.clone().invert(),part.parent!.matrixWorld);
  for(let i=0;i<=20;i++){
    rotation.setFromEuler(new T.Euler(0,angle*i/20,0));
    matrix.compose(part.position,rotation,part.scale).premultiply(parent);
    result.union(bounds.clone().applyMatrix4(matrix));
  }
  return result.expandByScalar(.004);
}

/** Conservative parked-motion volume. Columns cover the chassis and the full
 * active panel sweep. Terrain checks use actual transformed lower surfaces;
 * vertical and between-pose rays catch roofs/rails, including during a hop.
 * This is bounded arcade clearance, not a rigid-body contact solver. */
export class CadillacClearance{
  readonly structural:T.Box3;
  private signature='';
  private columns:{bottom:T.Vector3;middle:T.Vector3;top:T.Vector3;radius:number}[]=[];
  private readonly bottom=new T.Vector3();
  private readonly middle=new T.Vector3();
  private readonly top=new T.Vector3();
  private readonly points=[this.bottom,this.middle,this.top];
  private readonly direction=new T.Vector3();
  private readonly previous:T.Vector3[]=[];
  constructor(body:T.Object3D){
    this.structural=cadillacLocalBounds(body);
    if(this.structural.isEmpty())throw new Error('Cadillac structural clearance geometry is missing.');
  }
  bounds(matrix:T.Matrix4,target=new T.Box3()){return target.copy(this.structural).applyMatrix4(matrix);}
  private prepare(extra:readonly T.Box3[]){
    const volumes=[this.structural,...extra.filter(bounds=>!bounds.isEmpty())],signature=volumes.map(bounds=>[...bounds.min.toArray(),...bounds.max.toArray()].join(',')).join(';');
    if(signature===this.signature)return;
    this.signature=signature;this.columns=[];this.previous.length=0;
    for(const bounds of volumes){
      const xSteps=Math.max(1,Math.ceil((bounds.max.x-bounds.min.x)/.5)),zSteps=Math.max(1,Math.ceil((bounds.max.z-bounds.min.z)/.5));
      const radius=Math.hypot((bounds.max.x-bounds.min.x)/xSteps,(bounds.max.z-bounds.min.z)/zSteps)/2+.005;
      for(let x=0;x<=xSteps;x++)for(let z=0;z<=zSteps;z++){
        const px=T.MathUtils.lerp(bounds.min.x,bounds.max.x,x/xSteps),pz=T.MathUtils.lerp(bounds.min.z,bounds.max.z,z/zSteps);
        this.columns.push({bottom:new T.Vector3(px,bounds.min.y,pz),middle:new T.Vector3(px,(bounds.min.y+bounds.max.y)/2,pz),top:new T.Vector3(px,bounds.max.y,pz),radius});
        this.previous.push(new T.Vector3(),new T.Vector3(),new T.Vector3());
      }
    }
  }
  clearPath(matrices:readonly T.Matrix4[],terrain:CarGround,referenceY:number,extra:readonly T.Box3[]=[]){
    if(!matrices.length)return false;
    this.prepare(extra);
    for(let step=0;step<matrices.length;step++){
      const matrix=matrices[step];if(!matrix.elements.every(Number.isFinite))return false;
      for(let i=0;i<this.columns.length;i++){
        const column=this.columns[i];
        this.bottom.copy(column.bottom).applyMatrix4(matrix);this.middle.copy(column.middle).applyMatrix4(matrix);this.top.copy(column.top).applyMatrix4(matrix);
        const points=this.points;
        for(let j=0;j<3;j++){
          const point=points[j],prior=this.previous[i*3+j];
          if(point.y<terrain.height(point.x,point.z,referenceY)+.012||terrain.obstructed(point.x,point.z,column.radius))return false;
          if(step){this.direction.copy(point).sub(prior);const distance=this.direction.length();
            if(distance>.00001){this.direction.multiplyScalar(1/distance);const hit=terrain.raycastObstacle(prior,this.direction,distance,column.radius);if(hit!==null&&hit<=distance)return false;}}
          prior.copy(point);
        }
        this.direction.copy(this.top).sub(this.bottom);const height=this.direction.length();
        if(height>.001){this.direction.multiplyScalar(1/height);const hit=terrain.raycastObstacle(this.bottom,this.direction,height,column.radius);if(hit!==null&&hit<=height)return false;}
      }
    }
    return true;
  }
}
