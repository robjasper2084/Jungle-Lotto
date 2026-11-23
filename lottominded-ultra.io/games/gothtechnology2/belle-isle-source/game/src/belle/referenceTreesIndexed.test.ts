import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {referenceTree} from './referenceTrees.ts';
import {ReferenceLeafDisplay, applyLeafOutline, rigidLeafGeometry} from './referenceLeafDisplay.ts';

test('rigid leaf cards reproduce every authored vertex and preserve shaded crown cores',()=>{
 for(const id of ['maple','birch','pine','willow'])for(const low of [false,true]){
  const {leaves:source}=referenceTree(id,low,16),count=source.userData.referenceLeafCount;
  const cards=rigidLeafGeometry(source,count);
  const original=source.getAttribute('position'),position=cards.getAttribute('position');
  const uv=source.getAttribute('uv'),point=new T.Vector3(),a=new T.Vector3(),across=new T.Vector3(),along=new T.Vector3(),expected=new T.Vector3();
  assert.equal(cards.index!.count/3,count*2+260);
  for(let i=0;i<count;i++){
   a.fromBufferAttribute(position,i*4);across.fromBufferAttribute(position,i*4+1).sub(a);along.fromBufferAttribute(position,i*4+3).sub(a);
   for(let j=0;j<13;j++){
    const index=i*13+j;
    point.copy(a).addScaledVector(across,(uv.getX(index)+.30)/.60).addScaledVector(along,(uv.getY(index)+.25)/.67);
    assert(point.distanceTo(expected.fromBufferAttribute(original,index))<.00001);
   }
  }
  for(const name of ['position','normal','uv','color']){
   const orig=source.getAttribute(name),card=cards.getAttribute(name);
   assert.deepEqual(card.array.subarray(count*4*card.itemSize),orig.array.subarray(count*13*orig.itemSize));
  }
 }
});

test('canopy selection preserves wind, native multisampling, Smooth distant leaves and authored ray hits',()=>{
 const tree=referenceTree('maple',false,16),mesh=new T.InstancedMesh(tree.leaves,tree.foliage,1);
 mesh.setMatrixAt(0,new T.Matrix4());mesh.updateMatrixWorld();
 const ray=new T.Raycaster(new T.Vector3(0,12,12),new T.Vector3(0,0,-1));
 const expected=ray.intersectObject(mesh).map(hit=>[hit.faceIndex,hit.distance]);
 assert(expected.length>0);
 const near=new ReferenceLeafDisplay(mesh,true);
 assert.equal(mesh.geometry,tree.leaves);
 near.setWind(false);assert.notEqual(mesh.geometry,tree.leaves);
 assert.deepEqual(ray.intersectObject(mesh).map(hit=>[hit.faceIndex,hit.distance]),expected);
 near.setSingleSample(false);assert.equal(mesh.geometry,tree.leaves);
 near.setSingleSample(true);assert.notEqual(mesh.geometry,tree.leaves);
 near.setWind(true);assert.equal(mesh.geometry,tree.leaves);
 const far=referenceTree('pine',true,16),distant=new T.InstancedMesh(far.leaves,far.foliage,1);
 const full=far.leaves.index,display=new ReferenceLeafDisplay(distant,true,far.smoothLeafIndex);
 assert.notEqual(distant.geometry,far.leaves);
 display.setSmooth(true);assert.equal(distant.geometry,far.leaves);assert.equal(distant.geometry.index,far.smoothLeafIndex);
 display.setSmooth(false);assert.notEqual(distant.geometry,far.leaves);assert.equal(far.leaves.index,full);
 const native=new T.InstancedMesh(far.leaves,far.foliage,1),multisample=new ReferenceLeafDisplay(native,false,far.smoothLeafIndex);
 multisample.setSmooth(false);assert.equal(native.geometry,far.leaves);multisample.setSmooth(true);assert.equal(native.geometry.index,far.smoothLeafIndex);
 for(const [material,template] of [[new T.MeshStandardMaterial(),T.ShaderLib.standard],[new T.MeshDepthMaterial(),T.ShaderLib.depth],[new T.MeshDistanceMaterial(),T.ShaderLib.distance]] as const){
  applyLeafOutline(material);
  const shader={vertexShader:template.vertexShader,fragmentShader:template.fragmentShader} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert(shader.vertexShader.includes('referenceLeafUV = uv;'));
  assert(shader.fragmentShader.includes('> referenceLeafWidth(referenceLeafUV.y)) discard;'));
 }
});

type GoldenGeometry={hashes:Record<string,string>;bounds:{box:{min:number[];max:number[]};sphere:{center:number[];radius:number}}};
type GoldenTree={id:string;low:boolean;height:number;trunk:GoldenGeometry;leaves:GoldenGeometry};
/** Captured from the legacy non-indexed generator at
 * 5b69fab28bdac1b1b22da7f008e10dd1e4685a02 (Three 0.185.1).
 * Legacy referenceTrees.ts SHA-256:
 * 0258870e31304993b15d0e62cc921871c8578f6e97afeeee655712d132605624.
 * Each digest covers raw Float32 attribute bytes expanded in triangle order,
 * including the independently deformed icosahedra and their original normals.
 * These constants require no Git history or external fixture at test time. */
const LEGACY:GoldenTree[]=[
 {"id":"maple","low":false,"height":16.0408,"trunk":{"hashes":{"position":"1dc54729c8e212e93eea80ce060301ef03481e5693f5e1d6ccbc7db1c2cac36a","normal":"a7d7aced3adccc5bb7169c0a9f46a15781fb56f37dd1eed2e939e2f44ae61f28","uv":"bd4a3b43075d082ce98e8dbda6187507cd3d72aa274970f151e979fcf5f1f9cf"},"bounds":{"box":{"min":[-2.9755375385284424,-0.0034862349275499582,-2.094440460205078],"max":[2.8120572566986084,14.598069190979004,2.513664960861206]},"sphere":{"center":[-0.08174014091491699,7.297291478025727,0.20961225032806396],"radius":7.316961823132326}}},"leaves":{"hashes":{"position":"ae964f1e439fb7fd25bfbebe38699de15ec8f87f8ef20e8a44c29d6256f21866","normal":"4850e6e6f6047f19edf94eff0f8a7a4d59478403a4d37a95e3f1a1a6026d28ee","uv":"45404cedbedd7a104ed94c1f9c84c60d4a1caf2f0cef401ed4344ff9b52f8f58","color":"d3caf020d8f58deabc6b70bca83d6a3b521dbd8975f851ce16115b7d2741e2cf"},"bounds":{"box":{"min":[-5.991317272186279,6.377312660217285,-5.299772262573242],"max":[6.041440963745117,17.245437622070312,5.916336536407471]},"sphere":{"center":[0.025061845779418945,11.811375141143799,0.30828213691711426],"radius":7.150399111555308}}}},
 {"id":"maple","low":true,"height":16.0408,"trunk":{"hashes":{"position":"c8b598a59fc6222ee832462af3e3ceb25e95e85dc51127efeb80c7801b0a9517","normal":"f6a4ffb36323c7dacbba7686bde5bfe8c8aed7256a0d4e8cff86a553aafabefc","uv":"449bba48d698a01aee4eb08be75b0cc58cccc40419951303e815f71078f240ba"},"bounds":{"box":{"min":[-2.975581407546997,-0.0034008764196187258,-2.092869758605957],"max":[2.8117008209228516,14.59804630279541,2.513664960861206]},"sphere":{"center":[-0.08194029331207275,7.297322713187896,0.2103976011276245],"radius":7.317331074133801}}},"leaves":{"hashes":{"position":"fb14e2909578258b2325f4d7b3872ff4042ec039933c22860869b34a7b28806f","normal":"f088989d53d2cc16a21a0d4358ec4c1f849985e9e2209ce773eedf55ce16cd83","uv":"bc78cf30f28b4fdf1d7a1ddad79233fff0842d1e6d65a001fb63b07c87ca2d32","color":"9b27d6ee1806587524fce520589cb4d61e814e1d33df2377bf4f98249abb306b"},"bounds":{"box":{"min":[-6.101821422576904,6.229463577270508,-5.138852119445801],"max":[6.255073070526123,17.430543899536133,5.809406280517578]},"sphere":{"center":[0.07662582397460938,11.83000373840332,0.33527708053588867],"radius":7.360646115500543}}}},
 {"id":"willow","low":false,"height":16.7428,"trunk":{"hashes":{"position":"4a92e149bd4c0c527044917c704ed7409d03d523f283bb6c7cc586ed2b511b23","normal":"ab627d9f664e3af61429390f4b57721e58fbd4fff47ab167376e6f423a366f09","uv":"bd4a3b43075d082ce98e8dbda6187507cd3d72aa274970f151e979fcf5f1f9cf"},"bounds":{"box":{"min":[-3.2570619583129883,-0.0033398340456187725,-3.0383827686309814],"max":[3.0381600856781006,15.236849784851074,3.2844278812408447]},"sphere":{"center":[-0.10945093631744385,7.616754975402728,0.12302255630493164],"radius":7.632483931653011}}},"leaves":{"hashes":{"position":"1903718fae70e71df968c90bb7f5b49bc6a614bc12c34f884d2063998706b318","normal":"65292ad216ac1b6ad8f3c91719cbd169cf0d3a5181de293ac3c30c33f09c0812","uv":"45404cedbedd7a104ed94c1f9c84c60d4a1caf2f0cef401ed4344ff9b52f8f58","color":"ffc3ea184924dbd6e0c44b29d83d53dbadf3a5f174ed2d754a1b7582d49a4dbb"},"bounds":{"box":{"min":[-6.778810977935791,4.558018684387207,-6.771720886230469],"max":[6.702589988708496,20.498519897460938,6.645051956176758]},"sphere":{"center":[-0.03811049461364746,12.528269290924072,-0.06333446502685547],"radius":9.010953027002689}}}},
 {"id":"willow","low":true,"height":16.7428,"trunk":{"hashes":{"position":"ac761d5cbbebdba2c1aa50388e7efc7acab0247dc782dd2b53a3abd7a9a47a18","normal":"2ebb2a5bf0a287f137acdd197b82eace54e0ee9fa9bd2892ed348f53b92aa007","uv":"449bba48d698a01aee4eb08be75b0cc58cccc40419951303e815f71078f240ba"},"bounds":{"box":{"min":[-3.25714111328125,-0.0032580539118498564,-3.037038803100586],"max":[3.037809371948242,15.236827850341797,3.2844278812408447]},"sphere":{"center":[-0.1096658706665039,7.6167848982149735,0.1236945390701294],"radius":7.632361219671021}}},"leaves":{"hashes":{"position":"5899e70fb4863f14d42c824d95d49989878f4a40a9e375e5a0cd846563b50436","normal":"626abcc6c79cf56bd93c3a3a31d79c5eac32b302397ca03a2a129e055633802b","uv":"bc78cf30f28b4fdf1d7a1ddad79233fff0842d1e6d65a001fb63b07c87ca2d32","color":"6a08218cdf1fcd635c5228944e0a3aebec53d27c62a95d969a67b1d41750cfee"},"bounds":{"box":{"min":[-6.7561750411987305,4.692077159881592,-6.97734260559082],"max":[6.85065221786499,20.560928344726562,6.633134365081787]},"sphere":{"center":[0.04723858833312988,12.626502752304077,-0.1721041202545166],"radius":9.336898724897097}}}},
 {"id":"birch","low":false,"height":18.3402,"trunk":{"hashes":{"position":"53b8fb33858742d491982fc06bdd23796830e4e484feaaf814565b4009034b1f","normal":"ca035a295d300a8ed7f50a743e1c728717f0dcb07c949db3cd9662aab0f140b8","uv":"bd4a3b43075d082ce98e8dbda6187507cd3d72aa274970f151e979fcf5f1f9cf"},"bounds":{"box":{"min":[-1.8777003288269043,-0.0017869663424789906,-2.3008530139923096],"max":[2.4056143760681152,16.6900634765625,2.5747127532958984]},"sphere":{"center":[0.26395702362060547,8.34413825511001,0.13692986965179443],"radius":8.355236691558385}}},"leaves":{"hashes":{"position":"9abc018ed33941d875422c200ea8925353cd2f970928ff94f6ff67e722c1b319","normal":"741045c615be1d7c5af293d85514b2ae5a0b78a02640a5014ca2f275d0e476da","uv":"45404cedbedd7a104ed94c1f9c84c60d4a1caf2f0cef401ed4344ff9b52f8f58","color":"c42127bb09a45f58da495ec180faa0c41741b7387083fec2a80348d3f05652af"},"bounds":{"box":{"min":[-4.62197208404541,8.115118980407715,-5.072105407714844],"max":[5.289152145385742,18.81583023071289,5.502147197723389]},"sphere":{"center":[0.333590030670166,13.465474605560303,0.21502089500427246],"radius":6.473550426224565}}}},
 {"id":"birch","low":true,"height":18.3402,"trunk":{"hashes":{"position":"1c89bb27ad67c3d4c878c09be9c31f87486d8b58927f96d6df173b284db94d1c","normal":"556402389cb108e4c0a8f5dbd9028b91b31bb94f13fa1d4fdc4dc5f5f97912e1","uv":"449bba48d698a01aee4eb08be75b0cc58cccc40419951303e815f71078f240ba"},"bounds":{"box":{"min":[-1.876318097114563,-0.0017432011663913727,-2.2992632389068604],"max":[2.4052155017852783,16.690052032470703,2.5747127532958984]},"sphere":{"center":[0.26444870233535767,8.344154415652156,0.13772475719451904],"radius":8.355564167299798}}},"leaves":{"hashes":{"position":"1c84be1c5d14eb4805bd94fa048d7348bb4b1fa1181703a8b413081d79ef129e","normal":"0a7b108e448f3fea2b6d6308fba8c06b36733f033d235d2e9bf5ecfc96cd9227","uv":"bc78cf30f28b4fdf1d7a1ddad79233fff0842d1e6d65a001fb63b07c87ca2d32","color":"60ce1627a34152709195ffc6d81d3c798fcd1a7fabfed08213fdd8394d7638f7"},"bounds":{"box":{"min":[-4.699148654937744,8.202753067016602,-5.295088768005371],"max":[5.07355260848999,18.538883209228516,5.652721881866455]},"sphere":{"center":[0.18720197677612305,13.370818138122559,0.178816556930542],"radius":6.276921475014177}}}},
 {"id":"pine","low":false,"height":14.641,"trunk":{"hashes":{"position":"b33364951da77bef1c8763b074177641fec7388cd9cb1ee7978b19246997e73e","normal":"633d540e055dfde0c28e9be7589779faa4c93cf1e628c0e0b1fca2cac28f6bd4","uv":"bd4a3b43075d082ce98e8dbda6187507cd3d72aa274970f151e979fcf5f1f9cf"},"bounds":{"box":{"min":[-2.129210948944092,-0.0038193529471755028,-2.539177417755127],"max":[2.9361813068389893,13.3243408203125,1.8751156330108643]},"sphere":{"center":[0.40348517894744873,6.660260733682662,-0.33203089237213135],"radius":6.7065965533049825}}},"leaves":{"hashes":{"position":"d1463d71bf31b60480f64fac5dc8ce8198b071dbf5ee08c23e4d3236bdd3aea7","normal":"7ec557d9ac771782c8ebbb73891cd97bf25c8ad720fa8493452ffff10c5bae97","uv":"45404cedbedd7a104ed94c1f9c84c60d4a1caf2f0cef401ed4344ff9b52f8f58","color":"39770f20d2edfb2d91dd917c9ac4af9f8aac726436bced2b26fa0489a84140c0"},"bounds":{"box":{"min":[-4.515574932098389,2.1352460384368896,-4.65028715133667],"max":[4.9160566329956055,15.014127731323242,4.213608264923096]},"sphere":{"center":[0.2002408504486084,8.574686884880066,-0.2183394432067871],"radius":7.3086548944492895}}}},
 {"id":"pine","low":true,"height":14.641,"trunk":{"hashes":{"position":"53e69b87084d64443bc43924b266966fbc3ece375c93c50d8aeed1f951cee77e","normal":"f9f138de667625084f0b471765cfac1b619e646d06aed554f217e4f15322c197","uv":"449bba48d698a01aee4eb08be75b0cc58cccc40419951303e815f71078f240ba"},"bounds":{"box":{"min":[-2.1293153762817383,-0.0037258348893374205,-2.5381860733032227],"max":[2.935985803604126,13.324316024780273,1.8751156330108643]},"sphere":{"center":[0.40333521366119385,6.660295094945468,-0.3315352201461792],"radius":6.704362802404485}}},"leaves":{"hashes":{"position":"adef919ea45c77eb0a89288cd8493b679ef6b6b2b09f6bf1cfd7bc17295493ee","normal":"b7d44d4c7386430f3a20d5a81094345f9e70922c24724f2ad7f12ad6371ff293","uv":"bc78cf30f28b4fdf1d7a1ddad79233fff0842d1e6d65a001fb63b07c87ca2d32","color":"38db9afcc67403c7c28f4f0b291ff84b8a8aba2b5a43b4e2c3674e6589f04145"},"bounds":{"box":{"min":[-4.799376964569092,1.9880985021591187,-4.439345836639404],"max":[4.937509059906006,15.219029426574707,3.899808645248413]},"sphere":{"center":[0.06906604766845703,8.603563964366913,-0.2697685956954956],"radius":7.424582034836064}}}}
];
const TRUNK_INDICES={near:'91373b28d3730d61859460fe8c2481792de913ea98330a9d30d83c863988e83f',far:'1889515457e1931ffda12242f68ec500eb801f9350721e96dc777f75888b3e9f'};
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
test('Smooth distant canopy keeps all leaf placements and the exact shaded core',()=>{
 const tree=referenceTree('maple',true,16),simple=tree.smoothLeafIndex!,full=tree.leaves.getIndex()!;
 assert.equal(simple.count,700*6+13*60);
 for(let i=0;i<700;i++)assert.deepEqual([...simple.array.slice(i*6,i*6+6)].map(n=>n-i*13),[0,9,6,0,6,3]);
 assert.deepEqual(simple.array.slice(700*6),full.array.slice(700*33));
 tree.trunk.dispose();tree.leaves.dispose();tree.bark.dispose();tree.foliage.dispose();
});
function expandedHash(geometry:T.BufferGeometry,name:string){
 const attribute=geometry.getAttribute(name),index=geometry.getIndex();
 assert(attribute instanceof T.BufferAttribute);assert(attribute.array instanceof Float32Array);assert(index);
 assert.equal(attribute.normalized,false);
 assert.equal(attribute.itemSize,name==='uv'?2:3);
 const source=Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength),stride=attribute.itemSize*4;
 const expanded=Buffer.alloc(index.count*stride);
 for(let i=0;i<index.count;i++){const offset=index.getX(i)*stride;source.copy(expanded,i*stride,offset,offset+stride);}
 return digest(expanded);
}

test('legacy fixtures cover all actual manifest species and both tree detail levels',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/manifest.json',import.meta.url),'utf8')) as {trees:{id:string;cardCenter:number[]}[]};
 const expected=manifest.trees.flatMap(entry=>[false,true].map(low=>({id:entry.id,low,height:entry.cardCenter[1]*2})));
 assert.deepEqual(LEGACY.map(({id,low,height})=>({id,low,height})),expected);
});

for(const golden of LEGACY)test(`indexed ${golden.id} ${golden.low?'far':'near'} preserves legacy triangle bytes and bounds`,()=>{
 const tree=referenceTree(golden.id,golden.low,golden.height);
 try{
  for(const part of ['trunk','leaves'] as const){
   const geometry=tree[part],expected=golden[part],index=geometry.getIndex(),position=geometry.getAttribute('position');
   const vertices=part==='trunk'?(golden.low?442:598):(golden.low?9880:24180),triangles=part==='trunk'?(golden.low?260:364):(golden.low?7960:20060);
   assert(index);assert(index.array instanceof Uint16Array);
   assert.equal(position.count,vertices);assert.equal(index.count,triangles*3);
   assert.equal(new Set(index.array).size,vertices,'every stored vertex is referenced');
   for(const vertex of index.array)assert(vertex>=0&&vertex<vertices,'index remains in bounds');
   assert.deepEqual(Object.keys(geometry.attributes).sort(),Object.keys(expected.hashes).sort());
   for(const [name,hash]of Object.entries(expected.hashes))assert.equal(expandedHash(geometry,name),hash,part+'/'+name+' retains exact triangle order and attributes');
   assert.deepEqual(geometry.groups,[]);assert.deepEqual(geometry.drawRange,{start:0,count:Infinity});
   assert.deepEqual(geometry.morphAttributes,{});assert.equal(geometry.morphTargetsRelative,false);
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   assert.deepEqual({box:{min:geometry.boundingBox!.min.toArray(),max:geometry.boundingBox!.max.toArray()},sphere:{center:geometry.boundingSphere!.center.toArray(),radius:geometry.boundingSphere!.radius}},expected.bounds);
   if(part==='trunk')assert.equal(digest(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength)),TRUNK_INDICES[golden.low?'far':'near']);
   else{
    const leaves=golden.low?700:1800;
    // Keep all 13 x 60 independently deformed core vertices; do not weld them
    // or move indexing before the original flat-normal calculation.
    for(let i=0;i<13*60;i++)assert.equal(index.getX(leaves*33+i),leaves*13+i);
    const totalBytes=index.array.byteLength+Object.values(geometry.attributes).reduce((sum,attribute)=>sum+(attribute as T.BufferAttribute).array.byteLength,0);
    assert.equal(totalBytes,golden.low?482480:1184280);
   }
  }
 }finally{tree.trunk.dispose();tree.leaves.dispose();tree.bark.dispose();tree.foliage.dispose();}
});
