const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const footCycleDistance=(speed:number)=>1.65+1.35*smooth(2.35,5.4,Math.abs(speed));
/** Distance matched contact: the planted ankle travels backwards at ground speed.
 * Low swing clearance keeps the current cadence without high stepping.
 * Smaller heroes use their own reach, rather than inheriting a human stride. */
export function footGait(phase:number,speed:number,legLength:number){
 const jog=smooth(1.9,3.6,speed),stance=.62-.24*jog;
 const cycleDistance=footCycleDistance(speed)*Math.max(.35,legLength/.9);
 const travel=cycleDistance*stance;
 const t=((phase%1)+1)%1,heel=.12-.07*jog,toe=.24+.10*jog;
 if(t<stance){const s=t/stance;return{z:travel*(.5-s),lift:0,pitch:-heel*(1-smooth(0,.20,s))+toe*smooth(.66,1,s),contact:true};}
 // Match the planted foot's backwards velocity at lift-off and touchdown.
 // A zero-tangent swing made each ankle visibly stop at every step boundary.
 const u=(t-stance)/(1-stance),tangent=-(1-stance)/stance;
 const s=u*u*(3-2*u)+tangent*u*(1-u)*(1-2*u);
 return{z:travel*(s-.5),lift:Math.min(.075+.12*jog,legLength*.24)*Math.sin(Math.PI*u)**1.3*(1+.20*jog*Math.cos(Math.PI*u)),pitch:toe*(1-smooth(0,.70,u))-heel*smooth(.70,1,u),contact:false};
}

/** Grounded shooter locomotion: small weight transfer, opposing shoulders and
 * hips, and elbows that flex more during running. The weapon layer may still
 * override the arms independently of this lower-body gait. */
export function footBodyMotion(phase:number,speed:number){
 const effort=smooth(0,.85,Math.abs(speed)),run=smooth(2.5,5.4,Math.abs(speed));
 const wave=Math.sin(phase*Math.PI*2),swing=Math.cos(phase*Math.PI*2);
 return {effort,run,hipPitch:(.025+.045*run)*effort,chestPitch:(.05+.055*run)*effort,
  hipYaw:-wave*(.035+.02*run)*effort,chestYaw:wave*(.04+.025*run)*effort,
  weight:wave*(.012+.008*run)*effort,bob:-Math.cos(phase*Math.PI*4)*(.008+.009*run)*effort,
  shoulder:-swing*(.30+.32*run)*effort,elbow:.30+.72*run*effort};
}
