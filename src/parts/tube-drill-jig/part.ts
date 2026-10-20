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
import { layout, threads, bearingSource } from './lib/selection';
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
    'Flat-sided tube jig with an adjustable spacer stop, 4/8/12 radial holes and automatically matched bearing or bushing guides. Reuse one body for different end offsets.',
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
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Jig and guides in working positions. The tube end rests on the calculated height spacer stack.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Separate cartridges, guides, retainers, screws and the removable height spacer stack.',
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
    if (d.axisHeight < (d.kind === 'plain' ? d.drill / 2 : d.flangeHeight / 2 + 0.15) + 2)
      errors.push(
        'Increase the fixed drill height: the guide recess must leave at least 2 mm above the base stop.',
      );
    if (n(p, 'endOffset') > d.axisHeight)
      errors.push(
        'The desired end offset exceeds this body capacity. Reduce the offset or choose a larger fixed drill height before printing.',
      );
    if (
      [n(p, 'endOffset'), d.axisHeight].some(
        (value) => Math.abs(value * 2 - Math.round(value * 2)) > 1e-7,
      )
    )
      errors.push(
        'Use 0.5 mm increments for the desired offset and fixed drill height so the reusable spacer kit can set the height exactly.',
      );
    if (d.spacerOD <= d.stopBore + 1)
      errors.push(
        'Spacer clearance leaves too little annular support. Reduce clearance or use a thicker-wall tube.',
      );
    if (n(p, 'endOffset') < d.drill / 2 + 1)
      errors.push('The tube hole would break through the tube end. Increase the end offset.');
    if (d.kind !== 'plain' && d.flangeWidth / 2 + 1.5 >= d.floor * Math.tan(Math.PI / d.count))
      errors.push(
        'Adjacent guide stations overlap or leave too little material. Increase tube diameter, reduce hole count or choose printed marking guides.',
      );
    if (
      d.kind === 'plain' &&
      d.drill + n(p, 'guideClearance') + 2 >= d.bore * Math.sin(Math.PI / d.count)
    )
      errors.push(
        'Adjacent printed guide holes leave less than 2 mm of material. Increase tube diameter or reduce hole count.',
      );
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
      `Tube OD ${p.tubeOD} mm; sleeve bore ${d.bore.toFixed(2)} mm; ${d.flatCount} flat support faces with recessed screw heads. Fixed drill axes Z=${d.axisHeight} mm; ${d.count} stations at ${360 / d.count} degrees.`,
      `Desired tube-end offset ${p.endOffset} mm: ${d.stack.length ? `fit ${d.stack.join(' + ')} = ${d.spacerHeight} mm of height spacers` : 'remove all spacers and seat on the base stop'}. Tube end is at Z=${d.spacerHeight}; ${d.axisHeight} - ${d.spacerHeight} = ${p.endOffset} mm. Changing this offset does not change the collar or guides.`,
      p.holeMode === 'tap'
        ? `Drill ${d.drill} mm, remove jig, then cut ${p.thread} x ${thread.pitch}. Nominal wall engagement ${(n(p, 'tubeWall') / thread.pitch).toFixed(1)} turns; suitability depends on tube material and load.`
        : `Drill ${d.drill} mm through one tube wall at each station. Opposite walls have independent guide stations.`,
      d.bearing
        ? `Matched guides: ${2 * d.count} x ${d.bearing.id}, ${d.drill} x ${d.outer} x ${d.width} mm; two per station. Nominal bearing bore must be tested for free drill passage.`
        : d.kind === 'plain'
          ? 'Printed guides are intended for marking and occasional use; no purchased bearings are required.'
          : `No bearing substituted: ${d.count} custom hardened bushings, ID ${(d.drill + n(p, 'guideClearance')).toFixed(2)} x OD ${d.outer} x L ${d.width} mm. Confirm procurement and bore tolerance.`,
      d.kind === 'plain'
        ? 'Print one collar bottom down. Clamp tube and jig together before drilling.'
        : `Print one collar, ${d.count} identical cartridges and ${d.count} retainers. Fit ${2 * d.count} M3 retainer screws; select length after checking engagement. Clamp tube and jig together.`,
    ];
  },
  notes:
    'Prototype based on the supplied Tube90 example. A polygonal collar rests on flat support faces; all retainer heads are recessed behind those faces. The fixed drill axes are at Z=H. Reusable measured annular spacers raise the tube end to Z=S, giving the hole offset H-S without reprinting the body. Spacer kit: 0.5/1/2/5/10/20 mm; bottom thickness does not affect the setting. Purchased guides and screws are nominal envelopes. Clamp the workpiece, verify measured spacer thickness and remove the jig before tapping.',
  sources: [
    { label: 'SMB miniature bearing dimensions', url: bearingSource },
    {
      label: 'Dormer Pramet cutting-tap data',
      url: 'https://www.dormerpramet.com/us/en/downloads-catalogues/',
    },
  ],
};
export default part;
