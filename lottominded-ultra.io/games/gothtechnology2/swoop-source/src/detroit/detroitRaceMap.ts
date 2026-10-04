import {CITY,pointOnCut} from './geography.ts';
import {RACE_ROUTE} from './raceRules.ts';
import {northUp} from './routeMap.ts';
import {trimCoursePath} from './raceMap.ts';
const mapAt=(station:number)=>{const p=pointOnCut(station);return northUp(p.x,p.z);};
/** City route retains the mapped Cut bends and the rules' exact gate positions. */
export const DETROIT_RACE_COURSE={id:RACE_ROUTE.id,label:'Swoop Detroit · Cut to Mack Avenue',points:trimCoursePath(CITY.cut.map(p=>northUp(p[0],p[1])),mapAt(RACE_ROUTE.start),mapAt(RACE_ROUTE.end)),checkpoints:RACE_ROUTE.gates.map(mapAt)};
