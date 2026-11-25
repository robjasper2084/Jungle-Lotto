"""Opaque, selected-object GLB review exporter. No source .blend is saved.

Run in a dedicated Python 3.11 environment with bpy 4.5.3 and Pillow.
All output is ephemeral review data. The actual game integration is opt-in.
"""
import argparse
import io
import json
import math
from pathlib import Path
import struct
import bpy
from mathutils import Matrix, Vector
from PIL import Image

MANIFEST = Path(__file__).with_name("polyhaven-review.json")

def triangles(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)

def used_images(materials):
    seen, images = set(), set()
    def walk(tree):
        if tree is None or tree in seen:
            return
        seen.add(tree)
        for node in tree.nodes:
            if node.type == "TEX_IMAGE" and node.image:
                images.add(node.image)
            if node.type == "GROUP":
                walk(node.node_tree)
    for mat in materials:
        if mat and mat.use_nodes:
            walk(mat.node_tree)
    return images

def reduce_textures(obj, source_dir, limit):
    for im in used_images(obj.data.materials):
        if im.source != "FILE":
            raise ValueError("Non-file image needs explicit bake: " + im.name)
        path = source_dir/"textures"/Path(bpy.path.abspath(im.filepath).replace("\\","/")).name
        if not path.is_file():
            raise ValueError("Missing verified texture: " + path.name)
        if im.packed_file:
            im.unpack(method="REMOVE")
        im.filepath = str(path)
        im.reload()
        # Set transfer functions from the verified asset map roles, not suffix formats.
        role = path.stem.lower()
        im.colorspace_settings.name = "sRGB" if "_diff_" in role else "Non-Color"
        w,h = map(int,im.size)
        if min(w,h)<1:
            raise ValueError("Image failed to load: "+im.name)
        factor=min(1,limit/max(w,h))
        if factor<1:
            im.scale(max(1,round(w*factor)),max(1,round(h*factor)))
        # Save the resized pixels only in the in-memory Blender image.
        im.pack()
        if max(im.size)>limit:
            raise ValueError("Texture limit exceeded")

def selected_object(source_name):
    source=bpy.data.objects.get(source_name)
    if source is None or source.type!="MESH":
        raise ValueError("Expected exact mesh: "+source_name)
    if any(m.type=="NODES" for m in source.modifiers):
        raise ValueError("Geometry Nodes require individual explicit source selection")
    world=source.matrix_world.copy()
    copy=source.copy()
    copy.data=source.data.copy()
    copy.parent=None
    bpy.context.scene.collection.objects.link(copy)
    copy.matrix_world=world
    copy.hide_viewport=False
    copy.hide_render=False
    copy.hide_set(False)
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    mesh=bpy.data.meshes.new_from_object(copy.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
    bpy.data.objects.remove(copy,do_unlink=True)
    if not mesh or not mesh.uv_layers or triangles(mesh)<1:
        raise ValueError("Expected UV-mapped nonempty static mesh")
    mesh.transform(world)
    mins=Vector(tuple(min(v.co[i] for v in mesh.vertices) for i in range(3)))
    maxs=Vector(tuple(max(v.co[i] for v in mesh.vertices) for i in range(3)))
    if min(maxs-mins)<=0 or not all(math.isfinite(x) for x in (*mins,*maxs)):
        raise ValueError("Invalid mesh bounds")
    mesh.transform(Matrix.Translation(Vector((-(mins.x+maxs.x)/2,-(mins.y+maxs.y)/2,-mins.z))))
    obj=bpy.data.objects.new("REVIEW_"+source_name,mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    return obj

def reduce_mesh(obj, cap):
    before=triangles(obj.data)
    for i in range(3):
        current=triangles(obj.data)
        if current<=cap:
            break
        dec=obj.modifiers.new("REVIEW_BOUNDED_DECIMATE","DECIMATE")
        dec.decimate_type="COLLAPSE"
        dec.ratio=max(.001,min(.99,cap/current*.97))
        bpy.ops.object.modifier_apply(modifier=dec.name)
    count=triangles(obj.data)
    if not 0<count<=cap:
        raise ValueError(f"Geometry budget failed: {count} / {cap}")
    return before,count

def inspect_glb(path,tier,cap):
    data=path.read_bytes()
    if len(data)>tier["maxBytes"] or len(data)<28:
        raise ValueError("GLB byte budget")
    magic,version,size=struct.unpack_from("<4sII",data)
    if (magic,version,size)!=(b"glTF",2,len(data)):
        raise ValueError("Invalid GLB header")
    n,kind=struct.unpack_from("<II",data,12)
    if kind!=0x4E4F534A:
        raise ValueError("Missing glTF JSON")
    doc=json.loads(data[20:20+n])
    bin_length,bin_kind=struct.unpack_from("<II",data,20+n)
    if bin_kind!=0x004E4942 or 28+n+bin_length!=len(data):
        raise ValueError("Invalid embedded binary")
    binary=data[28+n:]
    if doc.get("extensionsRequired"):
        raise ValueError("Unreviewed mandatory glTF extension")
    meshes=doc.get("meshes",[])
    if len(meshes)!=1:
        raise ValueError("Expected exactly one selected mesh")
    total=0
    for p in meshes[0]["primitives"]:
        if p.get("mode",4)!=4:
            raise ValueError("Not triangle geometry")
        if not {"POSITION","NORMAL","TEXCOORD_0"} <= p["attributes"].keys():
            raise ValueError("Missing position, normal or UV")
        total+=doc["accessors"][p["indices"]]["count"]//3
        mat=doc["materials"][p["material"]]
        pbr=mat.get("pbrMetallicRoughness",{})
        if not all(key in pbr for key in ("baseColorTexture","metallicRoughnessTexture")) or "normalTexture" not in mat:
            raise ValueError("PBR maps missing from GLB; material bake/review required")
        if mat.get("alphaMode","OPAQUE")!="OPAQUE":
            raise ValueError("Alpha requires dedicated plant/fence pass")
    if not 0<total<=cap:
        raise ValueError("Exported triangle budget exceeded")
    sizes=[]
    for im in doc.get("images",[]):
        if "uri" in im or "bufferView" not in im:
            raise ValueError("Expected self-contained textures")
        view=doc["bufferViews"][im["bufferView"]]
        start=view.get("byteOffset",0)
        with Image.open(io.BytesIO(binary[start:start+view["byteLength"]])) as decoded:
            sizes.append(list(decoded.size))
            if max(decoded.size)>tier["maxTexture"]:
                raise ValueError("Exported texture exceeds resolution tier")
            decoded.verify()
    if not sizes:
        raise ValueError("No embedded PBR texture maps")
    return {"triangles":total,"bytes":len(data),"primitives":len(meshes[0]["primitives"]),"textures":sizes}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--id",required=True)
    ap.add_argument("--sources",type=Path,required=True)
    ap.add_argument("--source-report",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    plan=json.loads(MANIFEST.read_text())
    asset=next(a for a in plan["assets"] if a["id"]==args.id)
    proof=next(r for r in json.loads(args.source_report.read_text()) if r["id"]==args.id)
    if not proof.get("verified") or proof.get("fingerprint")!=asset["fingerprint"]:
        raise ValueError("Unverified uploaded source")
    if not asset["variants"]:
        raise ValueError("No approved opaque source mesh selection")
    source=(args.sources/args.id).resolve()
    dest=args.output.resolve()/args.id
    if "/game/public/" in dest.as_posix():
        raise ValueError("Never export into production public assets")
    dest.mkdir(parents=True,exist_ok=True)
    records=[]
    for variant in asset["variants"]:
        for i,tier in enumerate(plan["tiers"]):
            record={"variant":variant["name"],"tier":tier["name"],"source":variant["objects"][i]}
            path=dest/(variant["name"]+"-"+tier["name"]+".glb")
            try:
                bpy.ops.wm.open_mainfile(filepath=str(source/(args.id+"_4k.blend")),load_ui=False,use_scripts=False)
                obj=selected_object(record["source"])
                before,count=reduce_mesh(obj,variant["triangles"][i])
                reduce_textures(obj,source,tier["maxTexture"])
                bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,
                    export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,
                    export_tangents=True,export_materials="EXPORT",export_image_format="AUTO",
                    export_draco_mesh_compression_enable=False)
                record.update(inspect_glb(path,tier,variant["triangles"][i]))
                record.update(status="review",sourceTriangles=before,stagedTriangles=count,file=path.name)
            except Exception as e:
                path.unlink(missing_ok=True)
                record.update(status="blocked",reason=str(e))
            records.append(record)
            (dest/"review.json").write_text(json.dumps({"id":args.id,"blender":bpy.app.version_string,"sourceFingerprint":proof["fingerprint"],"records":records},indent=2)+"\n")
    if any(r["status"]!="review" for r in records):
        raise SystemExit("Review contains blocked assets; do not promote incomplete pack")

if __name__=="__main__":
    main()
