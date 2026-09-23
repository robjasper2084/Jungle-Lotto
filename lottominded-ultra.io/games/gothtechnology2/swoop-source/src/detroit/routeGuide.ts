/** Heading-relative guidance shared by race and challenge HUDs. */
export function routeGuide(x:number,z:number,heading:number,target:{x:number;z:number}){
 const dx=target.x-x,dz=target.z-z,distance=Math.hypot(dx,dz);
 const bearing=Math.atan2(Math.sin(Math.atan2(dx,dz)-heading),Math.cos(Math.atan2(dx,dz)-heading));
 const arrow=Math.abs(bearing)>2.35?'TURN BACK':bearing>.45?'RIGHT':bearing<-.45?'LEFT':'AHEAD';
 return `${arrow} / ${Math.round(distance)} m to next gate`;
}
