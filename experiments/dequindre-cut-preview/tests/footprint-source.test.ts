import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import clipping from 'polygon-clipping';
import {DetroitWorld,heightAt} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import {parkTriangles} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/freestylePark.ts';
import type {StreetCache} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/streetSurfaceCache.ts';
import {SwoopCoverage,inside,type Point} from '../src/terrain.ts';

type MultiPolygon=Point[][][];
const area=(multi:MultiPolygon)=>multi.reduce((sum,polygon)=>sum+polygon.reduce((sum,ring,i)=>sum+(i?-1:1)*Math.abs(ring.slice(1).reduce((a,p,j)=>a+ring[j][0]*p[1]-p[0]*ring[j][1],0))/2,0),0);
const contains=(multi:MultiPolygon,x:number,z:number)=>multi.some(([outer,...holes])=>inside(x,z,outer)&&!holes.some(hole=>inside(x,z,hole)));

test('exact source tiles, Freestyle floor and decoded street cache union without geometry loss',async()=>{
  // This reproduces the real full-scene startup failure without GLB/texture
  // downloads or a renderer. The old projected union failed at Belle
  // [-3366.219092940661,2061.6271446653627]; raw MAP union also failed until
  // redundant closed-tile triangles were removed from the visual union only.
  const world=new DetroitWorld(),coverage=new SwoopCoverage(world.chunks);
  try{
    for(const mesh of world.geoMeshes)if(mesh.collision!==false&&(mesh.kind==='deck'||mesh.kind==='approach'))coverage.addRideTriangles(mesh.geometry.attributes.position.array,mesh.geometry.index?.array,true);
    coverage.addRideTriangles(parkTriangles());
    // Exact one-metre access strip registered by buildFreestylePark.
    const path:number[]=[];
    for(let i=0;i<180;i++){const x=2550+i;for(const triangle of [[[x,-1462],[x,-1468],[x+1,-1462]],[[x+1,-1462],[x,-1468],[x+1,-1468]]])for(const [px,pz]of triangle.reverse())path.push(px,Math.max(0,heightAt(px,pz))+.15,pz);}
    coverage.addRideTriangles(new Float32Array(path));
    const root=new URL('../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/street-life/',import.meta.url);
    const meta=JSON.parse(readFileSync(new URL('street-surfaces-indexed.json',root),'utf8')) as Omit<StreetCache,'positions'|'indices'>;
    assert.equal(meta.version,2);assert.equal(meta.encoding,'meshopt');
    const raw=gunzipSync(readFileSync(new URL('street-surfaces-indexed.bin.gz',root))),decoded=new Uint8Array(meta.values*4);
    await MeshoptDecoder.ready;
    for(const tile of meta.tiles){
      const {offset,count,indexOffset,indexCount,encodedOffset,vertexBytes,indexBytes}=tile;
      MeshoptDecoder.decodeVertexBuffer(decoded.subarray(offset*4,(offset+count)*4),count/3,12,raw.subarray(encodedOffset,encodedOffset!+vertexBytes!));
      MeshoptDecoder.decodeIndexSequence(decoded.subarray(indexOffset!*4,(indexOffset!+indexCount!)*4),indexCount!,4,raw.subarray(encodedOffset!+vertexBytes!,encodedOffset!+vertexBytes!+indexBytes!));
    }
    for(const tile of meta.tiles)if(!['yellow','white','seam'].includes(tile.material))coverage.addRideTriangles(new Float32Array(decoded.buffer,tile.offset*4,tile.count),new Uint32Array(decoded.buffer,tile.indexOffset!*4,tile.indexCount));
    const pieces=coverage.mapFootprintPolygons();
    assert.equal(coverage.cellCount,253);
    assert.ok(pieces.length>8500,'the actual added Freestyle and street triangles remain represented');
    const union=clipping.union(pieces[0],...pieces.slice(1)) as MultiPolygon;
    // 253 complete 100m tiles plus the exact uncovered Freestyle rectangle.
    assert.equal(area(union),2_534_362);assert.equal(union.length,1);
    const bounds=coverage.bounds;let samples=0;
    for(let x=bounds.minX-20.375;x<bounds.maxX+20;x+=37.25)for(let z=bounds.minZ-20.625;z<bounds.maxZ+20;z+=31.75){
      assert.equal(contains(union,x,z),coverage.containsMap(x,z),`mask/physics footprint mismatch at ${x}, ${z}`);samples++;
    }
    assert.ok(samples>5000);
  }finally{for(const mesh of [...world.geoMeshes,...world.buildingMeshes])mesh.geometry.dispose();}
});

test('exact redundant-tile reduction preserves a hole, disjoint floor and uncovered triangle corner',()=>{
  const tiles:{x:number;z:number}[]=[];
  for(let x=0;x<3;x++)for(let z=0;z<3;z++)if(x!==1||z!==1)tiles.push({x:x*100+50,z:z*100+50});
  const coverage=new SwoopCoverage(tiles);
  // A closed-edge triangle is already covered by a full tile; source collision
  // data still retains it. A disjoint triangle must retain its exact contour.
  coverage.addRideTriangles(new Float32Array([0,0,0,0,0,100,100,0,0]));
  coverage.addRideTriangles(new Float32Array([400,0,0,400,0,80,480,0,0]));
  const pieces=coverage.mapFootprintPolygons();assert.equal(pieces.length,9);
  const union=clipping.union(pieces[0],...pieces.slice(1)) as MultiPolygon;
  assert.equal(area(union),83_200);assert.equal(union.length,2);
  assert.ok(contains(union,50,50));assert.equal(contains(union,150,150),false,'central hole remains open');
  assert.equal(contains(union,350,50),false,'disjoint floor is not joined across empty space');
  assert.ok(contains(union,410,10));assert.equal(contains(union,470,70),false,'triangle is not enlarged to its bounding rectangle');
  for(const [x,z]of [[50,50],[150,150],[350,50],[410,10],[470,70]])assert.equal(contains(union,x,z),coverage.containsMap(x,z));
});
