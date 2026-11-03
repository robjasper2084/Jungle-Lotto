import fs from 'node:fs/promises';
import path from 'node:path';
import {makeMeadowPlan} from '../game/src/belle/meadowPlan.ts';
const root=path.resolve(import.meta.dirname,'..');
const map=JSON.parse(await fs.readFile(root+'/game/public/belle/map.json','utf8'));
const plan=makeMeadowPlan(map);
await fs.writeFile(root+'/game/public/belle/nature/meadow.json',JSON.stringify(plan));
console.log('Meadow:',plan.cells.length,'safe six-metre cells; runtime blades use a fixed detail pool.');
