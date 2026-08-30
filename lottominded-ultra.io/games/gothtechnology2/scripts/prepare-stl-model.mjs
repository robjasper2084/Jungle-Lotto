/** Convert a user-supplied binary or ASCII STL into a normalized, compressed GLB. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Box3, Vector3 } from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const [sourcePath, outputName] = process.argv.slice(2);
if (!sourcePath || !/^[a-z0-9-]+$/.test(outputName ?? '')) {
  throw new Error('Usage: node scripts/prepare-stl-model.mjs model.stl output-name');
}

const outputDir = resolve(import.meta.dirname, '../store/public/models');
await mkdir(outputDir, { recursive: true });
const source = await readFile(sourcePath);
const arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
const geometry = new STLLoader().parse(arrayBuffer);
const position = geometry.getAttribute('position');
const normal = geometry.getAttribute('normal');
if (!position || !normal || position.count % 3 !== 0) throw new Error('The STL does not contain valid triangle geometry.');

const bounds = new Box3().setFromBufferAttribute(position);
const dimensions = bounds.getSize(new Vector3());
const center = bounds.getCenter(new Vector3());
if (!Number.isFinite(dimensions.z) || dimensions.z <= 0) throw new Error('The STL has invalid dimensions.');

// The supplied print mesh is Z-up. Convert it to glTF Y-up, center it on X/Z,
// place its lowest point at Y=0, and normalize its height for predictable framing.
const scale = 1 / dimensions.z;
const positions = new Float32Array(position.count * 3);
const normals = new Float32Array(normal.count * 3);
for (let i = 0; i < position.count; i++) {
  positions[i * 3] = (position.getX(i) - center.x) * scale;
  positions[i * 3 + 1] = (position.getZ(i) - bounds.min.z) * scale;
  positions[i * 3 + 2] = -(position.getY(i) - center.y) * scale;
  normals[i * 3] = normal.getX(i);
  normals[i * 3 + 1] = normal.getZ(i);
  normals[i * 3 + 2] = -normal.getY(i);
}

const document = new Document();
const buffer = document.createBuffer();
const material = document.createMaterial('Obsidian display material')
  .setBaseColorFactor([0.055, 0.06, 0.07, 1])
  .setMetallicFactor(0.62)
  .setRoughnessFactor(0.34);
const primitive = document.createPrimitive()
  .setMaterial(material)
  .setAttribute('POSITION', document.createAccessor('Position').setType('VEC3').setArray(positions).setBuffer(buffer))
  .setAttribute('NORMAL', document.createAccessor('Normal').setType('VEC3').setArray(normals).setBuffer(buffer));
const mesh = document.createMesh(outputName).addPrimitive(primitive);
const node = document.createNode('Mobster Luggage Charm / supplied STL').setMesh(mesh);
document.createScene('Mobster Luggage Charm display').addChild(node);
document.getRoot().setDefaultScene(document.getRoot().listScenes()[0]);

const originalTriangles = position.count / 3;
const targetTriangles = 80_000;
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
await document.transform(weld({ tolerance: 0.00001 }), dedup(), prune());
// STL exports duplicate vertices at every face normal. Simplify with the
// normals as weighted attributes so those shading seams can collapse safely.
for (const itemMesh of document.getRoot().listMeshes()) for (const itemPrimitive of itemMesh.listPrimitives()) {
  const index = itemPrimitive.getIndices();
  const itemPosition = itemPrimitive.getAttribute('POSITION');
  const itemNormal = itemPrimitive.getAttribute('NORMAL');
  if (!index || !itemPosition || !itemNormal || index.getCount() <= targetTriangles * 3) continue;
  const [indices, error] = MeshoptSimplifier.simplifyWithAttributes(
    new Uint32Array(index.getArray()), itemPosition.getArray(), 3,
    itemNormal.getArray(), 3, [0.15, 0.15, 0.15], null,
    targetTriangles * 3, 0.006, ['Permissive'],
  );
  index.setArray(indices);
  compactPrimitive(itemPrimitive);
  console.log(`Attribute-aware simplification: ${indices.length / 3} triangles; error ${error}.`);
}
await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

const triangles = document.getRoot().listMeshes().reduce((sum, item) => sum + item.listPrimitives().reduce((count, itemPrimitive) => count + (itemPrimitive.getIndices()?.getCount() ?? itemPrimitive.getAttribute('POSITION').getCount()) / 3, 0), 0);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const glb = await io.writeBinary(document);
await io.readBinary(glb);

const outputPath = resolve(outputDir, `${outputName}.glb`);
await writeFile(outputPath, glb);
const report = {
  source: basename(sourcePath),
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  sourceBytes: source.length,
  originalTriangles,
  triangles,
  sourceDimensions: dimensions.toArray(),
  normalizedHeight: 1,
  axisConversion: 'STL Z-up to glTF Y-up',
  material: 'Neutral obsidian display material; STL contains geometry only.',
  bytes: glb.length,
  compression: 'EXT_meshopt_compression',
  rights: 'User-supplied STL; ownership and production accuracy not independently verified.',
};
await writeFile(resolve(outputDir, `${outputName}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
