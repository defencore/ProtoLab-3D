"""Normalize source-installed FinsROV purchases into reusable supplier models.

Run in FreeCAD Python, or runpy after build-fins-assembly.py. Inputs are an
intermediate catalog.json, native/equipment.json and semantic placement JSON.
No dimensions or source contours are reconstructed. Every native product is
one opaque purchase, with its original internal solids and rigidly moved BREP.
"""
import argparse, base64, json, math, struct, zlib
from pathlib import Path
import FreeCAD as App
import Part, MeshPart
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def packed(value):
    return base64.b64encode(zlib.compress(value, 9)).decode()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':')) + '\n')


def catalog_presets(models):
    """Persist the complete package catalog alongside its native source records."""
    return [dict(
        id=model['id'], name=model['label'],
        description=f"Buy complete: {model['designation']}.",
        parameters=dict(model=model['id']), product=dict(supply='purchased'),
        catalog=dict(
            designation=model['designation'], manufacturer=model['manufacturer'],
            sourceName='FinsROV original product bill of materials and assembly CAD',
            sourceUrl=model['sourceUrl'], verifiedParameters=['model'],
            geometryEvidence=dict(
                kind='community-cad',
                summary='Original source solid geometry normalized into a reusable product coordinate frame.',
                limitations='Installation reference. Supplier availability, ratings and delivered mounting interfaces require verification.',
                sourceUrl=model['cadSourceUrl'], sourceSha256=model['sourceSha256']),
            attributes={key: float(f'{value:.2f}') for key, value in
                        zip(['width', 'depth', 'height'], model['dimensions'])},
            specifications=[
                dict(label='Order designation', value=model['designation']),
                dict(label='Coordinates', value=model['normalization']),
                dict(label='Supply', value='Purchase complete product')]
        )) for model in models]


def bound(shape):
    b = shape.optimalBoundingBox(False, False)
    return [b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def points(shape):
    return np.array([list(v.Point) for s in shape.Solids for v in s.Vertexes])


def matrix(rotation, translation):
    m = App.Matrix()
    for i in range(3):
        for j in range(3):
            setattr(m, 'A%d%d' % (i + 1, j + 1), float(rotation[i, j]))
        setattr(m, 'A%d4' % (i + 1), float(translation[i]))
    return m


def rigid_fit(a, b):
    ac, bc = a.mean(axis=0), b.mean(axis=0)
    u, _, vt = np.linalg.svd((a - ac).T @ (b - bc))
    r = vt.T @ u.T
    if np.linalg.det(r) < 0:
        vt[-1] *= -1
        r = vt.T @ u.T
    return App.Placement(matrix(r, bc - r @ ac))


def fit_metrics(predicted, source):
    a, b = points(predicted), points(source)
    ds = ((a[:, None, :] - b[None, :, :]) ** 2).sum(axis=2).min(axis=1)
    return dict(nearestVertexRmsMm=float(np.sqrt(ds.mean())),
                nearestVertexMaximumMm=float(np.sqrt(ds.max())),
                exactRigidFit=bool(ds.max() < 1e-6),
                sourceVolumeMm3=math.fsum(s.Volume for s in source.Solids),
                canonicalVolumeMm3=math.fsum(s.Volume for s in predicted.Solids))


def transformed(shape, placement):
    result = shape.copy()
    result.Placement = placement.multiply(result.Placement)
    return result


def mesh(shape):
    result = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.1,
                                    AngularDeflection=.25, Relative=False)
    vs, ts = result.Topology
    xyz = [float(c) for v in vs for c in v]
    indices = [i for t in ts for i in t]
    return dict(vertices=packed(struct.pack('<%df' % len(xyz), *xyz)),
                triangles=packed(struct.pack('<%dI' % len(indices), *indices)))


def axis_frame(shape, axis, center):
    """Product +Z follows its measured axis; rear measured envelope is Z=0."""
    z = np.array(axis, dtype=float)
    z /= np.linalg.norm(z)
    x = np.array([1., 0, 0])
    x -= z * np.dot(x, z)
    if np.linalg.norm(x) < .1:
        x = np.array([0., 1, 0]) - z * z[1]
    x /= np.linalg.norm(x)
    r = np.column_stack([x, np.cross(z, x), z])
    f = App.Placement(matrix(r, center))
    local = transformed(shape, f.inverse())
    # Axial extremes use the accurate OCC envelope, not vertex-only bounds.
    zmin = bound(local)[2]
    return App.Placement(matrix(r, np.array(center) + z * zmin))


def largest_cylinder(shape):
    faces = [f for s in shape.Solids for f in s.Faces
             if isinstance(f.Surface, Part.Cylinder)]
    return max(faces, key=lambda f: (f.Surface.Radius, f.Area)).Surface


def servo_frame(shape):
    cylinders = [f.Surface for s in shape.Solids for f in s.Faces
                 if isinstance(f.Surface, Part.Cylinder)]
    shaft = next(c for c in cylinders if abs(c.Radius - 3.05) < 1e-5)
    holes = sorted({tuple(round(v, 9) for v in c.Center) for c in cylinders
                    if abs(c.Radius - 2.2) < 1e-5 and abs(c.Center.z + 60.5) < 1e-5},
                   key=lambda p: p[1])
    assert len(holes) == 4
    x = np.mean(holes[-2:], axis=0) - np.mean(holes[:2], axis=0)
    x[2] = 0
    x /= np.linalg.norm(x)
    z = np.array([0., 0, -1])
    return App.Placement(matrix(np.column_stack([x, np.cross(z, x), z]),
                                [shaft.Center.x, shaft.Center.y, -60.5]))


def run(source, placements):
    catalog = {int(m['id'].split('-')[-1]): m
               for m in json.loads((source / 'catalog.json').read_text())}
    native = {int(m['id'].split('-')[-1]): m for m in
              json.loads((source / 'native/equipment.json').read_text())['components']}
    poses = json.loads(placements.read_text())
    shapes = {}
    for i, value in native.items():
        shape = Part.Shape()
        shape.importBrepFromString(zlib.decompress(base64.b64decode(value['brep'])).decode())
        assert all(s.isValid() and s.isClosed() and s.Volume > 0 for s in shape.Solids)
        shapes[i] = shape

    def source_pose(i):
        p = poses[i - 1]
        return App.Placement(App.Vector(*p['position']), App.Rotation(*p['rotation']))

    assets, models, occurrences, frames = {}, {}, [], {}

    def register(library, model, base, ids, frame, label, colors, note, poses_by_id=None):
        canonical = transformed(shapes[base], frame.inverse())
        b = bound(canonical)
        metadata = dict(catalog[base])
        metadata.update(id=model, label=label, bounds=b,
                        dimensions=[b[i + 3] - b[i] for i in range(3)],
                        volume=math.fsum(s.Volume for s in canonical.Solids),
                        solidCount=len(canonical.Solids), normalization=note,
                        sourceEquipmentId=catalog[base]['id'])
        metadata['requirements'] = list(dict.fromkeys(metadata['requirements']))
        assets.setdefault(library, []).append(dict(id=model,
            brep=packed(canonical.exportBrepToString().encode()),
            meshParts=[dict(mesh(s), color=colors[n % len(colors)])
                       for n, s in enumerate(canonical.Solids)]))
        models.setdefault(library, []).append(metadata)
        frames[library + '/' + model] = dict(sourceEquipmentId=catalog[base]['id'],
                                           canonicalToSourceMatrix=list(frame.toMatrix().A),
                                           normalization=note)
        for i in ids:
            placement = poses_by_id[i] if poses_by_id else rigid_fit(points(shapes[base]), points(shapes[i])).multiply(frame)
            prediction = transformed(canonical, placement)
            fit = fit_metrics(prediction, shapes[i])
            correction = ''
            if i == 12:
                def mounting_centers(shape):
                    return np.array(sorted({tuple(c.Center) for s in shape.Solids for f in s.Faces
                                            if isinstance(f.Surface, Part.Cylinder)
                                            for c in [f.Surface]
                                            if abs(c.Radius - 2.2) < 1e-5 and abs(c.Center.z + 60.5) < 1e-5}))
                mounting_a, mounting_b = mounting_centers(prediction), mounting_centers(shapes[i])
                mounting_error = float(np.sqrt(((mounting_a[:, None, :] - mounting_b[None, :, :]) ** 2).sum(axis=2).min(axis=1).max()))
                assert mounting_error < 1e-6, ('Corrected servo mounting datum mismatch', mounting_error)
                correction = ('The upstream CAD mirrors an asymmetric QFS2025. This occurrence uses the same real servo '
                              'as the other three, with a proper rigid placement matching its output axis and four '
                              'mounting holes. Source mirror asymmetry is corrected; no mirrored supplier model is invented.')
                fit['sourceMirrorCorrected'] = True
                fit['interfaceDatumFit'] = 'Output shaft axis and four mounting-hole centers coincide.'
                fit['mountingHoleMaximumMm'] = mounting_error
            else:
                assert fit['exactRigidFit'], (i, library, fit)
            yaw, pitch, roll = placement.Rotation.getYawPitchRoll()
            occurrences.append(dict(equipmentId=catalog[i]['id'], sourceOrdinal=i,
                libraryId=library, parameters=dict(model=model),
                placement=dict(translation=list(placement.Base), rotation=[roll, pitch, yaw]),
                installationMatrix=list(placement.toMatrix().A), fit=fit, notes=correction))

    register('qfs2025-servo', 'qfs2025', 7, [7, 12, 32, 33], servo_frame(shapes[7]),
             'LIEYING QFS2025 waterproof servo', [0x30343a, 0x40464e, 0x252b32, 0xbac3cc],
             'Origin at output axis on mounting-hole plane; +Z points along output shaft and +X along the case.',
             {i: (servo_frame(shapes[12]) if i == 12 else rigid_fit(points(shapes[7]), points(shapes[i])).multiply(servo_frame(shapes[7])))
              for i in [7, 12, 32, 33]})

    for model, base, ids, flip in [('cw', 3, [2, 3, 4, 6], False),
                                  ('ccw', 13, [9, 10, 13, 14], True)]:
        original = source_pose(base)
        local = transformed(shapes[base], original.inverse())
        axis = largest_cylinder(local)
        b = bound(local)
        f = App.Placement(App.Vector(axis.Center.x, axis.Center.y, b[5] if flip else b[2]),
                          App.Rotation(App.Vector(0, 1, 0), 180) if flip else App.Rotation())
        register('underwater-thruster', model, base, ids, original.multiply(f),
                 '4S underwater thruster — ' + model.upper() + ' source form',
                 [0x263947, 0x7b858e, 0x1e2933, 0xa9b5bd, 0x396e85],
                 'Origin at rear measured envelope on shroud axis; +Z follows the shaft through the shroud. '
                 'CW/CCW identifies source paired geometry; verify actual electrical direction on the delivered pair.',
                 {i: source_pose(i).multiply(f) for i in ids})

    for library, model, base, ids, label, colors, use_author in [
        ('metal-servo-bracket', 'u-bracket', 16, [16, 17, 31, 34],
         'Metal multifunctional servo bracket', [0x909ba8], True),
        ('ms5837-depth-sensor', 'm10-10m', 20, [19, 20, 21, 22],
         'MS5837-30BA M10 depth sensor', [0xa8b4bf, 0x87929a, 0xc3c9ce, 0x252b31], False),
        ('metal-servo-horn', 'round', 35, [35, 36],
         'Metal round servo horn', [0x9eaab7], True),
        ('underwater-pressure-enclosure', 'tube-flange', 1, [1],
         'Pressure enclosure — tube and flange kit portion', [0x9caab5, 0x697c89, 0x48555e], False),
        ('underwater-pressure-enclosure', 'dome-pressure-plate', 15, [15],
         'Pressure enclosure — dome and pressure plate kit portion', [0xa7beca, 0x83929c, 0x4c5963], False),
    ]:
        original = source_pose(base) if use_author else App.Placement()
        local = transformed(shapes[base], original.inverse())
        if library == 'metal-servo-bracket':
            b = bound(local)
            f = App.Placement(App.Vector((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[2]), App.Rotation())
            note = 'Author mounting orientation, lateral envelope centered; rear plane is Z=0.'
        else:
            axis = largest_cylinder(local)
            f = axis_frame(local, list(axis.Axis), list(axis.Center))
            note = 'Measured cylindrical axis is +Z; rear envelope is Z=0 and axis passes through X=Y=0.'
        register(library, model, base, ids, original.multiply(f), label, colors, note)

    assert len(occurrences) == 24
    assert sum(len(v) for v in models.values()) == 8
    for library in models:
        folder = ROOT / 'src/parts' / library / 'lib'
        write(folder / 'catalog.json', models[library])
        write(folder / 'native.json', dict(components=assets[library]))
        write(folder.parent / 'presets.json', catalog_presets(models[library]))
    write(ROOT / 'src/parts/rov-project/lib/purchased-instances.json',
          dict(schemaVersion=1, canonicalFrames=frames,
               occurrences=sorted(occurrences, key=lambda o: o['sourceOrdinal'])))
    print('CANONICAL_PURCHASES', len(occurrences), 'occurrences reuse 8 native product models across 6 library modules.', flush=True)


if __name__ in ('__main__', '<run_path>'):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--placements', type=Path, required=True)
    args = parser.parse_args()
    run(args.source, args.placements)
