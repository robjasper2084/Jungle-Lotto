/** Transport bytes are released after Rapier restores the immutable map. */
const binary=new WeakMap<object,Uint8Array>();
const formats=new WeakMap<object,string>();
export function setFixtureBytes(fixture:object,bytes:Uint8Array,format='snapshot'){binary.set(fixture,bytes);formats.set(fixture,format);}
export function takeFixtureFormat(fixture:object){const format=formats.get(fixture)??'snapshot';formats.delete(fixture);return format;}
export function takeFixtureBytes(fixture:object){const bytes=binary.get(fixture);binary.delete(fixture);return bytes;}
