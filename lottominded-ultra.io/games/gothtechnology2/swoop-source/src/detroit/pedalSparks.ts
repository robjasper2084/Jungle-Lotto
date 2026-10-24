import {PedalSparks as ContactSparks} from '../../../ride-core/src/pedalSparks.ts';
import {reducedEffects} from './rideEffects.ts';
import type {RidePose} from './controller.ts';

/** Swoop's accessibility setting also applies to split-screen and studio riders. */
export class PedalSparks extends ContactSparks {
 override update(dt:number,p:RidePose,active:boolean){super.update(dt,p,active,reducedEffects());}
}
