import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),ref=JSON.parse(await readFile(new URL('art/waterfront/waterfront-reference.json',root))),city=JSON.parse(await readFile(new URL('src/detroit/city-data.json',root)));
const inside=p=>p[0]>-360&&p[0]<450&&p[1]>-1950&&p[1]<220;
const ways=ref.ways.filter(w=>w.points.some(inside));
const buildings=ways.filter(w=>w.tags.building).map(w=>{const old=city.buildings.find(b=>b.id===w.id),h=parseFloat(w.tags.height),floors=parseFloat(w.tags['building:levels']);return{id:w.id,name:w.tags.name??old?.name??'',height:Number.isFinite(h)?h:Number.isFinite(floors)?floors*3.3:old?.height??6.6,points:w.points,heightSource:Number.isFinite(h)?'OSM height':Number.isFinite(floors)?'OSM levels x 3.3 m':'existing estimate'};});
const output={source:ref.source,retrieved:ref.retrieved,attribution:ref.attribution,shoreline:ref.shoreline,gates:ref.gates.filter(g=>inside(g.point)),buildings,ponds:ways.filter(w=>w.tags.water==='pond'),barriers:ways.filter(w=>w.tags.barrier),park:ways.find(w=>w.id==='382924778')};
await writeFile(new URL('src/detroit/waterfront-data.json',root),JSON.stringify(output));console.log({buildings:buildings.length,ponds:output.ponds.length,barriers:output.barriers.length});
