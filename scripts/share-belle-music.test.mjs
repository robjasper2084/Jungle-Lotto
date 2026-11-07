import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {shareBelleMusic} from './share-belle-music.mjs';
import {belleMusicUrl} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/belleMusicPlayer.ts';
const marker='<meta name="belle-music-base" content="../swoop-detroit/">';
const hash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'belle-music-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const game=join(root,'belle-isle-explorer'),swoop=join(root,'swoop-detroit/audio/swoop'),music=join(game,'audio/swoop');
 await mkdir(join(game,'assets'),{recursive:true});await mkdir(music,{recursive:true});await mkdir(swoop,{recursive:true});
 const html='<html><head><title>Belle</title></head><body></body></html>',runtime='const a="belle-music-base",b="../swoop-detroit/";';
 await writeFile(join(game,'index.html'),html);await writeFile(join(game,'assets/app-hash.js'),runtime);
 const tracks=[];for(const id of ['01','02']){const file=`track-${id}.mp3`,bytes=Buffer.from('exact song '+id);await writeFile(join(music,file),bytes);await writeFile(join(swoop,file),bytes);tracks.push({file,bytes:bytes.length,gitBlob:hash(bytes)});}
 const provenance=JSON.stringify({tracks});await writeFile(join(music,'belle-audio-provenance.json'),provenance);
 return{root,game,swoop,music,html,runtime,tracks,provenance};
}
test('same-origin music sharing preserves canonical songs, metadata and hashed scripts',async t=>{
 const f=await fixture(t),result=await shareBelleMusic(f.game);
 assert.equal(result.files,2);assert.equal(result.saved,f.tracks.reduce((s,x)=>s+x.bytes,0)-Buffer.byteLength(marker+'\n'));
 assert.equal(await readFile(join(f.game,'index.html'),'utf8'),f.html.replace('</head>',marker+'\n</head>'));
 assert.equal(await readFile(join(f.game,'assets/app-hash.js'),'utf8'),f.runtime);
 assert.equal(await readFile(join(f.music,'belle-audio-provenance.json'),'utf8'),f.provenance);
 for(const track of f.tracks){assert.equal(hash(await readFile(join(f.swoop,track.file))),track.gitBlob);await assert.rejects(readFile(join(f.music,track.file)),{code:'ENOENT'});}
 const again=await shareBelleMusic(f.game);assert.equal(again.saved,0);assert.equal(again.files,0);
});
for(const kind of ['canonical','copy','missing','resolver','extra','base'])test('invalid '+kind+' fails before the first artifact mutation',async t=>{
 const f=await fixture(t);
 if(kind==='canonical')await writeFile(join(f.swoop,'track-02.mp3'),'different');
 if(kind==='copy')await writeFile(join(f.music,'track-02.mp3'),'different');
 if(kind==='missing')await unlink(join(f.swoop,'track-02.mp3'));
 if(kind==='resolver')await writeFile(join(f.game,'assets/app-hash.js'),'old player');
 if(kind==='extra')await writeFile(join(f.music,'track-99.mp3'),'extra');
 if(kind==='base')await writeFile(join(f.game,'index.html'),f.html.replace('</head>','<base href="/elsewhere/"> </head>'));
 const before=await readFile(join(f.game,'index.html'),'utf8');
 await assert.rejects(shareBelleMusic(f.game));
 assert.equal(await readFile(join(f.game,'index.html'),'utf8'),before);
 assert.deepEqual((await readdir(f.music)).filter(x=>x==='track-01.mp3'||x==='track-02.mp3').sort(),['track-01.mp3','track-02.mp3']);
});
for(const file of ['../escape.mp3','track-01.mp3'])test('unsafe or duplicate provenance is rejected: '+file,async t=>{
 const f=await fixture(t);f.tracks[1].file=file;await writeFile(join(f.music,'belle-audio-provenance.json'),JSON.stringify({tracks:f.tracks}));
 await assert.rejects(shareBelleMusic(f.game),/Invalid/);assert.equal(await readFile(join(f.game,'index.html'),'utf8'),f.html);
});
test('old music-free builds remain compatible with the existing asset sharing helper',async t=>{
 const f=await fixture(t);await rm(f.music,{recursive:true});assert.deepEqual(await shareBelleMusic(f.game),{files:0,saved:0});
});
test('standalone URLs remain local and Pages opts into only the fixed sibling',()=>{
 const song='./audio/swoop/track-19.mp3';assert.equal(belleMusicUrl(song,null),song);assert.equal(belleMusicUrl(song,'https://other.example/'),song);
 assert.equal(belleMusicUrl(song,'../swoop-detroit/'),'../swoop-detroit/audio/swoop/track-19.mp3');
 for(const bad of ['./audio/swoop/../../secret.mp3','https://other.example/a.mp3','./audio/swoop/track-19.mp3?x=1'])assert.equal(belleMusicUrl(bad,'../swoop-detroit/'),bad);
 const parent='https://example.test/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/';
 assert.equal(new URL(belleMusicUrl(song,'../swoop-detroit/'),parent).href,parent.replace('belle-isle-explorer/','swoop-detroit/audio/swoop/track-19.mp3'));
});
