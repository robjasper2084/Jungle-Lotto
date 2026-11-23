import type {Camera, Object3D, Scene, WebGLRenderer} from 'three';
import {yieldStartupTask} from './startupWork.ts';

type LandmarkProgram = {
 program: WebGLProgram;
 getUniforms(): unknown;
};

/** Three r185 compileAsync polls only the last program of each material. A
 * material shared by ordinary and batched meshes can own several programs.
 * Reflect each variant here so that a first visible draw doesn't do that work. */
export async function warmLandmarkPrograms(renderer: WebGLRenderer, root: Object3D, camera: Camera, scene: Scene) {
 // The live scene composes atmosphere and terrain shaders in microtasks on
 // childadded. Use that same path, hidden, before capturing any program keys.
 if (!root.parent) {
  const visible = root.visible;
  root.visible = false;
  try {
   scene.add(root);
   await Promise.resolve();
  } finally {
   root.removeFromParent();
   root.visible = visible;
  }
 }
 const gl = renderer.getContext();
 const parallel = gl.getExtension('KHR_parallel_shader_compile');
 const programs = new Set<LandmarkProgram>();
 for (const material of renderer.compile(root, camera, scene)) {
  const properties = renderer.properties.get(material) as {programs: Map<string, LandmarkProgram>};
  for (const program of properties.programs.values()) programs.add(program);
 }
 gl.flush();
 const deadline = performance.now() + 45000;
 let sliceStart = performance.now();
 while (programs.size) {
  if (gl.isContextLost()) throw new Error('WebGL context lost while preparing landmark shaders');
  if (performance.now() >= deadline) throw new Error('Landmark shader preparation timed out');
  for (const entry of programs) {
   if (parallel && !gl.getProgramParameter(entry.program, parallel.COMPLETION_STATUS_KHR)) continue;
   if (!gl.getProgramParameter(entry.program, gl.LINK_STATUS)) throw new Error('Landmark shader failed to link');
   // In r185 getUniforms() also initializes the attribute cache on first use.
   entry.getUniforms();
   programs.delete(entry);
   if (performance.now() - sliceStart >= 8) {
    await yieldStartupTask();
    sliceStart = performance.now();
   }
  }
  if (programs.size) await new Promise(resolve => setTimeout(resolve, 10));
 }
}
