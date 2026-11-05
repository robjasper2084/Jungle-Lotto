"""Georeferenced distant Ambassador Bridge, static material batches.
OSM tower/bridge footprints; operator dimensions. Decorative LOD, not drivable.
"""
def add_ambassador():
    source=ET.parse(R/'research/ambassador-bridge.osm').getroot()
    ns={n.get('id'):project(float(n.get('lon')),float(n.get('lat'))) for n in source.findall('node')}
    ways={w.get('id'):w for w in source.findall('way')}
    def center(ident):
        refs=[n.get('ref') for n in ways[ident].findall('nd')][:-1]
        return Vector((*tuple(sum(ns[n][k] for n in refs)/len(refs) for k in range(2)),0))
    a,b=center('469346651'),center('656928839')
    axis=(b-a).normalized();cross=Vector((-axis.y,axis.x,0));span=(b-a).length;mid=(a+b)*.5
    mi=len(mats);mats.append(material('Ambassador blue steel',(.10,.27,.32),.38,.62));verts.append([]);faces.append([])
    def point(s,w,z):return mid+axis*s+cross*w+Vector((0,0,z))
    def beam3(p,q,width,depth=None,material_index=mi):
        v=verts[material_index];f=faces[material_index];offset=len(v);direction=(q-p).normalized()
        normal=direction.cross(Vector((0,0,1)))
        if normal.length<.01:normal=cross.copy()
        normal.normalize();up=direction.cross(normal).normalized()
        for origin in (p,q):
            for u,w in ((-1,-1),(1,-1),(1,1),(-1,1)):
                v.append(tuple(origin+normal*(width*u*.5)+up*((depth or width)*w*.5)))
        for face in ((0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)):f.append(tuple(offset+i for i in face))
    half=span*.5
    def deck(s):return 46.3-5*min(1,abs(s)/half)**2 if abs(s)<=half else max(8,41.3-(abs(s)-half)*.047)
    # Tower shafts, portal cross-bracing, and concrete pier shoes.
    for s in (-half,half):
        for side in (-1,1):
            beam3(point(s,side*11,5),point(s,side*9,117.65),3.6,4.8)
            beam3(point(s,side*11,-1),point(s,side*11,7),9,8,0)
        for z in (42,71,95,114):beam3(point(s,-10,z),point(s,10,z),2.4,2.4)
        for z,top in ((45,69),(73,93),(97,112)):
            beam3(point(s,-9,z),point(s,9,top),1.3)
            beam3(point(s,9,z),point(s,-9,top),1.3)
    # Twin open-lattice shafts and cap portals, visible from the Belle Isle approach.
    for s in (-half,half):
        for side in (-1,1):
            for z in range(9,113,7):
                w=side*(11-2*z/117.65)
                beam3(point(s-2.5,w,z),point(s+2.5,w,z+6),.32)
                beam3(point(s+2.5,w,z),point(s-2.5,w,z+6),.32)
        beam3(point(s,-12,117.65),point(s,12,117.65),1.1,1.1)
    # Main suspension, anchored side spans and open deck truss.
    extent=half+300
    for side in (-1,1):
        def cable(s):
            if abs(s)<=half:return 57+(117.65-57)*(s/half)**2
            return 117.65-(117.65-25)*(abs(s)-half)/300
        for i in range(100):
            s=-extent+i*(extent*2/100);t=-extent+(i+1)*(extent*2/100)
            beam3(point(s,side*9,cable(s)),point(t,side*9,cable(t)),1.15)
            if i%2==0 and abs(s)<half+235:beam3(point(s,side*9,deck(s)+1),point(s,side*9,cable(s)),.38)
        for i in range(76):
            s=-extent+i*(extent*2/76);t=-extent+(i+1)*(extent*2/76)
            beam3(point(s,side*9,deck(s)-3),point(t,side*9,deck(t)-3),1.1)
            beam3(point(s,side*9,deck(s)-3),point(t,side*9,deck(t)+1),.65)
    for i in range(76):
        s=-extent+i*(extent*2/76);t=-extent+(i+1)*(extent*2/76)
        beam3(point(s,0,deck(s)),point(t,0,deck(t)),18,1.4)
    for sign in (-1,1):
        beam3(point(sign*extent,0,0),point(sign*extent,0,25),22,30,0)
        for d in (75,150,225):
            s=sign*(half+d)
            for side in (-1,1):beam3(point(s,side*8,1),point(s,side*8,deck(s)-3),2.2)
    # Curb-mounted single-arm roadway luminaires. Symmetrical spacing is an
    # interpretation of reference photographs, not a surveyed fixture inventory.
    lamps=[];cable_lights=[];tower_lights=[]
    for s in range(-int(extent)+14,int(extent),36):
        for side in (-1,1):
            base=point(s,side*8.7,deck(s)+.85)
            neck=point(s,side*8.7,deck(s)+9.4)
            elbow=point(s,side*8.1,deck(s)+10.1)
            head=point(s,side*5.9,deck(s)+10.3)
            beam3(base,neck,.20);beam3(neck,elbow,.18);beam3(elbow,head,.18)
            beam3(head+axis*.55,head-axis*.55,.48,.17)
            lamps.append({'p':[head.x,head.z-.1,-head.y],'ground':[head.x,deck(s)+.72,-head.y]})
    for side in (-1,1):
        for i in range(121):
            s=-extent+2*extent*i/120;p=point(s,side*9,cable(s)+.65)
            cable_lights.append([p.x,p.z,-p.y])
        for s in (-half,half):
            p=point(s,side*9,119.3);tower_lights.append([p.x,p.z,-p.y])
    plan={'a':[a.x,0,-a.y],'b':[b.x,0,-b.y],'center':[mid.x,0,-mid.y],'span':span,'height':117.65,'roadway':lamps,'cables':cable_lights,'beacons':tower_lights,'source':'https://www.ambassadorbridge.com/bridge-facts/','fixturePlacement':'Photo-informed approximate spacing; OSM tower anchors'}
    (R/'game/src/belle/ambassadorLayout.json').write_text(json.dumps(plan,indent=2))
    inventory.append({'name':'Ambassador Bridge','source':'OSM 469346651 / 656928839','x':round(mid.x,2),'z':round(-mid.y,2),'span':round(span,2),'height':117.65,'detail':'Static distant silhouette; side spans approximate'})
    print('AMBASSADOR',round(span,2),'m mapped main span',tuple(mid))
add_ambassador()
