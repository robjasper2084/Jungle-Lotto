export type SpiritRider={x:number;y:number;z:number;headingY:number;speed:number};
export type SpiritSpot={x:number;y:number;z:number;heading:number;seat:number;side:number};
/** One shared encounter budget per ride, regardless of split-screen player count. */
export class SpiritEncounters{
  limit=1;seen=0;age=0;active?:SpiritSpot;
  private elapsed=0;private distance=0;private nextTime=0;private nextDistance=0;
  private previous:SpiritRider[]=[];
  private random:()=>number;
  constructor(random:()=>number=Math.random){this.random=random;this.reset();}
  reset(){this.limit=this.random()<.5?1:2;this.seen=0;this.age=0;this.active=undefined;this.previous=[];this.elapsed=this.distance=0;this.nextTime=18+this.random()*12;this.nextDistance=35+this.random()*30;}
  clear(){this.active=undefined;this.previous=[];}
  update(dt:number,riders:SpiritRider[],paused:boolean,enabled:boolean,place:(rider:SpiritRider,seat:number,side:number)=>SpiritSpot|undefined){
    if(!enabled){this.clear();return false;}
    if(paused||dt<=0)return false;
    dt=Math.min(dt,.1);this.elapsed+=dt;
    let travel=0;
    riders.forEach((r,i)=>{const p=this.previous[i];if(p){const d=Math.hypot(r.x-p.x,r.z-p.z);if(d<5)travel=Math.max(travel,d);}});
    this.distance+=travel;this.previous=riders.map(r=>({...r}));
    if(this.active){this.age+=dt;if(this.age>=3.8)this.active=undefined;return false;}
    if(this.seen>=this.limit||this.elapsed<this.nextTime||this.distance<this.nextDistance)return false;
    for(let i=0;i<riders.length;i++){
      const rider=riders[i];if(Math.abs(rider.speed)<.8)continue;
      const side=this.random()<.5?-1:1,spot=place(rider,i,side)??place(rider,i,-side);
      if(!spot)continue;
      this.active=spot;this.age=0;this.seen++;this.nextTime=this.elapsed+55+this.random()*30;this.nextDistance=this.distance+110+this.random()*70;return true;
    }
    return false;
  }
}
