import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import holderPart from '../../li-ion-battery-holder/part';
import powerPart from '../../electrical-connector/part';
import signalPart from '../../signal-connector/part';
import springPart from '../../compression-spring/part';
import { latch } from './closure';
import powerModels from '../../electrical-connector/lib/models.json';
import signalModels from '../../signal-connector/lib/catalog.json';
import { layout } from './layout';

export const libraries = [holderPart, powerPart, signalPart, springPart];

function occurrence(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec,
  procurement: NonNullable<AssemblyComponent['procurement']>,
  notes: string,
  state = 'assembled',
): ConfiguredPiece {
  const component: AssemblyComponent = {
    id,
    name: label,
    libraryId: part.id,
    parameters,
    state,
    ...(parameters.model === undefined ? {} : { presetId: String(parameters.model) }),
    quantity: 1,
    supply: 'purchased',
    placement: { translation, rotation },
    procurement,
    notes,
  };
  return { component, label, color: 0xaab1bb, preserveLibraryAppearance: true };
}

/** Retain source-local datums; fabrication clearances belong to the authored carrier parts. */
export function hardware(p: Parameters, travel = 0): ConfiguredPiece[] {
  const d = layout(p),
    power = powerModels.find((model) => model.id === 'xt60e-f')!,
    socket = signalModels.find((model) => model.id === `xh254-balance-header-ra-${d.headerPins}`)!;
  return [
    occurrence(
      springPart,
      'latch-spring',
      'Compression spring / nominal 8 OD x 10 free x 0.4 wire',
      {
        outerDiameter: 8,
        secondaryDiameter: 8,
        wireDiameter: 0.4,
        freeLength: 10,
        turns: 6,
        compression: 1 + travel,
        profile: 'cylindrical',
        ends: 'closed',
        handedness: 'right',
      },
      [(latch.movingSeat + travel + latch.fixedSeat) / 2, latch.centreY, latch.axisZ],
      [0, 90, 0],
      {
        designation: 'Compression spring 8 OD x 10 free x 0.4 wire / verify delivered spring',
        manufacturer: 'Unspecified',
        source: 'User-specified nominal dimensions; authored 6-coil reference',
      },
      'Installed axial length 9 mm closed / 5 mm released. Six total coils and closed unground ends are assumptions; conservative solid height 2.8 mm. The printed shoulders stop the 4 mm stroke. Qualify actual spring return against PETG friction; no rated return force or life claim.',
      'compressed',
    ),
    occurrence(
      holderPart,
      'holder',
      `MPD ${d.holder.designation} · ${d.cells}-cell PCB holder`,
      { model: d.holder.id },
      [0, 0, d.holderZ],
      [0, 0, 0],
      {
        designation: d.holder.designation,
        manufacturer: d.holder.manufacturer,
        source: d.holder.source,
      },
      'Original MPD tray and separate contact solids retain the source mounting and solder-tail datums. Contacts are independent; series links and balance wiring are separate assembly operations.',
    ),
    occurrence(
      powerPart,
      'power-connector',
      'AMASS XT60E-F · panel socket',
      { model: power.id, detail: 'envelope' },
      [...d.xtCentre, d.xtZ],
      [0, 0, 90],
      { designation: 'XT60E-F', manufacturer: 'AMASS', source: power.source },
      'The source rear flange/gasket face is the panel seating datum. The keyed body, supplied gasket and solder cups retain the library geometry.',
    ),
    occurrence(
      signalPart,
      'balance-socket',
      `Side-facing XH-style balance header · ${d.headerPins} contacts · nominal 2.54 mm`,
      { model: socket.id },
      [d.balanceCentre[0], d.balanceCentre[1] + (d.cells * 2.54) / 2, d.boardTop],
      [0, 0, 0],
      {
        designation: socket.name,
        manufacturer: 'Unspecified',
        source: socket.sourceUrl,
      },
      'Authored white XH-style shroud and asymmetric mating guides with user-specified nominal 2.54 mm pitch. Right-angle header soldered directly to the main PCB: tail row X-50.5, pin 1 at highest Y, row extending -Y. Its keyed shroud faces -X and ends flush at the left shell wall X-60. Release the M4 panel mounts and withdraw the complete module before connecting the balance lead from the side. Shell dimensions and the matching cable housing require verification on the delivered pair; this is not original manufacturer CAD or a JST 2.50 mm model.',
    ),
  ];
}
