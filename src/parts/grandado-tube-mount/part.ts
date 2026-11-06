import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { libraries, configuredPieces, composition } from './lib/model';
import { layout } from './lib/spec';
import { cassetteContactSpec } from './lib/cassette';
import { cableRoutingSpec } from './lib/cable-routing';
import { replacementLidSpec } from './lib/replacement-lid';
import { grandadoSpec, grandadoRimSpec } from '../catalog-enclosure/lib/grandado';
import profile from './product.json';
import presets from './presets.json';

export const states = [
  {
    id: 'assembled',
    label: 'Installed in tube',
    description:
      'Curved replacement lid 1 mm above the pipe apex, a captured 3S cassette and two four-bolt end discs.',
  },
  {
    id: 'cutaway',
    label: 'Tube cutaway',
    description:
      'Front half of the tube hidden to inspect the split cassette, captive nuts and library battery holder.',
  },
  {
    id: 'cassette',
    label: 'Cassette and electronics',
    description:
      'Upper shell, two lower sections, passive cell keeper and two solid end discs, without the pipe.',
  },
  {
    id: 'template',
    label: 'Window and drilling template',
    description:
      'Two separate alignment rings, rear datum spine and removable marking rails. The window is measured as a projected chord.',
  },
  {
    id: 'exploded',
    label: 'Mounting parts separated',
    description:
      'Inspect the curved lid, upper shell, two lower sections, cell keeper and both keyed end discs.',
  },
  {
    id: 'print-layout',
    label: 'All printed parts',
    description:
      'Jig and cassette parts in their flat printing orientations. Divide this layout across print beds.',
  },
  {
    id: 'jig-print',
    label: 'Print template parts',
    description: 'Only the separate alignment and marking components.',
  },
  {
    id: 'cassette-print',
    label: 'Print cassette parts',
    description:
      'Only the printed mounting components; purchased enclosure, holder and hardware are omitted.',
  },
  {
    id: 'fit-coupon',
    label: 'M3 fit coupon',
    description: 'Small sample for the M3 clearance hole and side-loaded hex nut pocket.',
  },
  { id: 'cover-only', label: 'Print curved Grandado cover', description: 'Replacement cover alone: curved structural roof, internal screw columns, a recessed gasket channel and the 1 mm outer wrap lip.' },

  {
    id: 'seal-interface', label: 'Lid gasket interface',
    description: 'Measured underside channel and its occupied-space reference. The body rim presses the actual gasket into this channel; gasket material and leakage remain unqualified.',
  },
];

export function validate(p: Parameters, state: string): string[] {
  const errors: string[] = [];
  if (!states.some((v) => v.id === state))
    errors.push('Select an installation, template or printing view.');
  for (const field of parameters) {
    const value = p[field.key];
    if (field.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      )
        errors.push(`${field.label} must be within its stated range.`);
    } else if (field.type === 'boolean' && typeof value !== 'boolean')
      errors.push(`Choose ${field.label.toLowerCase()}.`);
  }
  for (const key of Object.keys(p))
    if (!(key in defaults)) errors.push(`Unsupported kit parameter: ${key}.`);
  if (errors.length) return errors;
  const d = layout(p);
  const lid = replacementLidSpec(p);
  const lidGroove = lid.gasketGroove;
  const rim = lidGroove.measuredBodyRim;
  if (Math.min(rim.clearanceX, rim.clearanceY) < 0.15 - 1e-9)
    errors.push('Keep at least 0.15 mm straight clearance on both faces of the measured body rim. Adjust the end/side wall or groove width.');
  if (Math.min(lidGroove.raisedBodyRim.endClearance, lidGroove.raisedBodyRim.sideClearance, lidGroove.raisedBodyRim.cornerClearance) < 0.15 - 1e-9)
    errors.push('Keep at least 0.15 mm clearance around the nominal uniform raised rim, including its post turns.');
  if (lidGroove.raisedBodyRim.floorClearance < 0.1 - 1e-9)
    errors.push('The groove must clear the measured 1.8 mm raised rim with at least 0.1 mm rigid fitting allowance.');
  if (d.earThickness + d.earClearance < grandadoSpec.earThickness - 1e-9)
    errors.push('The mounting pocket must fit the measured 6 mm ears.');
  if (Math.max(lid.skirtWall, lid.skirtEndWall) >= 5)
    errors.push('Keep the sealing skirt below the 5 mm body corner radius to preserve the inner corner contour.');
  const route = cableRoutingSpec(p);
  if (route.clearanceRadius > route.maximumClearanceRadius + 1e-6)
    errors.push('Cable diameter plus the service allowance must fit the 6 mm passages. Reduce the cable diameter or allowance to preserve 3 mm structural walls.');
  const cornerOffset = route.requestedWireBendRadius * (1 - 1 / Math.sqrt(2));
  const bendClearance = Math.sqrt(route.wireRadius ** 2 + 2 * cornerOffset ** 2) + 0.035;
  if (route.clearanceRadius < bendClearance)
    errors.push('The cable service allowance is too small for the rounded wire bends. Increase the allowance within the 6 mm passage limit or reduce the cable diameter.');
  if (d.id >= d.od || d.od - d.id < 2) errors.push('Leave at least 1 mm tube wall per side.');
  if (d.screwTop - d.screwHeadHeight < d.innerRadius + 0.05)
    errors.push(
      'The tube wall is too thin for the recessed DIN 7991 head without entering the inner load-bearing cap. Use the specified 90/86 tube or a thicker wall.',
    );
  if (d.holderLength < 77.7 || d.holderWidth < 59.69 || d.holderHeight < 21.54)
    errors.push('The selected library 3S holder requires at least 77.7 × 59.69 × 21.54 mm.');
  if (Math.hypot(d.holderWidth / 2 + d.fit, d.trayBottom) + d.minimumStructure > d.cassetteRadius + 0.01)
    errors.push('The holder pocket must leave at least 3 mm to the outside cylindrical surface.');
  const cableRadius = d.powerCableDiameter / 2;
  if (
    Math.max(
      Math.hypot(32.5 + cableRadius, d.powerCenterZ),
      Math.hypot(32.5, d.powerCenterZ + cableRadius),
    ) >
    d.innerRadius - 0.1
  )
    errors.push(
      'The power cable bend exceeds the tube bore. Reduce cable diameter or use a larger inside diameter.',
    );
  if (cassetteContactSpec(p).trackEngagement < 3)
    errors.push('The cylinder sections must retain at least 3 mm of keyed track engagement.');
  if (Math.hypot(29, d.bodySeamZ) > d.innerRadius)
    errors.push('The bare Grandado body must clear the tube bore during axial insertion.');
  if (Math.hypot(grandadoRimSpec.outerWidth / 2, d.bodyRimTopZ) > d.innerRadius)
    errors.push('The raised sealing rim must clear the tube bore during axial insertion.');
  if (d.antenna) {
    if (d.antennaY + d.antennaHole / 2 > -8.9)
      errors.push('Place the cable opening beside the antenna, at least 0.3 mm outside its maximum 17.2 mm housing span.');

  }
  return errors;
}

const part: PartDefinition = {
  id: 'grandado-tube-mount',
  name: 'Grandado · Ø90/86 tube window and 3S cassette',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  description:
    'Printable internal cylinder for Grandado and the library 3S 18650 holder, with passive cell capture, two four-bolt end discs and a smooth curved lid with a continuous face gasket groove.',
  complexity: 'PETG · Ø90/86 · Grandado · 3S',
  preview: 'worker',
  keywords: [
    'Grandado',
    '83x58',
    '90/86',
    'tube',
    'pipe',
    'window',
    'template',
    'stencil',
    'SMA',
    'M3',
    '3S',
    '18650',
    'battery cassette',
    'cylindrical insert',
    'cell keeper',
    'countersunk',
    'DIN 7991',
    'PETG',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  states,
  presetMatchKeys: ['tubeOD', 'tubeID', 'windowClearance'],
  identityParameters(p) {
    const { showTube: _tube, showPayload: _payload, ...physical } = p;
    return physical;
  },
  validate,
  composition,
  buildGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s, s !== 'seal-interface'), true),
  python: (p, s) => componentPython(libraries, configuredPieces(p, s, s !== 'seal-interface')),
  dimensions: (p, s) => componentDimensions(libraries, configuredPieces(p, s)),
  exportDimensions: (p, s) => componentDimensions(libraries, configuredPieces(p, s, s !== 'seal-interface')),
  assessment(p) {
    const seal = replacementLidSpec(p).gasketGroove;
    const d = layout(p),
      arc = 2 * d.radius * Math.asin(d.windowWidth / d.od);
    return [
      `Grandado 83 × 58 × 35 mm lies with 83 mm along the pipe axis. The replacement cover apex is Z${d.boxTop.toFixed(2)}, exactly 1 mm above the pipe apex; the body bottom is Z${d.boxBottom.toFixed(2)}.`,
      `Projected window ${d.windowLength.toFixed(2)} × ${d.windowWidth.toFixed(2)} mm. The corresponding transverse surface arc is ${arc.toFixed(2)} mm; do not substitute the chord dimension as a wraparound tape distance.`,
      `One upper shell and two lower sections form an internal Ø${(2 * d.cassetteRadius).toFixed(2)} cylinder. Continuous keyed tracks bridge the lower centre seam; both solid end discs capture the assembled sections and keeper tails.`,
      `Two solid 16 mm end discs at X±${d.endMountX} each take four radial countersunk M3 ×12 screws, with eight captured M3 nuts total. All eight heads recess below the curved pipe skin.`,
      'The existing BeiLaMoo 3S1P holder, 77.7 × 59.69 × 21.54 mm, rests on the lower cassette floor. A passive keyed keeper captures the three cell top arcs and upper end rims without extra internal screws. Spring contacts and wires carry no retaining load.',
      'The smooth replacement lid has a 3 mm radial roof, internal screw columns and a continuous recessed gasket groove inboard of the four holes. The body rim compresses the gasket upward into that groove; there is no printed tongue below the seating plane. Original-thread screws retain the confirmed axes, 3 mm head-bearing webs and 2 mm tip shortening. Measure actual gasket, screw and blind-hole dimensions before final fabrication.',
      `Measured lower body: 22 mm to the hard seat, 23.8 mm including its 1.8 mm raised rim. The 6 mm ears use a ${(d.earThickness + d.earClearance).toFixed(2)} mm pocket with ${d.earClearance.toFixed(2)} mm fitting allowance. Body bottom Z${d.boxBottom.toFixed(2)}, hard seat Z${d.bodySeamZ.toFixed(2)} and rim top Z${d.bodyRimTopZ.toFixed(2)} preserve the tried lid and battery positions.`,
      `Approximate rim spans: outside 78.7 × 53.7 mm, inside 76.8 × 51.6 mm, with uniform wall approximately 1 mm. Side groove ${seal.width.toFixed(2)} mm; straight end groove ${seal.endWidth.toFixed(2)} mm includes ${seal.axialFitAllowance.toFixed(2)} mm total inner-contour fitting relief. Minimum end/side straight clearance against the uniform source model is ${seal.raisedBodyRim.endClearance.toFixed(3)}/${seal.raisedBodyRim.sideClearance.toFixed(3)} mm. Depth ${seal.grooveMinimumDepth.toFixed(2)}–${seal.grooveMaximumDepth.toFixed(2)} mm leaves ${seal.raisedBodyRim.floorClearance.toFixed(2)} mm rigid headroom above the raised rim. Repeat physical fit, molded corners and actual gasket deformation remain unqualified.`,
      `Continuous cable passages run around the holder end into the cavity below its floor. Each end disc has two downward-open U grooves with ${(2 * cableRoutingSpec(p).clearanceRadius).toFixed(1)} mm clearance; install the wires before seating the discs.`,
      'SMA reserved on the short X+ wall, Y−19…−8 and bottom+0.9…20 mm. The inward Ø19 power connector has its centre measured 12 mm above the external bottom; its crown stays 0.5 mm below the lid hard seat. Only the cable exits the long wall.',
      d.antenna
        ? `The underside antenna cable entry is at X${d.antennaX}, Y${d.antennaY}, Ø${d.antennaHole}. The antenna is installed directly on the tube without a printed cover.`
        : 'Antenna cable opening omitted.',
      'Use the local body-loading opening to feed the attached wire while seating Grandado in the upper shell. Route the free lead in the open side/underfloor channels before sliding the loaded lower assembly into the upper shell from X+. The extended negative-end relief clears the wire throughout closure. Fit both keyed discs with the wires in their open grooves, then insert the complete unit axially into the pipe.',
      'There are eight radial tube anchors at the end discs. The enclosure ears are captured by the internal frame; no old middle tube anchors, battery keeper screws or end pusher are used.',
      'The marking jig is assembled from separate flat-printing rings, rails and a rear alignment spine. It is a marking aid: remove it before cutting or using a rotary tool. The printed M3 sample checks fit before the full kit.',
      'The ears are measured 6 mm thick; their 99 mm pitch remains a photograph-based estimate. The purchased library body now includes the delivered 22/23.8 mm height measurements. Exported printing geometry contains fabricated kit parts only.',
    ];
  },
  notes:
    'Fit-check cylindrical assembly for an open-ended Ø90/86 tube. Uses the existing library Grandado and BeiLaMoo 3S holder. Keyed tracks, a passive cell keeper and two solid four-bolt discs provide geometric retention without extra internal screws. Confirm actual holder/cell fit and angular/impact strength. Fit the smooth gasket-groove lid after axial tube insertion. The four lid holes retain the confirmed positions, with reinforcement inside the smooth cylindrical roof. The gasket occupied-space witness marks the measured channel, while the actual rubber profile remains unmeasured, with no additional inferred procurement item. Measure the actual gasket and qualify compression/leakage. No antenna cover is fitted. Fabrication views export printed parts only. The Lid gasket interface inspection view also exports its non-procured occupied envelope.',

  sources: [
    {
      label: 'Böllhoff DIN 7991 countersunk head dimensions',
      url: 'https://eshop.boellhoff.de/out/media/pdf/DIN_7991_Edelstahl_A4___en.pdf',
    },
    {
      label: 'Grandado listing and original product gallery',
      url: 'https://gbr.grandado.com/products/2pcs-83x58x35-mm-waterproof-clear-cover-plastic-electronic-cable-project-box-instrument-enclosure-case-white',
    },
    {
      label: 'BeiLaMoo library 3S wire-lead holder',
      url: 'https://www.beilamoo.com/sdp/1074412/4/pd-5180803/21007228-2986068/Three_18650_In_Series_Battery_Holder_with_Wire_Lea.html',
    },
    {
      label: 'Ettinger M3 DIN 934 / ISO 4032 dimensions',
      url: 'https://www.ettinger.de/en/product-datasheet/9565ea9a3614479d7cc8eb87a306fedb/create',
    },
  ],
};
export default part;
