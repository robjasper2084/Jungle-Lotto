export const LOTTO_STORE_TRACK='track-01';
export const isLottoStoreTrack=(id:string)=>id==='track-01'||id==='track-02';
/** Store music is excluded even when an old save explicitly selected it. */
export function ridingMusic<T extends {id:string;group:string;duplicateOf?:string}>(tracks:readonly T[],station:string,scene:string){
 const available=tracks.filter(t=>!t.duplicateOf&&t.group!=='effect'&&!isLottoStoreTrack(t.id));
 const selected=available.filter(t=>station==='shuffle'||station==='all'&&t.group!=='bonus'||station==='bonus'&&t.group==='bonus'||station==='auto'&&t.group===scene||t.id===station);
 return selected.length?selected:available.filter(t=>t.group===scene);
}
