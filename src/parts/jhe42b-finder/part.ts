import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, component, pythonShape } from '../../core/assembly/boundary/shapes';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { jhe42bModelInterface, jhe42bSourceUrl, jhe42bWiringPhotoUrl } from './lib/interface';
import presets from './presets.json';
import product from './product.json';
import { jhe42bExteriorPieces } from './lib/model';

export {
  jhe42bInterface,
  jhe42bProjectReferenceInterface,
  jhe42bModelInterface,
} from './lib/interface';

/** Nominal reservation; detailed exterior geometry is separate from this envelope. */
export const jhe42bEnvelopeShape = (parameters = defaults) => {
  const [length, width, height] = jhe42bModelInterface(parameters).dimensions;
  return box([length, width, height], [-length / 2, -width / 2, 0]);
};

const label = (parameters: typeof defaults) =>
  parameters.model === 'jhe42b'
    ? 'JHEMCU JHE42B · photo-reconstructed exterior with integral battery'
    : 'JHE42B · current project occupied box 26 × 17 × 15 mm';
const part: PartDefinition = {
  id: 'jhe42b-finder',
  name: 'JHEMCU JHE42B Finder',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SENSORS & SWITCHES',
  icon: 'circuit',
  complexity: 'Fixed exterior models with source evidence',
  description:
    'Detailed JHE42B exterior with buzzer, side sound mouth, PCB, LED, cancel switch, three-pin socket, pouch battery and clear sleeve, reconstructed from manufacturer photos within the nominal 23 × 17 × 17 mm envelope. Includes the distinct 26 × 17 × 15 mm project reference.',
  keywords: ['JHEMCU', 'JHE42B', 'finder', 'recovery', 'buzzer', 'alarm', 'LED', 'backup battery'],
  defaults,
  parameters,
  presets: presets as Preset[],
  product: product as ProductProfile,
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Finder model' }],
  catalogFilterFields,
  presetMatchKeys: ['model'],
  validate(p, state) {
    if (state !== 'default') return ['Select the default exterior view.'];
    if (!parameters[0].options?.some((option) => option.value === p.model))
      return [
        'Select the standard JHE42B or current-project reference; JHE42B-S and JHE20B are different products.',
      ];
    return Object.keys(p)
      .filter((key) => key !== 'model')
      .map((key) => `Model dimensions are fixed; unsupported parameter: ${key}.`);
  },
  buildGeometry: (p) => {
    if (p.model !== 'jhe42b')
      return new Group().add(component(jhe42bEnvelopeShape(p), label(p), 0x39434a));
    const group = new Group();
    for (const piece of jhe42bExteriorPieces()) {
      const visual = component(piece.shape, piece.label, piece.color);
      visual.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          if (piece.opacity !== undefined) {
            material.transparent = true;
            material.opacity = piece.opacity;
            material.depthWrite = false;
            material.roughness = 0.2;
          }
        }
      });
      group.add(visual);
    }
    return group;
  },
  python: (p) => {
    const pieces =
      p.model === 'jhe42b'
        ? jhe42bExteriorPieces()
        : [
            {
              label: label(p),
              shape: jhe42bEnvelopeShape(p),
              color: 0x39434a,
            },
          ];
    return [
      'def _pl_transform(shape, translation, rotation):',
      '    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):',
      '        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)',
      '    shape.translate(App.Vector(*translation))',
      '    return shape',
      `components = [${pieces.map((piece) => pythonShape(piece.shape)).join(',\n')}]`,
      `component_labels = ${JSON.stringify(pieces.map((piece) => piece.label))}`,
      `component_colors = [${pieces.map((piece) => `(${[((piece.color >> 16) & 255) / 255, ((piece.color >> 8) & 255) / 255, (piece.color & 255) / 255, 'opacity' in piece ? piece.opacity : 1].join(',')})`).join(',')}]`,
      'shape = Part.makeCompound(components)',
    ].join('\n');
  },
  dimensions: (p) => [...jhe42bModelInterface(p).dimensions],
  notes:
    'Standard JHE42B exterior features are reconstructed from manufacturer photographs, not dimensioned CAD: their positions, sizes, sleeve thickness and visible SMD outlines are estimates. The page text gives 23 × 17 × 17 mm while its dimensioned photograph says 25 × 17 × 17 mm; this model retains the nominal 23 mm catalog basis and requires delivered-unit measurement for fitted mounts. The closed-top buzzer has a negative-X side mouth, LED faces +Z, and socket and cancel actuator face +X. No undocumented acoustic/electrical internals, mounting holes or loose cable are modeled. All visible pieces belong to one purchased unit. The distinct 26 × 17 × 15 mm project reference remains unchanged.',
  assessment: (p) =>
    p.model !== 'jhe42b'
      ? [
          'Current project reference: user-given 26 × 17 × 15 mm occupied box, source component 234. It is not the standard manufacturer 23 × 17 × 17 mm execution.',
          'The current source script, label and registry say JHE42B. A stale native PartNumber still says JHE20B; that property is retained as a source conflict and does not select the separate JHE20B model.',
          'Actual supplier execution, feature orientation, cable access, support lands and retention remain unresolved. Keep this selection identified as an engineering reference.',
        ]
      : [
          'Nominal 23 × 17 × 17 mm exterior reconstruction; published mass 7.4 g. The manufacturer photo instead labels length 25 mm. Measure the delivered execution before making a fitted holder.',
          'Photo-estimated visible features and translucent sleeve replace the rectangular block. Keep the negative-X sound mouth, positive-X connector/button and positive-Z LED accessible. Mating-plug and cable bend space remain additional and unmeasured.',
          'The built-in rechargeable battery is included in this purchased unit. Chemistry, capacity and detailed battery envelope are not established by the reviewed source.',
          'Mounting support, positive capture, cable strain relief and deployment-shock qualification belong to the installation; this model provides no flight or retention rating.',
        ],
  sources: [
    { label: 'JHEMCU standard JHE42B product page', url: jhe42bSourceUrl },
    { label: 'JHEMCU connection and cancel-button photograph', url: jhe42bWiringPhotoUrl },
  ],
};
export default part;
