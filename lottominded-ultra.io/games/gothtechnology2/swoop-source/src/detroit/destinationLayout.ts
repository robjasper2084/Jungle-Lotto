import {toLocal} from './geo-profile.ts';
import {MACK_STUDIO,studioMap,studioRoom} from './mackStudioSite.ts';
/** Both existing collections now occupy rooms inside the mapped Mack studio. */
export function destinationLayout(store=false){const r=studioRoom(store),p=studioMap(r.u,r.v),y=MACK_STUDIO.floor;return{scale:1,map:{...p,y},local:toLocal(p.x,y,p.z),heading:MACK_STUDIO.heading,foundationDepth:.2};}
