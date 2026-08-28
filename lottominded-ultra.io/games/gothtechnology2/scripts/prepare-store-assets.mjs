import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, parse } from 'node:path';
import sharp from 'sharp';

const source = resolve(import.meta.dirname, '../store/media-sources');
const destination = resolve(import.meta.dirname, '../store/public/media');
await mkdir(destination, { recursive: true });
const manifest = [];
for (const file of await readdir(source)) {
  if (!/\.(png|webp|jpe?g)$/i.test(file)) continue;
  const name = parse(file).name;
  const input = resolve(source, file);
  const metadata = await sharp(input).metadata();
  const info = await sharp(input).rotate().resize({ width: name === 'armory-hero-v2' ? 2400 : 1680, withoutEnlargement: true }).webp({ quality: 84 }).toFile(resolve(destination, `${name}.webp`));
  const generated = name.includes('campaign') || name === 'hero' || name.startsWith('armory-') || ['equipment-atlas','signal-portals'].includes(name);
  manifest.push({ source: file, output: `${name}.webp`, sourceWidth: metadata.width, sourceHeight: metadata.height, width: info.width, height: info.height, bytes: info.size, origin: generated ? 'AI campaign concept; user reference' : 'User-supplied reference; rights require owner confirmation' });
  if (name === 'hero') for (const width of [640, 960]) await sharp(input).resize({ width }).webp({ quality: 80 }).toFile(resolve(destination, `hero-${width}.webp`));
  if (name === 'armory-hero-v2') await sharp(input).resize({ width: 960 }).webp({ quality: 80 }).toFile(resolve(destination, 'armory-hero-v2-960.webp'));
}
await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Prepared ${manifest.length} store images without altering source images.`);
