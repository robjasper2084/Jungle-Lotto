import bpy, os, sys, math
from mathutils import Vector
scene=bpy.context.scene
out=sys.argv[-1]
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=False
scene.render.film_transparent=True
scene.render.resolution_x=512
scene.render.resolution_y=512
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
camera=scene.camera
camera.data.type='ORTHO'
for ob in scene.objects:
    if ob.type=='MESH': ob.hide_render=True
for name,tag in [('tree.009','canopy'),('tree','shrub')]:
    ob=bpy.data.objects[name]
    ob.hide_render=False
    corners=[ob.matrix_world@Vector(v) for v in ob.bound_box]
    root=Vector(tuple((min(p[i] for p in corners)+max(p[i] for p in corners))/2 for i in range(3)))
    height= max(p.z for p in corners)-min(p.z for p in corners)
    camera.data.ortho_scale=max(height,ob.dimensions.x,ob.dimensions.y)*1.02
    # The slot reaching the ground contains the woody structure.
    bottom={}
    for p in ob.data.polygons:
        z=(ob.matrix_world@p.center).z
        bottom[p.material_index]=min(bottom.get(p.material_index,z),z)
    bark=min(bottom,key=bottom.get)
    for i,m in enumerate(ob.data.materials):
        m.diffuse_color=(.115,.075,.043,1) if i==bark else (.13,.235,.068,1)
    for i,d in enumerate([Vector((0,-1,.02)),Vector((1,0,.02))]):
        camera.location=root+d*32
        camera.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=os.path.join(out,tag+str(i)+'.png')
        bpy.ops.render.render(write_still=True)
    ob.hide_render=True
