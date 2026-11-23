import type {Object3D} from 'three';
import type {HoverPose} from '../hoverController.ts';
const digits=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
/** Drive the authored seven-segment display from live game telemetry, not demo keys. */
export function corleoDashboard(root:Object3D){
 const nodes=new Map<string,Object3D>();root.traverse(o=>{if(o.name.startsWith('CR_HUD_'))nodes.set(o.name,o);});
 function show(name:string,enabled:boolean){const node=nodes.get(name);if(node){node.visible=enabled;if(node.userData.cr_rest_scale)node.scale.set(1,1,1);}}
 function number(label:string,value:number,width:number){const text=String(Math.round(value)).padStart(width,'0').slice(-width);for(let i=0;i<width;i++)for(const segment of 'abcdefg')show(`CR_HUD_${label}_${i}_${segment}`,digits[Number(text[i])].includes(segment));}
 return (p:HoverPose,power:number,lights:boolean,brake:boolean)=>{
  number('Speed',Math.min(99,Math.abs(p.speed)*3.6),2);number('Heading',((p.heading*180/Math.PI)%360+360)%360,3);
  show('CR_HUD_Walk',Math.abs(p.speed)>.1&&Math.abs(p.speed)<=1.2);show('CR_HUD_Trot',Math.abs(p.speed)>1.2);show('CR_HUD_Power',true);show('CR_HUD_Lights',lights);show('CR_HUD_Brake',brake);
  for(const name of ['FL','FR','RL','RR'])show('CR_HUD_Contact_'+name,false);
  const bar=nodes.get('CR_HUD_InputBar');if(bar)bar.scale.x=Math.max(.001,Math.min(1,power));
 };
}
