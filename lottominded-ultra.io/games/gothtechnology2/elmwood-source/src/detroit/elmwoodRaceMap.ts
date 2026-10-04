import {laneGates} from './elmwood-gameplay.ts';
import {trimCoursePath} from './raceMap.ts';
/** Standalone Explorer's actual Creek Lane course, never Swoop's city course. */
export function elmwoodRaceCourse(points:number[][]){
 const gates=laneGates(points).map(p=>({x:p.x,y:p.z})),checkpoints=gates.slice(1);
 return {id:'elmwood-creek-lane',label:'Elmwood · Creek Lane',points:trimCoursePath(points.map(p=>({x:p[0],y:-p[1]})),gates[0],gates.at(-1)!),checkpoints};
}
