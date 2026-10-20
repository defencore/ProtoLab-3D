import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { catalogFilterFields, defaults, parameters } from './configurator';
import { dimensions, geometry, models, python, selected } from './lib/model';
import presets from './presets.json';
import product from './product.json';

const part: PartDefinition = {
  id: 'prototyping-board',
  name: 'Prototyping board',
  product: product as ProductProfile,
  category: 'ELECTRONICS & VISION',
  subgroup: 'PROTOTYPING BOARDS',
  icon: 'circuit',
  complexity: 'PY · 2.54 mm grid',
  description:
    'PY soldering perfboards from 30 × 70 mm to 100 × 100 mm, with open grid holes, individual copper pads, edge pads and mounting holes.',
  keywords: [
    'PY-10',
    'PY-7',
    'PY-3',
    'PY-4',
    'PY-5',
    'PY-6',
    'PY-10*10CM',
    'PY-7*9CM',
    'PY-10*10CM 2.54MM',
    'PY-70x90',
    '100x100',
    '70x90',
    '2.54',
    'perfboard',
    'prototype',
    'PCB',
    'FR4',
    'soldering',
    'Nikom',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'Board model' }],
  catalogFilterFields,
  presetMatchKeys: ['model'],
  states: [{ id: 'assembled', label: 'Board', description: 'Empty purchased perfboard.' }],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((model) => model.id === p.model))
      errors.push('Choose a supported PY prototyping board.');
    if (state !== 'assembled') errors.push('Choose the board view.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push('Board dimensions are fixed; unsupported parameter: ' + key + '.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  assessment(p) {
    const model = selected(p);
    return [
      `${model.designation}: ${model.length} × ${model.width} mm, ${model.sides === 1 ? 'single' : 'double'} sided.`,
      `${model.columns} × ${model.rows} open holes on a ${model.pitch} mm grid; isolated pads and ${model.sidePadCount} edge pads per end.`,
      model.thicknessVerified
        ? `Published thickness: ${model.thickness} mm. Hole diameter: ${model.holeDiameter} mm; mounting hole diameter: ${model.mountDiameter} mm.`
        : `Thickness ${model.thickness} mm and hole diameter ${model.holeDiameter} mm are installation assumptions for this catalogue execution.`,
      ...(model.mountPhotoMismatch
        ? [
            `The ${model.mountDiameter} mm mounting bore follows the supplier table. Its photograph shows larger corner openings and may depict another execution; verify the delivered bore before choosing mounting hardware.`,
          ]
        : []),
      'Mounting-hole centres and pad dimensions are reconstructed from the supplier photograph; verify the delivered board before making a mounting plate.',
    ];
  },
  notes:
    'Source-dimension reconstructions of the selected Nikom catalogue executions, not manufacturer CAD. Published outline, pitch and sidedness are retained. Each model uses its selected supplier execution and published thickness and drill sizes where available. The 100 × 100 mm execution uses an assumed 1.5 mm thickness and 0.8 mm drill. Pad counts follow supplier photographs; mounting centre coordinates, outer pad dimensions and 0.035 mm copper are authored installation approximations. The 50 × 70 mm photograph shows edge lands at approximately 4 mm pitch despite the repeated 2.54 mm catalogue edge-pitch field; its model follows the photograph. Holes are open in both the preview and native FreeCAD solids. Copper plating barrels, silkscreen, edge chamfers and connected circuitry are omitted. These are empty soldering perfboards, without wires or electronic components.',
  sources: models.map((model) => ({
    label: `${model.designation} · Nikom ${model.supplierCode}`,
    url: model.sourceUrl,
  })),
};
export default part;
