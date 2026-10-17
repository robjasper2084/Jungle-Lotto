import {HUMAN_PROFILE,MASCOT_PROFILE,type RiderProfile} from '@digital-static/ridecore';
import {ThreeRiderView} from './threeRiderView.ts';
import type {TerrainSampler} from '@digital-static/ridecore';
import type {GLTF} from '../compressedGLTFLoader.ts';
// Circuit characters have a different EUC and authored pedal spacing.
export const CIRCUIT_PROFILE:RiderProfile={...MASCOT_PROFILE,id:'circuit',wheelScale:1,pedalHeight:.249,pedalHalfSpacing:.20};
export const SWOOP_RIDERS=[
  {id:'DS_Hoodie_Woman_01',label:'Woman · Detroit hoodie',profile:HUMAN_PROFILE},
  {id:'DS_Mascot_Suit_01',label:'Mascot · Pinstripe suit',profile:MASCOT_PROFILE},
  {id:'DS_Mascot_Hoodie_01',label:'Mascot · Detroit hoodie',profile:MASCOT_PROFILE},
  {id:'DS_Armored_Rider_01',label:'Armored rider · Night Sentinel',profile:HUMAN_PROFILE},
] as const;
// Only constructed views are retained/iterated. Selecting an outfit creates its
// rig once; loading the menu must not clone and fit every possible skeleton.
class RiderViews extends Map<string,ThreeRiderView>{
  private factories:Map<string,()=>ThreeRiderView>;
  private onCreate?: (view:ThreeRiderView)=>void;
  constructor(factories:Map<string,()=>ThreeRiderView>,onCreate?:(view:ThreeRiderView)=>void){super();this.factories=factories;this.onCreate=onCreate;}
  override get(id:string){
    const existing=super.get(id);if(existing)return existing;
    const create=this.factories.get(id);if(!create)return undefined;
    const view=create();this.onCreate?.(view);super.set(id,view);return view;
  }
}

export function createRideCoreRiders(original:Map<string,GLTF>,circuit:Map<string,GLTF>,terrain:TerrainSampler,options:{lazy?:boolean;onCreate?:(view:ThreeRiderView)=>void}={}){
  const factories=new Map<string,()=>ThreeRiderView>();
  factories.set('original',()=>new ThreeRiderView(original.get('DS_Man_01')!,original.get('DS_EUC_01')!,terrain,HUMAN_PROFILE));
  for(const {id,profile} of SWOOP_RIDERS){const asset=original.get(id);if(asset)factories.set(id,()=>new ThreeRiderView(asset,original.get('DS_EUC_01')!,terrain,profile));}
  for(const id of ['hoodie','suit']){
    const source=circuit.get(id)!;
    factories.set(id,()=>new ThreeRiderView({...source,animations:source.animations.filter(a=>a.name==='Idle')},circuit.get('euc')!,terrain,{...CIRCUIT_PROFILE,id:'circuit-'+id}));
  }
  const riders=new RiderViews(factories,options.onCreate);
  if(!options.lazy)for(const id of factories.keys())riders.get(id);
  return riders;
}
