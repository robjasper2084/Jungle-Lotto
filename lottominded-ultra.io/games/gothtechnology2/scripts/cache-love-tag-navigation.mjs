import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
import {TagTerrain} from '../../../../../Digital_Static_RideCore/dist/tag/fixture.js';
import {TagNavigation} from '../../../../../Digital_Static_RideCore/dist/tag/navigation.js';
import {tagSpawnCluster} from '../../../../../Digital_Static_RideCore/dist/tag/spawns.js';
const products=process.argv.slice(2);for(const product of products.length?products:['swoop-detroit','elmwood-explorer']){
 const f=JSON.parse(await readFile('love-tag-server/fixtures/'+product+'.json','utf8'));delete f.navigation;delete f.hash;
 const begin=performance.now(),terrain=await TagTerrain.create(f),graph=new TagNavigation(f,terrain);f.spawns=tagSpawnCluster(f,terrain);f.revision='20261004.full-map.3';f.navigation={nodes:graph.nodes,edges:[...graph.edges].flatMap(([i,edges])=>[...edges].map(([j,w])=>[i,j,w]))};terrain.dispose();
 f.hash=createHash('sha256').update(JSON.stringify(f)).digest('hex');const json=JSON.stringify(f),zip=gzipSync(json);
 for(const dir of ['love-tag-server/fixtures','swoop-source/public/love-tag','../../../../euc-detroit-riverwalk/public/love-tag']){await writeFile(dir+'/'+product+'.json',json);await writeFile(dir+'/'+product+'.json.gz',zip);}
 console.log(JSON.stringify({product,hash:f.hash,nodes:f.navigation.nodes.length,edges:f.navigation.edges.length,bytes:Buffer.byteLength(json),gzip:zip.length,elapsedMs:performance.now()-begin}));
}
