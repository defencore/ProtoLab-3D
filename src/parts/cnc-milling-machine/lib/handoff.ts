import type { Parameters, PartDefinition, Preset } from '../../../core/types';
import type { AssemblyComponent, ManufacturingDefinition } from '../../../core/product-types';
import { presetMatchesConfiguration } from '../../../core/catalog-models';
import { frameManufacturing } from '../../cnc-frame-part/part';
import { driveScrewLayout } from '../../cnc-drive-screw/part';
import { spindleMountLayout } from '../../cnc-spindle-mount/part';
import { worktableLayout } from '../../cnc-worktable/part';

type Handoff = Pick<AssemblyComponent, 'presetId' | 'procurement' | 'manufacturing'>;

const nutFamilies = new Set([
  'hex-nut',
  'coupling-nut',
  'flange-nut',
  'nyloc-nut',
  'thin-nut',
  'high-nut',
  'metal-lock-nut',
  'cap-nut',
  'square-nut',
]);

/** Only this declared, non-catalog nut inspection setting may differ from ordered nominal data. */
function nominalNutOrdering(part: PartDefinition, p: Parameters, preset: Preset): Parameters {
  const field = part.parameters.find((one) => one.key === 'threadAllowance');
  return nutFamilies.has(part.id) &&
    field?.type === 'number' &&
    field.filterable === false &&
    part.defaults.threadAllowance === 0 &&
    preset.parameters.threadAllowance === 0 &&
    !preset.catalog?.verifiedParameters.includes('threadAllowance') &&
    !Object.hasOwn(preset.catalog?.attributes ?? {}, 'threadAllowance') &&
    typeof p.threadAllowance === 'number' &&
    Number.isFinite(p.threadAllowance) &&
    p.threadAllowance >= (field.min ?? 0) &&
    p.threadAllowance <= (field.max ?? 0)
    ? { ...p, threadAllowance: 0 }
    : p;
}

/** A supplied identity must match; an ambiguous shape is never an automatic supplier selection. */
function catalogPreset(part: PartDefinition, p: Parameters, presetId?: string): Preset | undefined {
  const candidates = part.presets.filter(
    (preset) =>
      preset.catalog &&
      (presetId === undefined || preset.id === presetId) &&
      presetMatchesConfiguration(part, preset, nominalNutOrdering(part, p, preset)),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

function mountManufacturing(p: Parameters, part: PartDefinition): ManufacturingDefinition {
  const v = spindleMountLayout(p),
    depth = p.component === 'back' ? v.backSplitY - v.rearFaceY : v.capFrontY - v.capSplitY;
  return {
    material: 'Aluminium; alloy and temper to be specified',
    blank: `${v.outerWidth} x ${depth} x ${v.clampHeight} mm billet envelope; add machining allowance on the released drawing`,
    processes: [...part.product.processes],
    requirements: [
      ...part.product.releaseRequirements,
      `Selected ${p.component} detail: nominal assembled bore ${v.boreDiameter} mm at split gap ${p.splitGap} mm. Bore allowance and thread inspection allowance are authored geometry, not released fits.`,
      'Specify material, blank allowance, datums, bore fit, fastening torque and inspection before fabrication; no material grade or dimensional tolerance is approved here.',
    ],
  };
}

function driveManufacturing(p: Parameters, part: PartDefinition): ManufacturingDefinition {
  const v = driveScrewLayout(p);
  return {
    material:
      'Purchased SFU1610 grooved screw blank; actual steel grade and heat treatment to be confirmed with its supplier',
    blank: `Nominal diameter 16 mm SFU1610 blank, at least ${v.overallLength} mm before end-machining allowance; preserve ${v.racewayLength} mm active raceway`,
    processes: [...part.product.processes],
    requirements: [
      ...part.product.releaseRequirements,
      `Fixed journal diameter ${v.fixedJournal.diameter} mm, drive journal diameter ${v.driveJournal.diameter} mm; supported journal diameter ${v.freeJournal.diameter} mm. Use the library end drawing for their distinct spans and the M${v.thread.diameter}x${v.thread.pitch} retention thread.`,
      'Order a compatible blank and nut from an identified supplier; confirm lead accuracy, preload, hard-end machining method and machining allowance. The finished shaft is a custom execution, not an identified supplier SKU.',
    ],
  };
}

function tableManufacturing(p: Parameters, part: PartDefinition): ManufacturingDefinition {
  const v = worktableLayout(p),
    bent = ['pan-side', 'pan-end'].includes(v.role),
    wood = ['spoilboard', 'hybrid-board'].includes(v.role),
    machined = ['slat', 't-track', 'vacuum-plate'].includes(v.role),
    tank = v.role === 'tank-body';
  return {
    material: wood
      ? 'Wood-based board; grade, facing and coolant compatibility to be specified'
      : machined
        ? 'Aluminium; alloy and temper to be specified'
        : 'Metal stock; grade and coolant compatibility to be specified',
    blank: bent
      ? `Sheet thickness ${v.thickness} mm, formed length ${v.length} mm; calculate the developed blank from the released bend radius and material`
      : `${v.width} x ${v.length} x ${tank ? 150 : v.thickness} mm ${tank ? 'billet' : 'stock'} envelope; add manufacturing allowance on the released drawing`,
    processes: bent
      ? ['cutting', 'drilling', 'bending']
      : tank
        ? ['milling']
        : machined
          ? ['milling', 'drilling']
          : wood
            ? ['cutting', 'milling', 'drilling']
            : ['cutting', 'drilling'],
    requirements: [
      ...part.product.releaseRequirements,
      'The envelope is the selected library detail, not a developed production blank or an OEM drawing. Resolve stock allowance, datums, material, tolerances and inspection on the fabrication drawing.',
      ...(bent
        ? [
            `Selected inner bend radius ${p.bendRadius} mm; qualify bend allowance, corner relief and sealing with the chosen material and tooling.`,
          ]
        : []),
    ],
  };
}

/** Transfer source-backed ordering data and explicit fabrication recipes without changing geometry. */
export function millingHandoff(part: PartDefinition, p: Parameters, presetId?: string): Handoff {
  if (part.product.supply === 'manufactured') {
    const manufacturing =
      part.id === 'cnc-frame-part'
        ? frameManufacturing(p)
        : part.id === 'cnc-spindle-mount'
          ? mountManufacturing(p, part)
          : part.id === 'cnc-drive-screw'
            ? driveManufacturing(p, part)
            : part.id === 'cnc-worktable'
              ? tableManufacturing(p, part)
              : undefined;
    return manufacturing ? { manufacturing } : {};
  }
  if (!['purchased', 'standard'].includes(part.product.supply)) return {};
  const preset = catalogPreset(part, p, presetId),
    catalog = preset?.catalog,
    authoredNutAllowance =
      preset && nominalNutOrdering(part, p, preset).threadAllowance !== p.threadAllowance;
  return preset && catalog
    ? {
        presetId: preset.id,
        procurement: {
          // Distinct inspection configurations retain a qualified nominal identity, not a supplier fit claim.
          designation: authoredNutAllowance
            ? `${catalog.designation} / nominal catalog identity; Full CAD radial allowance ${p.threadAllowance} mm authored, delivered fit unqualified`
            : catalog.designation,
          manufacturer: catalog.manufacturer ?? '',
          source: catalog.sourceUrl,
          ...(catalog.standard ? { standard: catalog.standard } : {}),
        },
      }
    : {};
}
