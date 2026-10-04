import type {RideEvent} from '@digital-static/ridecore';
export type RunMode='free'|'sprint'|'tricks'|'tour';
export type Point={x:number;z:number};
export const MODES=[['free','Free ride'],['sprint','Creek lane sprint / race'],['tricks','Two-minute trick session'],['tour','Creek lane discovery']] as const;
export function laneGates(points:number[][],spacing=26):Point[]{
  if(points.length<2)return [];
  const gates:Point[]=[{x:points[0][0],z:-points[0][1]}];let remaining=spacing;
  for(let i=1;i<points.length;i++){
    const a={x:points[i-1][0],z:-points[i-1][1]},b={x:points[i][0],z:-points[i][1]};let length=Math.hypot(b.x-a.x,b.z-a.z);
    while(length>=remaining&&length>.001){const f=remaining/length;a.x+=(b.x-a.x)*f;a.z+=(b.z-a.z)*f;gates.push({...a});length-=remaining;remaining=spacing;}
    remaining-=length;
  }
  const last=points.at(-1)!;if(Math.hypot(gates.at(-1)!.x-last[0],gates.at(-1)!.z+last[1])>8)gates.push({x:last[0],z:-last[1]});
  return gates;
}
function sweptDistance(a:Point,b:Point,p:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);}
export class ElmwoodRun {
  mode:RunMode='free';elapsed=0;score=0;gate=1;finished=false;failed=false;finishTime=0;message='';messageTime=0;distance=0;
  private previous?:Point;
  splits:number[]=[];referenceSplits:readonly number[]=[];
  readonly gates:Point[];
  constructor(gates:Point[]){this.gates=gates;}
  reset(mode:RunMode,position:Point){this.mode=mode;this.elapsed=this.score=this.distance=this.finishTime=0;this.gate=1;this.finished=this.failed=false;this.message='';this.messageTime=0;this.previous={...position};this.splits=[];}
  relocate(position:Point){this.previous={...position};}
  update(dt:number,position:Point,events:readonly RideEvent[],paused=false){
    if(paused||this.finished||this.failed)return;
    this.elapsed+=dt;this.messageTime=Math.max(0,this.messageTime-dt);
    const moved=this.previous?Math.hypot(position.x-this.previous.x,position.z-this.previous.z):0;
    if(moved<5)this.distance+=moved;
    for(const event of events){
      if(event.type==='trick'){this.score+=event.points;this.message=event.message+(event.points&&!event.message.includes('+'+event.points)?' +'+event.points:'');this.messageTime=3;}
      if(event.type==='crash'){this.message='Recover to keep riding';this.messageTime=3;}
    }
    if(this.mode==='sprint'||this.mode==='tour'){
      const target=this.gates[this.gate];
      if(target&&this.previous&&moved<5&&sweptDistance(this.previous,position,target)<3.6){
        this.splits.push(this.elapsed);const reference=this.referenceSplits[this.splits.length-1],gap=Number.isFinite(reference)?this.elapsed-reference:null;
        this.gate++;this.score+=100;this.message='Checkpoint '+(this.gate-1)+' · +100'+(gap===null?'':' · '+Math.abs(gap).toFixed(2)+' s '+(gap<=0?'ahead of':'behind')+' your best');this.messageTime=3;
        if(this.gate>=this.gates.length){this.finished=true;this.finishTime=this.elapsed;this.message='Finished in '+this.elapsed.toFixed(1)+'s';this.messageTime=Infinity;}
      }    }
    if(this.mode==='tricks'&&this.elapsed>=120){this.finished=true;this.message='Session complete · '+this.score+' points';this.messageTime=Infinity;}
    this.previous={...position};
  }
  get label(){
    if(this.finished||this.failed)return this.message;
    if(this.mode==='tricks')return `${Math.ceil(Math.max(0,120-this.elapsed))}s · ${this.score} pts`;
    if(this.mode==='sprint'||this.mode==='tour')return `${this.gate-1}/${Math.max(0,this.gates.length-1)} gates${this.mode==='sprint'?' · '+this.elapsed.toFixed(1)+'s':''}`;
    return `${(this.distance/1000).toFixed(2)} km · ${this.score} pts`;
  }
}
