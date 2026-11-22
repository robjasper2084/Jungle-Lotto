/** Fraction of decorative HUD backing remaining at high flight speeds.
 * Speed is the simulation's metres per second; text and controls are not dimmed. */
export function flightHudBackdropFactor(speedMps:number,riding:boolean,blocked:boolean):number{
 if(!riding||blocked||!Number.isFinite(speedMps)||speedMps<=20)return 1;
 const t=Math.max(0,Math.min(1,(speedMps-20)/25));
 return 1-.4*t*t*(3-2*t);
}
