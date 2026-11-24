import type * as T from 'three';

// A material can already have a cached program and uniform table. Reusing its
// key is safe only for the same atmosphere owner, whose bindings are unchanged.
// Key strings and unknown callbacks are never inspected.
type Identity={owner:object;wind:boolean};
const composed = new WeakMap<T.Material['onBeforeCompile'],Identity>();

export function hasAtmosphereProgram(compile:T.Material['onBeforeCompile'],owner:object):boolean {
 const identity=composed.get(compile);
 return identity?.owner===owner&&!identity.wind;
}

export function registerAtmosphereProgram(material:T.Material,owner:object,wind:boolean,previous:T.Material['onBeforeCompile']):void {
 composed.set(material.onBeforeCompile,{owner,wind:wind||composed.get(previous)?.wind===true});
}

/** Call only after a known additive wrapper preserves its predecessor's shader. */
export function inheritAtmosphereProgram(material:T.Material,previous:T.Material['onBeforeCompile']):void {
 const identity=composed.get(previous);
 if(identity)composed.set(material.onBeforeCompile,identity);
}
