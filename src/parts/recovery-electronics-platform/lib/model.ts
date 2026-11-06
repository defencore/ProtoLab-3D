import type { Parameters, PartDefinition } from '../../../core/types';
import type {
  AssemblyComponent,
  AssemblyDefinition,
  ProductPlacement,
} from '../../../core/product-types';
import { configureProduct } from '../../../core/design-project';
import {
  componentGeometry,
  componentPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import gps from '../../gps-tracker/part';
import buzzer from '../../jhe42b-finder/part';
import usb from '../../usb-wireless-extender/part';
import mount, { mountingLayout } from '../../recovery-electronics-mount/part';

export const platformLibraries = [gps, buzzer, usb, mount];
type SourcePose = { sourceId: number; translation: readonly number[]; rotation: readonly number[] };

function occurrence(part: PartDefinition, presetId: string, pose: SourcePose): AssemblyComponent {
  const preset = part.presets.find((preset) => preset.id === presetId);
  if (!preset) throw new Error('Missing platform library model: ' + part.id + ':' + presetId);
  const parameters: Parameters = { ...part.defaults, ...preset.parameters };
  const configured = configureProduct({
    part,
    parameters,
    presetId,
    state: part.states?.[0]?.id ?? 'default',
  });
  return {
    id: 'source-' + pose.sourceId,
    name: preset.name,
    libraryId: part.id,
    presetId,
    parameters,
    state: configured.state,
    quantity: 1,
    supply: configured.supply,
    placement: {
      translation: [...pose.translation],
      rotation: [...pose.rotation],
    } as ProductPlacement,
    ...(configured.procurement ? { procurement: configured.procurement } : {}),
    ...(configured.manufacturing ? { manufacturing: configured.manufacturing } : {}),
    notes: `Source physical occurrence ${pose.sourceId}; latest current stack, relative to lower platform underside. Original world underside Z=${mountingLayout.sourceWorldLowerUndersideZ} mm.`,
  };
}

/** Stable source occurrences; inspection offsets never enter the physical composition. */
export function platformComposition(): AssemblyDefinition {
  return {
    components: [
      occurrence(mount, mountingLayout.lower.model, mountingLayout.lower),
      occurrence(mount, mountingLayout.upper.model, mountingLayout.upper),
      occurrence(gps, 'zx908', mountingLayout.gps),
      occurrence(buzzer, 'jhe42b-project-reference-26x17x15', mountingLayout.buzzer),
      occurrence(usb, 'speedybee-f405-wing-mini-usb', mountingLayout.usb),
      ...mountingLayout.gpsPads.map((pad) => occurrence(mount, pad.model, pad)),
    ],
    issues: [
      'This is the transferred electronics seating study, not a complete procurement or manufacturing assembly.',
      'Supporting posts, USB screws/nuts, top screws and two buzzer ties are excluded. Their source candidates, access and actual supplier executions remain unresolved; no replacements or installed tie paths are invented.',
      'The 26 x 17 x 15 JHE42B occupied box is a project reference, distinct from the standard manufacturer 23 x 17 x 17 product.',
      'GPS compliant retainer material, contact pressure and compression remain unspecified; exact retained source reliefs do not qualify retention loads.',
      'Actual connectors, insertion paths, cable bends, enclosure fit, manufacturing tolerances and load qualification require the delivered hardware.',
    ],
  };
}

function pieces(state: string): ConfiguredPiece[] {
  return platformComposition().components.map((component) => ({
    component,
    label: component.name,
    color: component.libraryId === mount.id ? 0xd4d8d8 : 0x39434a,
    preserveLibraryAppearance: true,
    z:
      state !== 'exploded'
        ? 0
        : component.id === 'source-248'
          ? 50
          : component.id.startsWith('source-15') || component.id.startsWith('source-16')
            ? 35
            : component.id === 'source-140'
              ? 0
              : 20,
  }));
}
export const platformGeometry = (state: string) =>
  componentGeometry(platformLibraries, pieces(state));
export const platformPython = (state: string) => componentPython(platformLibraries, pieces(state));
export function platformDimensions(state: string): [number, number, number] {
  const upper = mount.dimensions({ model: mountingLayout.upper.model }, 'default');
  // The notch-reduced Y envelope comes from the owning upper-disc definition.
  const top =
    state === 'exploded'
      ? mountingLayout.upper.translation[2] + 50 + upper[2]
      : mountingLayout.buzzer.translation[2] + 15;
  return [upper[0], upper[1], top];
}
