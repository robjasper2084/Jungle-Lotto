import R from '@dimforge/rapier3d-compat';
type Row={handle:number;p:R.Vector;r:R.Rotation;groups:number;solver:number;enabled:boolean;sensor:boolean;friction:number;restitution:number;frictionRule:number;restitutionRule:number;skin:number;active:number;shape:{kind:'box';half:R.Vector}|{kind:'mesh';vertices:[number,number];indices:[number,number];flags:number}};
/** Lossless geometry transport. Rapier's serialized BVHs are rebuilt locally,
 * avoiding a large download of redundant acceleration structures. */
export function encodeColliderTransport(world:R.World){
 const rows:Row[]=[],arrays:Uint8Array[]=[];let size=0;
 const append=(array:Float32Array|Uint32Array):[number,number]=>{const result:[number,number]=[size,array.length];arrays.push(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));size+=array.byteLength;return result;};
 world.forEachCollider(c=>{if(c.parent()&&!c.parent()!.isFixed())throw Error('Static map transport cannot include moving bodies');const s=c.shape;
  if(s.type!==R.ShapeType.Cuboid&&s.type!==R.ShapeType.TriMesh)throw Error('Unsupported static collider '+s.type);
  const shape:Row['shape']=s.type===R.ShapeType.Cuboid?{kind:'box',half:(s as R.Cuboid).halfExtents}:{kind:'mesh',vertices:append((s as R.TriMesh).vertices),indices:append((s as R.TriMesh).indices),flags:(s as R.TriMesh).flags};
  rows.push({handle:c.handle,p:c.translation(),r:c.rotation(),groups:c.collisionGroups(),solver:c.solverGroups(),enabled:c.isEnabled(),sensor:c.isSensor(),friction:c.friction(),restitution:c.restitution(),frictionRule:c.frictionCombineRule(),restitutionRule:c.restitutionCombineRule(),skin:c.contactSkin(),active:c.activeCollisionTypes(),shape});
 });
 const json=new TextEncoder().encode(JSON.stringify({version:1,gravity:world.gravity,rows})),offset=8+Math.ceil(json.length/4)*4,bytes=new Uint8Array(offset+size),view=new DataView(bytes.buffer);view.setUint32(0,0x31435344,true);view.setUint32(4,json.length,true);bytes.set(json,8);let cursor=offset;for(const array of arrays){bytes.set(array,cursor);cursor+=array.length;}return bytes;
}
export async function restoreColliderTransport(bytes:Uint8Array){
 if(bytes.byteLength<8)throw Error('Truncated collision geometry');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(4,true);
 if(view.getUint32(0,true)!==0x31435344||length>8_000_000||length+8>bytes.length)throw Error('Invalid collision geometry');
 const header=JSON.parse(new TextDecoder().decode(bytes.subarray(8,8+length))) as {version:number;gravity:R.Vector;rows:Row[]},offset=8+Math.ceil(length/4)*4;
 if(header.version!==1||!Array.isArray(header.rows)||header.rows.length>10000)throw Error('Invalid collision table');
 const world=new R.World(header.gravity),handles=new Map<number,number>();let deadline=performance.now()+6;
 const region=(pair:[number,number],stride=1)=>{if(!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isSafeInteger(n)||n<0)||pair[0]%4||pair[1]%stride||offset+pair[0]+pair[1]*4>bytes.length)throw Error('Invalid collision buffer');return bytes.byteOffset+offset+pair[0];};
 try{for(const row of header.rows){
  if(![row.p.x,row.p.y,row.p.z,row.r.x,row.r.y,row.r.z,row.r.w,row.friction,row.restitution,row.skin].every(Number.isFinite))throw Error('Invalid collider values');
  let shape:R.Shape;
  if(row.shape.kind==='box'){if(!Object.values(row.shape.half).every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid box');shape=new R.Cuboid(row.shape.half.x,row.shape.half.y,row.shape.half.z);}
  else if(row.shape.kind==='mesh'){const s=row.shape,vertices=new Float32Array(bytes.buffer,region(s.vertices,3),s.vertices[1]),indices=new Uint32Array(bytes.buffer,region(s.indices,3),s.indices[1]);shape=new R.TriMesh(vertices,indices,s.flags);}
  else throw Error('Invalid collider type');
  const desc=new R.ColliderDesc(shape).setTranslation(row.p.x,row.p.y,row.p.z).setRotation(row.r).setCollisionGroups(row.groups).setSolverGroups(row.solver).setEnabled(row.enabled).setSensor(row.sensor).setFriction(row.friction).setRestitution(row.restitution).setFrictionCombineRule(row.frictionRule).setRestitutionCombineRule(row.restitutionRule).setContactSkin(row.skin).setActiveCollisionTypes(row.active);
  handles.set(row.handle,world.createCollider(desc).handle);
  if(performance.now()>deadline){await new Promise<void>(resolve=>setTimeout(resolve,0));deadline=performance.now()+6;}
 }
 world.step();return {world,handles};
 }catch(error){world.free();throw error;}
}
