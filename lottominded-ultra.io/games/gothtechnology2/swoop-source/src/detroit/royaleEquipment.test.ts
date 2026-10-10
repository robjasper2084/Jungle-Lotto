import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {EquipmentLibrary,EQUIPMENT_KINDS,WeaponView} from './royale/equipment.ts';

const loader=new GLTFLoader();
const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async k=>{
 const bytes=await readFile(new URL('../../public/exports/polish/royale-equipment/'+k+'.glb',import.meta.url));
 return [k,await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')] as const;
}))));

test('six actual exports have sane dimensions, finite geometry and bounded draw calls',()=>{
 for(const k of EQUIPMENT_KINDS){const v=library.create(k),box=new T.Box3().setFromObject(v.root),size=box.getSize(new T.Vector3());
  assert(size.x>.1&&size.x<.4);assert(size.y>.2&&size.y<.4);assert(size.z>.2&&size.z<.7);
  let draws=0;v.root.traverse(o=>{if(o instanceof T.Mesh){draws++;assert(o.geometry.getAttribute('uv'));for(const n of o.geometry.getAttribute('position').array)assert(Number.isFinite(n));}});assert(draws<=6);v.dispose();
 }
});
test('firing all three models moves the slide, returns to rest and isolates riders',()=>{
 for(const kind of ['static','heart','bass'] as const){const a=library.create(kind),b=library.create(kind),slide=a.root.getObjectByName(kind+'_recoil')!,other=b.root.getObjectByName(kind+'_recoil')!,rest=slide.position.clone();
  assert(a.fire(false));a.update(2/30,false);assert(slide.position.distanceTo(rest)>.04);assert.equal(other.position.distanceTo(rest),0);
  for(let i=0;i<30;i++)a.update(1/30,false);assert(slide.position.distanceTo(rest)<1e-6);a.dispose();b.dispose();
 }
});
test('supplies loop without a seam; reduced motion restores their rest pose',()=>{
 for(const kind of ['ammo','repair','shield'] as const){const a=library.create(kind),lid=a.root.getObjectByName(kind+'_lid')!,rest=lid.position.clone();
  for(let i=0;i<30;i++)a.update(1/30,false);assert(lid.position.distanceTo(rest)>.009);
  for(let i=0;i<30;i++)a.update(1/30,false);assert(lid.position.distanceTo(rest)<1e-5);
  a.update(.1,false);a.update(.1,true);assert(lid.position.distanceTo(rest)<1e-6);a.dispose();
 }
});
test('weapon switching retains one visible model and reduced motion has no recoil/equip motion',()=>{
 const rack=new WeaponView(library);
 for(const kind of ['static','heart','bass','static'] as const){rack.select(kind);rack.update(.03,true);assert.equal(rack.fire(true),false);assert.equal(rack.root.children.filter(c=>c.visible).length,1);assert.equal(rack.root.children.find(c=>c.visible)!.rotation.x,0);assert.deepEqual(rack.root.position.toArray(),[0,0,0]);}
 rack.dispose();
});
