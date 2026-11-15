import {authoredChoice,authoredName,isAuthoredVehicle,type PilotChoice,type LiveryChoice} from './vehicles/choices.ts';
export type RideChoice={vehicle:'onewheel'|'hoverbike'|'jetson'|'corleo';camera:'fpp'|'tpp';pilot?:PilotChoice;livery?:LiveryChoice};
export const DEFAULT_RIDE:RideChoice={vehicle:'hoverbike',camera:'tpp'};
export function normalizeRideChoice(value:unknown):RideChoice{
 const v=value&&typeof value==='object'?value as Partial<RideChoice>:{};
 const authored=authoredChoice(v);
 return {...(authored??{vehicle:v.vehicle==='onewheel'?'onewheel':'hoverbike'}),camera:v.camera==='fpp'?'fpp':'tpp'} as RideChoice;
}
export const rideName=(choice:RideChoice)=>isAuthoredVehicle(choice.vehicle)?authoredName(choice.vehicle):choice.vehicle==='hoverbike'?'Hoverbike':'One wheel';

/** Each new visit starts with the primary ride; camera preference remains personal. */
export function startupRideChoice(saved:unknown):RideChoice{return {...normalizeRideChoice(saved),vehicle:'hoverbike'};}
