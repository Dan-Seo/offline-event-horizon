"""Original modular megastructure, authored in Blender and exported as two GLB LODs."""
import bpy, math, os, json, struct
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','assets'); SOURCE=os.path.join(ROOT,'assets','source')
os.makedirs(OUT,exist_ok=True);os.makedirs(SOURCE,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.5
    if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
    return m
alloy=mat('weathered_titanium',(.21,.24,.235),.72)
bone=mat('ceramic_ribs',(.62,.59,.48),.3)
dark=mat('recessed_graphite',(.027,.04,.04),.5)
light=mat('residual_circuit',(.30,.61,.53),.2,1.5)
def box(name,p,scale,m,angle=0,bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=name;o.dimensions=scale;o.rotation_euler.z=angle
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('machined_edges','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
    for f in o.data.polygons:f.use_smooth=True
    n=o.modifiers.new('weighted_normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=n.name)
    return o
for layer,(r,width,depth,n) in enumerate([(1,.105,.095,80),(.86,.035,.16,64),(1.13,.024,.04,96)]):
    for i in range(n):
        a=i/n*math.tau
        if (layer==0 and .55<a<.98) or (layer==1 and 3.6<a<4.3) or (layer==2 and 1.8<a<2.5):continue
        chord=2*math.pi*r/n*.91
        box('arc_module',(math.cos(a)*r,math.sin(a)*r,0),(width,chord,depth),bone if i%7==0 else alloy,a)
        if layer==0 and i%2==0:
            box('rib',(math.cos(a)*r,math.sin(a)*r,.065),(.16,.008,.05),bone,a,.001)
        if layer==1 and i%4==0:
            box('quiet_circuit',(math.cos(a)*r,math.sin(a)*r,.085),(.007,chord*.7,.003),light,a,0)
for i in range(12):
    a=i/12*math.tau
    if i==1:continue
    box('radial_buttress',(math.cos(a)*.985,math.sin(a)*.985,-.065),(.34,.024,.18),dark,a,.002)
    for s in (-1,1):
        box('suspended_fins',(math.cos(a)*1.22,math.sin(a)*1.22,s*.085),(.18,.025,.055),alloy,a,.003)
# A small observatory suspended in the open gate gives a human-scale reference.
box('observatory',(0,0,-.06),(.025,.065,.022),bone,0,.002)
for sign in (-1,1):box('solar_wing',(sign*.065,0,-.06),(.082,.07,.002),dark,0,0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE,'cathedral.blend'))
# Join by material to retain four draw calls rather than hundreds of modules.
for material in [alloy,bone,dark,light]:
    bpy.ops.object.select_all(action='DESELECT');members=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==material]
    for o in members:o.select_set(True)
    bpy.context.view_layer.objects.active=members[0];bpy.ops.object.join()
    obj=bpy.context.object;obj.name=material.name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='SELECT')
reports=[]
for lod in ('high','low'):
    if lod=='low':
        for obj in bpy.context.selected_objects:
            bpy.context.view_layer.objects.active=obj;d=obj.modifiers.new('distant_silhouette','DECIMATE');d.ratio=.26;bpy.ops.object.modifier_apply(modifier=d.name)
    for obj in bpy.context.selected_objects:
        obj.data.validate(clean_customdata=False);obj.data.update()
    path=os.path.join(OUT,'cathedral'+('' if lod=='high' else '-low')+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
    raw=open(path,'rb').read();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);p=[p for m in g['meshes'] for p in m['primitives']]
    reports.append(dict(lod=lod,bytes=len(raw),primitives=len(p),materials=len(g['materials']),vertices=sum(g['accessors'][a['attributes']['POSITION']]['count'] for a in p),triangles=sum(g['accessors'][a['indices']]['count']//3 for a in p),normals=all('NORMAL' in a['attributes'] for a in p),uvs=all('TEXCOORD_0' in a['attributes'] for a in p),textures=len(g.get('textures',[]))))
with open(os.path.join(OUT,'cathedral-report.json'),'w') as f:json.dump({'authoring':'Original procedural Blender geometry; normalized radius 1; glTF y-up','lods':reports},f,indent=2)
print(json.dumps(reports))
