"""Refined photo-guided SF truck and telescopic conveyor, with web animation pivots.
All helper coordinates use Three.js X/right, Y/up, Z/forward and metres.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
bpy.context.preferences.filepaths.file_preview_type='NONE'
def B(p): return Vector((p[0],-p[2],p[1]))
def group(name,parent=None,pos=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=B(pos);return o
def material(name,c,rough=.5,metal=0,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*c,1);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
    if emit:s.inputs['Emission Color'].default_value=(*c,1);s.inputs['Emission Strength'].default_value=emit
    return m
paint=material('Graphite black clearcoat',(.014,.021,.029),.27,.5)
paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.65
rubber=material('Tire sidewall rubber',(.014,.017,.019),.88)
groove=material('Tread grooves',(.005,.006,.007),.96)
black=material('Satin black trim',(.018,.023,.028),.57)
steel=material('Brushed aluminum',(.52,.58,.62),.31,.82)
chrome=material('Polished chrome',(.8,.86,.89),.2,.92)
white=material('SF white markings',(.92,.94,.94),.42)
red=material('SF red stripe',(.65,.018,.026),.4,.1)
glass=material('Blue smoked glass',(.023,.065,.087),.16,.42)
glass.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.8
reflect=material('Glass reflected sky',(.13,.25,.31),.24,.35)
lamp=material('Headlamp lenses',(.75,.86,.91),.18,.4)
led=material('LED daytime lamps',(.84,.94,1),.25,0,.7)
amber=material('Amber marker lamps',(.95,.32,.025),.3,0,.3)
tail=material('Red tail lenses',(.65,.012,.014),.3,0,.3)
belt=material('Conveyor black belt',(.035,.044,.046),.9)
frame=material('Conveyor teal powdercoat',(.034,.20,.20),.43,.25)
yellow=material('Conveyor safety yellow',(.93,.55,.055),.45,.12)
roller=material('Roller galvanized steel',(.32,.39,.42),.3,.85)
wood=material('Cargo floor plywood',(.28,.22,.15),.85)

def mesh(name,vs,faces,mat,parent=None,bevel=0,smooth=False):
    me=bpy.data.meshes.new(name);me.from_pydata([B(v) for v in vs],[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
        bpy.context.view_layer.objects.active=o
        try:bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError:pass
        norm=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        try:bpy.ops.object.modifier_apply(modifier=norm.name)
        except RuntimeError:pass
    if smooth:
        for f in me.polygons:f.use_smooth=True
    return o
def box(name,c,size,mat,parent=None,bevel=0):
    x,y,z=c;a,b,d=[v/2 for v in size]
    vs=[(x+dx,y+dy,z+dz) for dx,dy,dz in [(-a,-b,-d),(a,-b,-d),(a,b,-d),(-a,b,-d),(-a,-b,d),(a,-b,d),(a,b,d),(-a,b,d)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,parent,bevel)
def tube(name,a,b,r,mat,parent=None,n=12):
    a,b=Vector(a),Vector(b);w=(b-a).normalized();u=w.cross(Vector((0,1,0)))
    if u.length<.01:u=w.cross(Vector((0,0,1)))
    u=u.normalized()*r;v=w.cross(u).normalized()*r
    vs=[tuple(p+u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n)) for p in (a,b) for i in range(n)]
    fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat,parent,smooth=True)
def line(name,pts,r,mat,parent=None):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;cu.use_fill_caps=True
    spline=cu.splines.new('POLY');spline.points.add(len(pts)-1)
    for point,co in zip(spline.points,pts):point.co=(*B(co),1)
    o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
def ring(name,c,r,width,mat,parent,axis='x',steps=48):
    pts=[]
    for i in range(steps+1):
        a=i*math.tau/steps
        pts.append((c[0],c[1]+r*math.sin(a),c[2]+r*math.cos(a)) if axis=='x' else (c[0]+r*math.cos(a),c[1]+r*math.sin(a),c[2]))
    line(name,pts,width,mat,parent)
fonts=[Path('C:/Windows/Fonts/msyh.ttc'),Path('/System/Library/Fonts/PingFang.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')]
FONT=next((bpy.data.fonts.load(str(p)) for p in fonts if p.exists()),None)
bold=Path('C:/Windows/Fonts/arialbi.ttf');BOLD=bpy.data.fonts.load(str(bold)) if bold.exists() else FONT
def text(name,body,c,size,mat,parent,side='front',font=None):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.001
    if font or FONT:cu.font=font or FONT
    o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.parent=parent;o.location=B(c)
    u=Vector((0,0,1)) if side=='left' else Vector((0,0,-1)) if side=='right' else Vector((-1,0,0)) if side=='rear' else Vector((1,0,0))
    v=Vector((0,1,0));normal=u.cross(v)
    o.rotation_euler=Matrix((B(u),B(v),B(normal))).transposed().to_euler();o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return o

truck=group('TruckAsset');conveyor=group('ConveyorAsset')
left=group('CargoLeft',truck);right=group('CargoRight',truck);roof=group('CargoRoof',truck);front=group('CargoFront',truck)
box('Chassis ladder',(0,.72,-.05),(2.32,.22,8.3),black,truck,.04)
for x in [-.85,.85]:box('Chassis rail',(x,.63,-.3),(.16,.23,7.1),black,truck,.018)
box('Plywood cargo floor',(0,1.105,-1.3),(2.78,.16,5.86),wood,truck,.02)
for i in range(14):box('Floor board join',(-1.3+i*.2,1.192,-1.3),(.009,.003,5.8),black,truck)
for side,g in [(-1,left),(1,right)]:
    x=side*1.43
    box('Ribbed black cargo shell',(x,2.61,-1.3),(.075,2.91,5.9),paint,g,.022)
    for i in range(45):box('Cargo vertical rib',(x+side*.044,2.61,-4.13+i*.13),(.015,2.83,.013),paint,g,.004)
    for y in [1.17,4.065]:box('Cargo aluminum corner',(x,y,-1.3),(.115,.09,5.98),black,g,.018)
    box('Continuous SF red line',(x+side*.058,1.85,-1.3),(.012,.07,5.84),red,g)
    for i in range(24):box('Reflective red white strip',(x+side*.058,1.30,-4.08+i*.24),(.015,.06,.17),red if i%2 else white,g)
    orientation='left' if side<0 else 'right'
    text('SF cargo logo','SF',(x+side*.072,2.85,-2.65),1.08,white,g,orientation,BOLD)
    ring('SF circular signature',(x+side*.065,2.81,-2.65),.86,.042,white,g)
    box('SF red logo accent',(x+side*.087,2.91,-2.68),(.015,.085,.15),red,g)
    text('SF freight slogan','大件也要发顺丰',(x+side*.071,3.54,.22),.255,white,g,orientation)
    text('SF delivery slogan','跨省最快7小时',(x+side*.071,3.16,.22),.24,white,g,orientation)
    text('SF hotline','95338',(x+side*.073,2.22,.55),.17,white,g,orientation)
    box('Side underrun guard',(side*1.20,.65,-.8),(.09,.11,3.0),steel,truck,.025)
    for z in [-2.15,.55]:box('Guard support',(side*1.12,.80,z),(.12,.35,.12),black,truck,.015)
box('Cargo roof',(0,4.10,-1.3),(2.96,.10,6.02),paint,roof,.035)
box('Cargo front bulkhead',(0,2.61,1.68),(2.88,2.92,.09),paint,front,.025)

# Rounded cab-over shell and sloped front glazing.
profile=[(.93,1.73),(.93,4.04),(1.12,4.29),(1.72,4.32),(2.0,4.16),(2.91,3.72),(3.13,3.44),(3.16,2.02),(2.95,1.73)]
vs=[]
for side in [-1,1]:
    for y,z in profile:vs.append((side*(1.23 if y<2.95 else 1.11),y,z))
n=len(profile)
mesh('Sculpted cab shell',vs,[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],paint,truck,.075)
# Windshield has a slight horizontal bow rather than a flat black rectangle.
for i in range(8):
    a=-1.08+i*2.16/8;b=a+2.16/8
    def w(x,y,z):return (x,y,z+.055*(1-(x/1.1)**2))
    mesh('Curved windshield',[w(a,2.04,4.169),w(b,2.04,4.169),w(b,2.91,3.755),w(a,2.91,3.755)],[(0,1,2,3)],glass,truck)
line('Windshield rubber surround',[(-1.09,2.03,4.17),(1.09,2.03,4.17),(1.09,2.92,3.75),(-1.09,2.92,3.75),(-1.09,2.03,4.17)],.023,black,truck)
for x in [-.62,.48]:
    line('Windscreen wipers',[(x,2.0,4.22),(x+.15,2.19,4.13),(x+.44,2.20,4.125)],.016,black,truck)
mesh('Windshield sky reflection',[(-.98,2.74,3.86),(.95,2.85,3.81),(.96,2.77,3.86),(-.98,2.67,3.90)],[(0,1,2,3)],reflect,truck)
for side in [-1,1]:
    x=side*1.245
    mesh('Cab side glass',[(x,2.03,2.03),(x,2.91,2.03),(x,2.91,3.43),(x,2.08,3.83)],[(0,1,2,3)],glass,truck)
    line('Cab door seal',[(x,1.13,2.02),(x,1.13,3.67),(x,2.04,3.89),(x,2.95,3.47),(x,2.95,1.99),(x,1.13,2.02)],.014,black,truck)
    box('Door handle',(side*1.277,1.95,2.15),(.042,.12,.24),chrome,truck,.035)
    box('Handle recess',(side*1.267,1.95,2.15),(.026,.18,.32),black,truck,.035)
    line('Mirror bracket',[(side*1.2,2.77,3.68),(side*1.64,2.92,3.76),(side*1.65,2.4,3.75)],.028,black,truck)
    box('Main mirror housing',(side*1.69,2.65,3.75),(.25,.62,.22),black,truck,.07)
    box('Mirror glass',(side*1.69,2.65,3.625),(.19,.53,.016),steel,truck,.02)
    box('Lower blindspot mirror',(side*1.60,2.15,3.79),(.29,.24,.20),black,truck,.05)
    box('Cab access step',(side*1.27,.85,2.01),(.26,.12,.68),steel,truck,.025)
    for k in range(6):box('Step grip',(side*1.27,.918,1.76+k*.10),(.23,.012,.026),black,truck)
    orientation='left' if side<0 else 'right'
    text('Cab SF branding','SF EXPRESS',(side*1.275,1.70,2.62),.13,white,truck,orientation,BOLD)
    text('Cab Chinese branding','顺丰速运',(side*1.278,1.50,2.62),.135,white,truck,orientation)

# Aerodynamic roof fairing, smoothly rising toward the cargo box.
fair=[(3.16,1.72),(4.01,1.72),(3.95,2.08),(3.75,2.70),(3.40,3.30),(3.17,3.51)]
v=[(side*(1.24 if z<2.3 else 1.08),y,z) for side in [-1,1] for y,z in fair];n=len(fair)
mesh('Curved roof air deflector',v,[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],paint,truck,.1)
box('Front grille recess',(0,1.52,4.333),(1.57,.70,.065),black,truck,.07)
for y in [1.23,1.35,1.47]:box('Chrome grille blades',(0,y,4.38),(1.6,.035,.03),steel,truck,.012)
ring('Front manufacturer emblem',(0,1.78,4.39),.13,.019,chrome,truck,'z',24)
box('Front bumper',(0,.91,4.27),(2.57,.3,.20),paint,truck,.08)
line('Bumper silver accent',[(-1.14,1.10,4.36),(-.8,1.02,4.43),(.8,1.02,4.43),(1.14,1.10,4.36)],.033,steel,truck)
for side in [-1,1]:
    box('Tall headlamp housing',(side*1.02,1.55,4.308),(.33,.73,.09),lamp,truck,.05)
    for y,r in [(1.66,.105),(1.40,.075)]:tube('Projector headlamp',(side*1.02,y,4.36),(side*1.02,y,4.38),r,chrome,truck,24)
    box('Daytime LED strip',(side*1.16,1.53,4.37),(.028,.57,.015),led,truck,.01)
    box('Front foglamp',(side*.99,.91,4.39),(.26,.10,.03),lamp,truck,.025)
    box('Side turn lamp',(side*1.265,1.98,3.68),(.025,.07,.17),amber,truck,.02)
box('Front license plate',(0,.90,4.39),(.52,.17,.025),material('License plate blue',(.025,.12,.35)),truck,.015)
text('License plate','粤 B · SF01',(0,.9,4.409),.085,white,truck)

# Wheels have lathed sidewalls, multi-hole rims, lug nuts and geometric tread.
for side in [-1,1]:
    for is_front,z in [(True,2.85),(False,-2.75)]:
        g=group(('Wheel_F' if is_front else 'Wheel_R')+('L' if side<0 else 'R'),truck,(side*1.26,.57,z))
        profile=[(-.18,.33),(-.18,.43),(-.14,.53),(-.07,.565),(.07,.565),(.14,.53),(.18,.43),(.18,.33)]
        vs=[(x,r*math.sin(i*math.tau/56),r*math.cos(i*math.tau/56)) for x,r in profile for i in range(56)]
        fs=[]
        for j in range(len(profile)-1):
            for i in range(56):fs.append((j*56+i,j*56+(i+1)%56,(j+1)*56+(i+1)%56,(j+1)*56+i))
        mesh('Sculpted tire',vs,fs,rubber,g,smooth=True)
        tube('Inset silver wheel',(-.17,0,0),(.17,0,0),.345,steel,g,40)
        face=side*.19
        tube('Wheel hub',(face,0,0),(face+side*.09,0,0),.13,chrome,g,24)
        ring('Rim rolled lip',(face,0,0),.327,.018,chrome,g)
        for i in range(8):
            a=i*math.tau/8;y=.242*math.sin(a);zz=.242*math.cos(a)
            tube('Ventilation hole',(face,y,zz),(face+side*.008,y,zz),.048,black,g,12)
            y=.165*math.sin(a);zz=.165*math.cos(a)
            tube('Lug nut',(face,y,zz),(face+side*.033,y,zz),.025,chrome,g,6)
        for i in range(48):
            a=i*math.tau/48
            vs=[(x,.568*math.sin(a+shift),.568*math.cos(a+shift)) for x,shift in [(-.11,-.035),(.11,.035),(.11,.060),(-.11,-.010)]]
            mesh('Angled tread siping',vs,[(0,1,2,3)],groove,g)
        # Wheel arch is static relative to the chassis.
        pts=[(side*1.265,.57+.66*math.sin(a),z+.66*math.cos(a)) for a in [i*math.pi/28 for i in range(29)]]
        line('Raised wheel arch',pts,.075,black,truck)
        if not is_front:box('Rear mudflap',(side*1.25,.37,z-.66),(.42,.62,.055),rubber,truck,.012)

# Rear doors remain independent pivots, with attached locks and hinges.
for side in [-1,1]:
    g=group('DoorLeft' if side<0 else 'DoorRight',truck,(side*1.43,2.61,-4.27));x=-side*.70
    box('Door black panel',(x,0,0),(1.40,2.86,.085),paint,g,.025)
    for xx in [x-.68,x+.68]:box('Rear door edge',(xx,0,-.05),(.038,2.85,.035),steel,g,.009)
    for yy in [-1.4,1.4]:box('Rear door edge',(x,yy,-.05),(1.37,.045,.035),steel,g,.008)
    for yy in [-1,.0,1]:
        box('Door hinge',(0,yy,-.07),(.20,.12,.05),steel,g,.012)
        tube('Hinge pin',(0,yy-.09,-.11),(0,yy+.09,-.11),.025,chrome,g)
    tube('Vertical locking rod',(x,-1.27,-.10),(x,1.27,-.10),.022,steel,g)
    for yy in [-1.20,-.5,.5,1.20]:box('Rod bracket',(x,yy,-.08),(.10,.055,.08),chrome,g,.008)
    box('Door locking handle',(x-side*.13,-.65,-.14),(.3,.055,.04),steel,g,.012)
    text('Rear SF lettering','SF',(x,.6,-.07),.6,white,g,'rear',BOLD)
    box('Rear reflective band',(x,-1.06,-.07),(1.30,.085,.025),red,g)
box('Rear bumper',(0,.65,-4.43),(2.7,.15,.15),steel,truck,.025)
for side in [-1,1]:
    box('Rear light housing',(side*1.1,.91,-4.35),(.45,.19,.10),black,truck,.025)
    for j,m in enumerate([tail,amber,lamp]):box('Rear lenses',(side*1.1-.14+j*.14,.92,-4.41),(.12,.11,.02),m,truck,.018)

# Conveyor: nested frames, rollers, motor, support legs and operator controls.
def conveyor_section(g,width,length,level):
    box('Belt deck',(0,1.345+level*.006,0),(1.02,.065,length),belt,g,.012)
    for side in [-1,1]:
        box('Nested telescoping side channel',(side*width/2,1.18,0),(.10,.28,length),frame,g,.018)
        box('Yellow edge protection',(side*width/2,1.36,0),(.095,.09,length),yellow,g,.016)
        for z in [-length*.38,length*.38]:tube('Hex frame fastener',(side*(width/2+.052),1.18,z),(side*(width/2+.065),1.18,z),.026,steel,g,6)
        box('Telescoping slide rail',(side*(width/2-.065),1.10,0),(.035,.045,length-.15),steel,g,.008)
    for z in [-length/2+.12,length/2-.12]:
        tube('Crowned end roller',(-.54,1.255,z),(.54,1.255,z),.09,roller,g,24)
        for side in [-1,1]:box('Roller bearing block',(side*.59,1.255,z),(.10,.15,.17),black,g,.016)
base=group('ConveyorBase',conveyor,(0,0,2.9));conveyor_section(base,1.5,7.8,0)
for z in [-.8,1,3.5,5.7]:
    for side in [-1,1]:
        box('Adjustable support leg',(side*.63,.90,z),(.12,.62,.14),frame,conveyor,.012)
        tube('Threaded leveling foot',(side*.63,.63,z),(side*.63,.76,z),.035,steel,conveyor)
        box('Foot plate',(side*.63,.62,z),(.25,.045,.26),black,conveyor,.014)
    tube('Leg cross brace',(-.63,.85,z),(.63,.85,z),.04,steel,conveyor)
box('Gearbox',(1.0,1.10,4.75),(.35,.32,.35),steel,conveyor,.06)
tube('Drive motor',(1.13,1.09,4.75),(1.70,1.09,4.75),.17,frame,conveyor,24)
for x in [1.25,1.34,1.43,1.52,1.61]:ring('Motor cooling fins',(x,1.09,4.75),.18,.012,black,conveyor)
box('Operator pedestal',(.98,.94,5.62),(.10,.68,.10),steel,conveyor,.018)
box('Control panel',(1.02,1.29,5.62),(.51,.34,.40),frame,conveyor,.045)
box('Controller screen',(1.02,1.47,5.60),(.31,.015,.14),glass,conveyor,.012)
for x,m in [(.87,red),(1.03,frame),(1.18,yellow)]:tube('Control button',(x,1.47,5.76),(x,1.50,5.76),.032,m,conveyor,16)
tube('Emergency stop mushroom',(.82,1.47,5.57),(.82,1.54,5.57),.06,red,conveyor,20)
line('Motor cable',[(1.12,.96,4.75),(1.12,.77,5.2),(.98,.77,5.6),(.98,1.1,5.6)],.018,black,conveyor)
for i in range(3):
    g=group('BeltSection'+str(i+1),conveyor,(0,0,5.65));conveyor_section(g,1.42-i*.11,2.4,i+1)
    for side in [-1,1]:
        box('Nested section index',(side*(.77-i*.055),1.22,.7),(.018,.12,.22),white,g)
        for j in range(4):box('Yellow black warning marker',(side*(.77-i*.055),1.22,-.9+j*.13),(.022,.10,.07),yellow if j%2 else black,g)
text('Equipment label','SF · 伸缩输送机',(1.13,1.15,2.8),.11,white,conveyor,'right')

# Join by parent and material: preserve semantic pivots, minimize web draw calls.
parents=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
for parent in parents:
    buckets={}
    for o in list(parent.children):
        if o.type=='MESH':buckets.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in buckets.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=parent.name+'_'+name.replace(' ','_')

# Source and runtime export are kept together. Preview scene offsets only for rendering.
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'refined-equipment.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'refined-equipment.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True)
mesh_count=sum(o.type=='MESH' for o in bpy.context.scene.objects)
triangles=sum(len(f.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for f in o.data.polygons)
(ROOT/'equipment-info.json').write_text(json.dumps({'meshes':mesh_count,'triangles':triangles,'glbBytes':(ROOT/'refined-equipment.glb').stat().st_size,'truckReference':'User-supplied SF truck photograph; approximate geometry and recreated markings','pivots':['TruckAsset','CargoLeft','CargoRight','CargoRoof','CargoFront','DoorLeft','DoorRight','Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR','ConveyorAsset','BeltSection1','BeltSection2','BeltSection3']},indent=2),encoding='utf8')
print('REFINED_EQUIPMENT_EXPORTED',mesh_count,triangles,flush=True)
conveyor.location=B((5.7,0,0))
for i in range(3):bpy.data.objects['BeltSection'+str(i+1)].location=B((0,0,5.65+1.1*(i+1)))
box('Studio floor',(1,-.07,2),(20,.1,26),material('Studio floor',(.27,.31,.32)))
bpy.ops.object.camera_add(location=B((-12,8.5,17)));cam=bpy.context.object;cam.rotation_euler=(B((1.5,1.8,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18;bpy.context.scene.camera=cam
for pos,power,size in [((-7,11,8),2300,9),((4,10,-4),1800,8),((10,5,8),1500,7)]:
    bpy.ops.object.light_add(type='AREA',location=B(pos));l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(B((0,1,1))-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.70,.79,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'equipment-preview.png');bpy.ops.render.render(write_still=True)
