/** Photographic shoreline character for Belle Isle Explorer.
 * Art-directed interpretation from supplied shoreline photographs and Belle
 * Isle reference imagery; this is not a georeferenced shoreline survey.
 * Pure data: no physics, scene, image, or network dependencies.
 */
export type ShoreZone='natural-riprap'|'bridge-approach'|'wooded-bank'|'swim-beach'|'formal-edge';
export type ShoreStyle={zone:ShoreZone;rockChance:number;minStones:number;maxStones:number;minRadius:number;maxRadius:number;driftwoodChance:number};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
/** A 40–80m patch length prevents unnaturally uniform rock coverage. */
export function shorePatch(x:number,z:number){
 if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
 return clamp(.48+.22*Math.sin(x*.037+Math.sin(z*.023)*1.5)+.24*Math.sin(z*.021-x*.016));
}
export function shoreStyle(x:number,z:number,zone:ShoreZone):ShoreStyle{
 if(zone==='swim-beach'||zone==='formal-edge')return{zone,rockChance:0,minStones:0,maxStones:0,minRadius:0,maxRadius:0,driftwoodChance:0};
 const patch=shorePatch(x,z);
 if(zone==='bridge-approach')return{zone,rockChance:.92,minStones:3,maxStones:6,minRadius:.36,maxRadius:1.04,driftwoodChance:.02};
 if(zone==='wooded-bank')return{zone,rockChance:.28+patch*.37,minStones:1,maxStones:3,minRadius:.26,maxRadius:.76,driftwoodChance:.12};
 return{zone,rockChance:.49+patch*.42,minStones:2,maxStones:6,minRadius:.34,maxRadius:1.12,driftwoodChance:.055};
}
export type StoneCharacter='light-limestone'|'mottled-gray'|'river-worn-dark';
export function stoneCharacter(seed:number,wet:boolean):StoneCharacter{
 const n=clamp(seed);
 if(wet)return n<.60?'river-worn-dark':n<.88?'mottled-gray':'light-limestone';
 return n<.52?'light-limestone':n<.83?'mottled-gray':'river-worn-dark';
}
export function stoneHSL(character:StoneCharacter,jitter:number):[number,number,number]{
 const a=clamp(jitter);
 if(character==='light-limestone')return [.105,.045+.028*a,.53+.20*a];
 if(character==='mottled-gray')return [.095,.025+.028*a,.43+.16*a];
 return [.105,.055+.022*a,.29+.16*a];
}
