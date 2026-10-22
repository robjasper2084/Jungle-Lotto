export type RoyaleMenuState={phase?:string;online:boolean;host:boolean;round:number;rounds:number;complete:boolean};
export function menuAction(s:RoyaleMenuState){
 if(s.phase==='results')return {action:'rematch',label:s.online&&!s.host?'Waiting for host':s.complete?'Start new match':'Next round '+(s.round+1)+' / '+s.rounds,disabled:s.online&&!s.host} as const;
 if(s.phase==='lobby')return {action:'room',label:'Open your room',disabled:false} as const;
 if(s.phase)return {action:'resume',label:'Return to match',disabled:false} as const;
 return {action:'practice',label:'Deploy · practice',disabled:false} as const;
}
