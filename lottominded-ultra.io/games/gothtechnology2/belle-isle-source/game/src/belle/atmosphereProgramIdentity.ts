import type * as T from 'three';

// Callback identity proves that this composition already contains the authored
// atmosphere pass. Key strings and unknown callbacks are never inspected.
const composed = new WeakSet<T.Material['onBeforeCompile']>();

export function hasAtmosphereProgram(compile:T.Material['onBeforeCompile']):boolean {
 return composed.has(compile);
}

export function registerAtmosphereProgram(material:T.Material):void {
 composed.add(material.onBeforeCompile);
}

/** Call only after a known additive wrapper preserves its predecessor's shader. */
export function inheritAtmosphereProgram(material:T.Material,previous:T.Material['onBeforeCompile']):void {
 if(composed.has(previous))composed.add(material.onBeforeCompile);
}
