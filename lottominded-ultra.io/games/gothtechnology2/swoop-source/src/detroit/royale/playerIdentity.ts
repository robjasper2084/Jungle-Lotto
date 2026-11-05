import type {Elimination} from '../../../../ride-core/src/royale/rules.ts';
/** User names remain plain text, including in the canvas nameplate. */
export function playerLabel(name:string,bot=false){const clean=name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,20)||'Rider';return clean+(bot?' [AI]':'');}
export function eliminationLabel(death?:Elimination){
 if(death?.killer)return 'Eliminated by '+playerLabel(death.killer.name,death.killer.bot);
 return death?.cause==='field'?'Eliminated by the Static Field':death?.cause==='disconnect'?'Eliminated after disconnecting':'Eliminated';
}
