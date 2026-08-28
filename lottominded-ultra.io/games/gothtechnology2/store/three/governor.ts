export type Quality = 'high'|'balanced'|'low'|'fallback';
export type QualityChoice = Quality|'auto';
export const qualitySettings = {
  high:{dpr:1.75,particles:72,shadows:true,fps:60},
  balanced:{dpr:1.25,particles:32,shadows:false,fps:45},
  low:{dpr:1,particles:10,shadows:false,fps:30},
  fallback:{dpr:1,particles:0,shadows:false,fps:0},
};
export function chooseQuality(hints:{webgl:boolean;reducedMotion:boolean;saveData:boolean;memory?:number;cores?:number;mobile?:boolean;choice?:QualityChoice}):Quality {
  if(!hints.webgl||hints.reducedMotion||hints.saveData||hints.choice==='fallback')return 'fallback';
  if(hints.choice && hints.choice!=='auto')return hints.choice;
  if((hints.memory??8)<=2||(hints.cores??8)<=2)return 'fallback';
  if((hints.memory??8)<=4||(hints.cores??8)<=4||hints.mobile)return 'low';
  return (hints.memory??8)>=8 && (hints.cores??8)>=8?'high':'balanced';
}
export function lowerQuality(quality:Quality):Quality {return ({high:'balanced',balanced:'low',low:'fallback',fallback:'fallback'} as const)[quality];}
export class PerformanceGovernor {
  private frames:number[]=[];
  private badWindows=0;
  constructor(public quality:Quality){}
  sample(milliseconds:number) {
    if(milliseconds<=0||milliseconds>250||this.quality==='fallback')return false;
    this.frames.push(milliseconds);if(this.frames.length<90)return false;
    const average=this.frames.reduce((a,b)=>a+b,0)/this.frames.length;this.frames=[];
    if(average>46)this.badWindows++;else this.badWindows=0;
    if(this.badWindows<2)return false;
    this.badWindows=0;this.quality=lowerQuality(this.quality);return true;
  }
}
