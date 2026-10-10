import type {RideTuning} from '../rideDynamics.ts';
export const WHEEL_CATALOG_REVISION='selected-wheel-2';
export const kphToMps=(value:number)=>value/3.6;
export const mphToMps=(value:number)=>value*.44704;
/** Existing authored wheels; manufacturer-inspired, not verified production replicas.
 * Handling/radius values are explicitly game estimates, not manufacturer measurements. */
const profile=(id:string,name:string,asset:string,topKph:number,acceleration:number,braking:number,radius:number,source:string,lowSpeedYaw=2.55,highSpeedYaw=.62)=>({
 id,name,asset,revision:WHEEL_CATALOG_REVISION,status:'gameplay-approximation',speedBasis:'configured riding ceiling',source,checked:'2026-10-09',
 topKph,estimatedRadius:radius,tuning:{version:WHEEL_CATALOG_REVISION+'/'+id,maxSpeed:kphToMps(topKph),reverseSpeed:2.8,driveAcceleration:acceleration,brakeAcceleration:braking,wheelRadius:radius,lowSpeedYaw,highSpeedYaw,
 launchJerk:22,brakeJerk:75,releaseJerk:32,hopSpeed:2.4,chargedHopSpeed:1.1,crashImpact:11} satisfies Partial<RideTuning>
});
export const WHEELS=[
 profile('euc','Classic EUC','DS_EUC_01',78.48,7.6,9.2,.255,'local:rideDynamics.ts/Digital Static Motion 4.1'),
 profile('euc:city','City 16 · V8S-inspired','Euc_city',34.923,3.4,5.8,.2032,'https://inmotionworld.com/products/inmotion-v8s',3,.72),
 profile('euc:tour','Touring 18 · V11Y-inspired','Euc_tour',59.546,5,7,.2286,'https://inmotionworld.com/products/inmotion-v11y',2.55,.58),
 profile('euc:trail','Trail 16 · V14 Pro-inspired','Euc_trail',80.467,7.8,9.4,.2032,'https://inmotionworld.com/products/inmotionadventure',2.8,.6),
 profile('euc:speed','Speed 22 · V13 Pro-inspired','Euc_speed',90.123,6.8,8.8,.2794,'https://eu.inmotionworld.com/products/inmotion-challenger-pro',2.05,.45)
];
export function wheelProfile(id='euc'){const p=WHEELS.find(p=>p.id===id);if(!p)throw Error('WHEEL_NOT_ALLOWED');return p;}
