import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const source = fileURLToPath(new URL('../../', import.meta.url));
export function assetPath(path: string, ...rest: string[]) {
  const relative = path.replace(/^\.\.\/\.\.\//, '');
  const roots = process.env.SWOOP_ASSET_PACK ? [resolve(process.env.SWOOP_ASSET_PACK)] : [
    ...(relative === 'exports/elmwood' ? [resolve(source, 'dist')] : []),
    resolve(source, 'public'),
    resolve(source, '../store/public/arcade/swoop-detroit'),
    resolve(source, '../elmwood-source/public'),
  ];
  const candidates = roots.map(root => resolve(root, relative, ...rest));
  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0];
}
