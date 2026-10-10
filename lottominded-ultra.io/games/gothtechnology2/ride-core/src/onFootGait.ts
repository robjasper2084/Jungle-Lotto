const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Distance matched contact: the planted ankle travels backwards at ground speed.
 * Smaller heroes use their own reach, rather than inheriting a human stride. */
export function footGait(phase:number,speed:number,legLength:number){
 const jog=smooth(1.9,3.6,speed),stance=.62-.24*jog;
 const cycleDistance=(1.65+1.95*smooth(2.35,5.4,speed))*Math.max(.35,legLength/.9);
 const travel=cycleDistance*stance;
 const t=((phase%1)+1)%1,heel=.20-.13*jog,toe=.40+.12*jog;
 if(t<stance){const s=t/stance;return{z:travel*(.5-s),lift:0,pitch:-heel*(1-smooth(0,.20,s))+toe*smooth(.66,1,s),contact:true};}
 const u=(t-stance)/(1-stance),s=u*u*(3-2*u);
 return{z:travel*(s-.5),lift:Math.min(.09+.24*jog,legLength*.34)*Math.sin(Math.PI*u)**1.3*(1+.35*jog*Math.cos(Math.PI*u)),pitch:toe*(1-smooth(0,.70,u))-heel*smooth(.70,1,u),contact:false};
}
