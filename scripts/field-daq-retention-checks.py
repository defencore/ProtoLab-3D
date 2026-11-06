"""Native-kernel evidence for the removable R3 central PCB groove key."""
import FreeCAD as App
import Part


def verify_open_pocket(base, edge_x, edge_y, inside_x, outside_y, seat_z, base_z):
    """Independent material witnesses distinguish a broad pocket from the old fin."""
    def probe(u0, u1, v0, v1, z0, z1):
        x0, x1 = sorted([edge_x+inside_x*u0, edge_x+inside_x*u1])
        y0, y1 = sorted([edge_y+outside_y*v0, edge_y+outside_y*v1])
        solid = Part.makeBox(x1-x0, y1-y0, z1-z0, App.Vector(x0,y0,z0))
        assert solid.cut(base).Volume < 1e-6, 'Missing broad pocket body or connected rim root'
        return solid.Volume

    floor = probe(1,2,-6,-4,base_z-.05,seat_z)
    rim = probe(1,2,2,5.5,base_z-.05,seat_z+.5)
    return {'floorWitnessMm3':floor,'rimRootWitnessMm3':rim}


def verify_retention(source, by_id, evaluate):
    audit = source['retentionAudit']
    design = source['layout']
    detail = audit['layout']
    fixtures = dict(zip(audit['fixtureIds'], evaluate(audit['fixtureCode'])['components']))
    base = by_id['base']
    key = by_id['board-retainer']
    lid = by_id['lid']
    rows = []

    def shifted(shape, x=0, y=0, z=0):
        result = shape.copy()
        result.translate(App.Vector(x, y, z))
        return result

    def clear(first, second, label):
        overlap = first.common(second).Volume
        assert overlap < 1e-5, label + ': interference %.9f mm3' % overlap
        return overlap

    def stop(first, second, label):
        overlap = first.common(second).Volume
        assert overlap > .005, label + ': missing mechanical stop'
        return overlap

    # The entire mounted key is positively held, independently of lid and soft pads.
    rows.append({'check': 'locked-key-upward-stop', 'overlapMm3': stop(
        shifted(key, z=.1), base, 'T-feet must meet the base-owned mortise roofs')})
    rows.append({'check': 'locked-key-reverse-stop', 'overlapMm3': stop(
        shifted(key, y=-.3), base, 'The unloaded latch must block the reverse stroke')})
    rows.append({'check': 'broken-latch-lid-backup', 'overlapMm3': stop(
        shifted(fixtures['rigid-key'], y=-.35), lid, 'The lid must independently block unlocking')})

    for board in design['boards']:
        substrate = by_id['reference-' + board['id']]
        c = design['clearance']
        obstacles = Part.makeCompound([base, key])
        for axis, sign in [('x', -1), ('x', 1), ('y', -1), ('y', 1), ('z', -1), ('z', 1)]:
            delta = -.05 if axis == 'z' and sign < 0 else sign * (c + .15)
            displacement = {axis: delta}
            blocked = stop(shifted(substrate, **displacement), obstacles,
                           board['id'] + ': open-lid ' + axis + str(sign) + ' restraint')
            rows.append({'check': 'open-lid-pcb-stop', 'board': board['id'],
                         'axis': axis, 'sign': sign, 'displacementMm': delta,
                         'overlapMm3': blocked})

        # Local inner-corner witnesses prevent the original outer pockets
        # from masking a missing centering pocket next to the removable key.
        corner_x = board['innerX']-3 if board['direction'] > 0 else board['innerX']
        for side in [-1, 1]:
            corner_y = board['y'] if side < 0 else board['y']+board['width']-3
            corner = Part.makeBox(3, 3, design['boardThickness'],
                                  App.Vector(corner_x, corner_y, design['boardZ']))
            clear(corner, base, board['id']+': nominal inner corner')
            blocked = stop(shifted(corner, y=side*(c+.2)), base,
                           board['id']+': local inner-corner lateral stop')
            for z in [0, .5, 2, 6, 12]:
                clear(shifted(corner, z=z), base, board['id']+': open-top inner guide')
            rows.append({'check':'inner-corner-lateral-guide','board':board['id'],
                         'side':side,'clearanceMm':c,'stopOverlapMm3':blocked,
                         'verticalWitnessSamples':5})
            rows.append({'check':'broad-open-pocket-root','board':board['id'],'side':side,
                         **verify_open_pocket(base,board['innerX'],side*board['width']/2,
                                              -board['direction'],side,design['boardZ'],design['baseTop'])})

        # Witness only the central clear edge, so outer pockets cannot mask a missing groove roof/web.
        edge_x = board['innerX'] - 3.5 if board['direction'] > 0 else board['innerX']
        for cy in detail['capCentres']:
            edge = Part.makeBox(3.5, 5, design['boardThickness'],
                                App.Vector(edge_x, cy-2.5, design['boardZ']))
            roof = stop(shifted(edge, z=c+.1), key, board['id'] + ': central groove roof')
            web = stop(shifted(edge, x=board['direction']*(c+.1)), key,
                       board['id'] + ': central groove web')
            rows.append({'check': 'central-edge-captured', 'board': board['id'], 'yMm': cy,
                         'roofStopMm3': roof, 'innerWebStopMm3': web})

    # Service the key with both PCBs and full library connectors still installed.
    installed = [base, by_id['wall'], by_id['panel']]
    installed += [value for name, value in by_id.items() if name.startswith('reference-')]
    obstacles = Part.makeCompound(installed)
    maximum = 0
    for index in range(13):
        y = -detail['travel'] * index / 12
        posed = shifted(fixtures['released-key'], y=y)
        maximum = max(maximum, clear(posed, obstacles, 'Released key slide Y%.2f' % y))
    rows.append({'check': 'released-key-slide', 'samples': 13,
                 'strokeMm': detail['travel'], 'maximumOverlapMm3': maximum})
    maximum = 0
    for index in range(51):
        z = index * .5
        posed = shifted(fixtures['released-key'], y=-detail['travel'], z=z)
        maximum = max(maximum, clear(posed, obstacles, 'Released key lift Z%.2f' % z))
    rows.append({'check': 'released-key-lift', 'samples': 51,
                 'strokeMm': 25, 'maximumOverlapMm3': maximum})

    # The base stays installed while either bare PCB withdraws and lifts.
    # Actual solder tails and populated undersides require a physical service trial.
    for board in design['boards']:
        substrate = by_id['reference-' + board['id']]
        peer = next(candidate for candidate in design['boards'] if candidate['id'] != board['id'])
        fixed = Part.makeCompound([base, by_id['reference-' + peer['id']]])
        maximum = 0
        for index in range(20):
            dx = board['direction'] * 9.5 * index / 19
            maximum = max(maximum, clear(shifted(substrate, x=dx), fixed,
                                         board['id'] + ': bare PCB withdrawal'))
        for index in range(25):
            maximum = max(maximum, clear(shifted(substrate, x=board['direction']*9.5, z=index*.5), fixed,
                                         board['id'] + ': bare PCB lift'))
        rows.append({'check': 'bare-pcb-service-path', 'board': board['id'],
                     'slideSamples': 20, 'liftSamples': 25, 'withdrawalMm': 9.5,
                     'maximumOverlapMm3': maximum})
    return rows
