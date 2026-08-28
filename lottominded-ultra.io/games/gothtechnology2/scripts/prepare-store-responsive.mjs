import sharp from 'sharp';
import {readFile, writeFile} from 'node:fs/promises';
const directory = new URL('../store/public/media/', import.meta.url);
const source = new URL('armory-hero-v2.webp', directory);
const meta = await sharp(await readFile(source)).metadata();
const manifestPath = new URL('manifest.json', directory);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const width of [640, 1600]) {
  const output = 'armory-hero-v2-' + width + '.webp';
  const buffer = await sharp(await readFile(source)).resize({width, withoutEnlargement:true}).webp({quality:82}).toBuffer();
  const size = await sharp(buffer).metadata();
  await writeFile(new URL(output,directory),buffer);
  const entry = {source:'armory-hero-v2.webp',output,sourceWidth:meta.width,sourceHeight:meta.height,width:size.width,height:size.height,bytes:buffer.length,origin:'Responsive derivative of existing campaign concept; no new imagery or rights approval'};
  const index = manifest.findIndex(item=>item.output===output);
  if(index<0)manifest.push(entry);else manifest[index]=entry;
  console.log(output + ': ' + buffer.length + ' bytes');
}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
