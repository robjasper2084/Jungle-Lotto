import {HUMAN_PROFILE,MASCOT_PROFILE,type RiderProfile} from '@digital-static/ridecore';
import {ThreeRiderView} from '@digital-static/ridecore/three';
import type {TerrainSampler} from '@digital-static/ridecore';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
// Circuit characters have a different EUC and authored pedal spacing.
export const CIRCUIT_PROFILE:RiderProfile={...MASCOT_PROFILE,id:'circuit',wheelScale:1,pedalHeight:.249,pedalHalfSpacing:.20};
export const SWOOP_RIDERS=[
  {id:'DS_Hoodie_Woman_01',label:'Woman · Detroit hoodie',profile:HUMAN_PROFILE},
  {id:'DS_Mascot_Suit_01',label:'Mascot · Pinstripe suit',profile:MASCOT_PROFILE},
  {id:'DS_Mascot_Hoodie_01',label:'Mascot · Detroit hoodie',profile:MASCOT_PROFILE},
] as const;
export function createRideCoreRiders(original:Map<string,GLTF>,circuit:Map<string,GLTF>,terrain:TerrainSampler){
  const riders=new Map<string,ThreeRiderView>();
  riders.set('original',new ThreeRiderView(original.get('DS_Man_01')!,original.get('DS_EUC_01')!,terrain,HUMAN_PROFILE));
  for(const {id,profile} of SWOOP_RIDERS){const asset=original.get(id);if(asset)riders.set(id,new ThreeRiderView(asset,original.get('DS_EUC_01')!,terrain,profile));}
  for(const id of ['hoodie','suit']){
    const source=circuit.get(id)!;
    riders.set(id,new ThreeRiderView({...source,animations:source.animations.filter(a=>a.name==='Idle')},circuit.get('euc')!,terrain,{...CIRCUIT_PROFILE,id:'circuit-'+id}));
  }
  return riders;
}
