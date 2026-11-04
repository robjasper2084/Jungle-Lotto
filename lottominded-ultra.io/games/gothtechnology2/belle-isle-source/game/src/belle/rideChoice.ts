export type RideChoice={vehicle:'onewheel'|'hoverbike';camera:'fpp'|'tpp'};
export const DEFAULT_RIDE:RideChoice={vehicle:'hoverbike',camera:'tpp'};
export function normalizeRideChoice(value:unknown):RideChoice{
 const v=value&&typeof value==='object'?value as Partial<RideChoice>:{};
 return {vehicle:v.vehicle==='onewheel'?'onewheel':'hoverbike',camera:v.camera==='fpp'?'fpp':'tpp'};
}
export const rideName=(choice:RideChoice)=>choice.vehicle==='hoverbike'?'Hoverbike':'One wheel';

/** Each new visit starts with the primary ride; camera preference remains personal. */
export function startupRideChoice(saved:unknown):RideChoice{return {...normalizeRideChoice(saved),vehicle:'hoverbike'};}
