import {LOTTO_GAMES} from './lottoGames.ts';
export type DeskGame={id:string;name:string;mainCount:number;mainMax:number;specialName?:string;specialMax?:number};
export type DeskTicket={gameId:string;numbers:number[];special?:number};
export function deskGame(id:string):DeskGame{return LOTTO_GAMES.find(g=>g.id===id)??LOTTO_GAMES[0];}
export function parsePool(input:string,game:DeskGame){
 const tokens=input.trim().split(/[\s,;]+/).filter(Boolean),min=game.mainMax===9?0:1;
 if(!tokens.length)throw Error('Enter a number pool.');
 if(tokens.some(t=>!/^\d+$/.test(t)||!Number.isSafeInteger(Number(t))||Number(t)<min||Number(t)>game.mainMax))throw Error(`Use whole numbers from ${min} to ${game.mainMax}.`);
 return tokens.map(Number);
}
function randomIndex(size:number,randomWord:()=>number){const limit=Math.floor(4294967296/size)*size;let word:number;do{word=randomWord()>>>0;}while(word>=limit);return word%size;}
export function quickTicket(id:string,randomWord=()=>crypto.getRandomValues(new Uint32Array(1))[0]):DeskTicket{
 const g=deskGame(id),numbers:number[]=[];
 if(g.mainMax===9){for(let i=0;i<g.mainCount;i++)numbers.push(randomIndex(10,randomWord));}
 else{const pool=Array.from({length:g.mainMax},(_,i)=>i+1);for(let i=0;i<g.mainCount;i++){const j=i+randomIndex(pool.length-i,randomWord);[pool[i],pool[j]]=[pool[j],pool[i]];numbers.push(pool[i]);}numbers.sort((a,b)=>a-b);}
 return{gameId:g.id,numbers,...(g.specialMax?{special:randomIndex(g.specialMax,randomWord)+1}:{})};
}
export function validTicket(ticket:DeskTicket){const g=deskGame(ticket.gameId);return ticket.gameId===g.id&&ticket.numbers.length===g.mainCount&&ticket.numbers.every(n=>Number.isInteger(n)&&n>=(g.mainMax===9?0:1)&&n<=g.mainMax)&&(g.mainMax===9||new Set(ticket.numbers).size===g.mainCount)&&(!g.specialMax||(Number.isInteger(ticket.special)&&ticket.special!>=1&&ticket.special!<=g.specialMax));}
/** Small deterministic coverage wheel. Cap prevents combinatorial work in the ride loop. */
export function coverageWheel(id:string,input:string,special?:number,cap=24):{tickets:DeskTicket[];total:number}{
 const g=deskGame(id);if(g.mainMax===9)throw Error('Use Digit Wheeler for Pick 3 or Pick 4.');
 const pool=[...new Set(parsePool(input,g))].sort((a,b)=>a-b);if(pool.length<g.mainCount||pool.length>12)throw Error(`Enter ${g.mainCount}–12 distinct numbers.`);
 if(g.specialMax&&(!Number.isInteger(special)||special!<1||special!>g.specialMax))throw Error(`Enter a ${g.specialName} from 1 to ${g.specialMax}.`);
 const tickets:DeskTicket[]=[],limit=Math.max(1,Math.min(24,Math.trunc(cap)));let total=1;for(let i=1;i<=g.mainCount;i++)total=total*(pool.length-g.mainCount+i)/i;
 const walk=(start:number,pick:number[])=>{if(tickets.length>=limit)return;if(pick.length===g.mainCount){tickets.push({gameId:g.id,numbers:[...pick],...(g.specialMax?{special}:{})});return;}for(let i=start;i<=pool.length-(g.mainCount-pick.length)&&tickets.length<limit;i++){pick.push(pool[i]);walk(i+1,pick);pick.pop();}};walk(0,[]);return{tickets,total:Math.round(total)};
}
