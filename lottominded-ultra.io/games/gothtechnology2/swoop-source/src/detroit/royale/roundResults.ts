export type Standing={id:string;name:string;wins:number;kills:number;damage:number};
export type RoundSummary={winner:string;reason:string;kills:number;damage:number;distance:number;eliminatedBy:string;round:number;rounds:number;complete:boolean;standings:Standing[];self:string;matchWinner:string};
export const standingsRule='Ranked by round wins, then total eliminations, then total damage. Equal totals result in a tied match.';
/** The authoritative series already sorts these rows; explain its first deciding score. */
export function standingsDecision(standings:Standing[]){
 const [first,second]=standings;
 if(!first||!second)return '';
 if(first.wins!==second.wins)return 'Decided by round wins · '+first.wins+' to '+second.wins+'.';
 if(first.kills!==second.kills)return 'Round wins tied. Eliminations decide the match · '+first.kills+' to '+second.kills+'.';
 if(first.damage!==second.damage)return 'Round wins and eliminations tied. Damage decides the match · '+Math.round(first.damage)+' to '+Math.round(second.damage)+'.';
 return 'Round wins, eliminations and damage are equal. The match is tied.';
}
/** Render only on a changed result; player names are always plain text. */
export function roundResults(root:HTMLElement,data:RoundSummary){
 const key=JSON.stringify(data);if(root.dataset.summary===key)return;root.dataset.summary=key;
 const make=(tag:string,cls:string,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 const title=make('strong','royale-result-winner',data.winner),reason=make('p','royale-result-reason',data.reason);
 const stats=make('dl','royale-result-stats');
 for(const [label,value]of [['Eliminations',data.kills],['Damage',data.damage],['Distance',Math.round(data.distance)+' m']]){const item=make('div','');item.append(make('dt','',String(label)),make('dd','',String(value)));stats.append(item);}
 const detail=make('p','royale-result-reason',data.eliminatedBy);detail.hidden=!data.eliminatedBy;
 const standings=make('details','royale-standings') as HTMLDetailsElement,summary=make('summary','',data.complete?'Final standings':'Match standings · round '+data.round+' / '+data.rounds);
 standings.open=data.complete;
 const table=make('table','royale-standings-table');table.setAttribute('aria-label','Match scores');
 const head=make('thead',''),heading=make('tr','');
 for(const label of ['Rider','Wins','Elims','Damage']){const cell=make('th','',label);cell.setAttribute('scope','col');if(label==='Elims')cell.setAttribute('aria-label','Eliminations');heading.append(cell);}head.append(heading);
 const body=make('tbody','');
 data.standings.forEach((r,index)=>{const row=make('tr',r.id===data.self?'is-you':'');const name=make('th','',(index+1)+'. '+r.name+(r.id===data.self&&r.name!=='You'?' · You':''));name.setAttribute('scope','row');row.append(name,...[r.wins,r.kills,Math.round(r.damage)].map(value=>make('td','',String(value))));body.append(row);});
 table.append(head,body);standings.append(summary,table,make('p','royale-standings-rule',standingsRule));
 if(data.complete)standings.append(make('p','royale-match-winner',data.matchWinner),make('p','royale-result-reason',standingsDecision(data.standings)));
 root.replaceChildren(title,reason,stats,detail,standings);
}
