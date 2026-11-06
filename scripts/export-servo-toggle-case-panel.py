"""Validate and export the modular case panel from the matching generated input.

Run export-servo-toggle-case-panel.ts first. The files contain millimetres.
Every printable is exported independently with its intended bed face at Z0.
"""
import hashlib
import ast
from html import escape
import json
import os
from pathlib import Path
import runpy
import shutil
import sys
import zipfile

sys.path.insert(0, os.environ.get('FREECAD_LIB', '/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App
import Part
import Mesh
import MeshPart


def leaves(parent):
    for child in parent.Group:
        if child.TypeId == 'App::Part':
            yield from leaves(child)
        else:
            yield child


def boxes_overlap(first, second):
    return all(min(getattr(first, axis + 'Max'), getattr(second, axis + 'Max')) -
               max(getattr(first, axis + 'Min'), getattr(second, axis + 'Min')) >= 1e-6
               for axis in 'XYZ')


large_parts = {}
shape_boxes = {}


def shape_bounds(shape):
    cached = shape_boxes.get(id(shape))
    if cached is None:
        cached = (shape, shape.BoundBox)
        shape_boxes[id(shape)] = cached
    return cached[1]


def solid_parts(shape):
    cached = large_parts.get(id(shape))
    if cached is not None:
        return cached[1]
    parts = [(solid, solid.BoundBox) for solid in shape.Solids]
    if len(parts) >= 32:
        # Retain the parent reference so Python cannot recycle its identity.
        large_parts[id(shape)] = (shape, parts)
    return parts


def positive_overlap(a, b):
    if not boxes_overlap(shape_bounds(a), shape_bounds(b)):
        return 0
    first, second = solid_parts(a), solid_parts(b)
    if max(len(first), len(second)) >= 32:
        return sum(left.common(right).Volume
                   for left, left_box in first for right, right_box in second
                   if boxes_overlap(left_box, right_box))
    return a.common(b).Volume


def connector_access_audit(case, shapes, case_fit):
    """Explicit installation studies; these envelopes are not cable occurrences."""
    module_ids = {'case-servo-driver-hat', 'case-heltec-v4', 'case-adc-cjmcu1220',
                  'case-buck-1', 'case-buck-2', 'case-lc-filter-1', 'case-lc-filter-2'}
    service_ids = {record['id'] for record in case['components']
                   if (record['id'] in {'case-lower-body','case-lower-cradle','case-pwm-backing'} or record['id'].startswith('case-electronics-')
                       or record['id'] in {id for row in case['mechanicalStructure']['brassSupports']['supports']for id in row['retainedComponentIds']}
                       or record['id'] in module_ids
                       or record['id'] in {'case-test-clip-carrier','case-test-clip-red','case-test-clip-black','case-pwm-mosfet','case-pwm-keeper'})}
    checks = []
    for reserve in case['electronicsAccess']['reserves']:
        low, high = reserve['min'], reserve['max']
        envelope = Part.makeBox(*(high[axis]-low[axis] for axis in range(3)), App.Vector(*low))
        violations = []
        if reserve['scope'] == 'installed' and not case_fit['box_inside'](case['caseEnvelope'], envelope.BoundBox, True):
            allowed = case_fit['enclosure_fixture'](case['caseEnvelope'])[0]
            volume = envelope.cut(allowed).Volume
            if volume > .001:
                violations.append({'target': 'measured-case-cavity', 'volumeMm3': volume})
        checked = 0
        for record, target in zip(case['components'], shapes):
            if record['id'] == reserve['hostId']:
                continue
            if reserve['scope'] == 'detached-body' and record['id'] not in service_ids:
                continue
            checked += 1
            volume = positive_overlap(envelope, target)
            if volume > .001:
                violations.append({'target': record['id'], 'volumeMm3': volume})
        checks.append({**reserve, 'checkedComponentCount': checked,
                       'passed': not violations, 'violations': violations})
        print('NATIVE_CONNECTOR_ACCESS=' + json.dumps(checks[-1]), flush=True)
    return checks


def shared_lid_head_seats(case, shapes):
    index = {record['id']: i for i, record in enumerate(case['components'])}
    lid = shapes[index['parallel-clamp']]
    rows=[]
    for number in range(1,5):
        record=case['components'][index['case-lid-screw-'+str(number)]]
        screw=shapes[index[record['id']]]
        underhead=screw.BoundBox.ZMax-record['parameters']['headHeight']
        x,y=record['placement']['translation'][:2]
        outer=record['parameters']['headSize']/2-.05
        bore=1.7
        def annulus(z,height):
            return Part.makeCylinder(outer,height,App.Vector(x,y,z)).cut(Part.makeCylinder(bore,height+.02,App.Vector(x,y,z-.01)))
        probe=annulus(underhead-.05,.05)
        area=probe.common(lid).Volume/.05
        assert area>=12.5,(record['id'],'insufficient continuous M3 bearing',area)
        assert probe.cut(lid).Volume<1e-6,(record['id'],'interrupted bearing annulus')
        web=annulus(underhead-.99,.98)
        assert web.cut(lid).Volume<1e-5,(record['id'],'missing1mm lid bearing web')
        rows.append({'id':record['id'],'headDiameterMm':record['parameters']['headSize'],'boreDiameterMm':2*bore,'probeAreaMm2':area,'continuousBearingAnnulus':True,'continuousWebNominalMm':1})
    return rows


def underside_drawing(case, shapes, output):
    """One-to-one packaging view using the audited BRep envelopes and floor section."""
    by_id = {meta['id']: shape for meta, shape in zip(case['components'], shapes)}
    width, height = case['layout']['width'], case['layout']['height']
    paper_width, paper_height = width + 40, height + 64

    def point(x, y):
        # From below, operator +X points left and operator +Y points up.
        return 20 + case['layout']['max'][0] - x, 30 + case['layout']['max'][1] - y

    def label(x, y, value, size=2.7, colour='#23313b'):
        xx, yy = point(x, y)
        return f'<text x="{xx}" y="{yy}" text-anchor="middle" font-size="{size}" fill="{colour}">{escape(value)}</text>'

    def rectangle(bounds, colour, fill='none', dashed=False):
        xx, yy = point(bounds.XMax, bounds.YMax)
        dash = ' stroke-dasharray="2 1"' if dashed else ''
        return f'<rect x="{xx}" y="{yy}" width="{bounds.XLength}" height="{bounds.YLength}" stroke="{colour}" fill="{fill}"{dash}/>'

    def circle(x, y, radius, colour, fill='white'):
        xx, yy = point(x, y)
        return f'<circle cx="{xx}" cy="{yy}" r="{radius}" stroke="{colour}" fill="{fill}"/>'

    svg = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<svg xmlns="http://www.w3.org/2000/svg" width="{paper_width}mm" height="{paper_height}mm" viewBox="0 0 {paper_width} {paper_height}">',
           '<style>text{font-family:Arial,sans-serif}path,rect,circle,line{stroke-width:.25}</style>',
           f'<rect width="{paper_width}" height="{paper_height}" fill="white"/>',
           f'<text x="{paper_width/2}" y="9" text-anchor="middle" font-size="4">Case panel / underside electronics</text>',
           f'<text x="{paper_width/2}" y="15" text-anchor="middle" font-size="2.7">View from below: +X left / +Y up. Dimensions in mm. Scale 1:1 / print at 100%.</text>',
           f'<rect x="20" y="30" width="{width}" height="{height}" rx="{case["caseEnvelope"]["cornerRadius"]}" stroke="#637381" fill="#f6f8fa"/>']
    deck = by_id['case-lower-body']
    floor_paths = []
    for wire in deck.slice(App.Vector(0, 0, 1), deck.BoundBox.ZMin + .15):
        vertices = wire.discretize(Deflection=.04)
        if vertices:
            coords = [point(p.x, p.y) for p in vertices]
            floor_paths.append('M ' + ' L '.join(f'{x:.5f},{y:.5f}' for x, y in coords) + ' Z')
    assert floor_paths, 'Missing electronics floor section for underside drawing'
    svg.append(f'<path d="{" ".join(floor_paths)}" stroke="#8d7342" fill="#f1e5c9" fill-rule="evenodd"/>')
    for number,(x,y) in enumerate(case['layout']['batteries'],1):
        svg.extend([rectangle(by_id['case-battery-pack-'+str(number)].BoundBox,'#6c869a',dashed=True),
                    label(x,y,'PACK '+str(number),2.6)])
    q0,q1=case['electronics']['quietPodMin'],case['electronics']['quietPodMax']
    svg.append(rectangle(App.BoundBox(q0[0],q0[1],0,q1[0],q1[1],1),'#49836b',dashed=True))
    svg.append(label(192,132,'EXTERIOR FOIL HOOD',2.2,'#38705a'))
    for x,y in case['electronics']['bodyMountAxes']:
        svg.extend([circle(x,y,4.5,'#6b766e','none'),circle(x,y,1.7,'#4e6474')])
    modules = [
        ('case-servo-driver-hat', 'HAT (A)', '#d2e4d2'),
        ('case-heltec-v4', 'HELTEC V4', '#e2d9ee'),
        ('case-adc-cjmcu1220', 'ADC / 22 x 21', '#d5e4f0'),
        ('case-buck-1', 'BEC 1 / 40 x 20', '#d5e4f0'),
        ('case-buck-2', 'BEC 2 / 40 x 20', '#d5e4f0'),
        ('case-lc-filter-1', 'LC 1', '#d5e4f0'),
        ('case-lc-filter-2', 'LC 2', '#d5e4f0'),
    ]
    for id, name, fill in modules:
        bounds = by_id[id].BoundBox
        svg.extend([rectangle(bounds, '#4e6474', fill),
                    label((bounds.XMin+bounds.XMax)/2, (bounds.YMin+bounds.YMax)/2-1, name,
                          2.1 if 'filter' in id else 2.7)])
    svg.extend([rectangle(by_id['case-pwm-mosfet'].BoundBox,'#b56549',dashed=True),label(181,52,'PWM ABOVE HAT',2.3,'#9c503b')])
    for reserve in case['electronicsAccess']['reserves']:
        low, high = reserve['min'], reserve['max']
        bounds = App.BoundBox(*low, *high)
        colour = '#39885d' if 'lead-reserve' in reserve['id'] else '#b06b22' if reserve['scope'] == 'installed' else '#8054a2'
        mouth = reserve['mouth']
        end = [mouth[axis] + reserve['outward'][axis] * 12 for axis in range(2)]
        x1, y1 = point(*mouth[:2])
        x2, y2 = point(*end)
        svg.extend([rectangle(bounds, colour, dashed=True),
                    f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{colour}"/>'])
    for meta in case['components']:
        if meta['id'].startswith('case-electronics-') and '-screw-' in meta['id']:
            x, y = meta['placement']['translation'][:2]
            svg.append(circle(x, y, meta['parameters']['headSize']/2, '#4e6474'))
    for x, y in case['layout']['mountingHoles']:
        svg.append(circle(x, y, 2.25, '#2451a5'))
    svg.extend([
        label(case['layout']['centre'][0], case['layout']['max'][1]+8, f'{width} panel width / {height} panel height', 3),
        f'<text x="20" y="{paper_height-31}" font-size="2.6">Tan: exact floor section. Blue dashes: battery bank. Circles: fastener heads.</text>',
        f'<text x="20" y="{paper_height-25}" font-size="2.6">Orange: HAT power plug. Green: straight15mm lead study. Purple: compact USB studies on detached body. No cables modeled.</text>',
        f'<text x="20" y="{paper_height-19}" font-size="2.6">Board rectangles: audited occupied XY envelopes. ADC, BEC and LC recipes are provisional; verify real boards.</text>',
        f'<text x="20" y="{paper_height-13}" font-size="2.6">Bench service: lift insert out, disconnect leads, remove four shared lid ties, support upper parts, then lower the body.</text>',
        f'<text x="20" y="{paper_height-7}" font-size="2.6">Depth below panel top: {case["layout"]["panelTop"] - min(shape.BoundBox.ZMin for shape in shapes):.1f} mm including flush heads. Source {case["codeSha256"][:16]}.</text>',
        '</svg>'])
    (output / 'case-panel-underside-layout.svg').write_text('\n'.join(svg) + '\n')


def side_clearance_drawing(case, output):
    """Dimensioned projected height study; no supplier case wall CAD is implied."""
    data, layout = case['caseEnvelope'], case['layout']
    cx = data['centre'][0]
    top_width, bottom_width = data['topOpening'][0], data['bottomOpening'][0]
    groove_width = data['grooveSize'][0]
    roof, ledge, rim, floor = [data[k] for k in
                              ['lidCeilingZ', 'grooveFloorZ', 'rimZ', 'innerFloorZ']]
    insert_floor, face = layout['batteryFloorBottom'], layout['panelTop']
    cover, battery = data['closedCoverTopZ'], layout['batteryTop']

    def point(x, z):
        return 30 + x, 25 + roof - z

    def line(x1, z1, x2, z2, colour='#526776', dash=''):
        a, b = point(x1, z1), point(x2, z2)
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        return f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{colour}"{extra}/>'

    def label(x, z, value, size=2.6, anchor='middle'):
        xx, yy = point(x, z)
        return f'<text x="{xx}" y="{yy}" text-anchor="{anchor}" font-size="{size}">{escape(value)}</text>'

    def rect(xmin, xmax, zmin, zmax, colour, fill):
        xx, yy = point(xmin, zmax)
        return f'<rect x="{xx}" y="{yy}" width="{xmax-xmin}" height="{zmax-zmin}" stroke="{colour}" fill="{fill}"/>'

    def dimension(x, lower, upper, title):
        return [line(x, lower, x, upper), line(x-1.5, lower, x+1.5, lower),
                line(x-1.5, upper, x+1.5, upper), label(x+2, (lower+upper)/2, title, 2.6, 'start')]

    def relative(z):
        return f'{z-ledge:+g}' if abs(z-ledge)>1e-9 else '0'

    svg = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<svg xmlns="http://www.w3.org/2000/svg" width="310mm" height="153mm" viewBox="0 0 310 153">',
           '<style>text{font-family:Arial,sans-serif;fill:#25343d}path,rect,line{stroke-width:.3}</style>',
           '<rect width="310" height="153" fill="white"/>',
           '<text x="155" y="9" text-anchor="middle" font-size="4">INTERTOOL BX-0151 / measured clearance study</text>',
           '<text x="155" y="15" text-anchor="middle" font-size="2.7">Projected features / scale 1:1 / mm / height 0 = floor of the separate panel-seat groove</text>']
    a, b = cx-top_width/2, cx+top_width/2
    c, d = cx-bottom_width/2, cx+bottom_width/2
    g0, g1 = cx-groove_width/2, cx+groove_width/2
    svg.extend([line(a, ledge, c, floor), line(c, floor, d, floor), line(d, floor, b, ledge),
                line(g0, ledge, a, ledge), line(b, ledge, g1, ledge),
                line(g0, ledge, g0, rim), line(g1, ledge, g1, rim),
                line(g0, rim, g1, rim, '#526776', '2 1'),
                line(a, roof, b, roof, '#526776', '2 1'),
                rect(cx-layout['width']/2, cx+layout['width']/2,
                     layout['panelBottom'], face, '#60768b', '#cbd7e0'),
                rect(cx-data['ringOuterSize'][0]/2, cx+data['ringOuterSize'][0]/2,
                     data['gasketBottomZ'], data['gasketTopZ'], '#3e565c', '#3e565c'),
                rect(cx-data['ringOuterSize'][0]/2, cx+data['ringOuterSize'][0]/2,
                     data['ringFlangeBottomZ'], data['ringFlangeTopZ'], '#60768b', '#b4c5d4')])
    for x in [data['mountingAxes'][0][0], data['mountingAxes'][-1][0]]:
        svg.append(rect(x-data['postRadius'], x+data['postRadius'], data['postBottomZ'],
                        data['postTopZ'], '#60768b', '#b4c5d4'))
    pack_x = layout['batteries'][0][0]
    svg.extend([rect(pack_x-layout['batterySize'][0]/2, pack_x+layout['batterySize'][0]/2,
                     layout['batteryBottom'], battery, '#577c49', '#d5e6cd'),
                line(6, insert_floor, 208, insert_floor, '#9d723a'),
                line(9, cover, 145, cover, '#a3524b', '2 1'),
                label(77, cover-4, f'Closed covers {relative(cover)}'),
                label(pack_x, battery-8, f'Battery top {relative(battery)}'),
                label(132, face+2, f'Working face {relative(face)}'),
                label(105, insert_floor+3, f'Insert floor {relative(insert_floor)}'),
                label(105, floor-5, f'Case floor {relative(floor)}'),
                label(150, roof+2, f'Lid roof {relative(roof)}'),
                label(173, ledge-6, f'Seat floor {relative(ledge)} / rim {relative(rim)}'),
                label(145, data['ringFlangeTopZ']+3, f'Adapter top {relative(data["ringFlangeTopZ"])}')])
    svg.extend(dimension(225, floor, ledge, f'{data["bodyDepth"]:g} body'))
    svg.extend(dimension(240, rim, roof, f'{roof-rim:g} lid'))
    svg.extend(dimension(257, ledge, rim, f'{rim-ledge:g} groove'))
    svg.extend(dimension(257, insert_floor, face, f'{face-insert_floor:g} depth'))
    svg.extend([
        label(150, floor-11, f'{insert_floor-floor:g} mm floor gap / {roof-cover:g} mm roof gap / {layout["batteryTop"]-face:g} mm battery projection above face'),
        '<text x="20" y="140" font-size="2.6">User-measured ideal taper and lid height. CornerR6 is inferred. Lid ribs and local molded features are not modeled.</text>',
        '<text x="20" y="146" font-size="2.6">The free panel seat is separate from the factory lid seal. Confirm actual fit, button head and wiring before assembly.</text>',
        '</svg>'])
    (output / 'case-side-clearance.svg').write_text('\n'.join(svg)+'\n')


case = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-case-panel-print-case.json').read_text())
output = Path(case['output'])
output.mkdir(parents=True, exist_ok=True)
assert hashlib.sha256(case['script'].encode()).hexdigest() == case['codeSha256']
if os.environ.get('CASE_PANEL_RESUME_EXPORT'):
    checkpoint=json.loads((output/'native-geometry-checkpoint.json').read_text())
    assert checkpoint['sourceCodeSha256']==case['codeSha256']
    validation_file=output/'case-panel-native-validation.FCStd'
    assert hashlib.sha256(validation_file.read_bytes()).hexdigest()==checkpoint['validationFcstdSha256']
    doc=App.openDocument(str(validation_file))
    root=doc.RootObjects[0]
    children=sorted(leaves(root),key=lambda obj:obj.ComponentIndex)
    assert len(children)==len(case['components'])
    shapes=[obj.Shape for obj in children]
    for record,shape in zip(case['components'],shapes):
        assert shape.isValid() and shape.isClosed() and shape.Volume>0,record['id']
        if record['supply']=='manufactured':assert len(shape.Solids)==1,record['id']
    case_fit_report=checkpoint['caseFit'];overlaps=checkpoint['intersections']
    access_checks=checkpoint['connectorAccess'];head_seat=checkpoint['sharedLidHeadSeats'];retention=checkpoint['retention'];structure=checkpoint['structure'];wall_mounts=checkpoint['wallMounts']
    assert case_fit_report['passed'] and not overlaps and all(row['passed'] for row in access_checks) and retention['passed'] and structure['passed'] and wall_mounts['passed']
    print('NATIVE_EXPORT_RESUMED='+case['codeSha256'],flush=True)
else:
    doc = App.newDocument('ModularCasePanelExport')
    class SourceCache(dict):
        def __init__(self):
            super().__init__()
            self.used = set()
            self.persist = None
        def __getitem__(self, source):
            self.used.add(source)
            return super().__getitem__(source)
        def __setitem__(self,source,value):
            fresh=source not in self
            super().__setitem__(source,value)
            if fresh and self.persist:self.persist(source,value)

    library_cache = SourceCache()
    if os.environ.get('CASE_PANEL_NATIVE_SEED_CACHE'):
        seed_directory = Path(os.environ['CASE_PANEL_NATIVE_SEED_CACHE'])
        seed = json.loads((seed_directory / 'manifest.json').read_text())
        needed_sources={node.args[0].value for node in ast.walk(ast.parse(case['script']))
                        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name)
                        and node.func.id=='_pl_component' and node.args and isinstance(node.args[0],ast.Constant)}
        for entry in seed['entries']:
            if entry['source'] not in needed_sources:continue
            digest = hashlib.sha256(entry['source'].encode()).hexdigest()
            assert entry['file'] == digest+'.brep'
            file = seed_directory / entry['file']
            assert hashlib.sha256(file.read_bytes()).hexdigest() == entry['sha256']
            shape = Part.Shape()
            shape.read(str(file))
            assert shape.isValid() and shape.isClosed()
            assert len(shape.Solids) == entry['solids'] and len(shape.Faces) == entry['faces']
            assert abs(shape.Volume-entry['volumeMm3']) <= max(1e-7, abs(entry['volumeMm3'])*1e-9)
            library_cache[entry['source']] = (shape, entry['metadata'], entry['labels'])
        print('NATIVE_SEED_CACHE_LOADED='+str(len(library_cache)), flush=True)
    if os.environ.get('CASE_PANEL_NATIVE_CACHE'):
        progress_cache=Path(os.environ['CASE_PANEL_NATIVE_CACHE']);progress_cache.mkdir(parents=True,exist_ok=True)
        progress_entries={}
        for entry in seed['entries'] if os.environ.get('CASE_PANEL_NATIVE_SEED_CACHE') else []:
            if entry['source'] not in library_cache:continue
            destination=progress_cache/entry['file']
            if destination.resolve()!=(seed_directory/entry['file']).resolve():
                shutil.copyfile(seed_directory/entry['file'],destination)
            progress_entries[entry['source']]=entry
        def persist_native_source(source,value):
            shape,metadata,labels=value
            file=progress_cache/(hashlib.sha256(source.encode()).hexdigest()+'.brep')
            shape.exportBrep(str(file))
            progress_entries[source]={'source':source,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                'volumeMm3':shape.Volume,'solids':len(shape.Solids),'faces':len(shape.Faces),'metadata':metadata,'labels':labels}
            (progress_cache/'manifest.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],
                'complete':False,'entries':list(progress_entries.values())}))
        library_cache.persist=persist_native_source
    build_index=[0]
    def trace_component_source(source):
        number=build_index[0];build_index[0]+=1
        print('NATIVE_BUILD='+json.dumps({'index':number,'id':case['components'][number]['id'],'exactCachedSource':source in library_cache}),flush=True)
        return source
    native_source=case['script'].replace('_pl_component_cache = {}','_pl_component_cache = _case_panel_cache')
    lines=[]
    for line in native_source.splitlines():
        if line.lstrip().startswith('component, local_metadata = _pl_component('):
            line=line.replace('_pl_component(','_pl_component(_case_trace_source(',1)+')'
        lines.append(line)
    exec('\n'.join(lines),{'_case_panel_cache':library_cache,'_case_trace_source':trace_component_source})
    assert build_index[0]==len(case['components'])
    root = doc.RootObjects[0]
    children = sorted(leaves(root), key=lambda obj: obj.ComponentIndex)
    assert len(children) == len(case['components'])
    doc.recompute()
    doc.saveAs(str(output / 'case-panel-native-validation.FCStd'))
    overlaps = []
    shapes = [obj.Shape for obj in children]
    for record, shape in zip(case['components'], shapes):
        assert shape.isValid() and shape.isClosed() and shape.Volume > 0, record['id']
        if record['supply'] == 'manufactured':
            assert len(shape.Solids) == 1, (record['id'], 'disconnected printable', len(shape.Solids))
    print('NATIVE_PREFLIGHT_ALL_SOLIDS_VALID='+str(len(shapes)), flush=True)
    if os.environ.get('CASE_PANEL_NATIVE_CACHE'):
        cache_directory = Path(os.environ['CASE_PANEL_NATIVE_CACHE'])
        cache_directory.mkdir(parents=True, exist_ok=True)
        entries = []
        for source in sorted(library_cache.used):
            shape, metadata, labels = library_cache[source]
            digest = hashlib.sha256(source.encode()).hexdigest()
            file = cache_directory / (digest + '.brep')
            shape.exportBrep(str(file))
            entries.append({'source': source, 'file': file.name,
                            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                            'volumeMm3': shape.Volume, 'solids': len(shape.Solids),
                            'faces': len(shape.Faces), 'metadata': metadata, 'labels': labels})
        manifest = cache_directory / 'manifest.json'
        temporary = manifest.with_suffix('.tmp')
        temporary.write_text(json.dumps({'sourceCodeSha256': case['codeSha256'], 'entries': entries}))
        temporary.replace(manifest)
        print('NATIVE_CACHE_READY=' + str(manifest), flush=True)
    case_fit = runpy.run_path(str(Path(__file__).with_name('case-panel-native-fixture.py')))
    case_fit_report = case_fit['audit_case_fit'](case['caseEnvelope'], case['components'], shapes,
                                              mounting=case['wallMounts'])
    case_fit_report['sourceCodeSha256'] = case['codeSha256']
    (output / 'native-case-fit-validation.json').write_text(json.dumps(case_fit_report, indent=2) + '\n')
    print('NATIVE_CASE_FIT=' + json.dumps(case_fit_report), flush=True)
    for index, a in enumerate(shapes):
        for other_index in range(index + 1, len(children)):
            volume = positive_overlap(a, shapes[other_index])
            if volume > 1e-3:
                row = {'first': case['components'][index]['id'],
                       'second': case['components'][other_index]['id'], 'volumeMm3': volume}
                overlaps.append(row)
                print('NATIVE_INTERSECTION=' + json.dumps(row), flush=True)
    (output / 'native-intersections.json').write_text(json.dumps({
        'sourceCodeSha256': case['codeSha256'], 'componentCount': len(children),
        'thresholdMm3': .001, 'unintendedIntersections': overlaps,
    }, indent=2) + '\n')
    print('NATIVE_INTERSECTIONS=' + json.dumps(overlaps), flush=True)
    if os.environ.get('CASE_PANEL_AUDIT_ONLY'):
        print('NATIVE_STAGED_AUDIT_COMPLETE', flush=True)
        sys.exit(0 if not overlaps and case_fit_report['passed'] else 1)
    assert not overlaps, 'Unintended physical component intersections: ' + json.dumps(overlaps)
    assert case_fit_report['passed'], 'Case fit: ' + json.dumps(case_fit_report['violations'])
    access_checks = connector_access_audit(case, shapes, case_fit)
    assert all(check['passed'] for check in access_checks), 'Connector access: ' + json.dumps(access_checks)
    head_seat = shared_lid_head_seats(case, shapes)
    print('NATIVE_SHARED_LID_HEAD_SEATS=' + json.dumps(head_seat), flush=True)
    retention=runpy.run_path(str(Path(__file__).with_name('case-panel-retention-fixture.py')))['audit_retention'](case,shapes,positive_overlap,case_fit)
    print('NATIVE_RETENTION=' + json.dumps(retention),flush=True)
    assert retention['passed'], 'Retention and foil study: '+json.dumps(retention)
    (output/'native-retention-validation.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],**retention},indent=2)+'\n')
    structure=runpy.run_path(str(Path(__file__).with_name('case-panel-structure-fixture.py')))['audit_structure'](case,shapes,positive_overlap)
    structure['honeycomb']=runpy.run_path(str(Path(__file__).with_name('case-panel-structure-fixture.py')))['audit_honeycomb'](case,shapes,positive_overlap)
    structure['passed']=structure['passed']and structure['honeycomb']['passed']
    structure['guardSweep']=runpy.run_path(str(Path(__file__).with_name('case-panel-structure-fixture.py')))['audit_guard_sweep'](case,shapes,positive_overlap)
    structure['passed']=structure['passed']and structure['guardSweep']['passed']
    (output/'native-structure-validation.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],**structure},indent=2)+'\n')
    print('NATIVE_STRUCTURE='+json.dumps(structure),flush=True)
    assert structure['passed'], 'Continuous shell and board load-path study: '+json.dumps(structure)
    wall_mounts=runpy.run_path(str(Path(__file__).with_name('case-panel-wall-mount-fixture.py')))['audit_wall_mounts'](case,shapes,positive_overlap,case['wallMounts'],case_fit)
    (output/'native-wall-mount-validation.json').write_text(json.dumps({'sourceCodeSha256':case['codeSha256'],**wall_mounts},indent=2)+'\n')
    print('NATIVE_WALL_MOUNTS='+json.dumps(wall_mounts),flush=True)
    assert wall_mounts['passed'], 'Internal side mounts and SP20 tool study: '+json.dumps(wall_mounts)
    baseline=json.loads(Path(__file__).with_name('servo-toggle-case-panel-volume-baseline.json').read_text())
    volumes=[{'id':r['id'],'volumeMm3':shape.Volume}for r,shape in zip(case['components'],shapes)if r['supply']=='manufactured']
    total=sum(r['volumeMm3']for r in volumes)
    comparison={'sourceCodeSha256':case['codeSha256'],'baseline':baseline,'parts':volumes,'totalPrintVolumeMm3':total,
        'changeMm3':total-baseline['totalPrintVolumeMm3'],'changePercent':(total/baseline['totalPrintVolumeMm3']-1)*100,
        'limits':'Solid BRep volumes only. Support, wall count, infill, speeds and orientations affect real print time; no slicer prediction is made.'}
    (output/'native-print-volume-comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
    underside_drawing(case, shapes, output)
    side_clearance_drawing(case, output)
    geometry_checkpoint = {
        'sourceCodeSha256': case['codeSha256'],
        'validationFcstdSha256': hashlib.sha256((output/'case-panel-native-validation.FCStd').read_bytes()).hexdigest(),
        'caseFit': case_fit_report, 'intersections': overlaps,
        'connectorAccess': access_checks, 'sharedLidHeadSeats': head_seat, 'retention': retention, 'structure': structure, 'wallMounts': wall_mounts,
    }
    (output/'native-geometry-checkpoint.json').write_text(json.dumps(geometry_checkpoint,indent=2)+'\n')
rows = []
mesh_failures = []
for obj, meta in zip(children, case['components']):
    shape = obj.Shape
    assert shape.isValid() and shape.isClosed() and shape.Volume > 0, meta['id']
    if meta['supply'] != 'manufactured':
        continue
    shape = shape.copy()
    operator_bounds=shape.BoundBox
    operator_bounds_row={'min':[operator_bounds.XMin,operator_bounds.YMin,operator_bounds.ZMin],'max':[operator_bounds.XMax,operator_bounds.YMax,operator_bounds.ZMax]}
    assert len(shape.Solids) == 1, (meta['id'], 'disconnected printable')
    # Front lettering, broad keeper faces, and the adapter flange are intentional beds.
    if meta['id']=='case-pwm-keeper':
        shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0),90)
    elif meta['id']=='case-lower-cradle':
        assert case['mechanicalStructure']['printRotations'][meta['id']]==[180,0,0]
        shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)
    elif meta['id']=='case-pwm-backing':
        shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0),-90)
    elif meta['id'] in ('parallel-base','parallel-clamp','parallel-rocker','case-fit-seat-ring','case-electronics-analogue-hood') or (meta['id'].startswith('case-electronics-') and meta['id'].endswith('-keeper') and '-buck-' not in meta['id']):
        shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0),180)
    elif meta['id'].startswith('case-electronics-buck-') and meta['id'].endswith('-keeper'):
        shape.rotate(App.Vector(0,0,0),App.Vector(1,0,0),-90)
    bounds = shape.BoundBox
    # The thin side shim prints on its broad face, independent of installed axis.
    lengths = [bounds.XLength, bounds.YLength, bounds.ZLength]
    if 'shim' in meta['id'] or '-key' in meta['id']:
        thin_axis = lengths.index(min(lengths))
        if thin_axis == 0:
            shape.rotate(App.Vector(0, 0, 0), App.Vector(0, 1, 0), 90)
        elif thin_axis == 1:
            shape.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90)
    bounds = shape.BoundBox
    normalization_translation=[-bounds.XMin,-bounds.YMin,-bounds.ZMin]
    shape.translate(App.Vector(*normalization_translation))
    bed_area = sum(face.Area for face in shape.Faces
                   if face.BoundBox.ZLength < 1e-7 and abs(face.BoundBox.ZMin) < 1e-7)
    assert bed_area > 1, (meta['id'], 'no usable flat print-bed face', bed_area)
    if meta['id']=='case-pwm-keeper':
        assert bed_area>=150,(meta['id'],'PWM frame must rest on its broad ring face',bed_area)
        assert abs(shape.BoundBox.ZLength-1.5)<1e-6,(meta['id'],'wrong thin-frame print orientation')
    if meta['id']=='case-pwm-backing':
        assert bed_area>=350 and abs(shape.BoundBox.ZLength-2.5)<1e-6,(meta['id'],'separate backing must rest on its broad flat face',bed_area)
    if meta['id']=='case-test-clip-carrier':
        assert bed_area>=1000,(meta['id'],'carrier must rest on its wide lower floor face',bed_area)
    if meta['id']=='case-lower-cradle':
        assert bed_area>=200 and abs(shape.BoundBox.ZLength-51)<1e-6,(meta['id'],'inverted cradle must rest on its original upper face',bed_area)
        assert abs(operator_bounds_row['max'][2]-1.5)<1e-6,(meta['id'],'original upper bed plane')
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.04,
                                  AngularDeflection=.12, Relative=False)
    if not mesh.isSolid() or mesh.CountFacets<=0:
        mesh_failures.append(meta['id'])
        mesh.write(str(output/(meta['id']+'.diagnostic.stl')))
        print('NATIVE_MESH_FAILURE='+meta['id'],flush=True)
        continue
    file = output / (meta['id'] + '.stl')
    mesh.write(str(file))
    saved = Mesh.Mesh(str(file))
    assert saved.isSolid(), (meta['id'], 'open STL roundtrip')
    bounds = saved.BoundBox
    assert abs(bounds.ZMin) < 1e-5, (meta['id'], 'print bed contact')
    rows.append({
        'id': meta['id'], 'file': file.name, 'closed': True,
        'solids': 1, 'facets': saved.CountFacets,
        'dimensionsMm': [bounds.XLength, bounds.YLength, bounds.ZLength],
        'min': [bounds.XMin, bounds.YMin, bounds.ZMin],
        'material': meta['manufacturing']['material'],
        'flatBedContactAreaMm2': bed_area,
        'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        'sourceCodeSha256': case['codeSha256'],
    })
    if meta['id']=='case-lower-cradle':
        rows[-1].update(printRotationDegrees=[180,0,0],normalizationTranslationMm=normalization_translation,operatorBounds=operator_bounds_row,operatorBedPlaneZ=operator_bounds_row['max'][2])
    print(json.dumps(rows[-1]), flush=True)
assert not mesh_failures, 'Open triangulations: '+json.dumps(mesh_failures)
assert rows, 'The case panel has no printable parts.'
(output / 'print-mesh-validation.json').write_text(json.dumps(rows, indent=2) + '\n')
current_prints = {row['file'] for row in rows}
for old_print in output.glob('*.stl'):
    if old_print.name not in current_prints:
        old_print.unlink()

stem = case['assemblyFileStem']
expected_solids = sum(len(obj.Shape.Solids) for obj in children)
expected_volume = sum(obj.Shape.Volume for obj in children)
step = output / (stem + '.step')
Part.export(children, str(step))
roundtrip = Part.read(str(step))
assert roundtrip.isValid() and roundtrip.isClosed()
assert len(roundtrip.Solids) == expected_solids
assert abs(roundtrip.Volume - expected_volume) / expected_volume < 1e-5
root_name = root.Name
doc.recompute()
assembly_file = output / (stem + '.FCStd')
shutil.copyfile(output/'case-panel-native-validation.FCStd',assembly_file)
App.closeDocument(doc.Name)
doc = App.openDocument(str(assembly_file))
root = doc.getObject(root_name)
children = sorted(leaves(root), key=lambda obj: obj.ComponentIndex)
assert len(children) == len(case['components'])
assert sum(len(obj.Shape.Solids) for obj in children) == expected_solids
assert abs(sum(obj.Shape.Volume for obj in children)-expected_volume)/expected_volume<1e-9
assert all(obj.Shape.isValid() and obj.Shape.isClosed() for obj in children)
App.closeDocument(doc.Name)
fixture_names=['case-panel-native-fixture.py','case-panel-retention-fixture.py','case-panel-structure-fixture.py','case-panel-wall-mount-fixture.py','export-servo-toggle-case-panel.py','servo-toggle-case-panel-volume-baseline.json']
fixture_hashes={name:hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()for name in fixture_names}
report = {
    'fixtureCodeSha256':fixture_hashes,
    'assemblyComponents': len(children), 'assemblySolids': expected_solids,
    'printCount': len(rows), 'stepRoundtrip': True, 'fcstdRoundtrip': True,
    'sourceCodeSha256': case['codeSha256'], 'intersections': overlaps,
    'fcstdValidationByteCopy': True,
    'fcstdSha256': hashlib.sha256(assembly_file.read_bytes()).hexdigest(),
    'caseFit': case_fit_report['passed'],
    'fullCaseFitVerified': case_fit_report['fullCaseFitVerified'],
    'caseFitValidationScope': case_fit_report['validationScope'],
    'workingPanelFit': case['caseEnvelope']['workingPanelFit'],
    'workingPanelFitStudy': case_fit_report['workingPanelFitStudy'],
    'workingRingFit': case_fit_report['workingRingFit'],
    'workingRingFitStudy': case_fit_report['workingRingFitStudy'],
    'ringWallMounting': case_fit_report['ringWallMounting'],
    'gasketFootprintAreaMm2': case_fit_report['gasketFootprintAreaMm2'],
    'connectorAccess': access_checks,
    'sharedLidHeadSeats': head_seat,
    'retention': retention,
    'structure': structure,
    'wallMounts': wall_mounts,
}
(output / 'native-export-validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('NATIVE_EXPORT_COMPLETE='+case['codeSha256'],flush=True)
