import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeElmwoodWeather} from './elmwood-weather.ts';

test('lawn and pavement cannot share a shader; attaching twice preserves grass normals',()=>{
 const weather=makeElmwoodWeather(new T.Scene(),new T.Camera(),new T.DirectionalLight(),new T.HemisphereLight(),{toneMappingExposure:1} as T.WebGLRenderer);
 const map=new T.Texture(),normalMap=new T.Texture(),roughnessMap=new T.Texture();
 const grass=new T.MeshStandardMaterial({name:'grass',map,normalMap,roughnessMap});
 const pavement=new T.MeshStandardMaterial({name:'Reference asphalt',map,normalMap,roughnessMap});
 // These would otherwise receive the same WebGL program for identical defines.
 assert.equal(grass.customProgramCacheKey(),pavement.customProgramCacheKey());
 weather.attach(pavement);weather.attach(grass);
 assert.notEqual(grass.customProgramCacheKey(),pavement.customProgramCacheKey());
 const key=grass.customProgramCacheKey(),normal=grass.normalScale.clone();
 weather.attach(grass);
 assert.equal(grass.customProgramCacheKey(),key);assert.ok(grass.normalScale.equals(normal));
 assert.equal(grass.map,map);assert.equal(grass.roughnessMap,roughnessMap);
});
