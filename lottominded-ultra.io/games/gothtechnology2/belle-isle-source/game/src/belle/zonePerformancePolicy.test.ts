import test from 'node:test';
import assert from 'node:assert/strict';
import {ZONE_FRAME_BUDGET,assessZonePerformance} from './zonePerformancePolicy.ts';
test('desktop target 60 fps and phone target 30 fps',()=>{
 assert(Math.abs(ZONE_FRAME_BUDGET.desktop.frameP95Ms-16.67)<.02);
 assert(Math.abs(ZONE_FRAME_BUDGET.phone.frameP95Ms-33.33)<.02);
});
test('software-rendered CI never certifies an FPS target',()=>{
 for(const device of ['desktop','phone'] as const)assert.equal(assessZonePerformance({device,renderer:'software',samples:1000,p50Ms:10,p95Ms:12,p99Ms:18}).status,'unverified');
});
test('real hardware benchmarks require enough frames and bounded p95/p99',()=>{
 const ok={device:'desktop' as const,renderer:'hardware' as const,samples:300,p50Ms:11,p95Ms:15,p99Ms:28};
 assert.equal(assessZonePerformance(ok).status,'pass');
 assert.equal(assessZonePerformance({...ok,p95Ms:20,p99Ms:35}).status,'fail');
 assert.equal(assessZonePerformance({...ok,samples:15}).status,'unverified');
 assert.equal(assessZonePerformance({...ok,p50Ms:31}).status,'unverified');
});
