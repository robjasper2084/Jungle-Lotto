import {pathToFileURL} from 'node:url';
import {assetPath} from './testAssets.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {elmTreeSpecies,ELM_TREE_SPECIES} from './elmwoodLibrary.ts';
import {ELM_DEM} from './elmwood-dem.ts';
const assets=pathToFileURL(assetPath('exports/elmwood')+'/');
test('Elmwood detailed and distant assets have finite world bounds and complete triangles',async()=>{
 const files=(await readdir(assets)).filter(p=>p.endsWith('.glb'));assert.equal(files.length,22);
 for(const file of files){const bytes=await readFile(new URL(file,assets)),model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const bounds=new T.Box3().setFromObject(model);assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),file+' bounds');
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;assert.ok(o.matrixWorld.elements.every(Number.isFinite),file+' transform');const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite),file+' vertices');assert.equal(o.geometry.index.count%3,0);});
 }
 const report=JSON.parse(await readFile(new URL('lod-report.json',assets),'utf8'));assert.equal(report.length,5);for(const tree of report)assert.ok(tree.after/tree.before<.32&&tree.after>3000);
});
test('Elmwood uses fine DEM data and five stable botanical variations',()=>{
 assert.equal(ELM_DEM.sourceResolutionMetres,1);assert.equal(ELM_DEM.step,2);assert.ok(ELM_DEM.maxMetres-ELM_DEM.minMetres>12);
 const set=new Set<number>();for(let i=0;i<200;i++){const species=elmTreeSpecies(i,i%2===0);assert.equal(species,elmTreeSpecies(i,i%2===0));set.add(species);}assert.equal(set.size,ELM_TREE_SPECIES.length);
});
