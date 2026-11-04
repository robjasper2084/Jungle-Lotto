export type RideChoice={vehicle:'onewheel'|'hoverbike';camera:'fpp'|'tpp'};
export const DEFAULT_RIDE:RideChoice={vehicle:'onewheel',camera:'tpp'};
export function normalizeRideChoice(value:unknown):RideChoice{
 const v=value&&typeof value==='object'?value as Partial<RideChoice>:{};
 return {vehicle:v.vehicle==='hoverbike'?'hoverbike':'onewheel',camera:v.camera==='fpp'?'fpp':'tpp'};
}
export const rideName=(choice:RideChoice)=>choice.vehicle==='hoverbike'?'Hoverbike':'One wheel';
