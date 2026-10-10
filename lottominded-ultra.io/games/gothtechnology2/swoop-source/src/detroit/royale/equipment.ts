import * as T from 'three';
import type {GLTF, GLTFLoader} from '../compressedGLTFLoader.ts';
import type {Weapon} from '../../../../ride-core/src/royale/rules.ts';

export const EQUIPMENT_KINDS = ['static','heart','bass','ammo','repair','shield'] as const;
export type EquipmentKind = typeof EQUIPMENT_KINDS[number];
const isWeapon = (kind:EquipmentKind):kind is Weapon => kind==='static'||kind==='heart'||kind==='bass';

/** Real GLBs authored in Higgsfield, optimized in Blender and checked in Unity.
 * Geometry/materials are shared; transforms and animation state belong to each instance. */
export class EquipmentLibrary {
  constructor(readonly assets:Map<EquipmentKind,GLTF>) {
    for(const kind of EQUIPMENT_KINDS){
      const asset=assets.get(kind),clip=(isWeapon(kind)?'Fire_':'Idle_')+kind;
      if(!asset?.scene.getObjectByName('PRP_'+kind)||!asset.animations.some(a=>a.name===clip))
        throw Error('Equipment model or animation missing: '+kind);
    }
  }
  static async load(loader:GLTFLoader,base:URL){
    const entries=await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await loader.loadAsync(new URL(kind+'.glb',base).href)] as const));
    return new EquipmentLibrary(new Map(entries));
  }
  create(kind:EquipmentKind){return new EquipmentView(kind,this.assets.get(kind)!);}
  dispose(){
    const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
    for(const data of this.assets.values())data.scene.traverse(o=>{if(o instanceof T.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
}

export class EquipmentView {
  readonly root:T.Group;readonly mixer:T.AnimationMixer;readonly action:T.AnimationAction;
  private reduced=false;
  constructor(readonly kind:EquipmentKind,source:GLTF){
    this.root=source.scene.clone(true);this.root.name='Equipment_'+kind;
    this.mixer=new T.AnimationMixer(this.root);
    this.action=this.mixer.clipAction(source.animations.find(a=>a.name===(isWeapon(kind)?'Fire_':'Idle_')+kind)!);
    this.action.setLoop(isWeapon(kind)?T.LoopOnce:T.LoopRepeat,Infinity);this.action.clampWhenFinished=true;
    if(!isWeapon(kind))this.action.play();
  }
  fire(reducedMotion:boolean){
    if(!isWeapon(this.kind)||reducedMotion)return false;
    this.action.reset().play();return true;
  }
  update(delta:number,reducedMotion:boolean){
    if(reducedMotion!==this.reduced){
      this.reduced=reducedMotion;this.action.stop();
      if(!reducedMotion&&!isWeapon(this.kind))this.action.reset().play();
    }
    if(!reducedMotion)this.mixer.update(Math.min(.1,Math.max(0,delta)));
  }
  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);this.root.removeFromParent();}
}

/** Equip movement pivots at the authoritative hand socket, never moves the grip. */
export class WeaponView {
  readonly root=new T.Group();private models=new Map<Weapon,EquipmentView>();
  private current?:EquipmentView;private equipAge=1;
  constructor(private library:EquipmentLibrary){}
  /** Socket targets include the currently evaluated equipment animation. */
  socket(local:readonly [number,number,number]){this.root.updateWorldMatrix(true,true);const prop=this.current?.root.getObjectByName('PRP_'+this.current.kind)??this.root;return prop.localToWorld(new T.Vector3(...local));}
  select(kind:Weapon){
    if(this.current?.kind===kind)return;
    if(this.current){this.current.root.visible=false;this.current.action.stop();}
    let model=this.models.get(kind);
    if(!model){model=this.library.create(kind);this.models.set(kind,model);this.root.add(model.root);}
    this.equipAge=this.current?0:1;this.current=model;model.root.visible=true;
  }
  fire(reducedMotion:boolean){return this.current?.fire(reducedMotion)??false;}
  update(delta:number,reducedMotion:boolean){
    this.equipAge+=delta;
    if(this.current){this.current.root.rotation.x=reducedMotion?0:.5*Math.max(0,1-this.equipAge/.2)**2;this.current.update(delta,reducedMotion);}
  }
  dispose(){for(const m of this.models.values())m.dispose();this.root.removeFromParent();}
}
