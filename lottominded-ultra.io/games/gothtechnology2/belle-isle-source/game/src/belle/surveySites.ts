import type {Point} from './terrain.ts';

type Spec = [dx:number, dz:number, height:number, kind:'tree'|'shrub'];
type Sector = {name:string; anchor:Point; plants:Spec[]};
// Offsets in mapped metres east and south of the original profiling waypoint.
// These are representative crown groups read against the satellite scale.
export const surveySites:Sector[] = [
 {name:'Shelter 17',anchor:[2919.75,641],plants:[
  [-48,-17,13,'tree'],[-32,-28,15,'tree'],[-18,-33,11,'tree'],[5,-48,14,'tree'],
  [23,-56,12,'tree'],[37,-65,15,'tree'],[-40,-18,2.2,'shrub'],[-8,-37,2.5,'shrub']
 ]},
 {name:'Nashua Canal',anchor:[2165.25,720.75],plants:[
  [-47,8,13,'tree'],[-31,-8,12,'tree'],[-9,-4,15,'tree'],[8,2,13,'tree'],
  [28,-3,12,'tree'],[43,-8,15,'tree'],[-20,4,2.4,'shrub'],[15,-4,2.7,'shrub']
 ]},
 {name:'Oakway Refectory',anchor:[2023,310],plants:[
  [37,18,14,'tree'],[49,9,15,'tree'],[58,-2,12,'tree'],[67,5,15,'tree'],
  [33,30,12,'tree'],[22,34,14,'tree'],[32,18,2.6,'shrub'],[46,15,2.2,'shrub']
 ]}
];
// Continuous lawn between Woodside Drive, the pavilion and the playground.
// The waterside fringe and the wooded bank across the road are outside it.
export const shelterLawn:Point[] = [[2889,648],[2942,617],[2993,589],[3004,605],[2973,630],[2944,645],[2901,661]];
