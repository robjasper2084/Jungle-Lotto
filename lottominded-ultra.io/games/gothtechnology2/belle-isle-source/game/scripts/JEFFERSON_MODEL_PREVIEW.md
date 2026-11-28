# Jefferson model previews

These tools export the actual current landmark and traffic-signal geometry and
render it with Blender for visual review. The output is **not an in-game
screenshot**. Keep the burned work-in-progress label on shared previews.

Requirements: the game Node dependencies, Node 24, Blender 4.3 or newer, Python
with Pillow, and the DejaVu Sans regular/bold fonts. Rendering uses CPU Cycles
and does not require a GPU, network connection or AI image generation.

Run from the `game` directory:

```sh
node --experimental-strip-types scripts/jefferson-model-preview.mjs garden
blender -b -t 8 --python ../tools/render-jefferson-model-preview.py -- --scene output/jefferson-model-preview/garden-scene.json
python ../tools/label-jefferson-model-preview.py --scene output/jefferson-model-preview/garden-scene.json
```

Use `stearns` or `palms` in place of `garden` in the export command and JSON
filename for those views. `garden` exports both the Garden Court wide view and
the Bagley/Wells house close-up. Unknown selections fail explicitly.

An optional second argument to the exporter sets the output directory. Its
default is resolved relative to the exporter file, so it is independent of the
calling shell's directory. The renderer and labeler also accept `--output` to
use a different render directory. Blender's `--samples` defaults to 24;
`--view bagley-wells-preview` renders just that camera. If Pillow cannot locate
the fonts, pass `--font-dir /path/to/dejavu/fonts` to the labeler.

The export includes transformed mesh vertices, instance transforms/colors,
base material properties and UVs. Exact coincident reversed triangles are
deduplicated because Cycles renders both sides; source shapes are preserved.
Mapped road strips are unioned into simple preview context. The neutral ground,
road-edge strip, camera and lighting are staging choices. The game's patched
material shaders, sky, terrain details and surrounding city are not reproduced.

Inspect the generated JPEGs before sharing them. Keep raw PNG/JSON and `.blend`
files for diagnosis when a model issue appears. Geometry fixes belong in the
actual game module, followed by a fresh export, rather than in the render mesh.
