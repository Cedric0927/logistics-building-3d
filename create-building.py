"""Photo-guided exterior approximation; dimensions and hidden elevations are inferred.

Run with Blender --background --factory-startup --python this-file.py.
Geometry, UVs, and reusable textures are generated locally; no remote modeling service.
"""
import bpy
import math
import random
import struct
import zlib
import json
import sys
from pathlib import Path
from collections import defaultdict
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
random.seed(19)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
bpy.context.preferences.filepaths.file_preview_type = 'NONE'

def png(path, width, height, pixel):
    def chunk(tag, data):
        return struct.pack('!I', len(data)) + tag + data + struct.pack('!I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(c for x in range(width) for c in pixel(x, y)) for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def tile_pixel(x, y):
    line = x % 32 < 1 or y % 16 < 1
    n = random.randint(-3, 3)
    base = 168 if line else 212 + ((x // 32 * 13 + y // 16 * 7) % 9 - 4)
    return tuple(max(0, min(255, base + n + c)) for c in (3, 1, -3))

def glass_pixel(x, y):
    sky = y / 255
    reflection = 14 * math.sin(x * .065 + y * .028) + 9 * math.sin(x * .12 - y * .03)
    if y > 160:
        reflection -= (math.sin(x * .15) * math.sin(y * .14) + 1) * 13
    return (int(53 + sky * 18 + reflection * .4), int(109 - sky * 21 + reflection * .7), int(143 - sky * 42 + reflection))

png(ROOT / 'facade-tiles.png', 512, 512, tile_pixel)
png(ROOT / 'glass-reflection.png', 256, 256, glass_pixel)

materials = {}
def mat(name, color, rough=.65, metal=0, texture=None, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    s = m.node_tree.nodes.get('Principled BSDF')
    s.inputs['Base Color'].default_value = (*color, 1)
    s.inputs['Roughness'].default_value = rough
    s.inputs['Metallic'].default_value = metal
    if texture:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(str(ROOT / texture))
        t.image.pack()
        m.node_tree.links.new(t.outputs['Color'], s.inputs['Base Color'])
    if emission:
        s.inputs['Emission Color'].default_value = (*color, 1)
        s.inputs['Emission Strength'].default_value = emission
    materials[name] = m
    return name

TILE = mat('Ivory ceramic mosaic', (.73, .72, .69), texture='facade-tiles.png')
ROOF = mat('Roof weathered concrete', (.43, .47, .46))
BLUE = mat('Blue aluminum frames', (.025, .21, .32), .32, .45)
GLASS = mat('Reflective blue glazing', (.08, .26, .37), .23, .25, 'glass-reflection.png')
GLASS_DARK = mat('Unlit ground floor glazing', (.018, .04, .055), .38, .2)
METAL = mat('Galvanized silver', (.49, .56, .56), .4, .65)
DARK = mat('Charcoal steel', (.045, .065, .071), .5, .3)
BLACK = mat('Van graphite paint', (.025, .036, .042), .27, .55)
WHITE = mat('Truck warm white', (.77, .79, .77), .4, .1)
TYRE = mat('Rubber', (.018, .022, .024), .95)
RED = mat('Red LED', (.95, .035, .018), .5, 0, emission=1.8)
GREEN = mat('Green LED', (.12, .65, .13), .5, 0, emission=1.2)
YELLOW = mat('Safety yellow', (.95, .63, .035), .65)
GROUND = mat('Concrete forecourt', (.49, .47, .41), .92)
LINE = mat('Road marking warm white', (.87, .86, .78), .9)
RIM = mat('Wheel rim', (.37, .40, .4), .4, .65)

geometry = defaultdict(lambda: [[], []])
def poly(name, material, verts, faces):
    v, f = geometry[(name, material)]
    n = len(v)
    v.extend(verts)
    f.extend(tuple(n + i for i in face) for face in faces)

def box(name, center, size, material, angle=0):
    x, y, z = center
    sx, sy, sz = (a / 2 for a in size)
    co, si = math.cos(angle), math.sin(angle)
    verts = [(x+a*co-b*si, y+a*si+b*co, z+c) for a,b,c in [(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),(-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]]
    poly(name, material, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def tube(name, a, b, radius, material, sides=8):
    a, b = Vector(a), Vector(b)
    direction = (b-a).normalized()
    basis = direction.cross(Vector((0,0,1)))
    if basis.length < .01:
        basis = direction.cross(Vector((0,1,0)))
    u = basis.normalized() * radius
    v = direction.cross(u).normalized() * radius
    verts = [tuple(p + u*math.cos(i*math.tau/sides) + v*math.sin(i*math.tau/sides)) for p in (a,b) for i in range(sides)]
    faces = [tuple(reversed(range(sides))),tuple(range(sides,2*sides))] + [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    poly(name, material, verts, faces)

def prism(name, outline, bottom, top, material):
    n = len(outline)
    verts = [(x,y,z) for z in (bottom,top) for x,y in outline]
    poly(name, material, verts, [tuple(reversed(range(n))),tuple(range(n,2*n))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])

def round_outline(x0, x1, y0, y1, radius):
    points=[]
    for x,y,start in [(x1-radius,y1-radius,0),(x0+radius,y1-radius,90),(x0+radius,y0+radius,180),(x1-radius,y0+radius,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8)
            points.append((x+radius*math.cos(a),y+radius*math.sin(a)))
    return points

def text(name, body, location, size, material, rotation=(math.pi/2,0,0), font=None):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=body
    curve.size=size
    curve.align_x='CENTER'
    curve.align_y='CENTER'
    curve.extrude=.006
    if font:
        curve.font=font
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=rotation
    obj.data.materials.append(materials[material])
    return obj

font_candidates = [
    Path('C:/Windows/Fonts/msyh.ttc'),
    Path('C:/Windows/Fonts/simhei.ttf'),
    Path('/System/Library/Fonts/PingFang.ttc'),
    Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'),
    Path('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc'),
]
if '--font' in sys.argv:
    font_candidates.insert(0, Path(sys.argv[sys.argv.index('--font') + 1]))
font_path = next((p for p in font_candidates if p.is_file()), None)
FONT = bpy.data.fonts.load(str(font_path)) if font_path else None

# Estimated main envelope: 64 m frontage, four storeys, a 12 m deep wing.
# Front faces negative Y. Rear and end elevations below are deliberately simplified.
box('Site / foundation', (0,-8,-.22), (77,43,.42), GROUND)
box('Main / upper three storeys', (-1,0,10.30), (53,12,11.6), TILE)
box('Main / loading hall back wall', (-1,4.2,2.15), (53,3.6,4.3), ROOF)
box('Main / loading platform', (-1,-2.15,.31), (53,9,.6), ROOF)
box('Main / roof surface',(-1,0,16.15),(53.3,12.3,.18),ROOF)
for y in (-6.05,6.05):
    box('Main / parapet',(-1,y,16.45),(53.5,.22,.65),TILE)

# Left rounded stair tower, taller and slightly forward of main facade.
left=round_outline(-33,-27,-7.25,6,2.65)
prism('Left / rounded stair tower',left,0,18,TILE)
prism('Left / roof',left,18,18.2,ROOF)
box('Left / plinth',(-30,-.4,.38),(6.1,13.4,.65),ROOF)

# Rounded right tower with the two tall blue window columns and facade badge.
right=round_outline(25.5,34.5,-7.9,6.1,1.8)
prism('Right / rounded corner tower',right,0,16.7,TILE)
prism('Right / roof',right,16.7,16.9,ROOF)
box('Right / inset doorway',(29.5,-7.94,1.85),(2.6,.10,3.6),GLASS_DARK)
box('Right / entrance frame',(29.5,-8.04,3.72),(3.7,.4,.18),METAL)
for x in (28.12,30.88):
    box('Right / door jamb',(x,-8.03,1.85),(.11,.14,3.65),METAL)
tube('Right / door split',(29.5,-8.1,0),(29.5,-8.1,3.6),.035,METAL)

def front_window(section, x, y, z, w=1.65, h=2.0, tall=False, opened=False):
    box(section+' / recess',(x,y+.015,z),(w+.20,.09,h+.2),DARK)
    box(section+' / glazing',(x,y-.045,z),(w,.06,h),GLASS)
    t=.075
    for px in (x-w/2,x+w/2,x):
        box(section+' / blue frames',(px,y-.11,z),(t,.13,h+.10),BLUE)
    levels=[-h/2,h/2] + ([-h/6,h/6] if tall else [h*.20])
    for dz in levels:
        box(section+' / blue frames',(x,y-.12,z+dz),(w+.08,.14,t),BLUE)
    box(section+' / sill',(x,y-.15,z-h/2-.09),(w+.24,.27,.09),METAL)
    if opened:
        # Small top-hinged sash tipped toward the yard.
        box(section+' / open casement',(x+w/4,y-.34,z-.12),(w/2-.09,.045,h*.56),GLASS)
        tube(section+' / open casement edge',(x+.05,y-.44,z-h*.39),(x+w/2-.05,y-.44,z-h*.39),.035,BLUE)

xs=[-24.8+i*4.13 for i in range(13)]
for row,z in enumerate((6.6,10.05,13.5)):
    for col,x in enumerate(xs):
        front_window('Front / windows level '+str(row+1),x,-6.10,z,w=1.65,h=2.05,opened=(row,col) in {(0,8),(0,9),(1,10),(2,7)})
    for col,x in enumerate((28.2,30.05)):
        front_window('Right / tall windows',x,-7.98,z,w=1.28,h=2.8,tall=True)

# Slightly projecting horizontal service gutters and floor joints.
for z in (4.58,8.29,11.76):
    box('Front / floor joint',(-1,-6.15,z),(53.1,.14,.065),ROOF)
box('Front / continuous rain gutter',(-1,-6.42,11.66),(53.1,.34,.14),DARK)
box('Front / gutter silver edge',(-1,-6.59,11.60),(53.1,.05,.065),METAL)
for x in xs:
    tube('Front / gutter brackets',(x,-6.1,11.78),(x,-6.52,11.48),.028,DARK)
for x in (-27.3,25.4):
    tube('Front / downpipes',(x,-6.33,.65),(x,-6.33,16.3),.065,METAL)

# Open loading hall: deep openings, front columns, doorway panels, LED signs.
for x in [-27.5+i*4.42 for i in range(13)]:
    box('Loading / columns',(x,-5.7,2.32),(.33,.62,4.08),TILE)
for i in range(12):
    x=-25.3+i*4.42
    section=f'Loading / bay {i+1:02d}'
    box(section+' / dark opening',(x,-3.15,2.05),(3.85,.08,3.35),GLASS_DARK)
    for dx in (-1.76,1.76):
        box(section+' / door guides',(x+dx,-3.28,2.05),(.075,.12,3.4),METAL)
        for z in (.85,1.65,2.45,3.25):
            box(section+' / safety bands',(x+dx,-3.36,z),(.08,.045,.23),RED)
    box(section+' / LED backing',(x,-8.18,4.07),(3.48,.18,.39),DARK)
    text(section+' / bay sign',f'卸货区 {i+1:02d}' if FONT else f'DOCK {i+1:02d}',(x,-8.29,4.07),.24,RED if i<9 else GREEN,font=FONT)
    box(section+' / bumper',(x,-6.77,.50),(1.5,.24,.25),DARK)
    box(section+' / dock step',(x,-7.03,.22),(3.5,.5,.25),ROOF)

# Canopy: thin corrugated roof, fascia, brackets, drain and wall services.
box('Loading / canopy',(-1,-7,4.55),(53.6,2.2,.14),METAL)
box('Loading / canopy front fascia',(-1,-8.08,4.42),(53.8,.14,.27),DARK)
for i in range(80):
    box('Loading / canopy seams',(-27.5+i*.67,-7,4.65),(.025,2.1,.035),ROOF)
for x in (-25,-17,-9,-1,7,15,23):
    tube('Loading / canopy diagonal stays',(x,-6.1,5.33),(x,-8.05,4.57),.035,METAL)
    tube('Loading / conduit',(x,-6.22,5.17),(x+2.8,-6.22,5.17),.025,DARK)

for i,x in enumerate((-26,-14,5,17,21)):
    z=5.1 if i%2 else 5.3
    box('Services / AC housings',(x,-6.47,z),(.85,.48,.56),WHITE)
    tube('Services / AC fan surrounds',(x-.13,-6.73,z),(x-.13,-6.76,z),.19,DARK,20)
    tube('Services / AC fan hubs',(x-.13,-6.77,z),(x-.13,-6.80,z),.055,METAL,12)
    for k in range(5):
        a=k*math.tau/5
        tube('Services / fan blades',(x-.13,-6.79,z),(x-.13+.16*math.cos(a),-6.79,z+.16*math.sin(a)),.019,METAL,5)
    for dz in (-.17,-.08,.01,.10,.19):
        box('Services / AC grille',(x+.23,-6.73,z+dz),(.23,.03,.025),METAL)
for x in (-22,-5,12):
    box('Services / wall vent',(x,-6.18,8.8),(.54,.1,.3),METAL)
    for z in (8.71,8.79,8.87):
        box('Services / vent slats',(x,-6.25,z),(.44,.025,.025),DARK)

# Roof safety rails, telecom pole and guy wires are conspicuous in the reference.
for y in (-6.03,6.03):
    for z in (16.95,17.18):
        tube('Roof / main rails',(-27.4,y,z),(25.5,y,z),.024,METAL)
    for i in range(93):
        x=-27.4+i*.575
        tube('Roof / main balusters',(x,y,16.73),(x,y,17.18),.016,METAL,5)
for x in (-27.4,25.45):
    for y in range(-5,7):
        tube('Roof / side rails',(x,y,16.73),(x,y,17.18),.02,METAL)
    tube('Roof / side rails',(x,-6,17.18),(x,6,17.18),.025,METAL)
for outline,z in ((right,17.1),(left,18.4)):
    for i,a in enumerate(outline):
        b=outline[(i+1)%len(outline)]
        tube('Roof / curved tower rail',(*a,z+.35),(*b,z+.35),.025,METAL)
        tube('Roof / curved tower posts',(*a,z-.05),(*a,z+.35),.018,METAL)
tube('Roof / mast',(-14,1,16.2),(-14,1,24),.075,METAL,12)
tube('Roof / antenna',(-14,1,23),(-14,1,25),.028,DARK)
box('Roof / antenna panel',(-13.76,1,23.1),(.16,.3,1.25),WHITE)
for anchor in ((-22,-4,16.4),(-6,4,16.4),(-17,5,16.4)):
    tube('Roof / guy wires',(-14,1,22.7),anchor,.012,DARK,5)
for z in (17.2,18.2,19.2):
    for x in (-12.2,-10.6):
        tube('Roof / lattice antenna',(x,1,z),(x,1,z+1),.025,METAL)
    tube('Roof / lattice antenna',(-12.2,1,z),(-10.6,1,z+1),.018,METAL)
    tube('Roof / lattice antenna',(-10.6,1,z),(-12.2,1,z+1),.018,METAL)
for x in (-2,9,23,32):
    tube('Roof / small aerials',(x,2,16.4),(x,2,18.6),.035,METAL)
box('Roof / rooftop access', (20,3.4,17.5),(6,4,2.4),TILE)
box('Roof / rooftop access cap',(20,3.4,18.75),(6.2,4.2,.12),METAL)

# Approximation of the visible SF facade emblem, built as actual geometry.
for i in range(64):
    a=i*math.tau/64
    b=(i+1)*math.tau/64
    tube('Right / circular SF emblem',(32.45+1.05*math.cos(a),-8.02,14.5+1.05*math.sin(a)),(32.45+1.05*math.cos(b),-8.02,14.5+1.05*math.sin(b)),.105,DARK,8)
text('Right / SF letters','SF',(32.45,-8.16,14.5),1.08,DARK)

# Inferred hidden elevations, intentionally lower-detail than photographed facade.
for row,z in enumerate((6.6,10.05,13.5)):
    for x in range(-24,26,5):
        # Rear plane, rotated window assembly.
        box('Rear / inferred glazing',(x,6.10,z),(1.5,.06,1.9),GLASS)
        for dx in (-.77,0,.77):
            box('Rear / inferred frames',(x+dx,6.17,z),(.07,.12,2),BLUE)
        for dz in (-.97,.97,.2):
            box('Rear / inferred frames',(x,6.17,z+dz),(1.6,.12,.07),BLUE)
for x in (-20,0,20):
    box('Rear / service doors',(x,6.13,1.65),(2.3,.10,3),DARK)

# Yard markings and a few simple vehicles give scale without copying people.
for x in (-27,-20,-13,-6,1,8,15,22,29):
    box('Yard / parking stripes',(x,-16,.008),(.08,13,.016),LINE)
box('Yard / stop line',(0,-9.3,.015),(65,.09,.02),LINE)
box('Yard / lane edge',(0,-24.4,.015),(69,.09,.02),LINE)
for x in (-20,-3,14):
    y=-22
    box('Yard / arrows',(x,y,.023),(.20,2.8,.025),LINE)
    poly('Yard / arrows',LINE,[(x-.75,y+1,.038),(x+.75,y+1,.038),(x,y+2,.038)],[(0,1,2)])

def vehicle(name,x,y,kind='van',angle=0):
    # Local vehicle longitudinal axis Y, cab faces negative Y.
    def p(a,b,c):
        return (x+a*math.cos(angle)-b*math.sin(angle),y+a*math.sin(angle)+b*math.cos(angle),c)
    def vbox(part,c,size,material):
        box(name+' / '+part,p(*c),size,material,angle)
    truck=kind=='truck'
    length=6.1 if truck else 5.1
    vbox('chassis',(0,0,.57),(2.05,length,.27),DARK)
    if truck:
        vbox('cargo',(0,.9,2.15),(2.45,4.3,2.8),WHITE)
        for xx in (-1.235,1.235):
            for yy in (-1,3):
                tube(name+' / cargo trim',p(xx,yy,.8),p(xx,yy,3.55),.025,METAL)
        vbox('cab',(0,-2,1.4),(2.15,1.7,1.72),WHITE)
        vbox('windshield',(0,-2.87,1.98),(1.84,.04,.74),GLASS_DARK)
    else:
        vbox('body',(0,0,1.55),(2.05,length,1.9),BLACK)
        vbox('roof',(0,.15,2.55),(1.95,length-.35,.22),BLACK)
        vbox('windshield',(0,-length/2-.025,2.02),(1.84,.045,.85),GLASS_DARK)
        for xx in (-1.04,1.04):
            vbox('side glazing',(xx,-.10,2.07),(.035,length-.8,.62),GLASS_DARK)
            vbox('sliding door track',(xx,.5,1.31),(.045,2.1,.035),METAL)
            vbox('door handle',(xx,-.45,1.35),(.045,.27,.055),METAL)
    for xx in (-1.05,1.05):
        for yy in (-length*.32,length*.32):
            tube(name+' / tyres',p(xx-.14,yy,.56),p(xx+.14,yy,.56),.48,TYRE,20)
            outside=xx+(.155 if xx>0 else -.155)
            tube(name+' / rims',p(outside,yy,.56),p(outside+(.025 if xx>0 else -.025),yy,.56),.27,RIM,16)
    vbox('front bumper',(0,-length/2-.08,.78),(2.06,.15,.22),DARK)
    for xx in (-.77,.77):
        vbox('headlights',(xx,-length/2-.09,1.13),(.35,.05,.24),WHITE)
        vbox('mirror',(xx*1.5,-length*.3,1.95),(.18,.32,.3),BLACK)
    vbox('plate',(0,-length/2-.17,.79),(.52,.02,.17),BLUE)

vehicle('Vehicle 01 / black delivery van',-15,-10.4)
vehicle('Vehicle 02 / black delivery van',-8.2,-10.4)
vehicle('Vehicle 03 / white box truck',1.6,-11.1,'truck')
vehicle('Vehicle 04 / foreground van',25,-18.3,angle=math.radians(65))

# Safety posts, cart, small loading bay equipment and fence at yard edges.
for x in (-29.0,-27.2,33,35):
    box('Yard / safety bollards',(x,-10,.53),(.38,.38,1.05),YELLOW)
    for z in (.25,.65):
        box('Yard / bollard bands',(x,-10,z),(.40,.40,.14),DARK)
for x in (-35.5,35.5):
    tube('Yard / fence rail',(x,-23,1.08),(x,-7,1.08),.04,METAL)
    for i in range(33):
        y=-23+i*.5
        tube('Yard / fence posts',(x,y,0),(x,y,1.12),.028,METAL)
for x in (-22.5,11,20):
    box('Loading / parcels',(x,-7.9,.8),(.7,.7,.8),ROOF)

# Build batched, named meshes. World-space planar UVs keep tile density consistent.
for (name,material),(verts,faces) in geometry.items():
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    uv=mesh.uv_layers.new(name='SurfaceUV')
    for face in mesh.polygons:
        normal=face.normal
        for li in face.loop_indices:
            co=mesh.vertices[mesh.loops[li].vertex_index].co
            if abs(normal.z)>.7:
                u,v=co.x,co.y
            elif abs(normal.y)>.7:
                u,v=co.x,co.z
            else:
                u,v=co.y,co.z
            if material==TILE:
                uv.data[li].uv=(u/3.2,v/3.2)
            elif material in (GLASS,):
                uv.data[li].uv=(u/2.2,v/2.4)
            else:
                uv.data[li].uv=(u,v)
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(materials[material])

# Convert lettering for portable glTF, including the Chinese dock identifiers.
for obj in list(bpy.context.scene.objects):
    if obj.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')

bpy.ops.object.camera_add(location=(-55,-91,43))
cam=bpy.context.object
cam.name='Camera / photographed facade overview'
cam.rotation_euler=(Vector((0,-2,7))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'
cam.data.ortho_scale=88
bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-25,-35,60))
bpy.context.object.data.energy=50000
bpy.context.object.data.shape='DISK'
bpy.context.object.data.size=42
bpy.ops.object.light_add(type='SUN',location=(0,0,30))
bpy.context.object.rotation_euler=(.4,-.4,-.3)
bpy.context.object.data.energy=2
scene=bpy.context.scene
world=scene.world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.75,.9,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1600
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'building-preview.png')
scene['reference_note']='Exterior approximation from a single supplied photo. Hidden geometry and all dimensions inferred. Vehicles are simplified props; no people reconstructed.'
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'logistics-building.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'logistics-building.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True)
mesh_count=sum(1 for o in scene.objects if o.type=='MESH')
triangles=sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons)
(ROOT/'building-info.json').write_text(json.dumps({'meshObjects':mesh_count,'triangles':triangles,'glbBytes':(ROOT/'logistics-building.glb').stat().st_size,'sourcePhoto':'reference.jpg','estimatedDimensionsMeters':{'frontage':67.5,'mainDepth':12,'mainHeight':16.7},'accuracy':'Photo-guided approximation; unobserved sides and dimensions inferred.'},indent=2),encoding='utf-8')
print('BUILDING_EXPORTED',mesh_count,triangles,flush=True)
bpy.ops.render.render(write_still=True)
print('BUILDING_RENDERED',flush=True)
