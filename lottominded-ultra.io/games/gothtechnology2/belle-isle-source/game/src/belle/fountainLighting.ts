import * as T from 'three';

// Slow, continuous architectural cues. Every fountain surface samples the same clock.
export const FOUNTAIN_CUE_SECONDS = 12;
export const FOUNTAIN_COLORS = [0xff9d42, 0xf44c79, 0xa75fff, 0x448dff, 0x39d2dc, 0x55c59c, 0xffdf9c] as const;
export function fountainCue(seconds:number) {
 const cycle=FOUNTAIN_COLORS.length*FOUNTAIN_CUE_SECONDS;
 const phase=((seconds%cycle)+cycle)%cycle/FOUNTAIN_CUE_SECONDS;
 const index=Math.floor(phase), fraction=phase-index;
 return {index,next:(index+1)%FOUNTAIN_COLORS.length,mix:fraction*fraction*(3-2*fraction)};
}
const colors=FOUNTAIN_COLORS.map(hex=>new T.Color(hex));
export function createFountainLighting(){
 const primary={value:new T.Color()},secondary={value:new T.Color()};
 function sample(target:T.Color,t:number){const c=fountainCue(t);target.copy(colors[c.index]).lerp(colors[c.next],c.mix);}
 function update(seconds:number){sample(primary.value,seconds);sample(secondary.value,seconds+FOUNTAIN_CUE_SECONDS);}
 update(0);
 return {uniforms:{fountainPrimary:primary,fountainSecondary:secondary},primary,secondary,update};
}
export const FOUNTAIN_COLOR_UNIFORMS='uniform vec3 fountainPrimary;uniform vec3 fountainSecondary;\n';
