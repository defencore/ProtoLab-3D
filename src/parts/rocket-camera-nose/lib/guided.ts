import type { Parameters, PartDefinition } from '../../../core/types';
import { cylinder, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';
import type { NoseFactory } from './tpu';
import { guidedLayout, worldPoint } from './guided-layout';
import { powerCarrierShape, adapterCushionShape, shiftedAccessoryParts } from './guided-geometry';
import { guidedShellShape, guidedShellAnchorDatums } from './guided-shell';
import {
  guidedCageBaseShape,
  guidedCageCoverShape,
  guidedCagePiSupportShape,
  guidedCagePiPressureShape,
  guidedCageJointSpecs,
  guidedCageRearPlateShape,
  guidedCageAuxiliaryKeeperShape,
  guidedCageCellCoverShape,
  guidedAuxiliaryFixing,
} from './guided-cage';
import { accessoryDeviceSpecs } from './accessory-mounts';
import { cameraFastenerMounts, cameraScrewPreset } from './camera-mount';
import pi from '../../raspberry-pi/part';
import ups, { upsInterface } from '../../waveshare-ups-3s/part';
import adapter from '../../waveshare-pcie-m2-d/part';
import camera from '../../board-camera-19/part';
import ovCamera from '../../waveshare-ov9281-110/part';
import { guidedOptics } from './guided-optics';
import { guidedCameraRearPocketShape, guidedCameraFrontLinerShape } from './guided-camera';
import cell from '../../li-ion-cell/part';
import ssd from '../../m2-ssd/part';
import gps from '../../gps-tracker/part';
import finder from '../../jhe42b-finder/part';
import bolt from '../../bolt-screw/part';

function sampling(s: Shape): Shape {
  if (s.kind === 'cylinder') return { ...s, segments: 96 };
  if (s.kind === 'revolve') return { ...s, segments: 96 };
  if (s.kind === 'transform') return { ...s, child: sampling(s.child) };
  if ('children' in s) return { ...s, children: s.children.map(sampling) };
  return s;
}
export function guidedPieces(p: Parameters, make: NoseFactory) {
  const a = guidedLayout(p),
    rearJoint = guidedCageJointSpecs(p)[0],
    optical = guidedOptics(p),
    items: ReturnType<NoseFactory['custom']>[] = [];
  const printed = (
    id: string,
    name: string,
    shape: Shape,
    material: 'PETG' | 'TPU',
    pose: string,
    fixed = false,
  ) => {
    const item = make.custom(
      id,
      name,
      sampling(shape),
      fixed,
      [
        'cassette-cage-base',
        'cassette-cage-cover',
        'outer-shell',
        'power-carrier',
        'aux-bed',
        'aux-clamp',
        'camera-pocket',
        'ups-cell-cover',
      ].includes(id)
        ? 'manifold'
        : 'jscad',
    );
    item.component.parameters.printPose = pose;
    item.component.manufacturing = {
      material,
      blank: 'One connected printed body',
      processes: ['printing'],
      requirements: [
        'Prototype printed fit and bolt preload with the actual hardware before use.',
        'PETG load frame and shell; TPU isolates the purchased electronics. CAD clearance does not qualify flight loads.',
      ],
    };
    item.color = material === 'TPU' ? 0x466f78 : id === 'outer-shell' ? 0xcc7643 : 0xd9dfdf;
    items.push(item);
    return item;
  };
  const purchased = (
    part: PartDefinition,
    id: string,
    name: string,
    presetId: string,
    translation: Vec,
    rotation: Vec,
  ) => {
    const selected = part.presets.find((x) => x.id === presetId);
    if (!selected) throw new Error(`Missing ${part.id}:${presetId}`);
    const item = make.occurrence(
      part,
      id,
      name,
      { ...selected.parameters },
      translation,
      rotation,
      false,
      selected,
    );
    items.push(item);
    return item;
  };
  printed(
    'outer-shell',
    'Continuous rear-open PETG ogive and tube interface',
    guidedShellShape(p),
    'PETG',
    'front-down',
    true,
  );
  printed(
    'cassette-cage-base',
    'Broad PETG cassette base with full-length side support',
    guidedCageBaseShape(p),
    'PETG',
    'x-minus-down',
  );
  printed(
    'cassette-cage-cover',
    'Common PETG cassette pressure frame',
    guidedCageCoverShape(p),
    'PETG',
    'rear-down',
  );
  printed(
    'pi-pocket',
    'Source-cleared TPU Pi cradle with locating pins',
    guidedCagePiSupportShape(p),
    'TPU',
    'x-minus-down',
  );
  printed(
    'pi-pressure',
    'Broad TPU Pi pressure form',
    guidedCagePiPressureShape(p),
    'TPU',
    'x-plus-down',
  );
  printed(
    'power-carrier',
    'TPU UPS carrier and continuous insulated divider',
    powerCarrierShape(
      p,
      guidedCageJointSpecs(p).map((j) => cylinder(2.4, 60, [-26, j.y, j.z], 'x')),
    ),
    'TPU',
    'x-minus-down',
  );
  printed(
    'adapter-cushion',
    'TPU PCIe adapter edge cushion with source-hole locators',
    adapterCushionShape([
      // Keep the complete head-entry path open, including its travel past the outer rail.
      cylinder(4.1, rearJoint.bearingX + 35.2, [-35, rearJoint.y, rearJoint.z], 'x'),
    ]),
    'TPU',
    'x-minus-down',
  );
  printed(
    'ups-cell-cover',
    'Broad TPU cell and UPS pressure form',
    guidedCageCellCoverShape(p),
    'TPU',
    'x-plus-down',
  );
  printed(
    'camera-pocket',
    'Interchangeable TPU camera cradle with broad rear compression pad',
    guidedCameraRearPocketShape(p),
    'TPU',
    'rear-down',
  );
  printed(
    'camera-front-liner',
    'Removable TPU camera front compression ring and objective shroud',
    guidedCameraFrontLinerShape(p),
    'TPU',
    'front-down',
  );
  for (const part of shiftedAccessoryParts(p))
    printed(
      part.id,
      part.name,
      part.shape,
      'TPU',
      part.id === 'aux-clamp' ? 'x-plus-down' : 'rear-down',
    );
  printed(
    'aux-pressure-plate',
    'Broad captive PETG auxiliary pressure plate',
    guidedCageAuxiliaryKeeperShape(p),
    'PETG',
    'rear-down',
  );
  printed(
    'rear-retainer',
    'Cable passage plate captured between cage halves',
    guidedCageRearPlateShape(p),
    'PETG',
    'rear-down',
  );
  purchased(
    pi,
    'pi5',
    'Raspberry Pi 5',
    'raspberry-pi-5',
    a.pi.translation,
    a.pi.rotation,
  ).component.parameters.detail = 'lightweight';
  purchased(
    ups,
    'ups3s',
    'Waveshare UPS Module 3S',
    'ups-module-3s',
    a.ups.translation,
    a.ups.rotation,
  );
  purchased(
    adapter,
    'nvme-adapter',
    'Waveshare PCIe TO M.2 Board (D)',
    'pcie-m2-d',
    a.adapter.translation,
    a.adapter.rotation,
  );
  purchased(
    ssd,
    'nvme-ssd',
    'M.2 2280 NVMe reference',
    '2280-reference',
    a.ssd.translation,
    a.ssd.rotation,
  );
  purchased(
    optical.ov ? ovCamera : camera,
    'csi-camera',
    optical.ov ? 'Waveshare OV9281-110 camera' : '19 mm rear-entry CSI camera',
    optical.ov ? 'waveshare-21653' : 'imx577-19x19-rear-mipi-m25',
    a.camera.translation,
    a.camera.rotation,
  );
  for (const [i, seat] of upsInterface.p28aPlacements.entries())
    purchased(
      cell,
      `ups-cell-${i}`,
      'Molicel P28A cell ' + (i + 1),
      'molicel-p28a',
      worldPoint(seat.translation, a.ups),
      [0, 0, 0],
    );
  for (const spec of accessoryDeviceSpecs) {
    const part = spec.libraryId === 'gps-tracker' ? gps : finder;
    purchased(
      part,
      spec.id,
      spec.id === 'aux-gps' ? 'ZX908 tracker reference' : 'JHE42B finder',
      spec.presetId,
      spec.translation.map(
        (v, i) => v + a.auxShifts[spec.id as keyof typeof a.auxShifts][i],
      ) as Vec,
      spec.rotation,
    );
  }
  for (const [i, joint] of guidedCageJointSpecs(p).entries()) {
    const selected = bolt.presets.find(
      (model) =>
        +model.parameters.diameter === joint.diameter &&
        +model.parameters.length === joint.length &&
        model.parameters.head === 'button',
    );
    if (!selected) throw new Error('Missing source cage button screw.');
    const off = (joint.length - Number(selected.parameters.headHeight)) / 2;
    purchased(
      bolt,
      `cage-joint-screw-${i}`,
      `M4 x ${joint.length} low-profile common cage screw`,
      selected.id,
      [joint.bearingX + off, joint.y, joint.z],
      [0, -90, 0],
    );
    items.push(
      make.lockNut(`cage-joint-nut-${i}`, joint.diameter, [joint.nutX, joint.y, joint.z], 'x'),
    );
  }
  const auxiliaryFixing = guidedAuxiliaryFixing;
  const auxiliaryScrew = bolt.presets.find(
    (model) =>
      +model.parameters.diameter === auxiliaryFixing.diameter &&
      +model.parameters.length === auxiliaryFixing.length &&
      model.parameters.head === 'button',
  );
  if (!auxiliaryScrew) throw new Error('Missing source auxiliary button screw.');
  purchased(
    bolt,
    'aux-keeper-screw',
    `Recessed M3 x ${auxiliaryFixing.length} auxiliary keeper screw`,
    auxiliaryScrew.id,
    [
      auxiliaryFixing.bearing[0] -
        (auxiliaryFixing.length - Number(auxiliaryScrew.parameters.headHeight)) / 2,
      auxiliaryFixing.bearing[1],
      auxiliaryFixing.bearing[2],
    ],
    [0, 90, 0],
  );
  items.push(make.lockNut('aux-keeper-nut', 3, guidedAuxiliaryFixing.nutCenter, '-x'));
  items.push(make.screw('ssd-retention-screw', 2, 3, [-14, 12.95, -82.5], '-x'));
  if (!optical.ov) {
    const cameraPreset = bolt.presets.find((x) => x.id === cameraScrewPreset)!;
    const camMount = cameraFastenerMounts(p);
    for (const spec of camMount.screws) {
      const side = spec.axis === 'x' ? 1 : -1,
        offset = (spec.length - Number(cameraPreset.parameters.headHeight)) / 2;
      items.push(
        make.occurrence(
          bolt,
          spec.id,
          'M2.5x8 camera side screw',
          cameraPreset.parameters,
          [spec.bearing[0] - side * offset, a.camera.translation[1], spec.bearing[2]],
          [0, side * 90, 0],
          false,
          cameraPreset,
        ),
      );
    }
    for (const spec of camMount.sleeves)
      items.push(
        (spec.type === 'washer' ? make.washer : make.sleeve)(
          spec.id,
          spec.outerDiameter,
          spec.bore,
          spec.length,
          [spec.center[0], a.camera.translation[1], spec.center[2]],
          spec.axis,
        ),
      );
  }
  for (const anchor of guidedShellAnchorDatums) {
    const t = (anchor.angle * Math.PI) / 180;
    const item = make.lockNut(
      anchor.id.replace('body-anchor-', 'body-anchor-nut-'),
      4,
      [anchor.nutRadius, 0, anchor.z],
      '-x',
      true,
    );
    const x = item.component.placement.translation[0];
    item.component.placement.translation = [x * Math.cos(t), x * Math.sin(t), anchor.z];
    item.component.placement.rotation = [0, -90, anchor.angle];
    items.push(item);
  }
  return items;
}
