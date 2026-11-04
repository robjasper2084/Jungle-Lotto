export type CockpitInput={speed:number;height:number;heading:number;landed:boolean;landing:boolean;boost:boolean;collision:boolean;lights:boolean;drone?:boolean};
export function cockpitTelemetry(p:CockpitInput){
 const degrees=((180-p.heading*180/Math.PI)%360+360)%360;
 return{speed:Math.round(Math.abs(p.speed)*3.6),height:Math.max(0,p.height).toFixed(1),bearing:Math.round(degrees)%360,compass:['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8],mode:p.landed?'LANDED':p.landing?'LANDING':p.boost?'BOOST':p.drone?'ALT HOLD':'IN FLIGHT',warning:p.collision?'OBSTACLE':p.speed<-.1?'REVERSE':'',lights:p.lights};
}
