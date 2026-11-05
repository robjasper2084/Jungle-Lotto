import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pins from './game-clip-pins.json' with {type:'json'};

export const GAME_CLIP_SOURCE = 'https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/a40a7a9178617dbf50443195081965dab93b993d/lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/';
const prefix = 'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/';

/** Assembly metadata only: keep standalone clips intact and host the exact public
 * bytes at an immutable commit. A changed clip or missing loader fails closed. */
export async function shareGameClips(files, specs=pins, read=file=>readFile(file.source)) {
  const omitted = new Set();
  for (const pin of specs) {
    const asset = files.find(file=>file.path===prefix+pin.path);
    if (!asset) throw Error('Pinned game clip missing: '+pin.path);
    const hash = createHash('sha256').update(await read(asset)).digest('hex');
    if (hash!==pin.sha) throw Error('Pinned game clip bytes changed: '+pin.path);
    omitted.add(asset);
  }
  const used = new Set(), result = [];
  for (const file of files) {
    if (omitted.has(file)) continue;
    if (!file.path.startsWith(prefix) || !/\.(?:html|js|css|json)$/.test(file.path)) {
      result.push(file); continue;
    }
    const before = file.content??(await read(file)).toString();
    let content = before;
    for (const pin of specs) {
      // Replace the exact quoted URL, never an equipment folder, partial filename,
      // other game's loader, or a clip that was not individually verified.
      for (const quote of ['"', "'"]) {
        const from = quote+'./'+pin.path+quote;
        if (content.includes(from)) {
          used.add(pin.path);
          content = content.replaceAll(from, quote+GAME_CLIP_SOURCE+pin.path+quote);
        }
      }
    }
    result.push(content===before?file:{...file,content,bytes:Buffer.byteLength(content)});
  }
  for (const pin of specs) if (!used.has(pin.path)) throw Error('Pinned game clip loader missing: '+pin.path);
  console.log(`Shared ${omitted.size} exact in-game clips through immutable public GitHub URLs.`);
  return result;
}
