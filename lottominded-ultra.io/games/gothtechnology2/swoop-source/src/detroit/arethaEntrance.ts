import {WATERFRONT} from './waterfrontSite.ts';
import {gateDirection} from './waterfrontRails.ts';
/** The venue gate between the pond and river, rather than the Atwater marquee.
 * City district description: https://detroitmi.gov/sites/detroitmi.localhost/files/events/2019-11/PED%20REFERRAL%20ITEMS%20FORMAL%20AGENDA%2011-5-2019.pdf
 * Position follows OSM node 6913854882; arch details remain authored estimates. */
const gate=WATERFRONT.gates.find(g=>g.id==='6913854882')!;
const axis=gateDirection(gate.point),inward={x:-axis[1],z:axis[0]};
export const ARETHA_ENTRANCE={
 osmId:gate.id,x:gate.point[0],z:gate.point[1],yaw:Math.atan2(-axis[1],axis[0]),
 approach:{x:gate.point[0]-inward.x*12,z:gate.point[1]-inward.z*12,heading:Math.atan2(inward.x,inward.z)},
 posts:[-5,5].map(offset=>({x:gate.point[0]+axis[0]*offset,z:gate.point[1]+axis[1]*offset})),
};
