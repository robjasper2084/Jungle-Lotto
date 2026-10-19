import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rigModel} from '../heroTestAssets.ts';
import {HeldRepairPack} from './equipment.ts';

test('Blender health pack opens, settles and closes on the shared healing clock',async()=>{
 const asset=await rigModel(new URL('../../../public/exports/polish/royale-equipment/repair-use.glb',import.meta.url));
 assert(asset.animations.some(c=>c.name==='Use_repair'&&Math.abs(c.duration-3)<.05));
 const a=new HeldRepairPack(asset),b=new HeldRepairPack(asset),lid=a.root.getObjectByName('repair_lid')!;
 a.sample(0,180);const rest=lid.quaternion.clone();
 a.sample(75,180);assert(lid.quaternion.angleTo(rest)>.5);
 b.sample(75,180);assert(lid.quaternion.angleTo(b.root.getObjectByName('repair_lid')!.quaternion)<.0001);
 a.sample(180,180);assert(lid.quaternion.angleTo(rest)<.001);
 a.sample(75,180,true);assert(lid.quaternion.angleTo(rest)<.001);
 const bounds=new T.Box3().setFromObject(a.root),size=bounds.getSize(new T.Vector3());
 assert(size.x<.3&&size.y<.3&&size.z<.3,'hand-sized, not a full world pickup');
 a.dispose();b.dispose();
});
