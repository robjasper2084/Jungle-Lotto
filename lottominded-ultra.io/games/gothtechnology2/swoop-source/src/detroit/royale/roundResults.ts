export type RoundSummary={winner:string;reason:string;kills:number;damage:number;distance:number;eliminatedBy:string;round:number;rounds:number;complete:boolean;standings:{id:string;name:string;wins:number}[];self:string;matchWinner:string};
/** Render only on a changed result; player names are always plain text. */
export function roundResults(root:HTMLElement,data:RoundSummary){
 const key=JSON.stringify(data);if(root.dataset.summary===key)return;root.dataset.summary=key;
 const make=(tag:string,cls:string,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 const title=make('strong','royale-result-winner',data.winner),reason=make('p','royale-result-reason',data.reason);
 const stats=make('dl','royale-result-stats');
 for(const [label,value]of [['Eliminations',data.kills],['Damage',data.damage],['Distance',Math.round(data.distance)+' m']]){const item=make('div','');item.append(make('dt','',String(label)),make('dd','',String(value)));stats.append(item);}
 const detail=make('p','royale-result-reason',data.eliminatedBy);detail.hidden=!data.eliminatedBy;
 const table=make('details','royale-standings'),summary=make('summary','',data.complete?'Final standings':'Match standings · round '+data.round+' / '+data.rounds),list=make('ol','');
 for(const r of data.standings){const row=make('li',r.id===data.self?'is-you':'');row.append(make('span','',r.name+(r.id===data.self?' · You':'')),make('strong','',r.wins+' '+(r.wins===1?'win':'wins')));list.append(row);}
 table.append(summary,list);if(data.complete)table.append(make('p','royale-result-reason',data.matchWinner));
 root.replaceChildren(title,reason,stats,detail,table);
}
