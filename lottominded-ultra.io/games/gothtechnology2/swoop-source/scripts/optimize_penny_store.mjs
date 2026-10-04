import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile,stat,mkdir,copyFile} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,prune,weld,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),report=[];
for(const name of ['penny-exchange','lotto-game-kiosk']){const source=resolve(root,'art/studio-retail/'+name+'-authoring.glb'),target=resolve(root,'public/exports/atwater/'+name+'.glb'),doc=await io.read(source);await doc.transform(weld(),dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[768,768],quality:86}));await io.write(target,doc);report.push({name,sourceBytes:(await stat(source)).size,runtimeBytes:(await stat(target)).size,meshes:doc.getRoot().listMeshes().length});}
const folder=resolve(root,'public/exports/polish/penny-catalog');await mkdir(folder,{recursive:true});
for(const [name,path] of [['hoodie','../store/public/media/hoodie.webp'],['hat','public/exports/boutique/detroit-skyline-cap.webp'],['charm','public/exports/boutique/gothtechnology-luggage-charm.webp'],['shirt','public/exports/boutique/detroit-2084-shirt.webp']])await copyFile(resolve(root,path),resolve(folder,name+'.webp'));
await writeFile(resolve(folder,'CREDITS.md'),'Existing user-supplied GothTechnology / LottoMind reference artwork. Catalog drafts only; garment sizes, final I Love Detroit artwork, stock, shipping and prices require operator verification. No Google Images photo is redistributed.\n');
await writeFile(resolve(root,'art/studio-retail/penny-optimization.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
