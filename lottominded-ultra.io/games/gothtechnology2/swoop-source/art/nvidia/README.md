Original outdoor skylights for Swoop Detroit and Elmwood Explorer.

The current Swoop urban bake is `detroit-skylight.hdr`, with its retained
`Detroit_Skylight_OptiX.blend` and `skylight-report.json`. The separate Explorer
uses its grass-ground Elmwood bake and calibration recorded in docs/love-tag.
The earlier production bake from PR #59 is preserved as
`production-skylight-20261004.hdr` and `production-skylight-report-20261004.json`.
The reproduction script below describes that earlier production bake, rather
than overwriting the current separately authored environments.

Blender 5.2.1 Cycles baked the procedural atmosphere with NVIDIA OptiX on an
RTX 3080. The 1024 x 512 HDR took 3.22 seconds at 64 samples; the report records
the completed bake. Run `blender --background --python bake_skylight_optix.py`
from a separate output folder to reproduce that earlier bake. No photograph or scan was used.

Both WebGL games convert this portable HDR to a PMREM reflection environment.
Players do not need NVIDIA hardware. Browser rendering uses Three.js, existing
MSAA and automatic detail/resolution budgets; this is not a DLSS integration.

The map collision and ground remain resident. Swoop defers distant retail and
optional scenery assets; Elmwood queues nearby landmark model families and
loads an explicitly selected destination before showing it. Assets stay cached
after loading. Manual graphics presets keep their selected detail.
