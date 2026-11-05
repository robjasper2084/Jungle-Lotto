import {strToU8,strFromU8,zlibSync,unzlibSync} from 'fflate';
export function pack(value:unknown){const bytes=zlibSync(strToU8(JSON.stringify(value)),{level:3});return btoa(Array.from(bytes,n=>String.fromCharCode(n)).join(''));}
export function unpack(value:string){if(typeof value!=='string'||value.length>110000)throw Error('Invalid packed frame');const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));const decoded=unzlibSync(bytes);if(decoded.length>1048576)throw Error('Frame too large');return JSON.parse(strFromU8(decoded));}
