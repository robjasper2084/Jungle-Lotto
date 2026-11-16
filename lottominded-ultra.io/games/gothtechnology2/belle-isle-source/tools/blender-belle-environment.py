"""Blender 5.2+ headless review exporter for Belle Isle bridges/rocks.
Authoring only: creates three separate Meshopt-compressed visual LOD GLBs,
never collision geometry or a public game asset by itself.

blender -b --python tools/blender-belle-environment.py -- \
  --source authoring/Belle_Isle_World.blend \
  --cache authoring/environment/cache \
  --output game/output/environment \
  --refs /absolute/path/to/your/Belle_Isle_reference_images
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy

def arguments():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--cache', default='authoring/environment/cache')
    ap.add_argument('--output', default='game/output/environment')
    ap.add_argument('--refs', default='')
    ap.add_argument('--mode', choices=['bridge','rock'], default='bridge')
    return ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

def load_scene(source):
    if source.suffix.lower() == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(source))
    elif source.suffix.lower() in ('.glb','.gltf'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
    else:
        raise RuntimeError('Source must be a .blend/.glb/.gltf file: ' + str(source))

def add_reference_images(folder):
    if not folder or not folder.is_dir():
        return 0
    count=0
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'):
            continue
        try:
            image=bpy.data.images.load(str(path),check_existing=True)
        except Exception as e:
            print('Skipped reference',str(path),str(e))
            continue
        obj=bpy.data.objects.new('REFERENCE_ONLY / '+path.stem,None)
        bpy.context.scene.collection.objects.link(obj)
        obj.empty_display_type='IMAGE'
        obj.data=image
        obj.empty_display_size=8
        obj.location=(count*9,0,0)
        obj.hide_render=True
        obj['reference_only']=True
        count+=1
    return count

def pbr_material(name, directory):
    if not directory.is_dir():
        raise RuntimeError('Missing downloaded CC0 maps: ' + str(directory))
    def map_path(kind):
        candidates=list(directory.glob(kind+'.*'))
        if len(candidates)!=1:raise RuntimeError('Expected exactly one '+kind+' map in '+str(directory))
        return candidates[0]
    mat=bpy.data.materials.new('Belle PBR / '+name)
    mat.use_nodes=True
    nt=mat.node_tree; nodes=nt.nodes; links=nt.links
    principled=nodes.get('Principled BSDF')
    base=nodes.new('ShaderNodeTexImage')
    base.label='CC0 sRGB albedo';base.image=bpy.data.images.load(str(map_path('diffuse')),check_existing=True)
    base.image.colorspace_settings.name='sRGB'
    links.new(base.outputs['Color'],principled.inputs['Base Color'])
    normal=nodes.new('ShaderNodeTexImage')
    normal.label='CC0 OpenGL +Y normal';normal.image=bpy.data.images.load(str(map_path('normal')),check_existing=True)
    normal.image.colorspace_settings.name='Non-Color'
    normal_node=nodes.new('ShaderNodeNormalMap')
    normal_node.inputs['Strength'].default_value=.48 if name=='aged-concrete' else .32
    links.new(normal.outputs['Color'],normal_node.inputs['Color'])
    links.new(normal_node.outputs['Normal'],principled.inputs['Normal'])
    arm=nodes.new('ShaderNodeTexImage')
    arm.label='CC0 ARM: R=AO G=roughness B=metallic'
    arm.image=bpy.data.images.load(str(map_path('arm')),check_existing=True)
    arm.image.colorspace_settings.name='Non-Color'
    separate=nodes.new('ShaderNodeSeparateColor')
    links.new(arm.outputs['Color'],separate.inputs['Color'])
    links.new(separate.outputs['Green'],principled.inputs['Roughness'])
    links.new(separate.outputs['Blue'],principled.inputs['Metallic'])
    # AO red is retained in the authoring map. glTF requires UV2 for occlusion;
    # do NOT assume this image automatically enables runtime AO on all meshes.
    mat['cc0_pbr_provider']='Poly Haven'
    mat['cc0_pbr_asset']=name
    return mat

def source_visuals(mode):
    patterns=('macarthur','bridge','abutment','arch','pier','rail','girder') if mode=='bridge' else ('rock','boulder','stone')
    return [obj for obj in bpy.context.scene.objects if obj.type=='MESH'
            and any(k in obj.name.lower() for k in patterns)
            and not any(k in obj.name.lower() for k in ('collision','hitbox','physics','trigger'))]

def assign_material(mesh,concrete,iron):
    kinds=('rail','iron','metal','rust','girder','steel','red')
    choice=iron if any(k in mesh.name.lower() for k in kinds) else concrete
    mesh.data.materials.clear();mesh.data.materials.append(choice)

def copies_for_lod(objects, index,mode,concrete,iron):
    products=[]
    for original in objects:
        mesh=original.copy();mesh.data=original.data.copy()
        bpy.context.scene.collection.objects.link(mesh)
        mesh.name='Belle_'+mode+'_LOD'+str(index)+'_'+original.name
        mesh['lod']=index;mesh['render_only']=True
        mesh.hide_render=False
        # Polygon decimation is separate from the existing analytic collision.
        if index:
            modifier=mesh.modifiers.new('Visual-only LOD decimation','DECIMATE')
            modifier.decimate_type='COLLAPSE'
            modifier.ratio=(.52 if index==1 else .22) if mode=='rock' else (.80 if index==1 else .50)
            bpy.ops.object.select_all(action='DESELECT')
            mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        if mode=='bridge':
            assign_material(mesh,concrete,iron)
        products.append(mesh)
    return products

def export_lod(objects,target):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    op=bpy.ops.export_scene.gltf
    available={p.identifier for p in op.get_rna_type().properties}
    opts={'filepath':str(target),'export_format':'GLB'}
    # Meshopt is wired into this game's GLTFLoader, but Draco is not.
    if 'export_meshopt_compression_enable' not in available:
        raise RuntimeError('Exporter does not support Meshopt. Use compatible Blender glTF exporter; never silently switch to Draco.')
    opts['export_meshopt_compression_enable']=True
    if 'export_meshopt_extension' in available:
        opts['export_meshopt_extension']='EXT_meshopt_compression'
    if 'use_selection' in available: opts['use_selection']=True
    elif 'export_selected' in available: opts['export_selected']=True
    else: raise RuntimeError('Cannot reliably export selection without including physics and reference images')
    if 'export_apply' in available:opts['export_apply']=True
    if 'export_yup' in available:opts['export_yup']=True
    op(**opts)
    data=target.read_bytes()
    if data[:4]!=b'glTF':raise RuntimeError('Output is not a GLB: '+str(target))
    return {'filename':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
      'triangles':sum(len(poly.vertices)-2 for obj in objects for poly in obj.data.polygons),
      'renderObjects':len(objects)}

def main():
    args=arguments();source=Path(args.source).resolve();output=Path(args.output).resolve()
    if not source.is_file():raise RuntimeError('Missing Blender scene: '+str(source))
    output.mkdir(parents=True,exist_ok=True)
    load_scene(source)
    references=add_reference_images(Path(args.refs).resolve() if args.refs else None)
    originals=source_visuals(args.mode)
    if not originals:raise RuntimeError('No '+args.mode+' visual objects selected; inspect model names before export')
    concrete=iron=None
    if args.mode=='bridge':
        cache=Path(args.cache).resolve()
        concrete=pbr_material('aged-concrete',cache/'aged-concrete')
        iron=pbr_material('aged-iron',cache/'aged-iron')
    reports=[]
    for index in range(3):
        copies=copies_for_lod(originals,index,args.mode,concrete,iron)
        target=output/('belle-'+args.mode+'-visual-lod'+str(index)+'.glb')
        reports.append(export_lod(copies,target))
        bpy.ops.object.select_all(action='DESELECT')
        for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
    result={'source':source.name,'mode':args.mode,'meshopt':True,
      'renderOnly':True,'referenceImagesUsedForAuthoring':references,
      'physicsModified':False,'files':reports,
      'limitation':'Authoring exports only; manual glTF shader and in-game integration review required'}
    (output/('belle-'+args.mode+'-export-manifest.json')).write_text(
        json.dumps(result,indent=2)+'\n',encoding='utf8')
    print('BELLE_ENVIRONMENT_EXPORT',json.dumps(result))

if __name__=='__main__':
    main()
