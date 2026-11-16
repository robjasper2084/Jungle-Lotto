import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const sources=JSON.parse(readFileSync(resolve(root,'authoring/environment/bridge-pbr-sources.json'),'utf8'));
test('bridge PBR sources are pinned CC0 authoring-only and avoid live asset API calls',()=>{
 assert.equal(sources.provider,'Poly Haven');
 assert.equal(sources.license,'CC0');
 assert.equal(sources.runtimeNetworkCalls,false);
 assert(sources.materials.length>=2);
 for(const item of sources.materials){
  assert(/^https:\/\/polyhaven\.com\/a\/[a-z0-9_]+$/.test(item.page));
  assert(item.name&&item.slug&&item.maxSizeMiB<=16);
 }
});
test('Blender Python entrypoints parse and use the existing Meshopt runtime',()=>{
 const files=['fetch-belle-pbr.py','blender-belle-environment.py'];
 const check=spawnSync('python3',['-c',
  'import ast,pathlib,sys;[ast.parse(pathlib.Path(x).read_text(encoding="utf8"),filename=x) for x in sys.argv[1:]]',
  ...files.map(file=>resolve(root,'tools',file))],{encoding:'utf8',timeout:20000});
 assert.equal(check.status,0,check.stderr||check.error?.message);
 const blender=readFileSync(resolve(root,'tools/blender-belle-environment.py'),'utf8');
 assert(blender.includes('export_meshopt_compression_enable'));
 assert(!blender.includes("export_draco_mesh_compression_enable']=True"));
 assert(blender.includes('export_apply'));
 assert(blender.includes("render_only"));
 assert(blender.includes("bpy.ops.object.modifier_apply"));
});
