type Point={x:number;z:number};
/** Only use the outside marker when the rider has not already passed it. */
export function useOuterApproach(start:Point,approach:Point,outward:Point){return (start.x-approach.x)*outward.x+(start.z-approach.z)*outward.z>0;}
