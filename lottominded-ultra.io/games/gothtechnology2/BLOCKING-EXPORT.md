# Blocking references for Higgsfield

Available in both Swoop Detroit and the standalone Elmwood Explorer.

1. Start a ride and choose **Record ride** (also in Settings → Replay).
2. Ride for at least 3 seconds, choose **Stop recording**, then **Cinematic replay**.
3. Select the camera and rider. Open **Blocking video / Higgsfield files**.
4. Select a 3–30 second range, landscape/portrait/square framing, and optional creative direction. Clean reference is recommended for AI input; Blocking guide adds actor labels and a timecode.
5. Choose **Create Higgsfield pack** and keep the tab visible. Preview the result and download the ZIP.

The ZIP includes an MP4 where supported (otherwise WebM), three clean JPG reference frames, `blocking.json`, `camera.csv`, `prompt.txt`, and instructions. Extract it before using the media in Higgsfield. JSON describes actor root transforms and the camera; it is not a complete 3D scene, skeletal animation, or native Higgsfield project.

Video has no game HUD or audio. Dedicated camera framing preserves proportions in all three aspect ratios. Export runs in real time at the available render rate. It uses a 30 fps capture stream, at most 1280 pixels on the longest side, 4 Mbps requested bitrate, and a 40 MiB video limit. Clips remain tab-local. Hiding the tab, losing the graphics context, choosing Cancel export, or leaving replay cancels an in-progress export and releases its capture stream.

Higgsfield Motion Control accepts a source image and motion reference video. Model limits and formats vary: check the selected model before generating. When needed, the included README shows how to convert WebM to H.264 MP4 with an already installed FFmpeg. Nothing uploads automatically or spends generation credits.

Primary reference checked September 29, 2026: https://open.higgsfield.ai/models/kling-video/v3/motion-control/pro/api-reference

Implementation: shared `gameFilm.ts`, `filmBlocking.ts` and `blockingPack.ts`, synchronized between Swoop, the actual `euc-detroit-riverwalk` Elmwood source and the repository Elmwood snapshot. ZIP encoding is lazy-loaded from pinned fflate 0.8.3. Recording retains the existing game runtime and assets.
