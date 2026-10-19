/** Seconds of looting/repositioning, then closing. Mirrored in the authoritative
 * C++ kernel and covered by a full-round parity/restore test. */
export const FIELD_HOLDS=[60,30,20,15,10] as const;
export const FIELD_CLOSES=[120,120,110,85,30] as const;
export const FIELD_DURATION=FIELD_HOLDS.reduce((s,n,i)=>s+n+FIELD_CLOSES[i],0);
export function fieldStageAt(tick:number){
 const seconds=Math.max(0,tick-240)/60;let start=0;
 for(let phase=0;phase<5;phase++){
  const hold=FIELD_HOLDS[phase],close=FIELD_CLOSES[phase],end=start+hold+close;
  if(seconds<end||phase===4){const age=seconds-start,closing=age>=hold;
   return {phase,closing,fraction:Math.max(0,Math.min(1,(age-hold)/close)),remaining:Math.max(0,(closing?end:start+hold)-seconds)};
  }start=end;
 }throw Error('Invalid field schedule');
}
