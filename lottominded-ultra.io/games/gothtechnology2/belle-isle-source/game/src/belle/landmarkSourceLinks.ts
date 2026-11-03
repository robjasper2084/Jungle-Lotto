import records from './landmarkSources.json' with {type:'json'};
const byId=new Map(records.map(record=>[record.id,record]));
/** Linked references only: opening the guide never downloads third-party imagery. */
export function appendLandmarkSources(card:HTMLElement,id:string){
 const record=byId.get(id);if(!record)return;
 const details=document.createElement('details');details.className='landmark-sources';
 const summary=document.createElement('summary');summary.textContent='Photos & maps';details.append(summary);
 const list=document.createElement('ul');
 for(const source of record.sources){const item=document.createElement('li'),link=document.createElement('a');link.href=source.url;link.textContent=source.label+' ↗';link.target='_blank';link.rel='noopener noreferrer';item.append(link);list.append(item);}
 details.append(list);
 if(record.referenceDate){const date=document.createElement('p');date.className='reference-date';date.textContent='Reference photos: '+record.referenceDate+'. Details may have changed.';details.append(date);}
 card.append(details);
}
