"""Build Swoop's 1938 Franklin landmark in Blender's background mode.

    blender --background --factory-startup --python tools/build-elevator-landmark.py -- brick_wall_001_diffuse_1k.jpg

HAER MI-415, pp. 39–40 identifies the eight Franklin Street bays, truck doors,
and raised roof monitor. The owner's facade photographs and the 2024 offering
memorandum supply contemporary exterior details. The geometry is fitted to
the game's existing collision footprint; it is not a measured architectural
model. The photographic references are not included in the asset. The
painted masonry derives from Poly Haven's CC0 Brick Wall 001 diffuse map.
Download the verified input from TEXTURE_URL before running this script.
"""
from array import array
from hashlib import sha256
from math import pi
from pathlib import Path
import sys

import bpy


SITE = Path(__file__).resolve().parents[2] / "store/public/arcade/swoop-detroit"
TEXTURE_URL = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_001/brick_wall_001_diffuse_1k.jpg"
TEXTURE_SHA256 = "6a1233ec0186703de830354d89f122991e61e67fb67e0846c7eaf6c5aefea902"
if "--" not in sys.argv or len(sys.argv[sys.argv.index("--")+1:]) != 1:
    raise SystemExit("Pass the path to the CC0 brick texture after --. Source: " + TEXTURE_URL)
BRICK = Path(sys.argv[-1]).resolve()
if sha256(BRICK.read_bytes()).hexdigest() != TEXTURE_SHA256:
    raise ValueError("Texture differs from the documented Poly Haven diffuse map")
OUTPUT = SITE / "exports/architecture/DS_Detroit_Elevator.glb"
SOURCES = [
    "https://tile.loc.gov/storage-services/master/pnp/habshaer/mi/mi0700/mi0746/data/mi0746data.pdf",
    "https://www.theelevatorbuilding.com/",
    "https://www.oconnordetroit.com/wp-content/uploads/2024/10/Riverfront-Elevator-Building-OM-1.pdf",
]

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
scene = bpy.context.scene
scene.name = "The Elevator Building, 1938 Franklin Street"
scene["architectural_references"] = " ".join(SOURCES)
scene["asset_origin"] = "Independent reconstruction based on publicly documented architecture. Dimensions fitted to the Swoop corridor."
scene["texture_credit"] = "Brick Wall 001, Dimitrios Savva and Rob Tuytel for Poly Haven, CC0. Downsampled and recolored. https://polyhaven.com/a/brick_wall_001 https://polyhaven.com/license"
scene["texture_source_sha256"] = TEXTURE_SHA256

materials = {}
surfaces = {}


def material(name, color, roughness, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    materials[name] = mat
    surfaces[name] = ([], [])
    return name


brick = material("Charcoal-painted masonry", (.07, .075, .08), .86)
original = bpy.data.images.load(str(BRICK))
original.scale(512,512)
pixels = array("f", [0]) * (original.size[0] * original.size[1] * 4)
original.pixels.foreach_get(pixels)
for i in range(0, len(pixels), 4):
    luminance = .2126*pixels[i] + .7152*pixels[i+1] + .0722*pixels[i+2]
    shade = .034 + .17 * luminance
    pixels[i:i+4] = array("f", (shade, shade*1.05, shade*1.1, 1))
paint = bpy.data.images.new("Charcoal paint over CC0 Brick Wall 001", *original.size, alpha=False)
paint.pixels.foreach_set(pixels)
paint.pack()
nodes = materials[brick].node_tree
texture = nodes.nodes.new("ShaderNodeTexImage")
texture.image = paint
nodes.links.new(texture.outputs["Color"], nodes.nodes["Principled BSDF"].inputs["Base Color"])

roof = material("Flat dark roof", (.07,.075,.08), .91)
zinc = material("Pale standing-seam monitor roof", (.72,.75,.76), .55, .22)
steel = material("Window frames and coping", (.045,.052,.056), .54, .47)
stone = material("Concrete sills and foundation", (.31,.30,.28), .88)
glass = material("Steel sash glazing", (.11,.18,.21), .22, .42)
block = material("Glass block infill", (.42,.49,.48), .30, .2)
door = material("Red enamel doors", (.62,.014,.025), .47, .12)
solar = material("Solar cells", (.026,.059,.11), .29, .45)
white = material("Painted light lettering", (.9,.87,.78), .64)


def polygon(mat, coordinates):
    vertices, faces = surfaces[mat]
    first = len(vertices)
    vertices.extend(coordinates)
    faces.append(tuple(range(first, len(vertices))))


def box(mat, x, y, z, width, depth, height):
    a,b = x-width/2, x+width/2
    c,d = y-depth/2, y+depth/2
    e,f = z-height/2, z+height/2
    vertices = [(a,c,e),(b,c,e),(b,d,e),(a,d,e),
                (a,c,f),(b,c,f),(b,d,f),(a,d,f)]
    for face in [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        polygon(mat, [vertices[i] for i in face])


# Coordinates are metres in the game's compressed trail corridor. The
# trail-facing gable points towards local +Z after glTF axis conversion.
box(stone, 0,0,.15, 26.5,31.4,.3)
box(brick, 0,0,3.15, 26.2,31.1,5.7)
box(roof, 0,0,6.01, 26.15,31.05,.12)
for x in (-13.12,13.12):
    box(steel, x,0,6.17, .15,31.3,.27)
for y in (-15.55,15.55):
    box(steel, 0,y,6.17, 26.3,.15,.27)

# Two gable ends and a continuous band of high windows below the white roof.
monitor_half = 5.7
eave, ridge = 9.45, 11.47
for y in (-11.7,11.7):
    outline = [(-monitor_half,y,6.05),(monitor_half,y,6.05),
               (monitor_half,y,eave),(0,y,ridge),(-monitor_half,y,eave)]
    polygon(brick, outline if y < 0 else list(reversed(outline)))
for side in (-1,1):
    x = side*monitor_half
    box(steel, x,0,7.72, .16,23.4,3.34)
    for bay in range(12):
        y = -11.7 + (bay+.5)*1.95
        box(glass, x+side*.1,y,7.83, .07,1.74,2.73)
        box(steel, x+side*.15,y,7.83, .04,.05,2.73)
        box(steel, x+side*.15,y,7.91, .04,1.74,.06)
    x = side*(monitor_half+.2)
    panel = [(0,-11.86,ridge),(x,-11.86,eave),(x,11.86,eave),(0,11.86,ridge)]
    polygon(zinc, panel if side > 0 else list(reversed(panel)))
    box(zinc, x,0,eave-.06, .12,23.72,.15)
    for offset in range(1,7):
        x = side*offset*.82
        z = ridge-(ridge-eave)*abs(x)/(monitor_half+.2)
        box(zinc,x,0,z+.025,.038,23.7,.05)

# The 1907 Franklin Street facade has eight recessed bays. The renovation
# retained glass block, two former truck portals and a red walk-through door.
def side_panel(mat, side, y, z, span, height, projection):
    box(mat,side*(13.1+projection),y,z,.06,span,height)

for side in (-1,1):
    for i in range(8):
        y = -15.4 + (i+.5)*3.85
        side_panel(brick,side,y-1.86,3.2,.22,5.85,.10)
        is_door = i in (1,6)
        base = .32 if is_door else 1.34
        top = 4.65
        side_panel(steel,side,y,(base+top)/2,3.02,top-base,.07)
        side_panel(block,side,y,(base+top)/2,2.83,top-base-.12,.12)
        for division in range(1,9):
            side_panel(steel,side,y-1.41+division*.314,(base+top)/2,.025,top-base-.12,.16)
        for division in range(1,int((top-base)/.33)):
            side_panel(steel,side,y,base+division*.33,2.83,.025,.16)
        side_panel(stone,side,y,base-.06,3.08,.13,.18)
        if is_door:
            side_panel(door,side,y,1.49,1.39,2.42,.20)
            side_panel(glass,side,y,1.76,.83,1.26,.24)
            side_panel(steel,side,y+.46,1.23,.19,.055,.28)

# The end facing the Dequindre Cut has two dark openings and a red entry.
for y in (-15.55,15.55):
    sign = -1 if y < 0 else 1
    for x in (-8.5,7.6):
        box(steel,x,y+sign*.06,2.63,2.72,.08,1.67)
        box(glass,x,y+sign*.12,2.63,2.51,.04,1.46)
        box(steel,x,y+sign*.15,2.63,.055,.04,1.46)
    box(door,.83,y+sign*.1,1.46,1.5,.11,2.46)
    box(glass,.83,y+sign*.17,1.76,.86,.03,1.21)

# Photovoltaic arrays sit on the low roof on either side of the monitor.
for side in (-1,1):
    for row in range(2):
        for i in range(7):
            x,y = side*(7.45+row*2.16), -9.1+i*2.98
            box(zinc,x,y,6.27,1.96,2.65,.12)
            box(solar,x,y,6.35,1.83,2.53,.045)
            box(zinc,x,y,6.38,.025,2.53,.022)

def make_mesh(mat):
    vertices, faces = surfaces[mat]
    if not faces:
        return
    mesh = bpy.data.meshes.new(mat)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(mat, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(materials[mat])
    if mat == brick:
        uv = mesh.uv_layers.new(name="Masonry metres")
        for face in mesh.polygons:
            side = abs(face.normal.x) > abs(face.normal.y)
            for i in face.loop_indices:
                x,y,z = mesh.vertices[mesh.loops[i].vertex_index].co
                uv.data[i].uv = ((y if side else x)/3, z/3)

for mat in materials:
    make_mesh(mat)

# Original typesetting of the words visible on the actual roof monitor.
for y in (-11.71,11.71):
    for label, z, width, mat in [("THE",9.54,1.52,white),("ELEVATOR",8.42,7.75,door),("BUILDING",7.24,3.84,white)]:
        curve = bpy.data.curves.new(label, "FONT")
        curve.body, curve.align_x, curve.align_y = label, "CENTER", "CENTER"
        obj = bpy.data.objects.new(label,curve)
        scene.collection.objects.link(obj)
        scene.view_layers[0].update()
        scale = width/obj.dimensions.x
        obj.scale = (scale,scale,scale)
        obj.rotation_euler = (pi/2,0,0 if y < 0 else pi)
        obj.location = (0,y,z)
        curve.materials.append(materials[mat])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)

OUTPUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB",
                          export_image_format="JPEG", export_jpeg_quality=85,
                          export_extras=True, export_animations=False,
                          export_cameras=False, export_lights=False)
