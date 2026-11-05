export type CompanionAnchor={x:number;z:number;headingY:number;speed:number};
/** A ground companion never follows a flying rider into the river. */
export function companionAnchor(previous:CompanionAnchor,rider:CompanionAnchor&{y:number},land:boolean,height:number){return land&&rider.y-height<3.5?{x:rider.x,z:rider.z,headingY:rider.headingY,speed:rider.speed}:{...previous,speed:0};}
