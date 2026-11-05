import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {shareCinematicMedia,CINEMATIC_SOURCE} from './share-cinematic-media.mjs';
test('only deployment metadata changes; verified media is served from its immutable pin',async()=>{
 const base='lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/';
 const media={path:base+'cinematics/movie.mp4',data:Buffer.from('movie'),bytes:5};
 const entry={path:base+'assets/main-abcdefgh.js',data:Buffer.from('new URL("./cinematics/movie.mp4",location.href)'),bytes:50};
 const pin={game:'swoop-detroit',name:'movie.mp4',sha:createHash('sha256').update(media.data).digest('hex')};
 const files=[media,entry],read=f=>f.data;
 const result=await shareCinematicMedia(files,[pin],read);
 assert.equal(result.length,1);assert.ok(result[0].content.includes(CINEMATIC_SOURCE));assert.equal(entry.content,undefined);assert.equal(files.length,2);
 await assert.rejects(()=>shareCinematicMedia(files,[{...pin,sha:'wrong'}],read),/bytes changed/);
 await assert.rejects(()=>shareCinematicMedia([media],[pin],read),/loader missing/);
});
