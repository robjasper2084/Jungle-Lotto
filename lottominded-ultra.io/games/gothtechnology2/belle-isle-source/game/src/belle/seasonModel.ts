const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function seasonLook(month:number,evergreen=false){const m=Number.isFinite(month)?Math.max(1,Math.min(12,month)):7;if(evergreen)return{density:1,autumn:0,spring:0,snow:m<3||m>11?.3:0};const density=m<3.2||m>11.6?0:m<5.3?clamp((m-3.2)/2.1):m<9.8?1:clamp((11.6-m)/1.8);return{density,autumn:m>8.8?clamp((m-8.8)/1.4):0,spring:m<6?clamp((6-m)/2.3):0,snow:m<3||m>11?.3:0};}
export function treeBlend(distance:number,cutoff:number){return clamp((cutoff-distance)/28);}
