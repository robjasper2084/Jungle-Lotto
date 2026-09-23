import config from './dog-gaits.json' with {type:'json'};
export const DOG_GAITS=Object.values(config);
const smooth=(v:number,a:number,b:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function gaitWeights(speed:number){
  const move=smooth(speed,.04,.6),trot=smooth(speed,1.3,2.6),run=smooth(speed,3.6,5.3);
  return [1-move,move*(1-trot),move*trot*(1-run),move*trot*run];
}
/** The stance sweeps 2*stride metres during duty of one cycle. Advancing by
 * this calibrated distance cancels root travel instead of skating the paws. */
export function gaitCadence(speed:number){
  const weights=gaitWeights(speed),moving=1-weights[0];
  if(moving<.001)return 0;
  const cycle=DOG_GAITS.reduce((sum,g,i)=>sum+(i?weights[i]*2*g.stride/g.duty:0),0)/moving;
  return speed/cycle;
}
export function pawContact(speed:number,phase:number,leg:number){
  const weights=gaitWeights(speed);
  return DOG_GAITS.reduce((sum,g,i)=>{
    if(!i)return sum+weights[i];
    const t=((phase+g.offsets[leg])%1+1)%1;
    return sum+weights[i]*smooth(t,0,.025)*(1-smooth(t,g.duty-.035,g.duty));
  },0);
}
