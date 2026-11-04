import {readFile,writeFile} from 'node:fs/promises';
import {canalWaterfowl} from '../game/src/belle/waterfowlPlan.ts';
const map=JSON.parse(await readFile(new URL('../game/public/belle/map.json',import.meta.url),'utf8'));
const routes=canalWaterfowl(map);
await writeFile(new URL('../game/src/belle/canalWaterfowl.json',import.meta.url),JSON.stringify(routes));
console.log(`Prepared ${routes.length} canal birds; route validation stays out of game startup.`);
