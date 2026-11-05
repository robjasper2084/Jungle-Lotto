export type RoyaleMenuState={phase?:string;online:boolean;host:boolean;round:number;rounds:number;complete:boolean;mode?:'city'|'range'|'combat';riders?:number};
export function menuAction(s:RoyaleMenuState){
 if(s.phase==='results')return {action:'rematch',label:s.online&&!s.host?'Waiting for host':s.complete?(s.mode==='combat'?'Retry Combat Block':s.mode==='range'?'Restart range':'Start new match'):'Next round '+(s.round+1)+' / '+s.rounds,disabled:s.online&&!s.host} as const;
 if(s.phase==='lobby')return {action:'room',label:'Open your room',disabled:false} as const;
 if(s.phase)return {action:'resume',label:s.mode==='range'?'Return to range':s.mode==='combat'?'Return to Combat Block':'Return to match',disabled:false} as const;
 return {action:'practice',label:'Deploy · practice',disabled:false} as const;
}
/** Describe the active arena, not the capacity selected for a future city match. */
export function menuPresentation(s:RoyaleMenuState,selectedBots:number){
 const active=!!s.phase,mode=active?s.mode??'city':'city',riders=active?(s.riders??selectedBots+1):selectedBots+1;
 const training=mode==='range'||mode==='combat';
 const facts=mode==='range'?'SHOOTING RANGE · SOLO DRILLS · 10–100 M':active?'ROUND '+s.round+' / '+s.rounds+' · '+(mode==='combat'?'COMBAT BLOCK':s.online?'ONLINE ROOM':'LOCAL PRACTICE'):'3 ROUNDS · 10 MINUTE FIELD · DOWNTOWN DETROIT';
 const brief=s.phase==='results'?(s.complete?(mode==='combat'?'Combat Block complete. Retry the one-round drill when ready.':mode==='range'?'Range session complete. Restart when ready.':s.rounds+' round'+(s.rounds===1?'':'s')+' complete. Start a new match when ready.'):'Continue the match with your current rider and wheel.'):s.phase==='lobby'?'Share your invitation and ready up in Friends.':active?(s.online?'Your online match continues while this menu is open.':mode==='range'?'Range practice is paused. Resume your aiming and cover drills.':mode==='combat'?'Combat Block is paused · you + '+Math.max(0,riders-1)+' AI opponent'+(riders===2?'':'s')+' · one round.':'Local practice is paused. Return when you are ready.'):selectedBots===0?'Solo exploration · no AI opponents':`${riders}-rider practice · you + ${selectedBots} AI opponent${selectedBots===1?'':'s'}`;
 return {facts,brief,captionLabel:mode==='range'?'PRACTICE YOUR AIM':mode==='combat'?'CLOSE-QUARTERS TRAINING':'THE CITY IS YOUR ARENA',captionTitle:mode==='range'?'YOUR PACE.\nYOUR PRACTICE.':riders===1?'SOLO RIDE.\nEXPLORE DETROIT.':riders+' RIDERS.\n'+(mode==='combat'?'ONE ROUND.':'ONE SURVIVOR.'),captionDetail:training?(mode==='range'?'Solo targets / Shooting range':'You + '+Math.max(0,riders-1)+' AI / Combat Block'):'Original Detroit streets / Static Royale'};
}
