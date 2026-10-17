import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {shareGameClips,GAME_CLIP_SOURCE} from './share-game-clips.mjs';

const prefix='lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/';
const data=Buffer.from('exact public movie bytes');
const pin={path:'exports/polish/movie.mp4',sha:createHash('sha256').update(data).digest('hex')};
const asset={path:prefix+pin.path,data,bytes:data.length};
const read=file=>file.data;

test('shares only exact pinned URLs while preserving source data and earlier assembly edits',async()=>{
  const content=`const clip="./${pin.path}"; const other='./exports/polish/other.mp4'; const equipment="./exports/polish/royale-equipment/";`;
  const entry={path:prefix+'assets/main-abcdefgh.js',content,bytes:Buffer.byteLength(content)};
  const unrelated={path:'unrelated/main.js',data:Buffer.from(content),bytes:content.length};
  const extra={path:prefix+'exports/polish/other.mp4',data:Buffer.from('other'),bytes:5};
  const files=[asset,entry,unrelated,extra],out=await shareGameClips(files,[pin],read);
  assert.deepEqual(out.map(f=>f.path),[entry.path,unrelated.path,extra.path]);
  assert.equal(out[0].content,content.replace('"./'+pin.path+'"','"'+GAME_CLIP_SOURCE+pin.path+'"'));
  assert.equal(out[0].bytes,Buffer.byteLength(out[0].content));
  assert.equal(out[1],unrelated);assert.equal(out[2],extra);
  assert.equal(entry.content,content);assert.equal(files.length,4);assert.equal(asset.data,data);
});

test('fails closed on changed bytes, a missing asset, or missing exact loader',async()=>{
  const entry={path:prefix+'main.js',data:Buffer.from(`"./${pin.path}.backup"`)};
  await assert.rejects(()=>shareGameClips([asset,entry],[{...pin,sha:'changed'}],read),/bytes changed/);
  await assert.rejects(()=>shareGameClips([entry],[pin],read),/clip missing/);
  await assert.rejects(()=>shareGameClips([asset,entry],[pin],read),/loader missing/);
  assert.equal(entry.content,undefined);
});

test('handles single-quoted loaders and independently requires every clip',async()=>{
  const entry={path:prefix+'index.html',data:Buffer.from(`src='./${pin.path}'`)};
  assert.ok((await shareGameClips([asset,entry],[pin],read))[0].content.includes(GAME_CLIP_SOURCE));
  const second={...pin,path:'exports/polish/second.mp4'};
  await assert.rejects(()=>shareGameClips([asset,{...asset,path:prefix+second.path},entry],[pin,second],read),/loader missing.*second/);
});
