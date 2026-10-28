import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const folder=new URL('../ride-core/art/hero-wardrobe/',import.meta.url);
for(const [name,ext]of [['ghoulies','jpg'],['detroit','png'],['neural','png'],['vampire','jpg']]){
 for(const size of [512,1024]){
  const output=fileURLToPath(new URL(`${name}-${size}.webp`,folder));
  const result=await sharp(fileURLToPath(new URL(`${name}.${ext}`,folder))).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toFile(output);
  console.log(name,size,result.size);
 }
}
