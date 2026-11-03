import fs from'node:fs/promises';import path from'node:path';
import{makeNaturePlan}from'../game/src/belle/naturePlan.ts';
import{makeGardenPlan}from'../game/src/belle/gardenPlan.ts';
import{makeLakeHabitat}from'../game/src/belle/lakeHabitatPlan.ts';
const root=path.resolve(import.meta.dirname,'..');
const map=JSON.parse(await fs.readFile(root+'/game/public/belle/map.json','utf8'));
const plan=makeNaturePlan(map);
await fs.writeFile(root+'/game/public/belle/nature/placements.json',JSON.stringify(plan));
console.log('Nature plan:',plan.trees.length,'trees,',plan.ground.length,'ground plants/rocks');
const gardens=makeGardenPlan(map);
await fs.writeFile(root+'/game/public/belle/nature/gardens.json',JSON.stringify(gardens));
console.log('Garden plan:',gardens.plants.length,'flowering clumps in mapped beds');

const lake=makeLakeHabitat(map);
await fs.writeFile(root+'/game/public/belle/nature/okonoka.json',JSON.stringify(lake));
const heron=makeLakeHabitat(map,'32613819');
await fs.writeFile(root+'/game/public/belle/nature/heron.json',JSON.stringify(heron));
console.log('Blue Heron habitat:',heron.reeds.length,'sedges,',heron.pads.length,'leaves,',heron.logs.length,'logs,',heron.rocks.length,'rocks');
console.log('Lake habitat:',lake.reeds.length,'sedges,',lake.pads.length,'leaves,',lake.logs.length,'fallen logs');
