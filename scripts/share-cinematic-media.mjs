import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pins from './cinematic-media-pins.json' with {type:'json'};
export const CINEMATIC_SOURCE='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/ea2f37577444916a74843b79182afbe273207f18/lottominded-ultra.io/games/gothtechnology2/store/public/arcade/';
const prefix='lottominded-ultra.io/games/gothtechnology2/arcade/';
// The same immutable public GitHub asset hosting already used by the city and
// Unity stage. Verify bytes first; never silently point at an outdated movie.
export async function shareCinematicMedia(files, specs=pins, read=file=>readFile(file.source)) {
 const omit=new Set();
 for(const pin of specs){
  const path=prefix+pin.game+'/cinematics/'+pin.name,file=files.find(f=>f.path===path);
  if(!file)throw Error('Cinematic asset missing: '+path);
  if(createHash('sha256').update(await read(file)).digest('hex')!==pin.sha)throw Error('Pinned cinematic bytes changed: '+pin.name);
  omit.add(file);
 }
 const used=new Set(),result=[];
 for(const file of files){
  if(omit.has(file))continue;
  if(!/\.(?:html|js|css)$/.test(file.path)){result.push(file);continue;}
  const game=specs.find(p=>file.path.startsWith(prefix+p.game+'/'))?.game;
  if(!game){result.push(file);continue;}
  const before=file.content??(await read(file)).toString();let content=before;
  const from='./cinematics/';
  if(content.includes(from)){used.add(game);content=content.replaceAll(from,CINEMATIC_SOURCE+game+'/cinematics/');}
  result.push(content===before?file:{...file,content,bytes:Buffer.byteLength(content)});
 }
 for(const pin of specs)if(!used.has(pin.game))throw Error('Pinned cinematic loader missing: '+pin.name);
 console.log(`Shared ${omit.size} exact cinematic assets through immutable public GitHub URLs.`);
 return result;
}
