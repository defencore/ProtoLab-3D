import type { Parameters, PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import manufactured from '../../manufactured-detail/part';
import antenna from '../../adhesive-antenna/part';
import bolt from '../../bolt-screw/part';
import { fairingPrintShape, fairingShape, fairingSpec, referenceTubeShape } from './fairing';

export const libraries: PartDefinition[] = [manufactured, antenna, bolt];

export function fairingOccurrence(p: Parameters, print = false): ConfiguredPiece {
  const component = detailComponent(
    'jcg108-fairing',
    'Conformal tube antenna fairing · engineering reference',
    print ? fairingPrintShape(p) : fairingShape(p),
    { nativeRefine: false, preserveAuthoredFrame: true },
  );
  component.supply = 'reference';
  component.notes =
    'Independent unfinished fairing design. No manufacturing or procurement release; not part of the Grandado mounting kit.';
  return { component, label: component.name, color: 0x72889a };
}

export function antennaOccurrence(p: Parameters): ConfiguredPiece {
  const s = fairingSpec(p),
    model = String(p.antennaModel);
  return {
    component: {
      id: 'jcg108-source-antenna',
      name: 'Jinchang JCG108 nominal source antenna',
      libraryId: antenna.id,
      presetId: model,
      parameters: { model },
      state: 'default',
      quantity: 1,
      supply: 'reference',
      placement: s.antennaPlacement,
      notes:
        'Reused adhesive-antenna source execution. Mounting depth controls never resize this library geometry. Lead, connector and boot remain unmodeled.',
    },
    label: 'Jinchang JCG108 · unchanged source housing',
    color: 0x292b2e,
  };
}

export function anchorOccurrences(p: Parameters): ConfiguredPiece[] {
  return fairingSpec(p).anchors.map((a) => ({
    component: {
      id: `fairing-anchor-${a.x < 0 ? 'negative' : 'positive'}`,
      name: `M3 × ${a.screwLength} DIN 7991 · interface reference`,
      libraryId: bolt.id,
      parameters: {
        ...bolt.defaults,
        diameter: 3,
        shankDiameter: 3,
        length: a.screwLength,
        head: 'countersunk',
        headSize: 6,
        headHeight: 1.7,
        countersinkAngle: 90,
        drive: 'hex',
        driveWidth: 2,
        driveDepth: 1.2,
        pitch: 0.5,
        tip: 'flat',
        tipDiameter: 2,
      },
      state: 'default',
      quantity: 1,
      supply: 'reference',
      placement: {
        translation: [a.x, 0, -a.headTopRadius + a.screwLength / 2],
        rotation: [180, 0, 0],
      },
      notes:
        'Nominal anchor interface only. Supporting nut lands and a qualified host load path are outside this standalone reference.',
    },
    label: `M3 × ${a.screwLength} flush anchor · reference`,
    color: 0xaeb5bc,
  }));
}

export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  if (state === 'print-only') return [fairingOccurrence(p, true)];
  if (state === 'fairing-only') return [fairingOccurrence(p)];
  const items = [fairingOccurrence(p), ...anchorOccurrences(p)];
  if (p.showAntenna) items.push(antennaOccurrence(p));
  if (p.showTube) {
    const component = detailComponent(
      'host-pipe-reference',
      'Ø90/86 pipe · installation reference',
      referenceTubeShape(p),
    );
    component.supply = 'reference';
    items.push({ component, label: component.name, color: 0x68757c });
  }
  return items;
}
