import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {BufferAttribute, BufferGeometry, Vector3} from 'three';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';

const species = ['white-oak', 'red-maple', 'american-elm', 'white-pine', 'weeping-willow'];
const attributes = {POSITION:'position', NORMAL:'normal', TEXCOORD_0:'uv', TANGENT:'tangent', COLOR_0:'color'};

// Preserve complete leaf cards and distribute them through the crown.
function reduceLeaves(geometry) {
  const position = geometry.getAttribute('position');
  const parent = Array.from({length: position.count}, (_, i) => i);
  const root = i => parent[i] === i ? i : (parent[i] = root(parent[i]));
  const index = geometry.index.array;
  for (let i = 0; i < index.length; i += 3) {
    const first = root(index[i]);
    parent[root(index[i+1])] = first;
    parent[root(index[i+2])] = first;
  }
  const order = new Map(), kept = [], cards = new Map();
  for (let i = 0; i < index.length; i += 3) {
    const id = root(index[i]);
    if (!order.has(id)) order.set(id, order.size);
    if (order.get(id) % 3 === 0) kept.push(index[i], index[i+1], index[i+2]);
  }
  for (const i of new Set(kept)) {
    const id = root(i);
    if (!cards.has(id)) cards.set(id, []);
    cards.get(id).push(i);
  }
  const point = new Vector3();
  for (const vertices of cards.values()) {
    const centre = new Vector3();
    for (const i of vertices) centre.add(point.fromBufferAttribute(position, i));
    centre.multiplyScalar(1 / vertices.length);
    for (const i of vertices) {
      point.fromBufferAttribute(position, i).sub(centre).multiplyScalar(1.55).add(centre);
      position.setXYZ(i, point.x, point.y, point.z);
    }
  }
  return geometry.setIndex(kept);
}

// Change just the indexed geometry. Embedded photographs, materials, UVs,
// nodes and transforms stay in their original glTF document.
function reducePrimitive(document, primitive) {
  const geometry = new BufferGeometry();
  const original = primitive.getIndices();
  geometry.setIndex(new BufferAttribute(original.getArray().slice(), 1));
  for (const semantic of primitive.listSemantics()) {
    const accessor = primitive.getAttribute(semantic);
    if (!attributes[semantic]) throw Error('Unsupported tree attribute ' + semantic);
    geometry.setAttribute(attributes[semantic], new BufferAttribute(
      accessor.getArray().slice(), accessor.getElementSize(), accessor.getNormalized()));
  }
  const leaves = primitive.getMaterial().getName().startsWith('leaf');
  const reduced = leaves ? reduceLeaves(geometry) :
    new SimplifyModifier().modify(geometry, Math.floor(geometry.getAttribute('position').count * .72));
  if (!leaves) reduced.computeVertexNormals();
  const buffer = original.getBuffer();
  const index = document.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(reduced.index.array);
  primitive.setIndices(index);
  for (const semantic of primitive.listSemantics()) {
    const old = primitive.getAttribute(semantic), value = reduced.getAttribute(attributes[semantic]);
    primitive.setAttribute(semantic, value ? document.createAccessor().setBuffer(buffer)
      .setType(old.getType()).setNormalized(value.normalized).setArray(value.array) : null);
  }
  return {before: original.getCount() / 3, after: index.getCount() / 3};
}

export async function buildElmwoodLods(input, output) {
  const io = new NodeIO(), report = [];
  await mkdir(output, {recursive:true});
  for (const name of species) {
    const doc = await io.read(resolve(input, name + '.glb')), root = doc.getRoot();
    const oldAccessors = root.listAccessors();
    let before = 0, after = 0;
    for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const count = reducePrimitive(doc, primitive);
      before += count.before;
      after += count.after;
    }
    for (const accessor of oldAccessors) {
      if (accessor.listParents().every(parent => parent === root)) accessor.dispose();
    }
    for (const node of root.listNodes()) {
      const extras = node.getExtras();
      if (typeof extras.pivot === 'string') {
        const {pivot, ...rest} = extras;
        node.setExtras({...rest, pivotDescription:pivot});
      }
      if (!node.getWorldMatrix().every(Number.isFinite)) throw Error('Invalid LOD transform ' + name);
    }
    await io.write(resolve(output, name + '-far.glb'), doc);
    report.push({name, before, after});
  }
  await writeFile(resolve(output, 'lod-report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2] || fileURLToPath(new URL('../../../exports/elmwood/', import.meta.url));
  await buildElmwoodLods(input, process.argv[3] || input);
}
