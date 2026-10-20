/** Offline catalog adapter. Only the generated slim presets belong in a browser package. */
import snapshotData from './kosmodrom/m3-standoffs.json';
import type { Parameters, Preset } from '../core/types';
import { prototypeDefaults } from '../parts/pcb-standoff/lib/schema';

type End = 'plain' | 'female' | 'male' | 'self-tapping';
type SourceValue = number | string | boolean | null;
interface SourceProduct {
  catalogId: number;
  sku: string;
  model: string;
  manufacturer: string | null;
  url: string;
  material: string | null;
  finish: string | null;
  sourceSha256: string;
  parameters: {
    profile: 'hex' | 'round' | null;
    endA: End | null;
    endB: End | null;
    bodyLength: number | null;
    bodyWidth: number | null;
    cornerDiameter: number | null;
    threadDiameter: number | null;
    threadPitch: number | null;
    threadDesignation: string | null;
    maleLengthA: number | null;
    maleLengthB: number | null;
    femaleDepthA: number | null;
    femaleDepthB: number | null;
    boreDiameter: number | null;
    throughBore: boolean | null;
    threadedThrough: boolean | null;
    overallLength: number | null;
  };
  designationHints: {
    bodyLength?: number;
    threadDiameter?: number;
    endA?: End;
    endB?: End;
  };
  parameterEvidence: Record<string, Array<{ kind: string; formula?: string }>>;
  drawings: Array<{
    url: string;
    E?: { nominal: number; lowerDeviation: number; upperDeviation: number };
    H?: { nominal: number; lowerDeviation: number; upperDeviation: number };
  }>;
  issues: Array<{
    field: string;
    reason: string;
    tableValue?: number;
    designationValue?: number;
    productValue?: number;
    drawingValue?: number;
  }>;
}
interface SourceSnapshot {
  snapshotDate: string;
  categoryUrl: string;
  products: SourceProduct[];
}
const snapshot = snapshotData as unknown as SourceSnapshot;
const pitchInterpretation =
  '0.5 mm is an ISO metric coarse interpretation of the published M3 designation. The supplier does not separately publish pitch, fit class or thread profile; this is not a verified supplier pitch.';
const positive = (value: number | null | undefined, label: string, item: string): number => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0)
    throw new Error(`${item}: no positive ${label} is available for its qualified envelope.`);
  return value;
};
const format = (value: number) => `${value} mm`;
function published(product: SourceProduct, key: string, value: SourceValue): boolean {
  return (
    value !== null &&
    !(product.parameterEvidence[key] ?? []).some(
      (evidence) => evidence.kind === 'derived-from-published-dimensions',
    )
  );
}
function sourceIssue(issue: SourceProduct['issues'][number]): string {
  if (issue.tableValue !== undefined && issue.designationValue !== undefined)
    return `Supplier board-spacing table says ${format(issue.tableValue)}; the commercial designation indicates ${format(issue.designationValue)}. The model uses the designation only as a disputed installation envelope, not a verified body length.`;
  if (issue.productValue !== undefined && issue.drawingValue !== undefined)
    return `The product specifies across flats ${format(issue.productValue)}, while its linked generic drawing gives ${format(issue.drawingValue)}. The explicit product width is retained; the generic drawing's corner width is not applied.`;
  return issue.reason;
}

function standoffPreset(product: SourceProduct): Preset {
  const source = product.parameters;
  const bodyLength = positive(
    source.bodyLength ?? product.designationHints.bodyLength,
    'body length',
    product.model,
  );
  const bodyWidth = positive(source.bodyWidth, 'published body width', product.model);
  const profile = source.profile ?? 'hex';
  const endA = source.endA ?? product.designationHints.endA;
  const endB = source.endB ?? product.designationHints.endB;
  if (!endA || !endB)
    throw new Error(`${product.model}: no declared or qualified end combination.`);
  const diameter = positive(source.threadDiameter, 'published thread diameter', product.model);
  if (diameter !== 3 || source.threadDesignation !== 'M3')
    throw new Error(`${product.model}: this category adapter requires the published M3 interface.`);
  const parameters: Parameters = {
    ...prototypeDefaults,
    catalogItem: `kosmodrom-${product.sku}`,
    profile,
    endA,
    endB,
    bodyLength,
    bodyWidth,
    cornerDiameter: source.cornerDiameter ?? 0,
    femaleDepthA: 0,
    femaleDepthB: 0,
    femaleEnvelopeDepthA: 0,
    femaleEnvelopeDepthB: 0,
    maleLengthA: 0,
    maleLengthB: 0,
    maleEnvelopeLengthA: 0,
    maleEnvelopeLengthB: 0,
    boreDiameter: source.boreDiameter ?? 0,
    throughBore: source.throughBore ?? false,
    threadedThrough: source.threadedThrough ?? false,
    meetingFemaleBores: false,
    appearance:
      product.finish === 'nickel-plated'
        ? 'nickel'
        : product.material === 'brass'
          ? 'brass'
          : product.material === 'steel'
            ? 'steel'
            : 'neutral',
  };
  const verified = new Set<string>(['catalogItem']);
  const conditions: Record<string, string> = {};
  const notes: string[] = [];
  const specifications: { label: string; value: string }[] = [
    { label: 'Supplier SKU', value: product.sku },
    { label: 'Model', value: product.model },
    { label: 'Manufacturer', value: product.manufacturer ?? 'Not published by the product page.' },
    { label: 'Material', value: product.material ?? 'Not published.' },
    { label: 'Finish', value: product.finish ?? 'Not published; color is illustrative.' },
    { label: 'Source snapshot', value: snapshot.snapshotDate },
    { label: 'Thread interpretation', value: pitchInterpretation },
  ];
  for (const key of ['profile', 'bodyLength', 'bodyWidth', 'cornerDiameter'] as const)
    if (published(product, key, source[key])) verified.add(key);
  if (source.profile === null)
    notes.push(
      'Hex form is inferred from the TFF/TFM/TMM commercial series, not explicitly specified for this SKU.',
    );
  if (source.bodyLength === null)
    notes.push(
      `Body ${format(bodyLength)} comes from the commercial designation; no resolved product-table body length is available.`,
    );
  if (source.cornerDiameter === null)
    notes.push(
      'Across-corner size and corner/chamfer profile are unpublished; the regular hex outer shape is an installation envelope.',
    );
  else
    notes.push(
      'The hex is clipped to the linked drawing H envelope. Corner rounds/chamfers remain unspecified.',
    );

  for (const side of ['A', 'B'] as const) {
    const end = parameters[`end${side}`];
    const sourceEnd = source[`end${side}`];
    parameters[`threadDiameter${side}`] = end === 'plain' ? 0 : diameter;
    parameters[`threadPitch${side}`] = end === 'plain' ? 0 : 0.5;
    parameters[`threadDesignation${side}`] = end === 'plain' ? '' : source.threadDesignation;
    parameters[`threadRootDiameter${side}`] = 0;
    if (sourceEnd !== null) {
      verified.add(`end${side}`);
      verified.add(`threadDiameter${side}`);
      verified.add(`threadDesignation${side}`);
    } else
      notes.push(
        `End ${side} ${end} is a commercial-designation inference, not an independently published end form.`,
      );
    if (end === 'female') {
      const envelope = Math.min(2, bodyLength / 4);
      parameters[`femaleEnvelopeDepth${side}`] = envelope;
      specifications.push({
        label: `Female end ${side}`,
        value: `Thread/drilling depth is unpublished. Confirmed depth remains 0; the ${format(envelope)} blind opening is an illustrative envelope, not a manufacturing depth.`,
      });
      notes.push(
        `Female ${side} depth is unpublished; its visible opening is an unverified envelope.`,
      );
    }
    if (end === 'male') {
      const supplied = source[`maleLength${side}`];
      const derivedOverall =
        supplied === null &&
        source.overallLength !== null &&
        source.bodyLength === null &&
        !product.issues.some((issue) => issue.field === 'bodyLength')
          ? source.overallLength - bodyLength
          : undefined;
      if (supplied !== null) {
        parameters[`maleLength${side}`] = positive(supplied, `stud ${side} length`, product.model);
        if (published(product, `maleLength${side}`, supplied)) {
          verified.add(`maleLength${side}`);
          specifications.push({
            label: `Male end ${side}`,
            value: `Published stud length ${format(supplied)}.`,
          });
        } else {
          notes.push(
            `Stud ${side} ${format(supplied)} is derived from published overall and body dimensions, not quoted as a separate supplier stud length.`,
          );
          specifications.push({
            label: `Male end ${side}`,
            value: `Derived extension ${format(supplied)} = overall ${format(source.overallLength!)} - body ${format(bodyLength)}.`,
          });
        }
      } else if (derivedOverall !== undefined && derivedOverall > 0) {
        parameters[`maleLength${side}`] = derivedOverall;
        notes.push(
          `Stud ${side} ${format(derivedOverall)} is derived from overall ${format(source.overallLength!)} minus designation body ${format(bodyLength)}; supplier stud length is not independently published.`,
        );
        specifications.push({
          label: `Male end ${side}`,
          value: `Derived extension ${format(derivedOverall)} = published overall ${format(source.overallLength!)} - commercial-designation body ${format(bodyLength)}.`,
        });
      } else {
        parameters[`maleEnvelopeLength${side}`] = 6;
        notes.push(
          `Stud ${side} length is unpublished. The 6 mm smooth projection is illustrative, not a verified stud span; confirmed male length stays 0.`,
        );
        specifications.push({
          label: `Male end ${side}`,
          value:
            'Unpublished stud length; a smooth 6 mm installation envelope is shown. No manufacturing thread/span is assigned to this projection.',
        });
      }
    }
  }
  for (const key of ['throughBore', 'threadedThrough'] as const)
    if (source[key] !== null) verified.add(key);
  if (source.throughBore === null || source.threadedThrough === null)
    notes.push(
      'Hole connectivity is unpublished. Blind opening envelopes do not assert a continuous through hole/thread.',
    );
  specifications.push(
    {
      label: 'Body length',
      value:
        source.bodyLength === null
          ? `${format(bodyLength)} qualified designation envelope; not a resolved published body length.`
          : `${format(source.bodyLength)} from the product dimensions.`,
    },
    {
      label: 'Across flats',
      value: `${format(bodyWidth)} from the product or directly linked nominal drawing dimension.`,
    },
    {
      label: 'Across-corner envelope',
      value:
        source.cornerDiameter === null
          ? 'Not published for this variant; no numeric H is promoted from an incompatible generic drawing.'
          : `${format(source.cornerDiameter)} nominal H, upper deviation 0 and lower deviation -0.2 mm; not a fully defined corner profile.`,
    },
    {
      label: 'Body/end form',
      value: `${profile}; ${endA}/${endB}. Missing source forms are commercial-series interpretations, identified in the model limitations.`,
    },
    {
      label: 'Hole connectivity',
      value:
        source.throughBore === false
          ? 'The directly linked series drawing depicts blind openings; numeric depth is unspecified.'
          : 'Not explicitly published; blind installation envelopes are shown.',
    },
    {
      label: 'Thread fit, corner/chamfer and strength',
      value:
        'Not published; confirm the actual supplier article/drawing before engineering release.',
    },
  );
  const issueNotes = product.issues.map(sourceIssue);
  for (const value of issueNotes) specifications.push({ label: 'Source conflict', value });
  notes.push(...issueNotes);
  notes.push(pitchInterpretation);
  const modelFidelity = product.issues.some((issue) => issue.field === 'bodyLength')
    ? 'Source length conflict; 25 mm designation envelope'
    : product.issues.length
      ? 'Explicit AF 4.5 mm; generic PDF AF 5 mm conflict'
      : [endA, endB].includes('female')
        ? 'Blind depth unpublished; installation envelope'
        : 'Published stud spans; interpreted ISO metric pitch';
  const attributes: Record<string, string | number | boolean> = {
    supplier: 'Kosmodrom',
    series: product.model.split('-M3')[0],
    threadLabel: source.threadDesignation!,
    modelFidelity,
  };
  if (product.material) attributes.material = product.material;
  if (product.manufacturer) attributes.manufacturer = product.manufacturer;
  if (product.finish) attributes.coating = product.finish;
  if (source.profile !== null) attributes.bodyForm = source.profile;
  if (source.endA !== null && source.endB !== null)
    attributes.endForm = `${source.endA}/${source.endB}`;
  for (const side of ['A', 'B'] as const) {
    if (verified.has(`threadDesignation${side}`)) {
      attributes[`catalogThread${side}`] = String(parameters[`threadDesignation${side}`]);
      conditions[`catalogThread${side}`] =
        `Published M3 designation applied to the source-described end ${side}; pitch and fit class remain separately unverified.`;
    }
  }
  if (source.overallLength !== null) {
    attributes.catalogOverallLength = source.overallLength;
    conditions.catalogOverallLength =
      'Exact overall length from the supplier product table; it includes any projecting stud and is not a verified body length.';
    specifications.push({
      label: 'Published overall length',
      value: `${format(source.overallLength)} from the product table; distinct from body length and separately qualified stud/body interpretations.`,
    });
  }
  for (const [sourceKey, attribute] of [
    ['bodyLength', 'catalogBodyLength'],
    ['bodyWidth', 'catalogBodyWidth'],
    ['cornerDiameter', 'catalogCornerDiameter'],
  ] as const)
    if (source[sourceKey] !== null) attributes[attribute] = source[sourceKey];
  const limitations = notes.join(' ');
  conditions.modelFidelity = issueNotes.length
    ? issueNotes.join(' ')
    : 'Installation envelope. Unpublished blind/stud dimensions, commercial-series interpretations and ISO coarse pitch are identified in the item specifications; no exact supplier CAD is claimed.';
  conditions.threadLabel = pitchInterpretation;
  if (source.bodyLength !== null)
    conditions.catalogBodyLength =
      'Published product body dimension; independent of illustrative opening/stud envelopes.';
  conditions.catalogBodyWidth = product.issues.some((issue) => issue.field === 'bodyWidth')
    ? issueNotes.join(' ')
    : 'Explicit product wrench width or directly linked nominal E dimension; source tolerances and exact chamfers must be checked.';
  if (source.cornerDiameter !== null)
    conditions.catalogCornerDiameter =
      'Directly linked M3 drawing H nominal 5.5 mm (+0/-0.2). The clipping envelope does not define exact corner/chamfer manufacture.';
  return {
    id: `kosmodrom-${product.sku}`,
    name: product.model,
    description: `Kosmodrom ${product.sku}: ${product.material ?? 'unspecified material'} ${endA}/${endB} standoff. ${modelFidelity}.`,
    parameters,
    product: { supply: 'purchased' },
    catalog: {
      designation: product.model,
      ...(product.manufacturer ? { manufacturer: product.manufacturer } : {}),
      sourceName: 'Kosmodrom M3 standoffs',
      sourceUrl: product.url,
      verifiedParameters: [...verified],
      productCodes: [product.sku],
      alternateSourceUrls: [
        snapshot.categoryUrl,
        ...product.drawings.map((drawing) => drawing.url),
      ],
      geometryEvidence: {
        kind: 'envelope',
        summary: `${modelFidelity}. Published dimensions are retained; only separately identified interpretations/envelopes fill missing installation geometry.`,
        limitations,
        sourceUrl: product.url,
        sourceSha256: product.sourceSha256,
      },
      attributes,
      attributeConditions: conditions,
      specifications,
    },
  };
}

/** All supplier identities are retained, including clearly qualified/conflicting envelopes. */
export function kosmodromPresets(): Preset[] {
  return snapshot.products.map(standoffPreset);
}
