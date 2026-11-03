import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surfaceKind} from './realisticMaterialRules.ts';

test('surface treatment preserves optical surfaces, the readable plate and controllable lights',()=>{
 for(const name of ['Running_Light_Blue','Brake_Light_Red','Michigan_Blue','Plate_White','Cinema_Lens_Coating','Cinema_Monitor_Blue','Conservatory clear panes','Aquarium tank glazing']){
  assert.equal(surfaceKind(name,'',.5),null,name);
 }
});
test('actor details remain distinct from architecture and road finishes',()=>{
 assert.equal(surfaceKind('Material_0','Boerboel'),'fur');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Head'),'skin');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Body'),'cloth');
 assert.equal(surfaceKind('Skin_Grip_Rubber','Camera'),'rubber');
 assert.equal(surfaceKind('Island asphalt','Joined island pavement'),'asphalt');
 assert.equal(surfaceKind('Weathered red brick','Casino'),'brick');
 assert.equal(surfaceKind('PH Bark Brown 02','Nearby maple'),'bark');
});
