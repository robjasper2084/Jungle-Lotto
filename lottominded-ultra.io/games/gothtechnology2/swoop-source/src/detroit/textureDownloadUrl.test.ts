import test from 'node:test';import assert from 'node:assert/strict';import {textureDownloadUrl} from './textureDownloadUrl.ts';
test('published originals use current game variants rather than the old pinned commit',()=>{
 const old='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/old/lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/shared-textures/abc.webp';
 const page='https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/royale.html';
 assert.equal(textureDownloadUrl(old,512,page),new URL('./texture-variants/512/shared-textures/abc.webp.webp',page).href);
 assert.equal(textureDownloadUrl(old,4096,page),old);
});
test('texture downloads honor quality without redirecting dev files, geometry or HD originals',()=>{
 const url='https://game.test/arcade/swoop-detroit/shared-textures/abc.webp?v=2';
 assert.equal(textureDownloadUrl(url,512),'https://game.test/arcade/swoop-detroit/texture-variants/512/shared-textures/abc.webp.webp?v=2');
 assert.equal(textureDownloadUrl(url,1024),url.replace('shared-textures/abc.webp','texture-variants/1024/shared-textures/abc.webp.webp'));
 assert.equal(textureDownloadUrl(url,2048),url);assert.equal(textureDownloadUrl('/textures/grass.jpg',512),'/textures/grass.jpg');assert.equal(textureDownloadUrl('/exports/hero.glb',512),'/exports/hero.glb');
});
