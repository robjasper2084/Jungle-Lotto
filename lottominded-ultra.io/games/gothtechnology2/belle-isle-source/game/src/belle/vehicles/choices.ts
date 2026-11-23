export type AuthoredVehicle='jetson'|'corleo';
export type PilotChoice='professional'|'maverick';
export type LiveryChoice='industrial'|'sport_red'|'sport_blue';
export type AuthoredChoice={vehicle:AuthoredVehicle;pilot:PilotChoice;livery:LiveryChoice};
export const isAuthoredVehicle=(v:unknown):v is AuthoredVehicle=>v==='jetson'||v==='corleo';
export function authoredChoice(value:unknown):AuthoredChoice|undefined{
 if(!value||typeof value!=='object')return;
 const v=value as Partial<AuthoredChoice>;if(!isAuthoredVehicle(v.vehicle))return;
 return {vehicle:v.vehicle,pilot:v.pilot==='maverick'?'maverick':'professional',livery:v.livery==='sport_red'||v.livery==='sport_blue'?v.livery:'industrial'};
}
export function coopAuthoredChoice(id:string):AuthoredChoice|undefined{
 const [vehicle,pilot]=id.split(':');return authoredChoice({vehicle,pilot});
}
export const authoredName=(v:AuthoredVehicle)=>v==='jetson'?'Jetson ONE':'CORLEO robot horse';
