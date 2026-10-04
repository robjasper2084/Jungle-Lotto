Original outdoor skylight for Swoop Detroit and Elmwood Explorer.

Blender 5.2.1 Cycles baked the procedural atmosphere with NVIDIA OptiX on an
RTX 3080. The 1024 x 512 HDR took 3.22 seconds at 64 samples; the report records
the completed bake. Run `blender --background --python bake_skylight_optix.py`
from this source folder to reproduce it. No photograph or scan was used.

Both WebGL games convert this portable HDR to a PMREM reflection environment.
Players do not need NVIDIA hardware. Browser rendering uses Three.js, existing
MSAA and automatic detail/resolution budgets; this is not a DLSS integration.

The map collision and ground remain resident. Swoop defers distant retail and
optional scenery assets; Elmwood queues nearby landmark model families and
loads an explicitly selected destination before showing it. Assets stay cached
after loading. Manual graphics presets keep their selected detail.
