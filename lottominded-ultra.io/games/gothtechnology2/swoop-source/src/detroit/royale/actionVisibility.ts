/** Keep controls in stable thumb positions; reveal contextual actions only when useful. */
export type ActionContext={foot:boolean;brawling:boolean;crashed:boolean;dogCharges:number;scopes:number;weapons:number;health:number;healthPacks:number;healing:boolean;shields:number;canSwap:boolean;magazine:number;capacity:number;reserve:number;reloading:boolean;fireModes:number};
export function contextualActions(c:ActionContext):Record<string,boolean>{
 return {
  brawl:c.foot,evade:c.foot,
  'dog-attack':c.dogCharges>0,'dog-radar':c.dogCharges>0,
  scope:c.scopes>0&&!c.brawling,switch:c.weapons>1&&!c.brawling,
  recover:c.crashed,swap:c.canSwap,
  repair:c.healing||c.healthPacks>0&&c.health<100,
  utility:c.shields>0,
  reload:c.brawling||c.reloading||c.magazine<c.capacity&&c.reserve>0,
  cycleMode:!c.brawling&&(c.fireModes&(c.fireModes-1))!==0,
  aim:!c.brawling,'lean-left':!c.brawling,'lean-right':!c.brawling,
 };
}
