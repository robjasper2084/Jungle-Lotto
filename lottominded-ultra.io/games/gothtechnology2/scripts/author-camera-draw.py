"""Author reversible shoulder-camera handling curves in an isolated Blender scene."""
import bpy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'swoop-source/art/movie-cameras-20261018'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 60
scene.frame_end = 65
obj = bpy.data.objects.new('Shoulder_Draw_Controls', None)
scene.collection.objects.link(obj)
names = ['grip', 'lift', 'swing', 'support', 'torso_turn', 'settle']
# Contact precedes release; the support palm joins after the camera clears the shoulder.
keys = [
 (0, [0,0,0,0,0,0]), (.12,[.35,0,0,0,-.07,0]),
 (.24,[1,0,0,0,-.12,0]), (.46,[1,1,0,0,-.08,0]),
 (.58,[1,1,.32,0,-.045,0]), (.76,[1,1,.88,.75,0,.02]),
 (.90,[1,1,1,1,0,.012]), (1,[1,1,1,1,0,0])]
for phase, values in keys:
    for name,value in zip(names,values):
        obj[name] = float(value)
        obj.keyframe_insert(data_path='["'+name+'"]',frame=1+phase*64)
for layer in obj.animation_data.action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for curve in bag.fcurves:
                for key in curve.keyframe_points:
                    key.interpolation='BEZIER'
                    key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
obj.animation_data.action.name='Camera_Shoulder_Draw'
samples=[]
for frame in range(65):
    scene.frame_set(frame+1)
    samples.append([round(obj[name],7) for name in names])
data={'duration':64/60,'channels':names,'samples':samples}
(ROOT/'ride-core/src/royale/cameraDrawData.ts').write_text('// Blender-authored: scripts/author-camera-draw.py\nexport const CAMERA_DRAW='+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'shoulder-draw.json').write_text(json.dumps(data,indent=2))
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Camera_Shoulder_Draw.blend'))
print('CAMERA_SHOULDER_DRAW_OK')
