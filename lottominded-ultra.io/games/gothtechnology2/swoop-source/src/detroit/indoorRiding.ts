import {MACK_STUDIO,studioCoordinates} from './mackStudioSite.ts';
import {LOTTO_SHOP,lottoCoordinates} from './lottoShopSite.ts';
import {PENNY_SHOP} from './pennyShopSite.ts';
/** Protection ends at the doors: streets, paths and other buildings keep normal physics. */
export function indoorRideArea(x:number,z:number){
 const studio=studioCoordinates(x,z);
 if(Math.abs(studio.u)<=MACK_STUDIO.width/2&&Math.abs(studio.v)<=MACK_STUDIO.depth/2){
  if(Math.abs(studio.u-12)<9.1&&Math.abs(studio.v-3)<6.15)return 'GothTech store';
  if(Math.abs(studio.u+12)<9.1&&Math.abs(studio.v-3)<6.15)return 'Serengeti gallery';
  return 'GothTech studio';
 }
 const retail=lottoCoordinates(x,z);
 if(Math.abs(retail.u)<=LOTTO_SHOP.width/2+.1&&Math.abs(retail.v)<=LOTTO_SHOP.depth/2+.1)return 'LottoMind store';
 if(Math.abs(retail.u-PENNY_SHOP.u)<=PENNY_SHOP.width/2+.1&&Math.abs(retail.v)<=PENNY_SHOP.depth/2+.1)return 'Penny Exchange';
 return undefined;
}
