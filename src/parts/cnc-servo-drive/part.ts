import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';
export const servoDriveSource =
  'https://landing.deltaww.com/IA/downloadcenter/catalogue/2.Motion/ASDA-A3/DELTA_IA-ASDA_ASDA-A3_C_EN_20210104_Web.pdf';
export function servoDriveParameters(): Parameters {
  return { model: 'asd-a3-0721-m' };
}
export function servoDriveLayout() {
  return {
    width: 50,
    depth: 180,
    height: 180,
    massKg: 1.3,
    mountX: 11.3,
    mountBottom: -2.1,
    mountTop: 170.4,
    mountPitch: 172.5,
    slotWidth: 5.5,
    backplane: 0,
    front: 180,
  };
}
export function servoDriveMountingHoles(): [number, number, number][] {
  const v = servoDriveLayout();
  return [
    [v.mountX, 0, v.mountBottom],
    [v.mountX, 0, v.mountTop],
  ];
}
function pieces(): Piece[] {
  const v = servoDriveLayout();
  const slots: Shape[] = servoDriveMountingHoles().map(([x, , z]) =>
    union(cylinder(2.75, 5, [x, -3, z], 'y'), box([5.5, 5, 3], [x - 2.75, -3, z])),
  );
  const headClearances = servoDriveMountingHoles().map(([x, , z]) =>
    cylinder(3.75, 4.5, [x, 2, z], 'y'),
  );
  const housing = subtract(
    union(box([50, 180, 180], [-25, 0, 0]), box([15, 2, 184.5], [v.mountX - 7.5, -2, -4.5])),
    ...slots,
    ...headClearances,
  );
  return [
    {
      label: 'ASD-A3-0721-M source50×180×180 cabinet envelope; mounting slots',
      color: 0x7f858c,
      shape: housing,
    },
    {
      label: 'Front display and CN ports; external details illustrative',
      color: 0x242c34,
      shape: box([34, 2, 140], [-17, 180, 20]),
    },
  ];
}
const part: PartDefinition = {
  id: 'cnc-servo-drive',
  name: 'Industrial feed servo drive',
  product: product as ProductProfile,
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'SERVO CONTROLLERS',
  icon: 'circuit',
  complexity: 'Delta ASDA-A3-M750W, PT / CN5 / STO',
  description:
    'Purchased750 W Delta ASD-A3-0721-M servo drive with pulse commands, external linear feedback and STO interfaces.',
  keywords: ['Delta', 'ASDA-A3', 'ASD-A3-0721-M', 'CN5', 'STO', 'full closed loop', '750W'],
  defaults: servoDriveParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Drive',
      type: 'select',
      group: 'Model',
      options: [{ value: 'asd-a3-0721-m', label: 'Delta ASD-A3-0721-M ·750W200–230VAC' }],
    },
  ],
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'power',
      label: 'Source rated power',
      type: 'number',
      unit: 'W',
      group: 'Ratings',
      catalogSummary: true,
    },
  ],
  validate: (p) =>
    p.model === 'asd-a3-0721-m'
      ? []
      : [
          'Choose the sourcedASD-A3-0721-M execution; L/E variants have different safety/command interfaces.',
        ],
  buildGeometry: () => geometry(pieces()),
  python: () =>
    `${python(pieces())}\ncomponent_manufactured=[False]*len(components)\nfor _pl_drive_meta in component_metadata: _pl_drive_meta.update(${JSON.stringify({ SupplierExecution: 'ASD-A3-0721-M', DriveInterface: '200–230VAC1/3phase; PT pulse/direction; CN5 external full-closed differential5VABZ; M execution has STO. Verify actual delivered manual revision and commissioning.', GeometryQualification: 'Source FrameC50×180×180 and backplane pitch172.5/offset36.3 fromleft. Port/display contours, mounting tab outline and the local Ø7.5×4.5 rear screw-head clearances are illustrative envelopes; current ordered fixingstyle must be checked against maker drawing. Drawing labels backplaneM5×0.8 but captionM4×0.7; retain this source discrepancy.', InstallationRequirement: 'Provide manufacturer cabinet airflow/spacing, protectiveearth, branch protection, line/filter/reactor and brake/resistor sizing; qualified power installer and current maker manual required.' })})`,
  dimensions: () => [50, 184, 184.5],
  notes:
    'Native cabinet datum backplaneY0, width centeredX0, bodyZ0..180; frontY180. Maker FrameC rear fixing pitch172.5, horizontal36.3 fromleft (X11.3). Lower holeZ−2.1; upper170.4. Bracket length, slot end contours and rear Ø7.5×4.5 head clearance relief are illustrative installation envelopes, not OEM manufacturing geometry. The source M5backplane label and M4caption disagree: ordered mountinghardware approval required. This source envelope is not internal electronics or a fabricated drive.',
  sources: [
    { label: 'Delta ASDA-A3 FrameC-M drawing, p22', url: servoDriveSource },
    {
      label: 'Delta ASDA-A3 current manual',
      url: 'https://filecenter.deltaww.com/Products/download/06/060201/Manual/DELTA_IA-ASD_ASDA-A3_UM_EN_20230323.pdf',
    },
  ],
};
export default part;
