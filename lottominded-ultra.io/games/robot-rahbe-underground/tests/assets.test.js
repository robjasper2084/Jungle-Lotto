import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';
import {MANIFEST} from '../src/render.js';
test('every runtime asset is present in the release, independent of local source artwork',()=>{
  const game=fileURLToPath(new URL('../',import.meta.url));const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:repo,encoding:'utf8'}).split('\0'));
  for(const file of [...Object.values(MANIFEST),'assets/vendor/phaser.min.js']){const absolute=resolve(game,file);assert.ok(existsSync(absolute),file+' is missing');assert.ok(tracked.has(relative(repo,absolute).replaceAll('\\','/')),file+' is absent from the release');}
});
