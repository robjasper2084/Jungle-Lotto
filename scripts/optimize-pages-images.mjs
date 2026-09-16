import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../lottominded-ultra.io/games/gothtechnology2/package.json',import.meta.url));
const sharp=require('sharp');
// Optimize published photographic PNGs only. Original files, dimensions, URLs,
// transparency, atlas layouts, data maps and source artwork stay unchanged.
export async function optimizePagesImages(root){
 const candidates=[],colorMaps=new Set(),dataMaps=new Set(),glbs=[];
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,e.name);if(e.isDirectory())await walk(file);else if(e.name.endsWith('.glb'))glbs.push(file);else if(e.name.endsWith('.png')){const rel=relative(root,file).replaceAll('\\','/');if(rel.startsWith('lotto mind refined/assets/')||rel.startsWith('lottominded-ultra.io/assets/')||rel.startsWith('lottominded-ultra.io/games/'))candidates.push(file);}}}
 await walk(root);
 // Shared GLTF textures keep normal/roughness/metalness maps untouched.
 for(const file of glbs){const input=await readFile(file);if(input.readUInt32LE(0)!==0x46546c67)continue;const gltf=JSON.parse(input.toString('utf8',20,20+input.readUInt32LE(12)));function visit(node){if(!node||typeof node!=='object')return;for(const [key,value]of Object.entries(node)){if(key.endsWith('Texture')&&Number.isInteger(value?.index)){const img=gltf.images?.[gltf.textures?.[value.index]?.source];if(img?.uri){const target=resolve(dirname(file),img.uri);(['baseColorTexture','emissiveTexture'].includes(key)?colorMaps:dataMaps).add(target);}}else visit(value);}}visit(gltf.materials);}
 let saved=0,count=0;
 for(const file of candidates){const rel=relative(root,file).replaceAll('\\','/');if(dataMaps.has(file)||/(normal|roughness|metalness|displacement|_orm)/i.test(rel))continue;if(rel.includes('/shared-textures/')&&!colorMaps.has(file))continue;if(rel.includes('/textures/'))continue;const input=await readFile(file);if(input.length<1024*1024)continue;const meta=await sharp(input).metadata();if(meta.pages>1)continue;const output=await sharp(input).png({palette:true,quality:100,effort:4,compressionLevel:9}).toBuffer();if(output.length>=input.length)continue;await writeFile(file,output);saved+=input.length-output.length;count++;}
 console.log(`Optimized ${count} web PNGs; saved ${(saved/1048576).toFixed(1)} MiB. Original sources retained.`);
 return {saved,count};
}
