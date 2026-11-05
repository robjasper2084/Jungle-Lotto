export type EnvironmentQuality='smooth'|'automatic'|'high';
export const SHORE_BUDGETS={
 smooth:{rocks:480,rockRange:240,plants:360,plantRange:100},
 automatic:{rocks:1100,rockRange:380,plants:760,plantRange:170},
 high:{rocks:1800,rockRange:520,plants:1200,plantRange:230}
} as const;
export const environmentQuality=(quality:string):EnvironmentQuality=>quality==='smooth'||quality==='high'?quality:'automatic';

/** A small dead band prevents a stationary view near a draw boundary from
 * repeatedly removing and restoring the same landmark. */
export function visibleWithHysteresis(distance:number,range:number,visible:boolean,margin=35){
 return Number.isFinite(distance)&&distance<range+(visible?margin:-margin);
}
