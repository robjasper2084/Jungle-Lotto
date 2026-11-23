import * as T from 'three';
import type {CarGround} from './carController.ts';
import selections from './cadillacAccessParts.json' with {type:'json'};

export type CadillacPanel='trunk'|'rearLeft'|'rearRight';
export type CadillacAccessReason='moving'|'blocked'|'exiting'|'unavailable';
export type CadillacAccessResult={accepted:boolean;opening:boolean;reason?:CadillacAccessReason};
export type CadillacPanelState={open:boolean;progress:number;angle:number};
export type CadillacAccessSnapshot={trunk:CadillacPanelState;rearLeft:CadillacPanelState;rearRight:CadillacPanelState;held:boolean;reason?:CadillacAccessReason};

/** Measured hinges in the shipped GLB's SprungBody coordinates. +X is the
 * driver's side, +Z is forward. The lid lifts about +X; rear doors swing out. */
export const CADILLAC_ACCESS_FIT={
  sourceSha256:selections.sourceSha256,
  trunk:{name:'Cadillac_TrunkLid',hinge:[0,1.0225,-1.5695],axis:'x',angle:1.25},
  rearLeft:{name:'Cadillac_RearLeftDoor',hinge:[.92,.6625,-.0336],axis:'y',angle:-1.03},
  rearRight:{name:'Cadillac_RearRightDoor',hinge:[-.92,.6625,-.0336],axis:'y',angle:1.03},
} as const;
const names:CadillacPanel[]=['trunk','rearLeft','rearRight'];
const bits={trunk:1,rearLeft:2,rearRight:4};
type Panel={group:T.Group;bounds:T.Box3;samples:T.Vector3[];radius:number;open:boolean;progress:number;triangles:number};
type Source={mesh:T.Mesh;geometry:T.BufferGeometry;labels:Uint8Array;mask:number;variants:Map<number,T.BufferGeometry>};

/** Preserve every source attribute and vertex ID (including the cabin's fitted
 * steering column). Only index buffers are partitioned. Closed cars retain the
 * original meshes and draw count; open-panel variants are cached on demand. */
export class CadillacAccess{
  readonly trunkLid:T.Group;
  private readonly panels:Record<CadillacPanel,Panel>;
  private readonly sources:Source[]=[];
  private readonly owned=new Set<T.BufferGeometry>();
  private mask=0;
  private reason:CadillacAccessReason|undefined;
  private disposed=false;
  constructor(private readonly body:T.Object3D){
    const create=(name:CadillacPanel):Panel=>{
      const fit=CADILLAC_ACCESS_FIT[name],group=new T.Group();group.name=fit.name;group.position.fromArray(fit.hinge);group.visible=false;body.add(group);
      return {group,bounds:new T.Box3(),samples:[],radius:0,open:false,progress:0,triangles:0};
    };
    this.panels={trunk:create('trunk'),rearLeft:create('rearLeft'),rearRight:create('rearRight')};
    this.trunkLid=this.panels.trunk.group;
    body.updateWorldMatrix(true,true);
    const inverseBody=body.matrixWorld.clone().invert(),point=new T.Vector3();
    for(const [meshName,selection] of Object.entries(selections.meshes)){
      const mesh=body.getObjectByName(meshName);
      if(!(mesh instanceof T.Mesh)||!mesh.geometry.index||mesh.geometry.attributes.position.count!==selection.positionCount||mesh.geometry.index.count!==selection.indexCount)
        throw new Error('Cadillac access geometry does not match the measured asset: '+meshName);
      const geometry=mesh.geometry,index=geometry.index!,labels=new Uint8Array(index.count);
      const source={mesh,geometry,labels,mask:0,variants:new Map<number,T.BufferGeometry>()};this.sources.push(source);
      const toBody=new T.Matrix4().multiplyMatrices(inverseBody,mesh.matrixWorld);
      for(const name of names){
        const ranges=(selection.parts as Partial<Record<CadillacPanel,number[][]>>)[name];if(!ranges)continue;
        const panel=this.panels[name],indices:number[]=[];
        for(const [start,count]of ranges)for(let i=start;i<start+count;i++){
          if(labels[i])throw new Error('Cadillac access selections overlap: '+meshName);
          labels[i]=bits[name];indices.push(index.getX(i));
        }
        source.mask|=bits[name];
        const split=this.indexGeometry(geometry,indices),child=new T.Mesh(split,mesh.material);
        child.name=panel.group.name+'_'+meshName;child.castShadow=mesh.castShadow;child.receiveShadow=mesh.receiveShadow;
        child.matrix.multiplyMatrices(new T.Matrix4().makeTranslation(-panel.group.position.x,-panel.group.position.y,-panel.group.position.z),toBody);
        child.matrix.decompose(child.position,child.quaternion,child.scale);
        panel.group.add(child);panel.triangles+=indices.length/3;
        for(const i of new Set(indices))panel.bounds.expandByPoint(point.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(toBody).sub(panel.group.position));
      }
    }
    for(const name of names){
      const panel=this.panels[name];if(!panel.triangles)throw new Error('Cadillac panel geometry missing: '+name);
      // A coarse solid grid deliberately includes empty window/cavity space.
      // Each sphere covers its grid cell; short swept arcs cover between poses.
      const size=panel.bounds.getSize(new T.Vector3()),steps=size.toArray().map(length=>Math.max(1,Math.ceil(length/.24)));
      const spacing=size.toArray().map((length,i)=>length/steps[i]);panel.radius=Math.hypot(...spacing)/2+.006;
      for(let x=0;x<=steps[0];x++)for(let y=0;y<=steps[1];y++)for(let z=0;z<=steps[2];z++)
        panel.samples.push(new T.Vector3(panel.bounds.min.x+x*spacing[0],panel.bounds.min.y+y*spacing[1],panel.bounds.min.z+z*spacing[2]));
    }
  }
  private indexGeometry(source:T.BufferGeometry,indices:number[]){
    const geometry=new T.BufferGeometry();for(const [name,attribute]of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
    geometry.setIndex(indices);geometry.name=source.name+' access indices';
    // computeBoundingBox() would include unused shared vertices from the whole
    // car. Bound only referenced vertices so culling follows the actual panel.
    const bounds=new T.Box3(),point=new T.Vector3();for(const i of new Set(indices))bounds.expandByPoint(point.fromBufferAttribute(source.attributes.position,i));
    geometry.boundingBox=bounds;geometry.boundingSphere=bounds.getBoundingSphere(new T.Sphere());this.owned.add(geometry);return geometry;
  }
  private setMask(mask:number){
    if(mask===this.mask)return;this.mask=mask;
    for(const source of this.sources){
      const relevant=mask&source.mask;
      if(!relevant){source.mesh.geometry=source.geometry;continue;}
      let geometry=source.variants.get(relevant);
      if(!geometry){
        const indices:number[]=[],index=source.geometry.index!;
        for(let i=0;i<index.count;i++)if(!(source.labels[i]&mask))indices.push(index.getX(i));
        geometry=this.indexGeometry(source.geometry,indices);source.variants.set(relevant,geometry);
      }
      source.mesh.geometry=geometry;
    }
    for(const name of names)this.panels[name].group.visible=!!(mask&bits[name]);
  }
  /** Check a conservative swept volume against the same terrain and obstacle
   * queries as the car. This is a parked clearance guard, not a rigid-body door
   * solver. No mesh scans or collision queries are done during steady driving. */
  private clear(name:CadillacPanel,target:number,terrain:CarGround,referenceY:number){
    const panel=this.panels[name],fit=CADILLAC_ACCESS_FIT[name];this.body.updateWorldMatrix(true,false);
    const from=panel.progress*fit.angle,to=target*fit.angle,steps=Math.max(1,Math.ceil(Math.abs(to-from)/.085));
    const rotation=new T.Matrix4(),transform=new T.Matrix4(),previous=panel.samples.map(()=>new T.Vector3()),point=new T.Vector3(),direction=new T.Vector3();
    const radius=panel.radius+.003;
    for(let step=0;step<=steps;step++){
      const angle=T.MathUtils.lerp(from,to,step/steps);
      if(fit.axis==='x')rotation.makeRotationX(angle);else rotation.makeRotationY(angle);
      transform.makeTranslation(fit.hinge[0],fit.hinge[1],fit.hinge[2]).multiply(rotation).premultiply(this.body.matrixWorld);
      for(let i=0;i<panel.samples.length;i++){
        point.copy(panel.samples[i]).applyMatrix4(transform);
        if(terrain.obstructed(point.x,point.z,radius)||point.y<terrain.height(point.x,point.z,referenceY)+radius)return false;
        if(step){
          direction.copy(point).sub(previous[i]);const distance=direction.length();
          if(distance>1e-7){direction.multiplyScalar(1/distance);const hit=terrain.raycastObstacle(previous[i],direction,distance,radius);if(hit!==null&&hit<=distance)return false;}
        }
        previous[i].copy(point);
      }
    }
    return true;
  }
  toggle(name:CadillacPanel,terrain:CarGround,referenceY:number):CadillacAccessResult{
    const panel=this.panels[name],opening=!panel.open;
    if(this.disposed)return this.reject('unavailable',opening);
    if(!this.clear(name,Number(opening),terrain,referenceY))return this.reject('blocked',opening);
    panel.open=opening;this.reason=undefined;this.refreshMask();return{accepted:true,opening};
  }
  reject(reason:CadillacAccessReason,opening=false):CadillacAccessResult{this.reason=reason;return{accepted:false,opening,reason};}
  /** Exit closes rear panels before placing the player beside the car. */
  closeAll(terrain:CarGround,referenceY:number){
    for(const name of names)if(this.panels[name].progress>0||this.panels[name].open)
      if(!this.clear(name,0,terrain,referenceY)){this.reason='blocked';return false;}
    for(const name of names)this.panels[name].open=false;this.reason=undefined;this.refreshMask();return true;
  }
  private refreshMask(){this.setMask(names.reduce((mask,name)=>mask|(this.panels[name].open||this.panels[name].progress>0?bits[name]:0),0));}
  update(dt:number,reduced:boolean){
    const blend=reduced?1:1-Math.exp(-T.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.12)*8);
    for(const name of names){const panel=this.panels[name],target=Number(panel.open);panel.progress=T.MathUtils.lerp(panel.progress,target,blend);
      if(Math.abs(panel.progress-target)<.0001)panel.progress=target;
      panel.group.rotation[CADILLAC_ACCESS_FIT[name].axis]=panel.progress*CADILLAC_ACCESS_FIT[name].angle||0;
    }
    this.refreshMask();
  }
  reset(){for(const name of names){const panel=this.panels[name];panel.open=false;panel.progress=0;panel.group.rotation.set(0,0,0);}this.reason=undefined;this.setMask(0);}
  get trunkProgress(){return this.panels.trunk.progress;}
  get held(){return names.some(name=>this.panels[name].open||this.panels[name].progress>0);}
  snapshot():CadillacAccessSnapshot{
    const state=(name:CadillacPanel)=>({open:this.panels[name].open,progress:this.panels[name].progress,angle:this.panels[name].progress*CADILLAC_ACCESS_FIT[name].angle||0});
    return{trunk:state('trunk'),rearLeft:state('rearLeft'),rearRight:state('rearRight'),held:this.held,...(this.reason?{reason:this.reason}:{})};
  }
  diagnostics(){return{...this.snapshot(),sourceSha256:selections.sourceSha256,selection:'original triangle indices; source attributes retained',
    collision:'parked conservative swept-panel clearance',panels:Object.fromEntries(names.map(name=>{const p=this.panels[name];return[name,{triangles:p.triangles,hinge:[...CADILLAC_ACCESS_FIT[name].hinge],axis:CADILLAC_ACCESS_FIT[name].axis,bounds:{min:p.bounds.min.toArray(),max:p.bounds.max.toArray()},clearanceSamples:p.samples.length,clearanceRadius:p.radius}];})),
    activeMask:this.mask,cachedIndexGeometries:this.owned.size};}
  dispose(){if(this.disposed)return;this.reset();for(const panel of Object.values(this.panels))panel.group.removeFromParent();for(const geometry of this.owned)geometry.dispose();this.owned.clear();this.disposed=true;}
}
