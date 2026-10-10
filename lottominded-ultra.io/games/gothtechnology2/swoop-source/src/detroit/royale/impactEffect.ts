import * as T from 'three';
/** Bounded presentation of host-confirmed bullet/dog hits. Two draw calls. */
export class ImpactEffect extends T.Group{
 private bursts:Array<{p:T.Vector3;at:number;shield:boolean}>=[];private mesh:T.InstancedMesh;private dummy=new T.Object3D();private color=new T.Color();
 constructor(){super();this.mesh=new T.InstancedMesh(new T.OctahedronGeometry(.09),new T.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false}),16*8);this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.count=0;this.add(this.mesh);}
 hit(p:{x:number;y:number;z:number},now:number,shield:boolean){this.bursts.push({p:new T.Vector3(p.x,p.y+1.05,p.z),at:now,shield});if(this.bursts.length>16)this.bursts.shift();}
 update(now:number,reduced:boolean){this.bursts=this.bursts.filter(b=>now-b.at<650);let count=0;for(const b of this.bursts){const t=Math.max(0,(now-b.at)/650);for(let i=0;i<(reduced?1:8);i++){const angle=i*Math.PI/4,d=reduced?0:t*.7;this.dummy.position.copy(b.p).add(new T.Vector3(Math.sin(angle)*d,Math.cos(angle)*d,Math.sin(angle*3)*d));this.dummy.scale.setScalar(1-t);this.dummy.updateMatrix();this.mesh.setMatrixAt(count,this.dummy.matrix);this.mesh.setColorAt(count++,this.color.set(b.shield?'#89ffff':'#ff7096'));}}this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
 reset(){this.bursts=[];this.mesh.count=0;}
 dispose(){this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.removeFromParent();}
}
