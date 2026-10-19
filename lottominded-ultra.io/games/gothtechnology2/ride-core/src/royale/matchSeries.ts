export type RoundScore={id:string;name:string;kills:number;damage:number};
export type RoundResult={id:string;winner:string|null;scores:RoundScore[]};
/** Host-owned three-round scorecard. Repeated result snapshots never award twice. */
export class MatchSeries{
 number=0;completed:RoundResult[]=[];
 constructor(readonly total=3){}
 begin(){if(this.completed.length>=this.total){this.completed=[];this.number=0;}this.number=this.completed.length+1;}
 finish(id:string,winner:string|null,scores:RoundScore[]){if(!this.completed.some(r=>r.id===id)&&this.completed.length<this.total)this.completed.push({id,winner,scores:structuredClone(scores)});}
 snapshot(){
  const rows=new Map<string,RoundScore&{wins:number}>();
  for(const round of this.completed)for(const score of round.scores){const row=rows.get(score.id)??{id:score.id,name:score.name,kills:0,damage:0,wins:0};row.kills+=score.kills;row.damage+=score.damage;row.wins+=Number(round.winner===score.id);rows.set(row.id,row);}
  const standings=[...rows.values()].sort((a,b)=>b.wins-a.wins||b.kills-a.kills||b.damage-a.damage||a.name.localeCompare(b.name));
  const complete=this.completed.length===this.total,first=standings[0],second=standings[1];
  const tied=!!second&&first.wins===second.wins&&first.kills===second.kills&&first.damage===second.damage;
  return {number:this.number,total:this.total,complete,standings,winner:complete&&!tied?first?.id??null:null};
 }
}
