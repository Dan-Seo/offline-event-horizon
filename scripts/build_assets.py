"""Original, low-poly hero props. Run with Blender --background --python scripts/build_assets.py."""
import bpy, math, os, json
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')
os.makedirs(OUT, exist_ok=True)
SOURCE = os.path.join(ROOT, 'assets', 'source')
os.makedirs(SOURCE, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.45):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=roughness
    return m
wood=material('smoked_walnut',(.105,.061,.035),0,.33)
metal=material('graphite_aluminium',(.038,.046,.049),.65,.29)
edge=material('anodized_edges',(.12,.135,.14),.78,.22)
ceramic=material('ivory_ceramic',(.54,.49,.39),.05,.24)
dark=material('rubber',(.016,.02,.022),.1,.7)
brass=material('aged_brass',(.38,.23,.10),.75,.26)

def box(name,loc,size,mat,bevel=.02):
    # Author in world x / depth / height, export glTF y-up.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(loc[0],-loc[2],loc[1]))
    o=bpy.context.object; o.name=name; o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('edge_highlights','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons: p.use_smooth=True
    mod=o.modifiers.new('weighted_normals','WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,loc,radius,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=(loc[0],-loc[2],loc[1]))
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    b=o.modifiers.new('rim','BEVEL'); b.width=.012; b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons:p.use_smooth=True
    return o

box('desk_walnut',(0,1.12,0),(5.85,.16,2.65),wood,.045)
for x in (-2.48,2.48):
    for z in (-.94,.94): box('desk_leg',(x,.53,z),(.065,1.05,.065),metal,.008)
    box('desk_frame',(x,1.02,0),(.06,.1,2.2),metal,.009)
for name,x,y,z,w,h in [('main',-.47,2.32,-.64,2.46,1.43),('portrait',-2.18,2.24,-.54,.87,1.59)]:
    box(name+'_chassis',(x,y,z),(w,h,.11),metal,.035)
    box(name+'_stand',(x,1.47,z-.02),(.075,.62,.09),edge,.015)
    box(name+'_foot',(x,1.235,z+.09),(.64,.035,.35),metal,.018)
box('keyboard_shell',(-.4,1.253,.65),(1.9,.08,.61),edge,.035)
box('desk_mat',(-.32,1.211,.64),(3.34,.016,1.04),dark,.028)
box('mouse',(.98,1.274,.72),(.24,.11,.37),metal,.07)
box('laptop_base',(1.56,1.24,-.31),(1.28,.045,.78),edge,.025)
box('laptop_display',(1.56,1.65,-.66),(1.28,.78,.044),metal,.025)

# Closed lathed ceramic mug, hollow interior, real wall thickness.
profile=[(.0,.0),(.16,.0),(.18,.025),(.185,.31),(.177,.34),(.15,.34),(.153,.07),(.0,.07)]
verts=[]; faces=[]; N=48
for r,h in profile:
    for i in range(N):
        a=i/N*math.tau; verts.append((1.57+r*math.cos(a),-.55+r*math.sin(a),1.22+h))
for j in range(len(profile)-1):
    for i in range(N):
        ni=(i+1)%N; faces.append((j*N+i,j*N+ni,(j+1)*N+ni,(j+1)*N+i))
mesh=bpy.data.meshes.new('ceramic_lathe');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('coffee_mug',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(ceramic)
for p in mesh.polygons:p.use_smooth=True
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=10,location=(1.78,-.55,1.39),major_radius=.113,minor_radius=.031,rotation=(math.pi/2,0,0))
bpy.context.object.name='mug_handle';bpy.context.object.data.materials.append(ceramic)

cylinder('lamp_base',(2.42,1.24,-.72),.25,.065,metal)
cylinder('lamp_stem',(2.42,2.10,-.72),.021,1.75,brass)
box('lamp_arm',(2.03,2.96,-.72),(.81,.032,.035),brass,.01)
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.28,radius2=.12,depth=.21,location=(1.65,.72,2.86))
bpy.context.object.name='lamp_shade';bpy.context.object.data.materials.append(metal)

# One reusable rock source, hidden in the office. The current ecosystem is generated at runtime.
rock=box('source_rock',(0,-10,0),(.35,.24,.31),edge,.08)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,'office.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'office.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
stats={'objects':len(bpy.data.objects),'vertices':sum(len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH'),'materials':len(bpy.data.materials),'glb_bytes':os.path.getsize(os.path.join(OUT,'office.glb')),'textures':0,'animations':0,'coordinate_system':'glTF y-up; meters','source':'Original procedural Blender geometry; bevels and weighted normals applied.'}
with open(os.path.join(OUT,'asset-report.json'),'w') as f:json.dump(stats,f,indent=2)
print(json.dumps(stats))
