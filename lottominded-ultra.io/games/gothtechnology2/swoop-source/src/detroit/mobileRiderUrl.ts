/** Only Smooth mobile downloads use the derived texture package. HD/Ultra keep
 * their original files; no model, rig, animation or geometry is substituted. */
export function mobileRiderUrl(url:string,mobile:boolean,maxSize:number){
 return mobile&&maxSize<=512?url.replace(/(\/exports\/rigged-heroes\/)(DS_(?:Man_01|Hoodie_Woman_01|Mascot_Suit_01|Mascot_Hoodie_01|Armored_Rider_01)\.glb)(?=[?#]|$)/,'$1mobile-512-20261017/$2'):url;
}
