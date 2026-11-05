import {footStickPace} from '../../../../ride-core/src/footStickPace.ts';
import type {Command} from '../../../../ride-core/src/royale/rules.ts';
/** Held equipment is deliberately absent: only the player's active actions
 * change normal walking. Camera commands have already suppressed combat. */
export function pacedFootCommand(c:Command,state:{onFoot:boolean;keyboard:boolean;brawling:boolean;reloading:boolean}):Command{
 const pace=footStickPace(c.throttle,c.steer,{enabled:state.onFoot&&!state.keyboard&&!state.brawling,run:c.burst,
  blocked:!!c.aimMode||c.fire||c.reload||state.reloading||c.crouch||c.prone||!!c.lean,strafing:c.facingYaw!==null});
 return{...c,throttle:pace.throttle,steer:pace.steer,burst:pace.run};
}
