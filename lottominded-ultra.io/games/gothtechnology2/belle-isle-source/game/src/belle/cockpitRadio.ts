export type CockpitRadioAction='previous'|'toggle'|'next'|'quieter'|'louder'|'library';
export interface CockpitRadio { snapshot():{title:string;playing:boolean;volume:number;count:number}; command(action:CockpitRadioAction):void; }
