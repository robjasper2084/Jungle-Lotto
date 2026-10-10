import {resolve} from 'node:path';
import {loadHostFixture} from '../dist/hostFixture.js';
import {TagMatch,TagTerrain} from '@digital-static/ridecore/tag';
const products=process.argv.slice(2);if(!products.length)products.push('swoop-detroit','elmwood-explorer');
const loaded=[];
for(const product of ['swoop-detroit','elmwood-explorer'])loaded.push(await loadHostFixture(resolve(import.meta.dirname,'../fixtures'),product));
const rooms=[];
for(const product of products){
 const data=loaded.find(x=>x.fixture.product===product);
 const terrain=await TagTerrain.create(data.fixture,await data.physics());
 const match=new TagMatch(data.fixture,terrain,'classic','expert');
 for(let i=0;i<4;i++)match.addActor('bot-'+i,'Bot '+i,true);
 match.start('memory-review');rooms.push({terrain,match});
 const started=performance.now();for(let i=0;i<600;i++)match.step();
 console.log(JSON.stringify({product,rooms:rooms.length,simulatedSeconds:10,cpuMs:performance.now()-started,rssMiB:process.memoryUsage().rss/1048576,peakRSSMiB:process.resourceUsage().maxRSS/1024}));
}
for(const room of rooms)room.terrain.dispose();
