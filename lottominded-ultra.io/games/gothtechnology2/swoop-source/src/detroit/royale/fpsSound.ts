export function weaponSound(weapon:string,distance:number){
 const profile=weapon==='bass'?{noise:420,tone:65,tail:.24,gain:.2}:weapon==='heart'?{noise:1850,tone:210,tail:.16,gain:.14}:{noise:1450,tone:115,tail:.09,gain:.16};
 const far=Math.min(1,Math.max(0,distance)/100);return {...profile,noise:profile.noise*(1-far*.65),tail:profile.tail+far*.10};
}
export function footstepSound(surface:string,crouch:number,prone:number){
 const rough=['gravel','sand','grass','dirt'].includes(surface),hard=surface==='metal';
 return {hz:hard?1500:surface==='wood'?380:rough?650:240,length:rough?.10:.065,gain:.075*(1-Math.min(1,Math.max(crouch,prone))*.6)};
}
