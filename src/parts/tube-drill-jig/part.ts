import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import detail from '../manufactured-detail/part';
import purchased from '../purchased-component/part';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import { configuredPieces, jigComposition } from './lib/model';
import { layout, threads, bearingSource, mr93Source } from './lib/selection';
import profile from './product.json';
import presets from './presets.json';

const libraries = [detail, purchased];
const part: PartDefinition = {
  id: 'tube-drill-jig',
  name: 'Tube drilling jig with end stop',
  product: profile as ProductProfile,
  category: 'WORKSHOP TOOLS',
  subgroup: 'DRILLING JIGS',
  icon: 'bracket',
  description:
    'Tube fixture with a split indexing head, separate centering liner and flat print orientations. Reuse one through-bore body, removable end stop and movable two-bearing cassette for supported 4/8/12 patterns.',
  complexity: 'Parametric jig assembly',
  preview: 'worker',
  keywords: [
    'tube',
    'pipe',
    'drill',
    'drilling',
    'jig',
    'stencil',
    'template',
    'end stop',
    'hole belt',
    'bearing guide',
    '90 mm',
    '4 holes',
    '8 holes',
    '12 holes',
    'tap',
    'M3',
    'adjustable stop',
    'spacer stack',
    'anti-roll',
    'flat sides',
    'movable cassette',
    'universal body',
    'MR93ZZ',
    '3x9x4',
    'split head',
    'print layout',
    'PETG',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'One guide cassette in the selected station. The independently clamped tube rests on the measured height spacer stack.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Inspect the common cup, centering liner, two indexing plates, clamp crown, alignment bushes and the single guide cassette.',
    },
    {
      id: 'print-layout',
      label: 'Print layout',
      description:
        'Only manufactured parts, flat on Z=0 with 8 mm spacing. Split the layout across printer beds as needed; bearings, screws and the reference tube are excluded.',
    },
  ],
  validate(p) {
    const errors: string[] = [],
      d = layout(p);
    if (n(p, 'tubeOD') - 2 * n(p, 'tubeWall') <= 2)
      errors.push('Tube wall must leave a bore greater than 2 mm for the annular stop.');
    if (d.kind === 'bearing' && !d.bearing)
      errors.push(
        `No exact bearing bore matches the ${d.drill} mm drill. Choose Automatic or a hardened steel bushing; an oversized bearing is not a drill guide.`,
      );
    if (d.capacity < n(p, 'tubeOD') + 6)
      errors.push(
        'Body capacity must exceed tube OD by at least 6 mm for the interchangeable centering insert.',
      );
    if (!Number.isInteger(n(p, 'station')) || n(p, 'station') > d.count)
      errors.push('Current drilling station must be an integer from 1 to the selected hole count.');
    if (d.axisHeight < 26)
      errors.push(
        'Fixed drill height must be at least 26 mm for the cup, indexing-head pilot and screws.',
      );
    if (d.endStop && n(p, 'endOffset') > d.axisHeight)
      errors.push(
        'The desired end offset exceeds this body capacity. Reduce the offset or choose a larger fixed drill height before printing.',
      );
    if (
      (d.endStop ? [n(p, 'endOffset'), d.axisHeight] : [d.axisHeight]).some(
        (value) => Math.abs(value * 2 - Math.round(value * 2)) > 1e-7,
      )
    )
      errors.push(
        'Use 0.5 mm increments for the desired offset and fixed drill height so the reusable spacer kit can set the height exactly.',
      );
    if (d.endStop && d.spacerOD <= d.stopBore + 1)
      errors.push(
        'Spacer clearance leaves too little annular support. Reduce clearance or use a thicker-wall tube.',
      );
    if (d.endStop && d.spacerOD < n(p, 'tubeOD') - 2 * n(p, 'tubeWall') + 0.4)
      errors.push(
        'The spacer must overlap the tube wall by at least 0.2 mm radially. Reduce spacer clearance for this thin-wall tube.',
      );
    if (d.endStop && n(p, 'endOffset') < d.drill / 2 + 1)
      errors.push('The tube hole would break through the tube end. Increase the end offset.');
    if (d.kind === 'bearing' && d.sleeveLength < 2)
      errors.push(
        'Increase body capacity to leave at least 2 mm between the two bearing outer races.',
      );
    if (d.minWeb < 2.4 - 1e-7)
      errors.push(
        `This tube and cassette leave only ${Math.max(0, d.minWeb).toFixed(2)} mm between sockets; at least 2.4 mm is required. Available hole counts: ${d.availableCounts.join(', ') || 'none'}. A larger outer body does not repair this inner web.`,
      );
    if (d.outerWeb < 2.4 - 1e-7)
      errors.push(
        `Increase reusable body capacity: the guide recess must leave at least 2.4 mm around the head alignment bushes (currently ${d.outerWeb.toFixed(2)} mm).`,
      );
    if (d.kind !== 'plain' && d.barrelOD / 2 - (d.outer + n(p, 'seatClearance')) / 2 < 2.4)
      errors.push('Guide seat must leave at least 2.4 mm radial cassette wall.');
    if (d.kind !== 'plain' && (d.pilotWall < 2 - 1e-7 || d.capWall < 2 - 1e-7))
      errors.push('Guide seat and retainer holes must retain at least 2 mm of local material.');
    if (d.kind === 'bushing' && d.flangeEnd - d.width < d.start + 1.2)
      errors.push('Increase body capacity to leave a positive bushing shoulder.');
    if (d.kind !== 'plain' && n(p, 'seatClearance') >= d.outer - d.drill - 0.6)
      errors.push('Guide seat allowance leaves insufficient retaining shoulder.');
    return errors;
  },
  composition: jigComposition,
  buildGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s), true),
  python: (p, s) => componentPython(libraries, configuredPieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configuredPieces(p, s)),
  assessment(p) {
    const d = layout(p),
      thread = threads[String(p.thread)];
    return [
      `One reusable through-bore body: capacity ${d.capacity} mm, 24 support flats. Match the centering/index insert, cassette reach and clamp screw lengths to the tube OD. Four M4 screws attach the insert; three upper M5 clamps hold the tube independently of the cassette.`,
      `${d.count} positions at ${360 / d.count} degrees; the single cassette is at station ${d.active.index + 1}. Fully withdraw the bit, release only the cassette lock, transfer the complete cassette and reseat its flange. Keep tube clamps tight.`,
      d.endStop
        ? `Tube end offset ${p.endOffset} mm = fixed drill height ${d.axisHeight} minus ${d.spacerHeight} mm of measured spacers${d.stack.length ? ` (${d.stack.join(' + ')} mm)` : ''}. Remove the separate bottom stop plate for through-tube operation. Body, head and cassette stay unchanged when adjusting only the offset.`
        : 'Through-tube mode: bottom stop plate, its four screws and all height spacers are removed. The hanging centering liner remains seated. Set the hole belt on a measured axial mark, then tighten the three tube clamps; end offset is not set by the fixture in this mode.',
      p.holeMode === 'tap'
        ? `Pilot drill ${d.drill} mm for ${p.thread} x ${thread.pitch}. Remove the jig before tapping. Nominal wall engagement ${(n(p, 'tubeWall') / thread.pitch).toFixed(1)} turns; qualify material and load.`
        : `Drill ${d.drill} mm through one tube wall at each indexed position; use a depth stop.`,
      d.bearing
        ? `Only 2 x ${d.bearing.id}, ${d.drill} x ${d.outer} x ${d.width} mm for the entire fixture, including a 12-hole belt. Both bearings, their outer-race sleeve and retainer travel inside one cassette.`
        : d.kind === 'plain'
          ? 'One movable printed marking cassette; no bearings. Use metal guides for repeated drilling.'
          : `Only 1 custom hardened bushing, ID ${(d.drill + n(p, 'guideClearance')).toFixed(2)} x OD ${d.outer} x L ${d.width} mm, transferred with the cassette.`,
      `Allow at least ${d.drillReach.toFixed(1)} mm of exposed drill length from the outside of the guide to penetrate one wall with 2 mm margin. A large body-to-tube reduction may require a long-series drill. Check actual bit passage through nominal bearing bores before use.`,
      `Three M5 tube clamp screws need ${(d.radius - 6 - (n(p, 'tubeOD') / 2 + 4.05)).toFixed(2)} mm nominal under-head reach for this tube and body. Fit measured lengths with deburred ends so their heads remain behind the support flats.`,
      `Supported hole counts for this tube and guide: ${d.availableCounts.join(' / ')}. Selected pattern leaves ${d.minWeb.toFixed(2)} mm minimum socket web; required 2.4 mm. Larger bearings increase cassette size and may reduce available patterns.`,
      'Print layout places only fabricated parts on flat bed faces: open indexing grooves face up, crown slots face up, cassette flange down, and removable stop boss up. The stop underside is flat with countersunk fixings. Structural floors are at least 2.4 mm; the full 4 mm retainer uses M3 x 10 screws and an 8 mm flange with 7 mm pilots. Verify fits and clamp loads on the actual PETG print.',
      `Removable stop: ${p.stopThickness} mm base, four M4 countersunk screws of ${d.stopScrewLength} mm total length (M4 x 12 at the default 5 mm base), 7 mm nominal pilot engagement and 2 mm tip allowance. The centering liner has a 45-degree hanging flange, independent of this stop.`,
      `Largest individual plate: ${2 * d.radius} x ${2 * d.radius} mm across flats. Print layout is a separated parts arrangement; divide it across printer beds as required. Thin 0.5 mm rings need a suitable layer schedule or measured shim stock.`,
    ];
  },
  notes:
    'Prototype modular through-bore tube fixture with removable flat end stop for FDM manufacture: the lower and upper indexing plates print with open grooves facing upward. The separate clamp crown has top-loaded pads/nuts and roofed horizontal passages. A separate tapered liner centers the tube and spacer stack; two tubular keys register the three head layers, clamped by four M4 screws. Print layout excludes all purchased hardware and orients each printed part on a flat face. A single cassette carries only two bearings or one hardened bushing between 4/8/12 stations. Measured stop rings set end offset H-S. Verify actual print fits, screw engagement, bit passage and clamping on a sample tube.',
  sources: [
    { label: 'SMB MR93ZZ / 3 x 9 x 4 mm drawing', url: mr93Source },
    { label: 'SMB miniature bearing dimensions', url: bearingSource },
    {
      label: 'Dormer Pramet cutting-tap data',
      url: 'https://www.dormerpramet.com/us/en/downloads-catalogues/',
    },
  ],
};
export default part;
