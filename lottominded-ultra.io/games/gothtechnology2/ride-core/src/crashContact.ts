import * as T from 'three';
import {createGroundSample} from './terrain.ts';
import type {TerrainSampler} from './terrain.ts';

// Keep extremal skin vertices for every dominant joint, including the hair and coat.
// This follows the actual deformed silhouette without scanning the full LOD0 each frame.
const directions:T.Vector3[]=[];
for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new T.Vector3(x,y,z).normalize());
export class CrashContact {
  readonly probes:{mesh:T.Mesh;indices:number[]}[]=[];
  private point=new T.Vector3();
  constructor(root:T.Object3D){
    root.traverse(object=>{
      const mesh=object as T.Mesh;if(!mesh.isMesh)return;
      const position=mesh.geometry.attributes.position;if(!position)return;
      const joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
      const groups=new Map<number,{scores:number[];indices:number[]}>();
      for(let i=0;i<position.count;i++){
        let joint=0,weight=-1;
        if(joints&&weights)for(let k=0;k<4;k++)if(weights.getComponent(i,k)>weight){weight=weights.getComponent(i,k);joint=joints.getComponent(i,k);}
        let group=groups.get(joint);
        if(!group){group={scores:directions.map(()=>-Infinity),indices:directions.map(()=>0)};groups.set(joint,group);}
        this.point.fromBufferAttribute(position,i);
        directions.forEach((d,k)=>{const score=this.point.dot(d);if(score>group!.scores[k]){group!.scores[k]=score;group!.indices[k]=i;}});
      }
      this.probes.push({mesh,indices:[...new Set([...groups.values()].flatMap(g=>g.indices))]});
    });
  }
  settle(root:T.Object3D,floor:number,terrain?:TerrainSampler,margin=.025,contact=0){
    // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld.
    // updateWorldMatrix alone leaves probes in the previous root transform.
    root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);
    const groundCache=new Map<string,ReturnType<typeof createGroundSample>>();
    let lift=-Infinity;
    for(const {mesh,indices} of this.probes){
      if((mesh as T.SkinnedMesh).isSkinnedMesh)(mesh as T.SkinnedMesh).skeleton.update();
      for(const index of indices){
        mesh.getVertexPosition(index,this.point).applyMatrix4(mesh.matrixWorld);
        let height=floor;
        if(terrain){
          const x=Math.round(this.point.x/.35)*.35,z=Math.round(this.point.z/.35)*.35,key=x+','+z;
          let sample=groundCache.get(key);
          if(!sample){sample=terrain.sampleGround(x,z,createGroundSample(),floor);groundCache.set(key,sample);}
          height=sample.height;
          if(sample.normal.y>.2)height-=(sample.normal.x*(this.point.x-x)+sample.normal.z*(this.point.z-z))/sample.normal.y;
        }
        lift=Math.max(lift,height+margin-this.point.y);
      }
    }
    if(!Number.isFinite(lift))return 0;
    lift=lift>0?lift:lift*T.MathUtils.clamp(contact,0,1);
    if(Math.abs(lift)>1e-9){
      const position=root.getWorldPosition(this.point);position.y+=lift;
      root.position.copy(root.parent?root.parent.worldToLocal(position):position);root.updateMatrixWorld(true);
    }
    return lift;
  }
}
