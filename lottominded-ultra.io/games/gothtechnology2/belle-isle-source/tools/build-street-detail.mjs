import fs from 'node:fs/promises';
import {createStreetPlan} from '../game/src/belle/streetPlan.ts';
const root=new URL('../',import.meta.url),data=JSON.parse(await fs.readFile(new URL('game/public/belle/map.json',root),'utf8'));
const start=performance.now(),plan=createStreetPlan(data);
const keys=['white','yellow','curb','gutter','metal','green','tactile'];const binary=new Float32Array(plan.boxes.length*9);plan.boxes.forEach((b,i)=>binary.set([b.x,b.y,b.z,b.w,b.h,b.l,b.yaw,keys.indexOf(b.material),b.grade||0],i*9));
await fs.writeFile(new URL('game/public/belle/street-details.bin',root),new Uint8Array(binary.buffer));
await fs.writeFile(new URL('game/public/belle/street-details.json',root),JSON.stringify({...plan,boxes:undefined,materials:keys,stride:9}));
await fs.writeFile(new URL('research/street-detail-stats.json',root),JSON.stringify({...plan.stats,buildMs:performance.now()-start,notes:plan.notes},null,2));
console.log('Street detail',plan.stats,'offline ms',Math.round(performance.now()-start));
