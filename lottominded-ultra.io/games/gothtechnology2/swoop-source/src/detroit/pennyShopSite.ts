import {LOTTO_SHOP,lottoCoordinates,lottoMap} from './lottoShopSite.ts';
/** The OSM building sharing LottoMind's east party wall. This is an authored
 * game showroom, not a claim that a real shop exists at this Detroit address. */
export const PENNY_SHOP={osmId:'379485660',u:10.8,width:8,depth:18.8,floor:LOTTO_SHOP.floor,heading:LOTTO_SHOP.heading} as const;
export function pennyMap(u:number,v:number){return lottoMap(PENNY_SHOP.u+u,v);}
export function pennyNear(x:number,z:number){const p=lottoCoordinates(x,z);return Math.abs(p.u-PENNY_SHOP.u)<4.3&&Math.abs(p.v)<13;}
export function pennyGrade(x:number,z:number,terrain:number){const p=lottoCoordinates(x,z),distance=Math.max(Math.abs(p.u-PENNY_SHOP.u)-4.2,Math.abs(p.v)-16.5,0),t=Math.max(0,1-distance/5);return terrain+(PENNY_SHOP.floor-terrain)*t*t*(3-2*t);}
export const PENNY_SOLIDS=[
 ...[-3.98,3.98].map(u=>({u,v:0,width:.16,height:4.2,depth:18.8,y:2.1})),
 ...[-9.48,9.48].flatMap(v=>[...[-2.65,2.65].map(u=>({u,v,width:2.55,height:3.6,depth:.18,y:1.8})),{u:0,v,width:2.75,height:.55,depth:.18,y:3.83}]),
 {u:0,v:0,width:8,height:.16,depth:18.8,y:4.2},
 {u:2.68,v:-4.8,width:1.65,height:1.3,depth:3.9,y:.65},
 ...[[-2.35,-5],[-2.35,-1],[2.35,3.3]].map(([u,v])=>({u,v,width:1.75,height:1.75,depth:1.05,y:.875})),
 ...[[-2.35,3.3],[0,0]].map(([u,v])=>({u,v,width:.95,height:1.85,depth:.6,y:.925})),
];
