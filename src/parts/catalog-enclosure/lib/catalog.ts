import type { Preset } from '../../../core/types';
import data from './catalog-data.json';
import { grandadoBodyMeasurements } from './grandado-rim';

export interface EnclosureCatalogModel {
  id: string;
  manufacturer?: string;
  designation: string;
  name: string;
  category: string;
  categoryLabel: string;
  /** Published A/B/C envelope in mm; mapped to X/Y/Z without reorienting source axes. */
  length: number;
  width: number;
  height: number;
  material?: string;
  materialFamily?: string;
  materialOptions?: string[];
  mounting?: string;
  ipRating?: string;
  lid?: string;
  lidOptions?: string[];
  sourceUrl: string;
  sourceName: string;
  productCodes?: string[];
  description?: string;
  dimensionsSource?: string;
  dimensionScope?: 'body-excludes-mounts';
  dimensionRanges?: Partial<Record<'length' | 'width' | 'height', { min: number; max: number }>>;
  dimensionOptions?: Partial<Record<'length' | 'width' | 'height', number[]>>;
  referenceEnvelopeNote?: string;
}

export const enclosureModels: EnclosureCatalogModel[] = data as EnclosureCatalogModel[];
export const defaultModel =
  enclosureModels.find((model) => model.sourceUrl.includes('grandado.com')) ?? enclosureModels[0];
const byId = new Map(enclosureModels.map((model) => [model.id, model]));

export function enclosureModel(id: unknown): EnclosureCatalogModel {
  const model = typeof id === 'string' ? byId.get(id) : undefined;
  if (!model) throw new Error('Select a supported enclosure model.');
  return model;
}

export const envelopeLabel = (model: EnclosureCatalogModel) =>
  `${(['length', 'width', 'height'] as const)
    .map((key) => {
      const range = model.dimensionRanges?.[key];
      return range
        ? `${range.min}–${range.max}${model.dimensionOptions?.[key]?.length ? ' (stock sizes)' : ''}`
        : String(model[key]);
    })
    .join(' × ')} mm`;

export function enclosurePreset(model: EnclosureCatalogModel): Preset {
  const isGrandado = model.id === 'grandado-83-58-35-clear';
  const attributes: Record<string, number | string | boolean> = {
    enclosureType: model.category,
  };
  for (const key of ['length', 'width', 'height'] as const)
    if (
      !model.dimensionRanges?.[key] &&
      !model.dimensionOptions?.[key]?.length &&
      !(model.dimensionScope === 'body-excludes-mounts' && key === 'length')
    )
      attributes[key] = model[key];
  for (const [key, value] of [
    ['material', model.material],
    ['materialFamily', model.materialFamily],
    ['mounting', model.mounting],
    ['ipRating', model.ipRating],
    ['lidType', model.lid],
  ])
    if (value) attributes[key!] = value;
  return {
    id: model.id,
    name: `${model.designation} · ${envelopeLabel(model)}`,
    description: [
      model.manufacturer?.includes('ı') ? model.manufacturer.replaceAll('ı', 'i') : undefined,
      model.categoryLabel,
      model.material,
      model.ipRating,
      model.lid,
      model.description,
      model.referenceEnvelopeNote,
      ...(isGrandado
        ? [
            'Delivered body measured 22 mm below the raised rim, 23.8 mm including its 1.8 mm rim; ears 6 mm. Remaining morphology is qualified reconstruction.',
          ]
        : []),
    ]
      .filter(Boolean)
      .join(' · '),
    parameters: { model: model.id },
    product: { supply: 'purchased' },
    catalog: {
      name: model.name,
      designation: model.designation,
      ...(model.manufacturer ? { manufacturer: model.manufacturer } : {}),
      sourceName: model.sourceName,
      sourceUrl: model.sourceUrl,
      ...(model.productCodes?.length ? { productCodes: model.productCodes } : {}),
      verifiedParameters: ['model'],
      ...(model.dimensionRanges ? { parameterRanges: model.dimensionRanges } : {}),
      ...(model.dimensionOptions ? { parameterChoices: model.dimensionOptions } : {}),
      ...(model.materialOptions?.length || model.lidOptions?.length
        ? {
            attributeOptions: {
              ...(model.materialOptions?.length ? { material: model.materialOptions } : {}),
              ...(model.lidOptions?.length ? { lidType: model.lidOptions } : {}),
            },
          }
        : {}),
      geometryEvidence: {
        kind: model.dimensionScope === 'body-excludes-mounts' ? 'source-dimensions' : 'envelope',
        summary: isGrandado
          ? 'Published 83 × 58 × 35 mm closed body envelope and 4 mm hole callouts. User measurements of the delivered lower body establish 22 mm hard height, 23.8 mm including its 1.8 mm raised sealing rim, and 6 mm ear thickness. The model retains four corner lid fasteners/inserts and six PCB bosses.'
          : `Published outside envelope: ${envelopeLabel(model)}.${model.referenceEnvelopeNote ? ` ${model.referenceEnvelopeNote}` : ''}`,
        limitations: isGrandado
          ? 'Delivered-sample measurements are not manufacturer CAD or batch tolerances. The uniform approximately 1 mm raised rim uses reported outer 78.7 ×53.7 mm; modeled inner 76.7 ×51.7 mm differs by 0.1 mm from approximate reported inner 76.8 ×51.6 mm. Its R3.9 post turns and 2 mm support ledge remain inferred. The modeled 110 mm overall length, ear pitch, floor/boss dimensions, screw/insert sizes and deeper cavity remain estimates. Upper insert/bore estimates move with the measured hard seating face; the factory screws retain their prior estimated geometry. The pictured opaque lid conflicts with the clear-cover title. No production fit or exact fastener thread is established.'
          : 'The rectangular shell and cover are installation references. Wall thickness, interior clearance, lid split, mounting interfaces, corner profiles, seals and hardware are not manufacturer CAD.',
        sourceUrl: model.sourceUrl,
      },
      attributes,
      attributeConditions: {
        length:
          model.dimensionScope === 'body-excludes-mounts'
            ? 'The published 83 mm is the body length excluding the mounting ears. Overall mounting length is not published and is excluded from exact outside-length filters; the 110 mm modeled extent is an estimate.'
            : 'Published outside A, modeled along X; not internal usable space.',
        width: 'Published outside B, modeled along Y; not internal usable space.',
        height: 'Published outside C, modeled along Z. Source axis order is retained.',
      },
      specifications: [
        {
          label:
            model.dimensionScope === 'body-excludes-mounts'
              ? 'Published body size (excluding mounting ears)'
              : 'Outside envelope (A × B × C)',
          value: envelopeLabel(model),
        },
        { label: 'Enclosure type', value: model.categoryLabel },
        ...(isGrandado
          ? [
              {
                label: 'Delivered body measurements',
                value:
                  'Hard lower body 22 mm; raised rim 1.8 mm; body including rim 23.8 mm; mounting ears 6 mm.',
              },
              { label: 'Measurement provenance', value: grandadoBodyMeasurements.source },
              {
                label: 'Unmeasured source interfaces',
                value: grandadoBodyMeasurements.limitations,
              },
            ]
          : []),
        ...(model.description ? [{ label: 'Source scope', value: model.description }] : []),
        ...(model.material ? [{ label: 'Material options', value: model.material }] : []),
        ...(model.mounting ? [{ label: 'Mounting', value: model.mounting }] : []),
        ...(model.ipRating ? [{ label: 'Published IP protection', value: model.ipRating }] : []),
        ...(model.lid ? [{ label: 'Cover options', value: model.lid }] : []),
        ...(model.dimensionsSource
          ? [{ label: 'Dimension evidence', value: model.dimensionsSource }]
          : []),
        ...(['length', 'width', 'height'] as const).flatMap((key, index) => {
          const choices = model.dimensionOptions?.[key];
          return choices?.length
            ? [
                {
                  label: `Outside ${['A', 'B', 'C'][index]} stock sizes`,
                  value: `${choices.join(', ')} mm — discrete published choices`,
                },
              ]
            : [];
        }),
        ...(model.referenceEnvelopeNote
          ? [{ label: 'Variable-size family reference', value: model.referenceEnvelopeNote }]
          : []),
        {
          label: 'Geometry scope',
          value: isGrandado
            ? 'Measured lower-body heights and ears, with a native analytic raised dogleg rim and inferred supporting ledge. The nominal closed envelope remains 83 ×58 ×35 mm. Other cavity, corner, post and original-lid details remain qualified reconstruction. Lifted-lid inspection exports as one closed purchased assembly; body-only height is 23.8 mm.'
            : 'Outside-envelope reference only. The illustrative interior does not establish board fit or mounting clearances. Check the linked product drawing for usable space and interfaces.',
        },
        ...(!model.manufacturer
          ? [{ label: 'Manufacturer', value: 'Not identified by the source' }]
          : []),
      ],
    },
  };
}

export const enclosurePresets = enclosureModels.map(enclosurePreset);
