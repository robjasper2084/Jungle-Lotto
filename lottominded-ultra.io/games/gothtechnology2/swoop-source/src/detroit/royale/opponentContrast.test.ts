import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OpponentContrast} from './opponentContrast.ts';

for(const enabled of [false,true])test('late accessory textures survive contrast '+enabled,()=>{
 const source=new T.MeshStandardMaterial({transparent:true,alphaTest:.25});
 const mesh=new T.Mesh(new T.PlaneGeometry(),source),contrast=new OpponentContrast(mesh);
 contrast.set(enabled);
 const copy=mesh.material as T.MeshStandardMaterial,version=copy.version,map=new T.Texture();
 source.map=map;source.alphaTest=.4;source.needsUpdate=true;
 contrast.set(enabled);
 assert.equal(copy.map,map);assert.equal(copy.alphaTest,.4);assert.ok(copy.version>version);
 assert.equal(source.emissive.getHex(),0);
 contrast.set(false);assert.equal(copy.emissive.getHex(),source.emissive.getHex());
 assert.equal(copy.map,map);
 contrast.dispose();assert.equal(mesh.material,source);
 mesh.geometry.dispose();source.dispose();map.dispose();
});

test('shared accessory material has one contrast copy and stable frames do not recompile',()=>{
 const source=new T.MeshStandardMaterial(),root=new T.Group(),a=new T.Mesh(new T.PlaneGeometry(),source),b=new T.Mesh(a.geometry,[source]);
 root.add(a,b);const contrast=new OpponentContrast(root);contrast.set(true);
 const copy=a.material as T.MeshStandardMaterial;
 assert.equal((b.material as T.Material[])[0],copy);
 const version=copy.version;contrast.set(true);assert.equal(copy.version,version);
 contrast.dispose();assert.equal(a.material,source);assert.equal((b.material as T.Material[])[0],source);
 a.geometry.dispose();source.dispose();
});
