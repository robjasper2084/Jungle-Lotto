import assert from 'node:assert/strict';
import {test} from 'node:test';
import {onlineService} from '../src/tag/onlineService.ts';
test('public builds with no server clearly offer offline without fake rooms', () => {
  assert.equal(onlineService('', 'robjasper2084.github.io').endpoint, '');
  assert.match(onlineService(undefined, 'example.com').message, /Play offline/);
});
test('local fallback remains available only on loopback pages', () => {
  assert.equal(onlineService('', 'localhost').endpoint, 'http://localhost:8211');
  assert.equal(onlineService('', '[::1]').endpoint, 'http://[::1]:8211');
  assert.equal(onlineService('', '192.168.1.2').endpoint, '');
});
test('valid secure deployment endpoints preserve subpaths', () => {
  assert.equal(onlineService(' wss://tag.example.com/game/ ', 'example.com').endpoint, 'wss://tag.example.com/game');
});
test('credentials, unsafe protocols and insecure public hosts are rejected', () => {
  for (const url of ['https://secret:password@example.com', 'javascript:alert(1)', 'file:///tmp', 'http://example.com', 'ws://example.com', 'broken']) {
    assert.equal(onlineService(url, 'example.com').endpoint, '');
  }
});
