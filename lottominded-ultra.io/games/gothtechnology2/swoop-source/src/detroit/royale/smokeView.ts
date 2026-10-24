import * as T from 'three';
import {smokeRadius,type SmokeCloud} from '../../../../ride-core/src/royale/smoke.ts';
/** Shared geometry, bounded cloud count, and no per-frame geometry allocation. */
export class SmokeView extends T.Group{
 private geometry=new T.IcosahedronGeometry(1,1);
 private clouds=new Map<string,{root:T.Group;material:T.MeshBasicMaterial}>();
 update(clouds:readonly SmokeCloud[],tick:number,reduced:boolean){
  const wanted=new Set(clouds.map(c=>c.id));
  for(const [id,c]of this.clouds)if(!wanted.has(id)){this.remove(c.root);c.material.dispose();this.clouds.delete(id);}
  for(const c of clouds){let view=this.clouds.get(c.id);
   if(!view){const root=new T.Group(),material=new T.MeshBasicMaterial({color:0x738a86,transparent:true,opacity:.55,depthWrite:false,side:T.DoubleSide});
    for(let i=0;i<7;i++){const mesh=new T.Mesh(this.geometry,material);mesh.position.set(Math.sin(i*2.4)*.36,i===0?.2:Math.sin(i*1.8)*.17,Math.cos(i*2.4)*.36);mesh.scale.set(1,.72,1);root.add(mesh);}view={root,material};this.clouds.set(c.id,view);this.add(root);}
   const radius=smokeRadius(c,tick);view.root.position.set(c.p.x,c.p.y+1.4,c.p.z);view.root.scale.setScalar(radius);view.material.opacity=.48*Math.min(1,radius/.8);
   view.root.rotation.y=reduced?0:(tick-c.start)*.0008;
  }
 }
 dispose(){for(const c of this.clouds.values())c.material.dispose();this.clouds.clear();this.geometry.dispose();this.clear();}
}
