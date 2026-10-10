import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConnectionHealth} from '../src/royale/connectionHealth.ts';
test('packet silence is visible without player input and recovers on a snapshot',()=>{const c=new ConnectionHealth();c.bind(100);assert.equal(c.status(200).state,'connected');assert.equal(c.status(3000).state,'waiting');assert.equal(c.status(11000).state,'disconnected');c.snapshot(11000);assert.deepEqual(c.status(11001),{state:'connected',text:''});});
test('queue saturation, failed reconnect and leave do not leave stale warnings',()=>{const c=new ConnectionHealth();c.bind(0);assert.equal(c.status(100,150).state,'waiting');c.fail();assert.equal(c.status(101).state,'disconnected');c.retry();assert.equal(c.status().state,'reconnecting');c.fail('Expired seat');assert.equal(c.status().text,'Expired seat');c.bind(200);assert.equal(c.status(201).text,'');c.reset();assert.equal(c.status().state,'offline');});
