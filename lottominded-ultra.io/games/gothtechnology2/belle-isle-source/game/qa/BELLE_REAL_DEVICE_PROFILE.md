# Belle Isle performance release gate

The pull request captures a 90-second genuine browser-input ride with Chrome
SwiftShader on desktop and phone-sized viewports. Reports include frame p50/p95/
p99, mean/max, CPU phases, stalled frames, positions, movement, draw calls,
texture/geometries, first-playable wall time and available JavaScript heap data.
This is software rendering, not physical mobile GPU FPS, total RAM or VRAM.

For hardware acceptance, open the actual candidate on desktop, Android, and
iPhone. Add ?profile=1 to the game URL, start riding, and open Settings >
Ride profile > Start 10-minute capture. Ride in the foreground for at least
600 seconds of observed moving time, copy the JSON, and repeat at the same
locations, time of day, and settings on published production.

Compare p50/p95/p99, over-50/100/250ms stalls, device RAM/VRAM from external
platform profilers, first-playable latency, draw calls, texture usage, and
sustained route completion. Suggested gates are no more than 10 percent
desktop / 15 percent mobile p95 regressions versus a valid baseline and no
new severe hitching. Without physical captures, performance approval remains
unverified even when software CI is green. Never synthesize device results.
