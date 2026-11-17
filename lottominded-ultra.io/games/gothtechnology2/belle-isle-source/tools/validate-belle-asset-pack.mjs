/** Validate a Blender-authored Belle Isle environment GLB before importing it into the game.
 * Node-only: no Blender installation, network access or game dependencies required.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_LOD0_TRIANGLES = 80_000;
const MAX_LOD0_PRIMITIVES = 48;
const MAX_MATERIALS = 24;
const MAX_ROCK_COLLIDER_TRIANGLES = 600;
const FORBIDDEN = new Set([
  // These require decoder setup that the proposed environment loader does not have.
  'KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression',
]);
const NODE_NAME = /^([A-Za-z0-9_]+)__(LOD[012]|COLLIDER)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Return the JSON chunk; validate all chunk boundaries, not just the GLB header. */
export function parseGlb(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length >= 20, 'GLB is too short');
  assert(bytes.readUInt32LE(0) === 0x46546c67, 'Invalid GLB magic');
  assert(bytes.readUInt32LE(4) === 2, 'Only glTF 2.0 is supported');
  assert(bytes.readUInt32LE(8) === bytes.length, 'GLB declared length differs from actual file size');
  let position = 12;
  let json;
  let chunkCount = 0;
  while (position < bytes.length) {
    assert(position + 8 <= bytes.length, 'Truncated GLB chunk header');
    const length = bytes.readUInt32LE(position);
    const type = bytes.readUInt32LE(position + 4);
    position += 8;
    assert(length % 4 === 0, 'GLB chunk is not 4-byte aligned');
    assert(position + length <= bytes.length, 'GLB chunk exceeds file bounds');
    if (chunkCount === 0) {
      assert(type === 0x4e4f534a, 'First GLB chunk must be JSON');
      try { json = JSON.parse(bytes.toString('utf8', position, position + length).trimEnd()); }
      catch (error) { throw new Error('Malformed GLB JSON: ' + error.message); }
    } else {
      assert(type === 0x004e4942, 'Unsupported GLB chunk after JSON');
      assert(chunkCount === 1, 'GLB contains more than one BIN chunk');
    }
    position += length;
    chunkCount += 1;
  }
  assert(position === bytes.length, 'Invalid GLB chunk padding');
  assert(json?.asset?.version?.startsWith('2.'), 'Missing glTF asset version 2.x');
  return json;
}

function triangleCount(gltf, node) {
  assert(Number.isInteger(node.mesh) && gltf.meshes?.[node.mesh], `Node ${node.name} has no mesh`);
  const mesh = gltf.meshes[node.mesh];
  assert(mesh.primitives?.length, `Node ${node.name} has no primitives`);
  let triangles = 0;
  for (const primitive of mesh.primitives) {
    assert((primitive.mode ?? 4) === 4, `Node ${node.name} contains non-triangle primitives`);
    const position = gltf.accessors?.[primitive.attributes?.POSITION];
    assert(position?.count > 0, `Node ${node.name} has no POSITION accessor`);
    if (position.min && position.max) {
      assert(position.min.length === 3 && position.max.length === 3, `${node.name}: invalid bounds`);
      assert([...position.min, ...position.max].every(Number.isFinite), `${node.name}: nonfinite bounds`);
      assert(position.min.every((n, i) => n <= position.max[i]), `${node.name}: inverted bounds`);
    }
    const indices = primitive.indices === undefined ? position : gltf.accessors?.[primitive.indices];
    assert(indices?.count > 0 && indices.count % 3 === 0, `${node.name}: invalid triangle index count`);
    triangles += indices.count / 3;
  }
  return { triangles, primitives: mesh.primitives.length,
    materials: mesh.primitives.map(p => p.material).filter(Number.isInteger) };
}

export function validateBellePack(gltf, fileSize = 0) {
  assert(fileSize <= MAX_BYTES, `GLB size exceeds ${MAX_BYTES} bytes`);
  assert(gltf?.asset?.version?.startsWith('2.'), 'Missing glTF 2.x asset');
  const extensions = new Set([...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])]);
  for (const extension of extensions) {
    assert(!FORBIDDEN.has(extension), `${extension} needs a decoder not wired into the Belle environment loader; export uncompressed`);
  }
  for (const image of gltf.images ?? []) {
    assert(!image.uri || image.uri.startsWith('data:'), 'GLB has an external texture URI; pack textures into the file');
  }
  for (const buffer of gltf.buffers ?? []) {
    assert(!buffer.uri, 'GLB has an external buffer URI');
  }
  const assets = new Map();
  const assignedMeshes = new Set();
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const match = NODE_NAME.exec(node.name ?? '');
    assert(match, `Unexpected mesh node "${node.name}"; require ASSET__LOD0/1/2 or ASSET__COLLIDER`);
    const [, assetName, variant] = match;
    const role = node.extras?.belle_role;
    assert(['bridge', 'rock', 'shore', 'tree', 'foliage', 'waterbed', 'prop'].includes(role), `${node.name} is missing a valid belle_role`);
    let asset = assets.get(assetName);
    if (!asset) { asset = {role, nodes: {}}; assets.set(assetName, asset); }
    assert(asset.role === role, `${assetName}: inconsistent roles`);
    assert(!asset.nodes[variant], `${assetName}: duplicate ${variant}`);
    assert(!assignedMeshes.has(node.name), `${node.name}: duplicate node name`);
    assignedMeshes.add(node.name);
    asset.nodes[variant] = triangleCount(gltf, node);
  }
  assert(assets.size > 0, 'No Belle export mesh nodes were found');
  let lod0Triangles = 0;
  let lod0Draws = 0;
  const materialIds = new Set();
  const roles = new Set();
  for (const [name, {role, nodes}] of assets) {
    roles.add(role);
    for (const tag of ['LOD0', 'LOD1', 'LOD2']) assert(nodes[tag], `${name} missing ${tag}`);
    assert(nodes.LOD1.triangles <= nodes.LOD0.triangles, `${name}: LOD1 has more triangles than LOD0`);
    assert(nodes.LOD2.triangles <= nodes.LOD1.triangles, `${name}: LOD2 has more triangles than LOD1`);
    if (role === 'rock') {
      assert(nodes.COLLIDER, `${name}: rock is missing a simplified collision proxy`);
      assert(nodes.COLLIDER.materials.length === 0, `${name}: collision proxy should not contain PBR materials`);
      assert(nodes.COLLIDER.triangles <= MAX_ROCK_COLLIDER_TRIANGLES,
        `${name}: collision proxy exceeds ${MAX_ROCK_COLLIDER_TRIANGLES} triangles`);
    }
    else assert(!nodes.COLLIDER, `${name}: only rocks may contain COLLIDER nodes`);
    lod0Triangles += nodes.LOD0.triangles;
    lod0Draws += nodes.LOD0.primitives;
    for (const id of nodes.LOD0.materials) materialIds.add(id);
  }
  assert(lod0Triangles <= MAX_LOD0_TRIANGLES, `LOD0 triangle budget exceeded: ${lod0Triangles}`);
  assert(lod0Draws <= MAX_LOD0_PRIMITIVES, `LOD0 primitive/draw-call budget exceeded: ${lod0Draws}`);
  assert(materialIds.size <= MAX_MATERIALS, `LOD0 uses ${materialIds.size} materials, exceeding ${MAX_MATERIALS}`);
  return {assetCount:assets.size, roles:[...roles].sort(), lod0Triangles, lod0Draws, lod0Materials:materialIds.size,
    bytes:fileSize, maxBytes:MAX_BYTES, requiresRuntimeLodSelection:true,
    assets:[...assets].map(([name,{role,nodes}])=>({name,role,
      lodTriangles:[nodes.LOD0.triangles,nodes.LOD1.triangles,nodes.LOD2.triangles],
      colliderTriangles:nodes.COLLIDER?.triangles ?? null}))};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert(process.argv.length === 3 || process.argv.length === 4,
      'Usage: node tools/validate-belle-asset-pack.mjs PATH_TO_GLB [--require-families=bridge,foliage,water,rock]');
    const data = await readFile(process.argv[2]);
    const report = validateBellePack(parseGlb(data), data.length);
    if (process.argv[3]) {
      const arg = process.argv[3];
      assert(arg.startsWith('--require-families='), 'Unknown validation argument');
      const expected = arg.slice('--require-families='.length).split(',').filter(Boolean);
      const familyRoles = {
        bridge:['bridge'], foliage:['foliage','tree'], water:['shore','waterbed'], rock:['rock'],
      };
      for (const family of expected) {
        assert(familyRoles[family], `Unknown required family: ${family}`);
        assert(familyRoles[family].some(role => report.roles.includes(role)),
          `Missing required environmental family: ${family}`);
      }
    }
    console.log(JSON.stringify({valid:true,...report},null,2));
  } catch (error) {
    console.error('Belle Blender asset validation failed:', error.message);
    process.exitCode = 1;
  }
}
