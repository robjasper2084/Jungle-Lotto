import {sampleKimodoEvade,KIMODO_EVADE} from '../kimodoEvade.ts';
import type {RidePose} from '../controller.ts';
/** Authority-owned volume follows the blended stance and selected hero scale. */
export function stanceBounds(p:RidePose,skin='hero'){
 const scale=skin.startsWith('DS_Mascot_')?.48:1,prone=p.footProne||0,crouch=p.footCrouch||0;
 const side=.42*scale,length=(.42+.78*prone)*scale;
 const x=Math.abs(Math.cos(p.headingY))*side+Math.abs(Math.sin(p.headingY))*length;
 const z=Math.abs(Math.sin(p.headingY))*side+Math.abs(Math.cos(p.headingY))*length;
 if(p.footEvade>0){const row=sampleKimodoEvade(p.footEvade),height=Math.max(.62,Math.min(1.95,row[45]/KIMODO_EVADE.legLength*.9+.65));return{x:Math.max(x,.55*scale),z:Math.max(z,.55*scale),minY:.05*scale,maxY:height*scale};}
 return {x,z,minY:(.20-.15*prone)*scale,maxY:(1.95-.34*crouch)*(1-prone)*scale+.65*scale*prone};
}
