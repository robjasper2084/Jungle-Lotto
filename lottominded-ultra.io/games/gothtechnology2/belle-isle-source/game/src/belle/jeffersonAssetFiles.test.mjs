import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix3,Matrix4,Quaternion,Vector3} from 'three';
import polygonClipping from 'polygon-clipping';
import {fitStreetBuilding} from './detroitAssets.ts';
import {JEFFERSON_BUILDING_PLACEMENTS,JEFFERSON_BUILDING_SOURCE_AUDIT,JEFFERSON_CAMERA_TARGETS,JEFFERSON_PROP_PLACEMENTS} from './jeffersonPlacements.ts';

// Parse the shipped files directly. GLTFLoader would require browser image
// APIs, and a fixture would not detect a stale, malformed, or oversized export.
function readGlb(relative){
  const assetUrl=new URL(relative,import.meta.url),bytes=fs.readFileSync(assetUrl);
  assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB magic');
  assert.equal(bytes.readUInt32LE(4),2,'GLB version');
  assert.equal(bytes.readUInt32LE(8),bytes.length,'complete GLB length');
  let json,bin,offset=12;
  while(offset<bytes.length){
    assert.ok(offset+8<=bytes.length,'complete chunk header');
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
    assert.equal(length%4,0,'aligned GLB chunk');
    offset+=8;assert.ok(offset+length<=bytes.length,'complete GLB chunk');
    const chunk=bytes.subarray(offset,offset+length);offset+=length;
    if(type===0x4e4f534a){assert.equal(json,undefined,'one JSON chunk');json=JSON.parse(chunk.toString('utf8'));}
    else if(type===0x004e4942){assert.equal(bin,undefined,'one BIN chunk');bin=chunk;}
    else assert.fail(`Unexpected GLB chunk ${type}`);
  }
  assert.equal(offset,bytes.length);
  assert.ok(json&&bin,'embedded GLB JSON and BIN');
  assert.equal(json.asset.version,'2.0');
  assert.equal(json.buffers.length,1,'one self-contained binary buffer');
  assert.equal(json.buffers[0].uri,undefined,'no external binary dependency');
  assert.ok(json.buffers[0].byteLength<=bin.length&&bin.length-json.buffers[0].byteLength<4);
  assert.deepEqual(json.extensionsRequired??[],[],'no undeclared decoding dependency');
  const cache=new Map();
  function accessor(index){
    if(cache.has(index))return cache.get(index);
    const a=json.accessors[index];assert.ok(a,`accessor ${index} exists`);
    assert.equal(a.sparse,undefined,'static dense accessor');
    assert.equal(a.normalized??false,false,'unquantized authored attributes');
    const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const component={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
    assert.ok(width&&component,'supported accessor format');
    const view=json.bufferViews[a.bufferView];assert.ok(view,'accessor buffer view exists');
    assert.equal(view.buffer,0);assert.equal(view.extensions,undefined,'uncompressed buffer view');
    const [size,read]=component,stride=view.byteStride??width*size,start=(view.byteOffset??0)+(a.byteOffset??0);
    assert.ok(Number.isInteger(a.count)&&a.count>0,'nonempty accessor');
    assert.ok(stride>=width*size&&stride%size===0,'valid accessor stride');
    assert.ok((a.byteOffset??0)+(a.count-1)*stride+width*size<=view.byteLength,'accessor stays in view');
    assert.ok((view.byteOffset??0)+view.byteLength<=json.buffers[0].byteLength,'view stays in buffer');
    const values=Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>bin[read](start+i*stride+j*size)));
    for(const tuple of values)for(const value of tuple)assert.ok(Number.isFinite(value),'finite accessor component');
    cache.set(index,values);return values;
  }
  return {json,bin,accessor,bytes,assetUrl};
}

const assetDirectory=new URL('../../public/belle/jefferson/',import.meta.url);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const approvedSourceHashes={
  'models/Jefferson_Assigned_Buildings.glb':'b9c930f5b6b5edde03e2d93511b26bb7d4d266133800e9f78eeccd04d8f5e2cf',
  'models/Jefferson_Assigned_Street.glb':'0986558a3e0fc15ffad4835efae399c52ccd022ae9455791572723dc8af48207',
};

function verifyRuntimePackaging(packs){
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',assetDirectory),'utf8'));
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.format,'glb-external-png-lossless-v1');
  assert.equal(manifest.textureUriPattern,'../textures/<sha256>.png');
  assert.deepEqual(manifest.models.map(model=>model.file).sort(),Object.keys(approvedSourceHashes).sort());
  const listed=new Map();
  for(const texture of manifest.textures){
    assert.match(texture.sha256,/^[a-f0-9]{64}$/);
    assert.equal(texture.file,`textures/${texture.sha256}.png`,'manifest permits only content-addressed local PNGs');
    assert.ok(!listed.has(texture.file),'unique manifest texture');listed.set(texture.file,texture);
  }
  const used=new Set(),imageBytes=new Map();
  for(const pack of packs){
    assert.ok(pack.assetUrl.href.startsWith(assetDirectory.href));
    const file=pack.assetUrl.href.slice(assetDirectory.href.length);
    const models=manifest.models.filter(model=>model.file===file);assert.equal(models.length,1);
    const model=models[0];
    assert.equal(model.sourceFile,file.slice('models/'.length));
    assert.equal(model.sourceSha256,approvedSourceHashes[file],'approved embedded source identity');
    assert.equal(model.runtimeSha256,sha256(pack.bytes),'runtime file matches lossless repack manifest');
    assert.equal(model.runtimeBytes,pack.bytes.length);assert.ok(model.sourceBytes>model.runtimeBytes);
    assert.equal(model.bufferViews.length,pack.json.bufferViews.length,'every retained source view is proven');
    const sourceViews=new Set(),runtimeViews=new Set();
    for(const proof of model.bufferViews){
      assert.ok(Number.isInteger(proof.sourceIndex)&&proof.sourceIndex>=0&&!sourceViews.has(proof.sourceIndex));sourceViews.add(proof.sourceIndex);
      assert.ok(Number.isInteger(proof.runtimeIndex)&&!runtimeViews.has(proof.runtimeIndex));runtimeViews.add(proof.runtimeIndex);
      const view=pack.json.bufferViews[proof.runtimeIndex];assert.ok(view);assert.equal(view.buffer,0);
      assert.equal(view.byteLength,proof.byteLength);
      const start=view.byteOffset??0;assert.ok(start+view.byteLength<=pack.json.buffers[0].byteLength);
      assert.equal(sha256(pack.bin.subarray(start,start+view.byteLength)),proof.sha256,'retained geometry bytes match the embedded source proof');
    }
    assert.equal(model.images.length,pack.json.images.length,'every original source image has a runtime mapping');
    const imageIndices=new Set();
    for(const proof of model.images){
      assert.ok(Number.isInteger(proof.imageIndex)&&!imageIndices.has(proof.imageIndex));imageIndices.add(proof.imageIndex);
      assert.ok(Number.isInteger(proof.sourceBufferView)&&proof.sourceBufferView>=0);
      assert.ok(Number.isInteger(proof.sourceByteOffset)&&proof.sourceByteOffset>=0&&proof.sourceByteOffset+proof.byteLength<=model.sourceBytes);
      assert.ok(!sourceViews.has(proof.sourceBufferView),'external PNG is not duplicated in geometry BIN');
      const image=pack.json.images[proof.imageIndex];assert.ok(image);
      assert.equal(image.bufferView,undefined,'runtime image is externalized');
      assert.match(image.uri,/^\.\.\/textures\/[a-f0-9]{64}\.png$/,'only the fixed relative texture path is allowed');
      assert.equal(image.uri,`../textures/${proof.sha256}.png`);assert.equal(image.uri,proof.uri);
      assert.equal(image.name,proof.name);assert.equal(image.mimeType??'image/png',proof.mimeType);assert.equal(proof.mimeType,'image/png');
      const textureFile=`textures/${proof.sha256}.png`,texture=listed.get(textureFile);assert.ok(texture,'image is explicitly listed in manifest');used.add(textureFile);
      assert.equal(texture.sha256,proof.sha256);assert.equal(texture.bytes,proof.byteLength);
      assert.equal(texture.width,proof.width);assert.equal(texture.height,proof.height);assert.equal(texture.mimeType,'image/png');
      const url=new URL(image.uri,pack.assetUrl),expected=new URL(textureFile,assetDirectory);
      assert.equal(url.href,expected.href,'image resolves only inside the Jefferson textures directory');
      if(!imageBytes.has(textureFile)){
        assert.ok(fs.lstatSync(url).isFile(),'texture is a regular file, not a symlink');
        const png=fs.readFileSync(url);assert.equal(png.length,texture.bytes);assert.equal(sha256(png),texture.sha256,'exact original PNG bytes');
        assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'real PNG signature');
        assert.equal(png.subarray(12,16).toString(),'IHDR');
        const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
        assert.equal(width,texture.width);assert.equal(height,texture.height);
        assert.ok(width>0&&width<=1024&&height>0&&height<=1024,'runtime PNG dimensions preserve the texture budget');
        imageBytes.set(textureFile,png);
      }
    }
  }
  assert.deepEqual([...used].sort(),[...listed.keys()].sort(),'manifest contains exactly the referenced texture files');
  return {models:packs.length,textures:used.size,textureBytes:[...imageBytes.values()].reduce((sum,png)=>sum+png.length,0)};
}

function meshEntries(pack,rootIndex){
  const result=[],visited=new Set();
  function walk(index,parent){
    assert.ok(!visited.has(index),'acyclic, uniquely parented selected subtree');visited.add(index);
    const node=pack.json.nodes[index];assert.ok(node,'scene node exists');
    assert.equal(node.skin,undefined,'static mesh node');assert.equal(node.weights,undefined,'no node morph weights');
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(
      new Vector3().fromArray(node.translation??[0,0,0]),
      new Quaternion().fromArray(node.rotation??[0,0,0,1]),
      new Vector3().fromArray(node.scale??[1,1,1]),
    );
    assert.ok(local.elements.every(Number.isFinite),'finite authored transform');
    const world=new Matrix4().multiplyMatrices(parent,local);
    if(node.mesh!==undefined){
      const mesh=pack.json.meshes[node.mesh];assert.ok(mesh,'mesh exists');
      assert.equal(mesh.weights,undefined,'no mesh morph weights');
      for(const primitive of mesh.primitives){
        assert.equal(primitive.mode??4,4,'triangle primitives');
        assert.equal(primitive.targets,undefined,'no morph targets');
        assert.equal(primitive.extensions,undefined,'no compressed primitive dependency');
        result.push({node,meshIndex:node.mesh,primitive,world});
      }
    }
    for(const child of node.children??[])walk(child,world);
  }
  walk(rootIndex,new Matrix4());return {entries:result,visited};
}

function ringArea(ring){
  // Translate before accumulating to keep tiny edge overshoots measurable at
  // world coordinates near x=-2000, without cancellation of large products.
  const [ox,oz]=ring[0];let area=0;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    area+=(a[0]-ox)*(b[1]-oz)-(b[0]-ox)*(a[1]-oz);
  }
  return Math.abs(area)*.5;
}
function polygonArea(multi){
  return multi.reduce((total,polygon)=>total+ringArea(polygon[0])-polygon.slice(1).reduce((holes,ring)=>holes+ringArea(ring),0),0);
}
function insideOrOnEdge(x,z,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    // Float32 export roundoff only; much tighter than the runtime's 2 cm guard.
    if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=1e-5)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function triangleIndices(pack,primitive,vertexCount){
  const indices=primitive.indices===undefined?Array.from({length:vertexCount},(_,i)=>i):pack.accessor(primitive.indices).map(tuple=>{
    assert.equal(tuple.length,1,'scalar indices');return tuple[0];
  });
  assert.equal(indices.length%3,0,'complete triangles');
  for(const i of indices)assert.ok(Number.isInteger(i)&&i>=0&&i<vertexCount,'in-range triangle index');
  return indices;
}

const pack=readGlb('../../public/belle/jefferson/models/Jefferson_Assigned_Buildings.glb');
const streetPack=readGlb('../../public/belle/jefferson/models/Jefferson_Assigned_Street.glb');
const districts=JSON.parse(fs.readFileSync(new URL('./detroitDistricts.json',import.meta.url),'utf8'));
const selections=JEFFERSON_BUILDING_PLACEMENTS.map(assignment=>{
  const buildings=districts.buildings.filter(b=>b.id===assignment.buildingId);
  assert.equal(buildings.length,1,'one source building per allowlisted ID');
  const building=buildings[0],fit=fitStreetBuilding(building);assert.ok(fit,'source building has an existing fit');
  const matches=pack.json.nodes.map((node,index)=>({node,index})).filter(value=>value.node.name===assignment.prototype);
  assert.equal(matches.length,1,`one actual ${assignment.prototype} root`);
  return {assignment,building,fit,...matches[0],...meshEntries(pack,matches[0].index)};
});

test('lossless runtime packaging proves geometry and PNG bytes and permits only manifest-listed local texture paths',t=>{
  const result=verifyRuntimePackaging([pack,streetPack]);
  t.diagnostic(`Checked ${result.models} runtime models and ${result.textures} exact source PNGs (${result.textureBytes} bytes)`);
});

test('shipped assigned roots match the exact allowlist, current map fits, and audit polygons',()=>{
  assert.deepEqual(JEFFERSON_BUILDING_PLACEMENTS.map(p=>[p.buildingId,p.prototype]),[
    ['detroit-38139','JEF_detroit_38139'],['886253052','JEF_886253052'],
  ]);
  assert.deepEqual([...pack.json.scenes[pack.json.scene??0].nodes].sort((a,b)=>a-b),selections.map(s=>s.index).sort((a,b)=>a-b));
  assert.deepEqual(pack.json.animations??[],[],'static scenery has no animations');
  const allNodes=new Set(),allMeshes=new Set();
  for(const selection of selections){
    const {assignment,building,fit,node,visited,entries}=selection;
    assert.equal(assignment.yawOffset,0,'adapted mesh uses its authored original yaw');
    const {id,...expectedFit}=fit;
    assert.equal(node.extras.jeffersonBuildingId,id);
    assert.deepEqual(node.extras.jeffersonFit,expectedFit,'GLB metadata matches actual fitStreetBuilding');
    assert.equal(node.extras.jeffersonSourcePrototype,assignment.sourcePrototype);
    assert.deepEqual(node.extras.jeffersonAnchorPoint,building.points[0]);
    assert.equal(node.extras.jeffersonBaseOffset,0,'same base as the existing collider');
    assert.equal(node.extras.collision,'visual_only_existing_physics_unchanged');
    const audit=JEFFERSON_BUILDING_SOURCE_AUDIT.filter(a=>a.buildingId===id);assert.equal(audit.length,1);
    assert.deepEqual(audit[0].fit,expectedFit,'placement audit fit is current');
    assert.deepEqual(audit[0].originalPoints,building.points,'placement audit polygon is current');
    for(const index of visited){assert.ok(!allNodes.has(index),'separate selected subtrees');allNodes.add(index);}
    for(const entry of entries)allMeshes.add(entry.meshIndex);
  }
  assert.equal(allNodes.size,pack.json.nodes.length,'no additional unselected scene nodes');
  assert.equal(allMeshes.size,pack.json.meshes.length,'no unused building meshes in the delivered pack');
});

test('actual exported vertices and complete triangles remain within the original building volumes',t=>{
  for(const {assignment,building,fit,entries} of selections){
    const fitMatrix=new Matrix4().makeRotationY(fit.yaw).scale(new Vector3(fit.w,fit.h,fit.d));
    fitMatrix.setPosition(fit.x,0,fit.z);
    const footprint=building.points.map(([x,z])=>[x-fit.x,z-fit.z]);
    let minY=Infinity,maxY=-Infinity,outsideArea=0,triangles=0,vertices=0,projectedTriangles=0;
    for(const {primitive,world} of entries){
      const positions=pack.accessor(primitive.attributes.POSITION);
      assert.equal(pack.json.accessors[primitive.attributes.POSITION].type,'VEC3');
      assert.equal(pack.json.accessors[primitive.attributes.POSITION].componentType,5126);
      const combined=new Matrix4().multiplyMatrices(fitMatrix,world);
      const transformed=positions.map(tuple=>new Vector3().fromArray(tuple).applyMatrix4(combined));
      for(const p of transformed){
        assert.ok([p.x,p.y,p.z].every(Number.isFinite),'finite transformed position');
        assert.ok(p.y>=-1e-5&&p.y<=fit.h+1e-5,`${assignment.buildingId} vertex exceeds existing height`);
        assert.ok(insideOrOnEdge(p.x,p.z,building.points),`${assignment.buildingId} vertex outside source polygon: ${p.x}, ${p.z}`);
        minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);vertices++;
      }
      const indices=triangleIndices(pack,primitive,positions.length);triangles+=indices.length/3;
      for(let i=0;i<indices.length;i+=3){
        const ring=indices.slice(i,i+3).map(index=>[transformed[index].x-fit.x,transformed[index].z-fit.z]);
        if(ringArea(ring)<=1e-12)continue; // Vertical/degenerate XZ projections have zero footprint area.
        ring.push(ring[0]);projectedTriangles++;
        outsideArea+=polygonArea(polygonClipping.difference([ring],[footprint]));
      }
    }
    assert.ok(vertices>0&&triangles>0&&projectedTriangles>0,'nonempty building geometry');
    assert.ok(Math.abs(minY)<=1e-5,'base remains at original ground');
    assert.ok(Math.abs(maxY-fit.h)<=1e-5,'roof extent preserves original map height');
    assert.ok(outsideArea<=1e-6,`${assignment.buildingId} projected triangle area outside footprint: ${outsideArea} m²`);
    t.diagnostic(`${assignment.buildingId}: ${vertices} vertices, ${triangles} triangles, outside projected area ${outsideArea} m²`);
  }
});

test('shipped building surfaces preserve opaque PBR, finite UVs, and the draw/triangle budget',t=>{
  let triangles=0,batches=0;
  const materials=new Set();
  for(const {entries} of selections)for(const {primitive} of entries){
    const positions=pack.accessor(primitive.attributes.POSITION);
    const normals=pack.accessor(primitive.attributes.NORMAL),uv=pack.accessor(primitive.attributes.TEXCOORD_0);
    assert.equal(pack.json.accessors[primitive.attributes.NORMAL].type,'VEC3');
    assert.equal(pack.json.accessors[primitive.attributes.TEXCOORD_0].type,'VEC2');
    assert.equal(normals.length,positions.length,'one normal per vertex');
    assert.equal(uv.length,positions.length,'one UV per vertex');
    for(const normal of normals)assert.ok(Math.abs(Math.hypot(...normal)-1)<.01,'usable unit normal');
    triangles+=triangleIndices(pack,primitive,positions.length).length/3;batches++;
    assert.ok(Number.isInteger(primitive.material),'explicit authored PBR material');materials.add(primitive.material);
  }
  assert.ok(batches>0&&batches<=17,`material batches ${batches} exceed 17`);
  assert.ok(triangles>0&&triangles<=14000,`triangles ${triangles} exceed 14000`);
  for(const name of ['JEF_RedBrick','JEF_BuffLimestone','JEF_CastConcrete','JEF_PaintedMetal']){
    const matches=[...materials].map(index=>pack.json.materials[index]).filter(material=>material.name===name);
    assert.equal(matches.length,1,`one used ${name} material`);
    assert.ok(matches[0].pbrMetallicRoughness.baseColorTexture,`${name} keeps its authored albedo`);
    assert.ok(matches[0].pbrMetallicRoughness.metallicRoughnessTexture,`${name} keeps its authored ORM response`);
    assert.ok(matches[0].normalTexture,`${name} keeps its authored normal map`);
  }
  for(const index of materials){
    const material=pack.json.materials[index];assert.ok(material,'material exists');
    assert.equal(material.alphaMode??'OPAQUE','OPAQUE','no transparent rendering path');
    assert.equal(material.extensions?.KHR_materials_unlit,undefined,'lit PBR material');
    const pbr=material.pbrMetallicRoughness;assert.ok(pbr,'metallic/roughness PBR definition');
    const color=pbr.baseColorFactor??[1,1,1,1];
    assert.equal(color.length,4);assert.equal(color[3],1,'opaque base color');
    for(const n of [...color,pbr.metallicFactor??1,pbr.roughnessFactor??1])assert.ok(Number.isFinite(n)&&n>=0&&n<=1,'valid PBR factor');
    for(const texture of [pbr.baseColorTexture,pbr.metallicRoughnessTexture,material.normalTexture,material.occlusionTexture].filter(Boolean)){
      assert.equal(texture.texCoord??0,0,'authored UV0 texture binding');
      assert.ok(pack.json.textures[texture.index],'referenced texture exists');
    }
  }
  for(const texture of pack.json.textures??[]){
    assert.ok(pack.json.images[texture.source],'texture resolves to its checked image manifest entry');
  }
  t.diagnostic(`Assigned buildings: ${batches} material batches, ${triangles} triangles, ${materials.size} opaque PBR materials`);
});

test('shipped sign relief has separated fascia and wall surfaces and outward visible glyph caps',t=>{
  // These metre limits come from the repaired export's independently measured
  // 18.724/19.420 mm front gap, 10 mm depth and 5.771/10.285 mm wall gap.
  // Validate the shipped triangles, not exporter metadata or a render fixture.
  const minimumFrontGap=.018,minimumDepth=.0095,minimumBackGap=.008,minimumWallGap=.005;
  const roundoff=1e-5; // Float32 position roundoff, not a visual-clearance allowance.
  for(const selection of selections){
    const {assignment,fit,entries}=selection,workshop=assignment.buildingId==='detroit-38139';
    const glyphMaterial=workshop?'JEF_StaticGold':'JEF_LetteringIvory';
    const glyphs=[],metal=[],brick=[];
    for(const {primitive,world} of entries){
      const name=pack.json.materials[primitive.material].name;
      const target=name===glyphMaterial?glyphs:name==='JEF_PaintedMetal'?metal:name==='JEF_RedBrick'?brick:null;
      if(!target)continue;
      // Fit-local metres retain +Z as the sign's outward direction. A normal
      // matrix is necessary because the normalized fit scales are nonuniform.
      const transform=new Matrix4().makeScale(fit.w,fit.h,fit.d).multiply(world);
      const normalMatrix=new Matrix3().getNormalMatrix(transform);
      const positions=pack.accessor(primitive.attributes.POSITION).map(v=>new Vector3().fromArray(v).applyMatrix4(transform));
      const normals=pack.accessor(primitive.attributes.NORMAL).map(v=>new Vector3().fromArray(v).applyNormalMatrix(normalMatrix));
      const indices=triangleIndices(pack,primitive,positions.length);
      for(let i=0;i<indices.length;i+=3){
        const ids=indices.slice(i,i+3),points=ids.map(j=>positions[j]);
        if(target===glyphs&&workshop&&points.some(p=>p.y<=4))continue; // Door handles share the gold material.
        target.push({points,normals:ids.map(j=>normals[j])});
      }
    }
    assert.ok(glyphs.length&&metal.length&&brick.length,`${assignment.buildingId} has lettering, fascia and supporting wall`);
    const vertices=glyphs.flatMap(triangle=>triangle.points),front=Math.max(...vertices.map(p=>p.z)),back=Math.min(...vertices.map(p=>p.z));
    const frontCaps=glyphs.filter(triangle=>triangle.points.every(p=>Math.abs(p.z-front)<=roundoff));
    const backCaps=glyphs.filter(triangle=>triangle.points.every(p=>Math.abs(p.z-back)<=roundoff));
    assert.ok(frontCaps.length&&backCaps.length,`${assignment.buildingId} has front and rear cap triangles`);
    let frontArea=0,minFrontWinding=Infinity,minFrontNormal=Infinity,maxBackWinding=-Infinity,maxBackNormal=-Infinity;
    for(const [caps,outward] of [[frontCaps,1],[backCaps,-1]])for(const triangle of caps){
      const [a,b,c]=triangle.points,cross=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));
      assert.ok(Number.isFinite(cross.lengthSq())&&cross.lengthSq()>0,`${assignment.buildingId} cap triangle has nonzero area`);
      const facing=cross.normalize().z;
      if(outward===1){frontArea+=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*.5;minFrontWinding=Math.min(minFrontWinding,facing);minFrontNormal=Math.min(minFrontNormal,...triangle.normals.map(n=>n.z));}
      else {maxBackWinding=Math.max(maxBackWinding,facing);maxBackNormal=Math.max(maxBackNormal,...triangle.normals.map(n=>n.z));}
    }
    // Independent XY barycentric projection onto actual backing triangles.
    // Taking the outermost depth also detects a surface placed in front of the
    // lettering; filtering only surfaces behind the glyph would conceal it.
    function outerDepth(triangles,point){
      let depth=-Infinity;
      for(const {points:[a,b,c]} of triangles){
        const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
        if(denominator===0)continue;
        const u=((b.y-c.y)*(point.x-c.x)+(c.x-b.x)*(point.y-c.y))/denominator;
        const v=((c.y-a.y)*(point.x-c.x)+(a.x-c.x)*(point.y-c.y))/denominator,w=1-u-v;
        if(Math.min(u,v,w)<-1e-6||Math.max(u,v,w)>1+1e-6)continue;
        depth=Math.max(depth,u*a.z+v*b.z+w*c.z);
      }
      assert.ok(Number.isFinite(depth),`${assignment.buildingId} backing covers glyph sample ${point.x}, ${point.y}`);
      return depth;
    }
    const samples=frontCaps.flatMap(({points})=>[...points,points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/3)]);
    const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x));
    const minY=Math.min(...vertices.map(p=>p.y)),maxY=Math.max(...vertices.map(p=>p.y));
    for(let x=0;x<=8;x++)for(let y=0;y<=4;y++)samples.push(new Vector3(minX+(maxX-minX)*x/8,minY+(maxY-minY)*y/4,front));
    let frontGap=Infinity,backGap=Infinity,wallGap=Infinity;
    for(const sample of samples){
      const fascia=outerDepth(metal,sample),wall=outerDepth(brick,sample);
      frontGap=Math.min(frontGap,front-fascia);backGap=Math.min(backGap,back-fascia);wallGap=Math.min(wallGap,fascia-wall);
    }
    t.diagnostic(`${assignment.buildingId}: front/fascia ${(frontGap*1000).toFixed(4)} mm, glyph depth ${((front-back)*1000).toFixed(4)} mm, rear/fascia ${(backGap*1000).toFixed(4)} mm, fascia/wall ${(wallGap*1000).toFixed(4)} mm; front cap area ${frontArea.toFixed(6)} m²; winding/normal ${minFrontWinding.toFixed(6)}/${minFrontNormal.toFixed(6)}`);
    assert.ok(frontGap+roundoff>=minimumFrontGap,`${assignment.buildingId} front-cap/fascia clearance below 18 mm`);
    assert.ok(front-back+roundoff>=minimumDepth,`${assignment.buildingId} glyph depth below 9.5 mm`);
    assert.ok(backGap+roundoff>=minimumBackGap,`${assignment.buildingId} rear-cap/fascia clearance below 8 mm`);
    assert.ok(wallGap+roundoff>=minimumWallGap,`${assignment.buildingId} fascia/supporting-wall clearance below 5 mm`);
    assert.ok(frontArea>0&&minFrontWinding>.99&&minFrontNormal>.99,`${assignment.buildingId} front caps face outward +Z`);
    assert.ok(maxBackWinding<-.99&&maxBackNormal<-.99,`${assignment.buildingId} rear caps face outward -Z`);
    // No watertightness claim: removing collinear/Float32-collapsed cap faces
    // preserves the visible silhouette but is not a manifold-topology proof.
  }
});

test('native sign framing targets the actual exported lettering, including its ground height',()=>{
  for(const {assignment,fit,entries} of selections){
    const workshop=assignment.buildingId==='detroit-38139';
    const materialName=workshop?'JEF_StaticGold':'JEF_LetteringIvory';
    const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
    let glyphVertices=0;
    for(const {primitive,world} of entries){
      if(pack.json.materials[primitive.material].name!==materialName)continue;
      const toMetres=new Matrix4().makeScale(fit.w,fit.h,fit.d).multiply(world);
      for(const tuple of pack.accessor(primitive.attributes.POSITION)){
        const point=new Vector3().fromArray(tuple).applyMatrix4(toMetres);
        if(workshop&&point.y<=4)continue; // The gold batch also contains door handles.
        min.min(point);max.max(point);glyphVertices++;
      }
    }
    assert.ok(glyphVertices>100,'nonempty exported lettering');
    const ground=JEFFERSON_BUILDING_SOURCE_AUDIT.find(a=>a.buildingId===assignment.buildingId).originalGround;
    const center=min.add(max).multiplyScalar(.5).applyAxisAngle(new Vector3(0,1,0),fit.yaw).add(new Vector3(fit.x,ground,fit.z));
    const targets=JEFFERSON_CAMERA_TARGETS.filter(target=>target.buildingId===assignment.buildingId);
    assert.ok(targets.length>0,'native capture target exists');
    for(const target of targets)assert.ok(center.distanceTo(new Vector3().fromArray(target.signLookAt))<1e-5,`${target.id} sign target no longer matches exported glyph bounds`);
  }
});

test('runtime street pack contains only the two selected metre-sized opaque signs',t=>{
  const street=streetPack;
  const rootIndices=street.json.scenes[street.json.scene??0].nodes;
  const rootNames=rootIndices.map(i=>street.json.nodes[i].name);
  assert.deepEqual([...rootNames].sort(),JEFFERSON_PROP_PLACEMENTS.map(p=>p.prototype).sort());
  assert.deepEqual(street.json.animations??[],[]);
  let batches=0,triangles=0;const visited=new Set();
  for(const rootIndex of rootIndices){
    const root=street.json.nodes[rootIndex];
    assert.equal(root.extras.collision,'visual_only');
    assert.deepEqual(root.translation??[0,0,0],[0,0,0],'no spread-sheet root translation');
    assert.deepEqual(root.scale??[1,1,1],[1,1,1],'metre-authored sign scale');
    const extracted=meshEntries(street,rootIndex);
    const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);
    for(const index of extracted.visited){assert.ok(!visited.has(index));visited.add(index);}
    for(const {primitive,world} of extracted.entries){
      const positions=street.accessor(primitive.attributes.POSITION);
      const normals=street.accessor(primitive.attributes.NORMAL),uv=street.accessor(primitive.attributes.TEXCOORD_0);
      assert.equal(street.json.accessors[primitive.attributes.POSITION].type,'VEC3');
      assert.equal(street.json.accessors[primitive.attributes.NORMAL].type,'VEC3');
      assert.equal(street.json.accessors[primitive.attributes.TEXCOORD_0].type,'VEC2');
      assert.equal(normals.length,positions.length);assert.equal(uv.length,positions.length);
      for(const tuple of positions){const point=new Vector3().fromArray(tuple).applyMatrix4(world);min.min(point);max.max(point);}
      for(const normal of normals)assert.ok(Math.abs(Math.hypot(...normal)-1)<.01,'usable sign normal');
      const material=street.json.materials[primitive.material];assert.ok(material?.pbrMetallicRoughness);
      assert.equal(material.alphaMode??'OPAQUE','OPAQUE');
      assert.equal(material.pbrMetallicRoughness.baseColorFactor?.[3]??1,1);
      triangles+=triangleIndices(street,primitive,positions.length).length/3;batches++;
    }
    const radius=Math.hypot(Math.max(Math.abs(min.x),Math.abs(max.x)),Math.max(Math.abs(min.z),Math.abs(max.z)));
    assert.ok(radius>0&&radius<=1.01,'actual sign fits the placement audit clearance radius');
    assert.ok(Math.abs(min.y)<1e-5,'sign base is at ground');
    assert.ok(Math.abs(max.y-2.89)<1e-5,'sign keeps authored 2.89 m height');
    assert.ok(max.z-min.z<.1,'slender sign depth');
  }
  assert.equal(visited.size,street.json.nodes.length,'no extra street-kit nodes');
  assert.ok(batches>0&&batches<=6,`sign material batches ${batches} exceed 6`);
  assert.ok(triangles>0&&triangles<=2000,`sign triangles ${triangles} exceed 2000`);
  const paintedMetal=street.json.materials.find(material=>material.name==='JEF_PaintedMetal');
  assert.ok(paintedMetal?.pbrMetallicRoughness.baseColorTexture&&paintedMetal?.pbrMetallicRoughness.metallicRoughnessTexture&&paintedMetal?.normalTexture,'sign poles keep authored PBR maps');
  for(const texture of street.json.textures??[])assert.ok(street.json.images[texture.source],'sign texture resolves to checked local PNG');
  t.diagnostic(`Assigned street signs: ${batches} material batches, ${triangles} triangles, maximum clearance radius 1.01 m`);
});
