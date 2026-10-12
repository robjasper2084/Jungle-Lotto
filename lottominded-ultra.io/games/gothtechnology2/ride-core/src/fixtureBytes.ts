/** Transport bytes are released after Rapier restores the immutable map. */
const binary=new WeakMap<object,Uint8Array>();
export function setFixtureBytes(fixture:object,bytes:Uint8Array){binary.set(fixture,bytes);}
export function takeFixtureBytes(fixture:object){const bytes=binary.get(fixture);binary.delete(fixture);return bytes;}
