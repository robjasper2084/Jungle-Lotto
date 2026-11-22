import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const source = fileURLToPath(new URL('../../', import.meta.url));
let ancestor = source;
while (dirname(ancestor) !== ancestor && !existsSync(resolve(ancestor, 'Digital_Static_Street_Asset_Pack'))) {
  ancestor = dirname(ancestor);
}
export const assetPack = resolve(process.env.SWOOP_ASSET_PACK ?? resolve(ancestor, 'Digital_Static_Street_Asset_Pack'));
export function assetPath(path: string, ...rest: string[]) {
  const relative = path.replace(/^\.\.\/\.\.\//, '');
  const roots = process.env.SWOOP_ASSET_PACK ? [assetPack] : [
    assetPack,
    resolve(source, 'public'),
    resolve(source, '../store/public/arcade/swoop-detroit'),
    resolve(source, '../elmwood-source/public'),
  ];
  const candidates = roots.map(root => resolve(root, relative, ...rest));
  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0];
}
