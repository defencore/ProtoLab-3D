/** Offline adapter; browser packages receive only the generated supplier presets. */
import snapshotData from './dremec/standoffs.json';
import type { Parameters, Preset } from '../core/types';
import { prototypeDefaults, insertPrototypeDefaults } from '../parts/pcb-standoff/lib/schema';

type Kind = 'DII' | 'DIA' | 'DAA';
interface SourceRecord {
  id: string;
  sku: string;
  series: string;
  kind: Kind;
  shape: 'hex' | 'round';
  material: string;
  materialGrade: string;
  finish: string;
  bodyLength: number;
  acrossFlats: number | null;
  bodyDiameter: number | null;
  femaleThread: string | null;
  femaleThreadDepth: number | null;
  femaleThrough: boolean;
  maleThread: string | null;
  maleThreadLength: number | null;
  supplierUrl: string;
  drawingUrl: string;
  printedPage: number;
  pdfPage: number;
  availabilityEvidence: string;
  relief: string;
  optionalNoReliefSuffix: string | null;
  optionalBareFinishSuffix?: string;
  optionalA2Material?: { suffix: string; materialGrade: string; sourcePrintedPage: number };
  shortStudOption?: { sku: string; maleThreadLength: number; sourcePrintedPage: number };
  selfTappingMajorDiameter?: number;
  selfTappingRootDiameter?: number;
  lengthTolerance: number | null;
  lengthToleranceStandard: string | null;
  geometryNotes: string[];
}
interface SourceSnapshot {
  sourceUrl: string;
  sourceSha256: string;
  catalogModifiedAt: string;
  records: SourceRecord[];
}
interface ThreadInterpretation {
  diameter: number;
  pitch: number;
  standardDerivedDiameter: boolean;
  interpretation: string;
}
const snapshot = snapshotData as unknown as SourceSnapshot;
const metricPitches = new Map([
  [2, 0.4],
  [2.5, 0.45],
  [3, 0.5],
  [4, 0.7],
  [5, 0.8],
  [6, 1],
  [8, 1.25],
]);
function positive(value: number | null | undefined, label: string, sku: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw new Error(`DREMEC ${sku}: missing positive ${label}.`);
  return value;
}
function thread(source: string | null, record: SourceRecord): ThreadInterpretation {
  if (!source) throw new Error(`DREMEC ${record.sku}: threaded end lacks its designation.`);
  const metric = /^M(\d+(?:\.\d+)?)$/.exec(source);
  if (metric) {
    const diameter = Number(metric[1]),
      pitch = metricPitches.get(diameter);
    if (pitch === undefined) throw new Error(`DREMEC ${record.sku}: unsupported metric ${source}.`);
    return {
      diameter,
      pitch,
      standardDerivedDiameter: false,
      interpretation: `${source} is interpreted as an ISO metric coarse thread with ${pitch} mm pitch. Pitch, fit class and exact profile are not independently published by the supplier.`,
    };
  }
  if (source === 'UNC4-40')
    return {
      diameter: 0.112 * 25.4,
      pitch: 25.4 / 40,
      standardDerivedDiameter: true,
      interpretation:
        'UNC4-40 is interpreted using the numbered #4 basic major diameter 0.112 in x 25.4 = 2.8448 mm and 25.4 / 40 = 0.635 mm pitch. These are standard-derived values, not separately measured supplier dimensions or a published fit class.',
    };
  if (/^ST\d+(?:\.\d+)?$/.test(source))
    return {
      diameter: positive(
        record.selfTappingMajorDiameter,
        'published self-tapping major d1',
        record.sku,
      ),
      pitch: 0,
      standardDerivedDiameter: false,
      interpretation: `${source} retains the published d1 major and d2 root diameters. Its pitch/profile is unspecified; the external stud remains a smooth nominal envelope in both modes, without a fabricated helix.`,
    };
  throw new Error(`DREMEC ${record.sku}: unsupported source thread ${source}.`);
}

function standoffPreset(record: SourceRecord, short = false): Preset {
  const option = short ? record.shortStudOption : undefined;
  if (short && !option) throw new Error(`DREMEC ${record.sku}: no short-stud source option.`);
  const sku = option?.sku ?? record.sku,
    id = short ? `${record.id}k` : record.id,
    composite = record.material === 'polyamide-brass',
    bodyLength = positive(record.bodyLength, 'body length', sku),
    bodyWidth = positive(record.acrossFlats ?? record.bodyDiameter, 'body width', sku),
    female = record.kind !== 'DAA',
    through = record.kind === 'DII' && record.femaleThrough,
    meeting =
      record.kind === 'DII' &&
      record.femaleThreadDepth !== null &&
      record.femaleThreadDepth * 2 === bodyLength;
  const parameters: Parameters = {
    ...(composite ? insertPrototypeDefaults : prototypeDefaults),
    catalogItem: id,
    profile: record.shape,
    endA: female ? 'female' : 'male',
    endB: record.kind === 'DII' ? 'female' : 'male',
    bodyLength,
    bodyWidth,
    cornerDiameter: 0,
    threadDiameterA: 0,
    threadDiameterB: 0,
    threadPitchA: 0,
    threadPitchB: 0,
    threadDesignationA: '',
    threadDesignationB: '',
    threadRootDiameterA: 0,
    threadRootDiameterB: 0,
    maleLengthA: 0,
    maleLengthB: 0,
    maleEnvelopeLengthA: 0,
    maleEnvelopeLengthB: 0,
    femaleDepthA: 0,
    femaleDepthB: 0,
    femaleEnvelopeDepthA: 0,
    femaleEnvelopeDepthB: 0,
    boreDiameter: 0,
    throughBore: false,
    threadedThrough: through,
    meetingFemaleBores: meeting,
    appearance:
      record.material === 'polyamide-brass'
        ? 'nylon-white'
        : record.material === 'polyamide'
          ? 'nylon-black'
          : record.finish === 'nickel-plated'
            ? 'nickel'
            : record.material === 'aluminium'
              ? 'aluminium'
              : 'steel',
    ...(composite
      ? {
          insertOuterDiameter: 0,
          insertLengthA: 0,
          insertLengthB: 0,
          insertThrough: false,
        }
      : {}),
  };
  const verified = new Set(['catalogItem', 'profile', 'endA', 'endB', 'bodyLength', 'bodyWidth']);
  const notes = [...record.geometryNotes];
  const interpretationNotes = new Set<string>();
  const specifications: { label: string; value: string }[] = [
    { label: 'Manufacturer order code', value: sku },
    {
      label: 'Manufacturer catalog',
      value: `Modified ${snapshot.catalogModifiedAt}; printed page ${record.printedPage}, PDF spread ${record.pdfPage}.`,
    },
    { label: 'Catalog SHA-256', value: snapshot.sourceSha256 },
    {
      label: 'UA product family',
      value:
        'The linked shop parent is listed; current variation ID, stock and exact local SKU availability are unconfirmed.',
    },
    { label: 'Material', value: record.materialGrade },
    { label: 'Finish', value: record.finish + '; display color is illustrative.' },
    {
      label: 'Body dimensions',
      value: `${bodyLength} mm body length; ${bodyWidth} mm ${record.shape === 'hex' ? 'across flats' : 'diameter'}, from the manufacturer size row.`,
    },
    {
      label: 'Offered lengths',
      value:
        record.availabilityEvidence === 'explicit-integer-length-range'
          ? 'The actual manufacturer row offers an integer-mm range; intermediate integer lengths are authorized on printed page 6.'
          : 'A filled standard-length cell in the actual manufacturer row; empty cells are not variants.',
    },
    {
      label: 'Length tolerance',
      value:
        record.lengthTolerance === null
          ? (record.lengthToleranceStandard ?? 'Not numerically specified.')
          : `+/-${record.lengthTolerance} mm.`,
    },
    {
      label: 'Across-corner/chamfer profile',
      value:
        'Not dimensioned; the regular body section is an installation envelope, with no verified across-corner value.',
    },
  ];
  let unknownDepth = false,
    unknownStud = false;
  for (const side of ['A', 'B'] as const) {
    const femaleEnd = parameters[`end${side}`] === 'female',
      designation = femaleEnd ? record.femaleThread : record.maleThread,
      interpreted = thread(designation, record);
    parameters[`threadDesignation${side}`] = designation!;
    parameters[`threadDiameter${side}`] = interpreted.diameter;
    parameters[`threadPitch${side}`] = interpreted.pitch;
    verified.add(`threadDesignation${side}`);
    if (!interpreted.standardDerivedDiameter) verified.add(`threadDiameter${side}`);
    interpretationNotes.add(interpreted.interpretation);
    if (femaleEnd) {
      const depth = record.femaleThreadDepth;
      if (through) {
        verified.add('threadedThrough');
        specifications.push({
          label: `Female end ${side}`,
          value: `Source thread span ${depth} mm equals the ${bodyLength} mm body: represented once as a through thread, with separate blind-depth parameters 0.`,
        });
      } else if (depth !== null) {
        parameters[`femaleDepth${side}`] = positive(depth, `female ${side} depth`, sku);
        verified.add(`femaleDepth${side}`);
        specifications.push({
          label: `Female end ${side}`,
          value: `Published L1 ${depth} mm from the catalog thread-length table.`,
        });
      } else {
        unknownDepth = true;
        const envelope = Math.min(2, bodyLength / 4);
        parameters[`femaleEnvelopeDepth${side}`] = envelope;
        notes.push(
          `Female ${side} depth is omitted by the source table. Confirmed depth remains 0; the visible ${envelope} mm blind opening is an illustrative envelope.`,
        );
        specifications.push({
          label: `Female end ${side}`,
          value: `Depth unresolved; confirmed 0, illustrative blind-opening envelope ${envelope} mm. No thread span is assigned to that opening.`,
        });
      }
    } else {
      const length = option?.maleThreadLength ?? record.maleThreadLength;
      if (length !== null) {
        parameters[`maleLength${side}`] = positive(length, `male ${side} length`, sku);
        verified.add(`maleLength${side}`);
        specifications.push({
          label: `Male end ${side}`,
          value: `Published L2 ${length} mm${short ? `; explicit k short-stud option on printed page ${option!.sourcePrintedPage}` : ''}.`,
        });
      } else {
        unknownStud = true;
        parameters[`maleEnvelopeLength${side}`] = 6;
        notes.push(
          `Male ${side} length is omitted by the source table. Confirmed span remains 0; the smooth 6 mm projection is an illustrative installation envelope.`,
        );
        specifications.push({
          label: `Male end ${side}`,
          value:
            'Stud span unresolved; confirmed 0, smooth illustrative projection 6 mm. No manufacturing thread span is assigned to that projection.',
        });
      }
      if (designation!.startsWith('ST')) {
        parameters[`threadRootDiameter${side}`] = positive(
          record.selfTappingRootDiameter,
          'source self-tapping root d2',
          sku,
        );
        verified.add(`threadRootDiameter${side}`);
      }
    }
  }
  if (meeting) {
    verified.add('meetingFemaleBores');
    specifications.push({
      label: 'Meeting female spans',
      value: `The two published ${record.femaleThreadDepth} mm end spans sum to the ${bodyLength} mm body. Both end annotations are retained; a continuous through thread is not asserted.`,
    });
  }
  if (composite)
    specifications.push({
      label: 'Brass inserts',
      value:
        'Installation diameter, internal extent and retention profile are unpublished. All internal insert dimensions remain 0; no fictitious separate insert is made. Published external brass stud spans remain visible.',
    });
  if (record.relief !== 'none')
    notes.push(
      'The catalog declares DIN 76-B relief, but its dimensions are unspecified here; the nominal stud/body envelope does not reproduce that relief. The oF option is not silently appended to the selected SKU.',
    );
  if (record.optionalNoReliefSuffix)
    specifications.push({
      label: 'Optional ordering suffix',
      value: `Source allows ${record.optionalNoReliefSuffix} for no relief; no combined option/SKU is invented.`,
    });
  if (record.optionalBareFinishSuffix)
    specifications.push({
      label: 'Optional finish suffix',
      value: `Source allows ${record.optionalBareFinishSuffix} for bare finish; selected default remains ${record.finish}.`,
    });
  if (record.optionalA2Material)
    specifications.push({
      label: 'Optional material suffix',
      value: `Source allows ${record.optionalA2Material.suffix} for ${record.optionalA2Material.materialGrade}; selected default remains ${record.materialGrade}.`,
    });
  if (record.shortStudOption && !short)
    specifications.push({
      label: 'Short-stud alternative',
      value: `${record.shortStudOption.sku} has ${record.shortStudOption.maleThreadLength} mm studs and is a separate catalog selection.`,
    });
  for (const interpretation of interpretationNotes) {
    notes.push(interpretation);
    specifications.push({ label: 'Standard interpretation', value: interpretation });
  }
  const conflicts = record.geometryNotes.filter((note) => note.includes('equivalence'));
  for (const conflict of conflicts)
    specifications.push({ label: 'Source conflict', value: conflict });
  const modelFidelity = composite
    ? 'Source outer dimensions; insert internals unspecified'
    : unknownDepth
      ? 'Female depth unresolved; installation envelope'
      : unknownStud
        ? 'Stud span unresolved; installation envelope'
        : record.maleThread?.startsWith('ST')
          ? 'Source d1/d2; self-tapping pitch unspecified'
          : meeting
            ? 'Source meeting end spans; standard-derived thread profile'
            : 'Source principal dimensions; standard-derived thread profile';
  const limitations = notes.join(' ');
  const attributes: Record<string, string | number | boolean> = {
    supplier: 'DREMEC Ukraine',
    manufacturer: 'DREMEC',
    series: record.series,
    endForm: `${parameters.endA}/${parameters.endB}`,
    bodyForm: record.shape,
    material: record.material,
    coating: record.finish,
    threadLabel:
      parameters.threadDesignationA === parameters.threadDesignationB
        ? String(parameters.threadDesignationA)
        : `${parameters.threadDesignationA} / ${parameters.threadDesignationB}`,
    catalogThreadA: String(parameters.threadDesignationA),
    catalogThreadB: String(parameters.threadDesignationB),
    catalogBodyLength: bodyLength,
    catalogBodyWidth: bodyWidth,
    modelFidelity,
  };
  return {
    id,
    name: sku,
    description: `DREMEC ${sku}: ${record.kind}, ${record.materialGrade}, ${bodyLength} mm body. ${modelFidelity}.`,
    parameters,
    product: { supply: 'purchased' },
    catalog: {
      designation: sku,
      manufacturer: 'DREMEC',
      sourceName: 'DREMEC manufacturer catalog (2020); UA product family',
      sourceUrl: record.supplierUrl,
      verifiedParameters: [...verified],
      productCodes: [sku],
      alternateSourceUrls: [record.drawingUrl, ...(short ? [`${snapshot.sourceUrl}#page=4`] : [])],
      geometryEvidence: {
        kind: composite || unknownDepth || unknownStud ? 'envelope' : 'source-dimensions',
        summary: `${modelFidelity}. Manufacturer body/end dimensions are retained; standard interpretations and unresolved installation geometry are separately qualified.`,
        limitations,
        sourceUrl: record.drawingUrl,
        sourceSha256: snapshot.sourceSha256,
      },
      attributes,
      attributeConditions: {
        modelFidelity: limitations,
        threadLabel: [...interpretationNotes].join(' '),
        catalogThreadA:
          'Source end A designation; standard pitch/profile interpretations do not establish a supplier fit class.',
        catalogThreadB:
          'Source end B designation; standard pitch/profile interpretations do not establish a supplier fit class.',
        catalogBodyLength:
          'Actual manufacturer standard-length cell or explicitly authorized integer-mm range. UA variation and current stock are unconfirmed.',
        catalogBodyWidth: `Published ${record.shape === 'hex' ? 'across-flats SW' : 'round diameter'} from the manufacturer size row; exact corner/edge geometry is not specified.`,
        ...(conflicts.length ? { material: conflicts.join(' ') } : {}),
      },
      specifications,
    },
  };
}

/** All exact source codes, including the separately specified 68 short-k options. */
export function dremecPresets(): { detail: Preset[]; insert: Preset[] } {
  const detail: Preset[] = [],
    insert: Preset[] = [];
  for (const record of snapshot.records) {
    const output = record.material === 'polyamide-brass' ? insert : detail;
    output.push(standoffPreset(record));
    if (record.shortStudOption) output.push(standoffPreset(record, true));
  }
  return { detail, insert };
}
