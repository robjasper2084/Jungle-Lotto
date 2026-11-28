import type {ParkTerrain} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
import type {GroundSample} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/runtime/ride-core/src/terrain.ts';
import {companionAnchor,type CompanionAnchor} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/companionSafety.ts';

type Position={x:number;y:number;z:number};
type ContactTerrain=Pick<ParkTerrain,'sampleGround'|'height'|'land'>&{containsSwoop?(x:number,z:number):boolean};

/** Contact-height context for the one existing host dog. The original island
 * sampler and anchor behavior remain unchanged. Source overpasses require the
 * dog's live contact height; selecting their base terrain would drop an upper
 * companion onto the trail, while selecting the highest deck would lift a dog
 * walking underneath it. */
export class CompanionGround {
  private anchorX=0;private anchorZ=0;private anchorHeight:number|undefined;
  private resetHeight:number|undefined;
  constructor(private terrain:ContactTerrain,private dog:()=>Position|undefined){}

  sampleGround(x:number,z:number,out:GroundSample){
    if(!this.terrain.containsSwoop?.(x,z))return this.terrain.sampleGround(x,z,out);
    const dog=this.dog();
    let reference=this.resetHeight??dog?.y??this.anchorHeight;
    // ElmwoodCompanion already regroups after a >24m separation. During its
    // existing reset, target probes near the relocated anchor must use the new
    // destination height, not a contact plane thousands of metres away. Other
    // local navigation probes retain the current dog's height.
    if(this.resetHeight===undefined&&dog&&this.anchorHeight!==undefined&&Math.hypot(dog.x-this.anchorX,dog.z-this.anchorZ)>24&&Math.hypot(x-this.anchorX,z-this.anchorZ)<8)reference=this.anchorHeight;
    return this.terrain.sampleGround(x,z,out,reference!==undefined&&Number.isFinite(reference)?reference:undefined);
  }

  anchor(previous:CompanionAnchor,rider:CompanionAnchor&{y:number}){
    const source=this.terrain.containsSwoop?.(rider.x,rider.z);
    const land=source?this.terrain.land(rider.x,rider.z,rider.y):this.terrain.land(rider.x,rider.z);
    const height=source?this.terrain.height(rider.x,rider.z,rider.y):this.terrain.height(rider.x,rider.z);
    const next=companionAnchor(previous,rider,land,height);
    this.anchorX=next.x;this.anchorZ=next.z;
    if(land&&rider.y-height<3.5)this.anchorHeight=height;
    else if(this.anchorHeight===undefined){
      this.anchorHeight=this.terrain.containsSwoop?.(next.x,next.z)?this.terrain.height(next.x,next.z,this.dog()?.y):this.terrain.height(next.x,next.z);
    }
    return next;
  }

  /** Scope the stored dry-land anchor height across the original enable,
   * vehicle-exit and relocation resets, including reset's orientation probes. */
  reset<Result>(action:()=>Result):Result {
    const previous=this.resetHeight;this.resetHeight=this.anchorHeight;
    try{return action();}finally{this.resetHeight=previous;}
  }
}
