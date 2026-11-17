import test from 'node:test';
import assert from 'node:assert/strict';
import {PERF_PROBE_REDUCTIONS,performanceProbeFromLocation} from './performanceProbe.ts';
test('reduction can be requested only from a local preview with explicit query opt-in',()=>{
 for(const hostname of ['localhost','127.0.0.1','[::1]'])assert(performanceProbeFromLocation({hostname,search:'?profile=1&perfProbe=1'}));
 for(const hostname of ['robjasper2084.github.io','example.com','localhost.evil.test',''])assert.equal(performanceProbeFromLocation({hostname,search:'?perfProbe=1'}),false);
 for(const search of ['','?perfProbe=0','?profile=1'])assert.equal(performanceProbeFromLocation({hostname:'localhost',search}),false);
 assert.equal(performanceProbeFromLocation(undefined),false);
});
test('diagnostic reductions cannot turn into a high-quality production preset',()=>{
 assert.equal(PERF_PROBE_REDUCTIONS.nearTrees,8);
 assert.equal(PERF_PROBE_REDUCTIONS.farRange,75);
 assert.equal(PERF_PROBE_REDUCTIONS.reeds,0);
 assert.equal(PERF_PROBE_REDUCTIONS.branches,0);
});
