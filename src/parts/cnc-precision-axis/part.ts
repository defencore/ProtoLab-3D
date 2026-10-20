import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile, AssemblyComponent } from '../../core/product-types';
import screw, { precisionScrewParameters, precisionScrewLayout } from '../cnc-precision-screw/part';
import nut, {
  precisionNutParameters,
  precisionNutLayout,
  precisionScrewSource,
  type PrecisionScrewModel,
} from '../cnc-precision-nut/part';
import product from './product.json';
import presets from './presets.json';
export function precisionAxisParameters(
  model: PrecisionScrewModel = 'r25-10t3-fdi',
  racewayLength = 1800,
  driveExtension = 0,
  nutFlangePosition?: number,
  nutReversed = false,
): Parameters {
  const v = precisionNutLayout(precisionNutParameters(model));
  return {
    model,
    racewayLength,
    driveExtension,
    nutFlangePosition: nutFlangePosition ?? v.flangeThickness - v.length / 2,
    nutReversed,
  };
}
export function precisionAxisComponents(p: Parameters): AssemblyComponent[] {
  return [
    {
      id: 'shaft',
      name: 'Factory-ground shaft with approved custom ends',
      libraryId: screw.id,
      parameters: precisionScrewParameters(
        p.model as PrecisionScrewModel,
        Number(p.racewayLength),
        Number(p.driveExtension),
      ),
      state: 'default',
      quantity: 1,
      supply: 'purchased',
      placement: {
        translation: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      },
      notes:
        'Physical shaft supplied with this matched nut; order and certify one complete matched set.',
    },
    {
      id: 'nut',
      name: 'Factory-matched FDI double nut',
      libraryId: nut.id,
      parameters: precisionNutParameters(p.model as PrecisionScrewModel),
      state: 'default',
      quantity: 1,
      supply: 'purchased',
      placement: {
        translation: [Number(p.nutFlangePosition), 0, 0] as [number, number, number],
        rotation: [0, p.nutReversed ? 180 : 0, 0] as [number, number, number],
      },
      notes:
        'Physical nut supplied in this factory-matched set; preload and measured lead records belong to the parent order.',
    },
  ];
}
const part: PartDefinition = {
  id: 'cnc-precision-axis',
  name: 'Matched ground ballscrew set',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'One purchased factory-matched shaft and FDI nut order',
  description:
    'A real HIWIN ground shaft and FDI double nut with explicit common purchase identity, custom end drawing and requested C3 /3% preload acceptance records.',
  keywords: ['HIWIN', 'FDI', 'matched set', 'ground screw', 'C3 order', 'precision axis'],
  defaults: precisionAxisParameters(),
  parameters: [
    ...screw.parameters.map((field) => ({
      ...field,
      ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}),
    })),
    {
      key: 'nutFlangePosition',
      label: 'Installed flange mating coordinate',
      type: 'number',
      unit: 'mm',
      group: 'Installation',
      min: -2200,
      max: 2200,
      step: 0.1,
      filterable: false,
    },
    {
      key: 'nutReversed',
      label: 'Reverse installed flange orientation',
      type: 'boolean',
      group: 'Installation',
      filterable: false,
    },
  ],
  presets: presets as Preset[],
  validate(p) {
    const errors = screw.validate(
      precisionScrewParameters(
        p.model as PrecisionScrewModel,
        Number(p.racewayLength),
        Number(p.driveExtension),
      ),
      'default',
    );
    if (
      typeof p.nutFlangePosition !== 'number' ||
      !Number.isFinite(p.nutFlangePosition) ||
      typeof p.nutReversed !== 'boolean'
    )
      return [
        ...errors,
        'Choose a finite nut mating coordinate and explicit installation orientation.',
      ];
    const v = precisionNutLayout(p),
      s = precisionScrewLayout(p),
      position = Number(p.nutFlangePosition),
      lo = position + (p.nutReversed ? -v.maximum : v.minimum),
      hi = position + (p.nutReversed ? -v.minimum : v.maximum);
    if (lo < s.racewayStart || hi > s.racewayEnd)
      errors.push('Keep the complete source nut envelope inside the ordered ground raceway.');
    return errors;
  },
  composition: (p) => ({
    components: precisionAxisComponents(p),
    issues: part.validate(p, 'default'),
    requirements: part.product.releaseRequirements,
  }),
  buildGeometry(p) {
    const children = precisionAxisComponents(p),
      shaft = screw.buildGeometry(children[0].parameters, 'default'),
      body = nut.buildGeometry(children[1].parameters, 'default');
    body.rotation.y = p.nutReversed ? Math.PI : 0;
    body.position.x = Number(p.nutFlangePosition);
    return new Group().add(shaft, body);
  },
  python(p) {
    const children = precisionAxisComponents(p);
    return `${screw.python(children[0].parameters, 'default')}\n_pl_set_components=list(components)\n_pl_set_labels=list(component_labels)\n_pl_set_metadata=list(component_metadata)\n_pl_set_colors=list(component_colors)\n${nut.python(children[1].parameters, 'default')}\nfor q in components:\n    ${p.nutReversed ? 'q.rotate(App.Vector(),App.Vector(0,1,0),180)' : 'pass'}\n    q.translate(App.Vector(${Number(p.nutFlangePosition)},0,0))\ncomponents=_pl_set_components+components\ncomponent_labels=_pl_set_labels+component_labels\ncomponent_metadata=_pl_set_metadata+component_metadata\ncomponent_colors=_pl_set_colors+component_colors\ncomponent_manufactured=[False]*len(components)\nshape=Part.makeCompound(components)\nfor _pl_set_meta in component_metadata: _pl_set_meta.update(${JSON.stringify({ MatchedSetOrder: 'One real purchased factory-matched shaft/nut kit; requested ground C3 and3% dynamic-load preload require manufacturer quote, approved end drawing and actual lead/preload/backlash certificates. No delivered certificate claimed.', GeometryLimits: 'Source physical shaft/nut models; unpublished contact/return/preload mechanics opaque and Full shaft groove representative. Internal racecontact is not certified from the clearance envelopes.' })})`;
  },
  dimensions: (p) => {
    const s = precisionScrewLayout(p),
      v = precisionNutLayout(p);
    return [s.overallLength, v.flangeDiameter, v.flangeDiameter];
  },
  notes:
    'Native shaft axisX, flange coordinate is an installation pose. This purchased parent is one actual factory-matched shaft/nut set; physical children remain library details for assembly inspection. Its requested C3 /3% preload is an order and acceptance requirement. OEM internal contact and preload geometry are not reconstructed or certified.',
  sources: [
    {
      label: 'HIWIN ground FDI manufacturer source and matched-set ordering',
      url: precisionScrewSource,
    },
  ],
};
export default part;
