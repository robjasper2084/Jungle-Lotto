/** Optional application-local render policy. Other games retain the original pose.
 * Only the output of riderMotion may be changed; the measured input is readonly.
 */
import type {RidePose} from '@digital-static/ridecore';
import type {RiderMotionTarget} from './riderMotion.ts';
type Presentation=(target:RiderMotionTarget,pose:Readonly<RidePose>)=>void;
const active:{apply:Presentation}[]=[];
export function installRiderPresentation(next:Presentation){
 const entry={apply:next};active.push(entry);let disposed=false;
 return()=>{if(disposed)return;disposed=true;const index=active.indexOf(entry);if(index>=0)active.splice(index,1);};
}
export function presentRider(target:RiderMotionTarget,pose:Readonly<RidePose>){active.at(-1)?.apply(target,pose);return target;}
