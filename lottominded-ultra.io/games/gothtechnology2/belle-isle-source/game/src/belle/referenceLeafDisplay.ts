import * as T from 'three';

// The original leaf has a symmetric planar outline. Each pair gives height
// and half-width in its authored UV coordinates, from stem to tip.
export const referenceLeafEdges = [
  [-.25, .04], [-.19, .18], [-.02, .12], [.10, .30],
  [.12, .12], [.29, .17], [.42, 0],
] as const;

const verticesPerLeaf = 13;
const indicesPerLeaf = 33;
const outlineOffset = 4; // Legacy leaf and crown-core UVs occupy x < 2.
const corners = [[-.30,-.25],[.30,-.25],[.30,.42],[-.30,.42]];

/** Rebuild a rigid leaf's plane from its two widest vertices and tip. Its
 * interpolated position, normal and tint are the same across the original
 * polygon. Opaque deformed icosahedra in the crown core keep all attributes. */
export function rigidLeafGeometry(source: T.BufferGeometry, leaves: number) {
  const oldIndex = source.getIndex()!;
  const oldPosition = source.getAttribute('position');
  const coreStart = leaves * verticesPerLeaf;
  const coreCount = oldPosition.count - coreStart;
  const cardVertices = leaves * 4;
  const target = new T.BufferGeometry();
  for (const name of ['position','normal','color','uv']) {
    const old = source.getAttribute(name) as T.BufferAttribute;
    const size = old.itemSize;
    const values = new Float32Array((cardVertices + coreCount) * size);
    values.set(old.array.subarray(coreStart * size), cardVertices * size);
    target.setAttribute(name, new T.BufferAttribute(values, size));
  }
  const position = target.getAttribute('position');
  const uv = target.getAttribute('uv');
  const normal = target.getAttribute('normal'), oldNormal = source.getAttribute('normal');
  const color = target.getAttribute('color'), oldColor = source.getAttribute('color');
  const indices = new Uint16Array(leaves * 6 + oldIndex.count - leaves * indicesPerLeaf);
  const across = new T.Vector3(), along = new T.Vector3(), center = new T.Vector3(), vertex = new T.Vector3();
  for (let i = 0; i < leaves; i++) {
    const base = i * verticesPerLeaf, out = i * 4;
    center.fromBufferAttribute(oldPosition, base + 3);
    across.fromBufferAttribute(oldPosition, base + 9).sub(center);
    center.addScaledVector(across, .5);
    across.multiplyScalar(1 / .6);
    along.fromBufferAttribute(oldPosition, base + 6).sub(center).multiplyScalar(1 / .32);
    for (let j = 0; j < 4; j++) {
      const [x,y] = corners[j];
      vertex.copy(center).addScaledVector(across,x).addScaledVector(along,y-.10);
      position.setXYZ(out+j,vertex.x,vertex.y,vertex.z);
      normal.setXYZ(out+j,oldNormal.getX(base),oldNormal.getY(base),oldNormal.getZ(base));
      color.setXYZ(out+j,oldColor.getX(base),oldColor.getY(base),oldColor.getZ(base));
      uv.setXY(out+j,x+outlineOffset,y);
    }
    indices.set([out,out+1,out+2,out,out+2,out+3],i*6);
  }
  for (let j = leaves * indicesPerLeaf; j < oldIndex.count; j++) {
    indices[leaves*6 + j-leaves*indicesPerLeaf] = oldIndex.getX(j)-coreStart+cardVertices;
  }
  target.setIndex(new T.BufferAttribute(indices,1));
  // These streams are rewritten and compacted by the same distance and
  // frustum selection code regardless of which geometry is on the mesh.
  for (const [name,attribute] of Object.entries(source.attributes)) {
    if ((attribute as T.InstancedBufferAttribute).isInstancedBufferAttribute) target.setAttribute(name,attribute);
  }
  return target;
}

const glFloat = (n:number) => n.toFixed(2);
const segments = referenceLeafEdges.slice(1).map(([y,width],i)=>{
  const [previousY,previousWidth] = referenceLeafEdges[i];
  return `if (y <= ${glFloat(y)}) return mix(${glFloat(previousWidth)}, ${glFloat(width)}, (y - ${glFloat(previousY)}) / ${glFloat(y-previousY)});`;
}).join('\n');

/** Single-sample lit and shadow passes use the same analytical silhouette.
 * Original smooth leaves and crown cores bypass the mask. */
export function applyLeafOutline(material: T.Material) {
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader,renderer) {
    previous.call(this,shader,renderer);
    shader.vertexShader = 'varying vec2 referenceLeafUV;\n' + shader.vertexShader.replace(
      '#include <uv_vertex>', '#include <uv_vertex>\nreferenceLeafUV = uv;');
    shader.fragmentShader = `varying vec2 referenceLeafUV;
      float referenceLeafWidth(float y) { ${segments} return 0.0; }
      ` + shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      if (referenceLeafUV.x > 2.0) {
        if (abs(referenceLeafUV.x - 4.0) > referenceLeafWidth(referenceLeafUV.y)) discard;
      }`);
  };
  material.customProgramCacheKey = () => key+'|reference-leaf-outline-v1';
}

const displays = new WeakMap<T.Mesh,ReferenceLeafDisplay>();
export const referenceLeafDisplay = (mesh:T.Mesh) => displays.get(mesh);

export class ReferenceLeafDisplay {
  private readonly original: T.BufferGeometry;
  private readonly cards?: T.BufferGeometry;
  private readonly full: T.BufferAttribute;
  private mesh: T.InstancedMesh;
  private smoothIndex?: T.BufferAttribute;
  private smooth = false;
  private wind: boolean;
  private singleSample = true;

  constructor(mesh:T.InstancedMesh, makeCards:boolean, smoothIndex?:T.BufferAttribute) {
    this.mesh=mesh;this.original=mesh.geometry;this.full=this.original.getIndex()!;
    this.smoothIndex=smoothIndex;
    this.wind=!smoothIndex; // Near geometry stays original until shadow and wind materials are ready.
    if(!makeCards)return;
    this.cards=rigidLeafGeometry(this.original,this.original.userData.referenceLeafCount);
    displays.set(mesh,this);
    const raycast=mesh.raycast;
    mesh.raycast=(raycaster,hits)=>{
      const display=mesh.geometry;
      mesh.geometry=this.original;
      try { raycast.call(mesh,raycaster,hits); } finally { mesh.geometry=display; }
    };
    this.select();
  }
  setWind(active:boolean){if(this.wind!==active){this.wind=active;this.select();}}
  setSmooth(active:boolean){if(this.smooth!==active){this.smooth=active;this.select();}}
  setSingleSample(active:boolean){if(this.singleSample!==active){this.singleSample=active;this.select();}}
  private select(){
    const simplified=this.smooth && this.smoothIndex;
    this.original.setIndex(simplified||this.full);
    this.mesh.geometry=this.cards&&this.singleSample&&!this.wind&&!simplified?this.cards:this.original;
  }
}
