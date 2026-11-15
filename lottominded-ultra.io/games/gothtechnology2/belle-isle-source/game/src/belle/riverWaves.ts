/** Shared near-river displacement: rendering, boat suspension and persistent foam. */
export const riverWaveGLSL='sin(dot(wp,vec2(.48,.34))-riverTime*1.3)*.075+sin(dot(wp,vec2(-.31,.63))-riverTime*1.06)*.045+sin(dot(wp,vec2(.14,-.19))-riverTime*.66)*.08';
export function riverWaveHeight(x:number,z:number,time:number){
 return Math.sin(x*.48+z*.34-time*1.3)*.075+Math.sin(x*-.31+z*.63-time*1.06)*.045+Math.sin(x*.14-z*.19-time*.66)*.08;
}
