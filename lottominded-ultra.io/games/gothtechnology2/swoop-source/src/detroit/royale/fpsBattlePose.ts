import type {RidePose} from '../controller.ts';
import type {CombatState} from '../../../../ride-core/src/royale/rules.ts';
/** Explicit action ownership keeps first-person hands out of full-body actions.
 * These are presentation decisions, never ammunition or damage authority. */
export function fpsBodyAction(p:RidePose,c:CombatState,tick:number){
 if(p.crashBlend>0)return 'fall';
 if(p.footVault>0)return 'vault';
 if(p.footMode===3)return 'mount';
 if(p.footMode===2&&(c.melee?.evadeUntil??0)>tick)return 'evade';
 if(p.footProne>.08&&p.footProne<.92)return 'laydown';
 if(c.melee?.brawl)return 'melee';
 return null;
}
