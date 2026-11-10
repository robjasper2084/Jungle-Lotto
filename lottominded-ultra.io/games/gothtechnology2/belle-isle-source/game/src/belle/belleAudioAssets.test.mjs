import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import {BELLE_MUSIC} from './belleMusicCatalog.ts';
import {musicCatalog} from './belleAudioPolicy.ts';
import {TRACKS} from '../../../../swoop-source/src/detroit/soundtrackCatalog.ts';

const game=resolve(import.meta.dirname,'../..');
const audio=resolve(game,'public/audio/swoop');
const original=resolve(import.meta.dirname,'../../../../store/public/arcade/swoop-detroit/audio/swoop');
const provenance=JSON.parse(readFileSync(resolve(audio,'belle-audio-provenance.json'),'utf8'));
const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

test('Belle playlist preserves the existing unique Swoop music titles and source selections',()=>{
 assert.deepEqual(BELLE_MUSIC,musicCatalog(TRACKS));
 assert.equal(BELLE_MUSIC.length,19);
 assert.equal(provenance.tracks.length,BELLE_MUSIC.length);
 assert.deepEqual(readdirSync(audio).filter(p=>p.endsWith('.mp3')).sort(),BELLE_MUSIC.map(t=>basename(t.url)).sort());
});

test('all packaged Belle music bytes are the exact existing Swoop blobs, not LFS pointers or substitutes',()=>{
 for(const track of BELLE_MUSIC){
  const name=basename(track.url),record=provenance.tracks.find(p=>p.file===name);
  assert(record,`missing provenance: ${name}`);
  const bytes=readFileSync(resolve(audio,name));
  assert(bytes.length>1024,`${name}: empty asset or pointer`);
  assert(!bytes.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec'));
  assert.equal(bytes.length,record.bytes);
  assert.equal(gitBlob(bytes),record.gitBlob,`${name}: source identity changed`);
  // Standalone checkouts need no second Swoop checkout: the recorded Git blob is the immutable source identity.
  const sourcePath=resolve(original,name);
  if(existsSync(sourcePath))assert(bytes.equals(readFileSync(sourcePath)),`${name}: copied music differs from Swoop`);
 }
});

test('production asset allowlist includes every selected song and its provenance',()=>{
 const config=readFileSync(resolve(game,'vite.config.ts'),'utf8');
 for(const track of BELLE_MUSIC)assert(config.includes(JSON.stringify(track.url.replace(/^\.\//,''))),`unpackaged music: ${track.id}`);
 assert(config.includes('"audio/swoop/belle-audio-provenance.json"'));
});
