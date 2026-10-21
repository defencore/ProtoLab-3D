import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { configuredPieces, composition, libraries, printedIds } from './lib/model';
import { layout } from './lib/layout';
import profile from './product.json';
import presets from './presets.json';
const part: PartDefinition = {
  id: 'panel-battery-module',
  name: 'Panel battery module',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'BATTERIES & HOLDERS',
  icon: 'circuit',
  preview: 'worker',
  complexity: '3S / 4S · panel mount',
  product: profile as ProductProfile,
  description:
    'Panel-mounted 18650 enclosure with a hook-in lid and recessed spring-return sliding lock, a soft extraction sling, fixed XT60E-F and a white 4/5-way right-angle XH-style balance header mounted directly on the main board at nominal 2.54 mm pitch. M3 internal fittings and M4 panel mounting.',
  keywords: [
    '18650',
    '3S',
    '4S',
    'battery',
    'holder',
    'enclosure',
    'panel',
    'ground station',
    'controller',
    'remote',
    'XT60E-F',
    'balance',
    '2.54',
    'MPD',
    'BK-18650-PC6',
    'BK-18650-PC8',
    'perfboard',
    'PY',
    'removable lid',
    'sliding bolt',
    'spring lock',
    'hidden hooks',
    'tool free',
    'extraction sling',
    'XH style',
    'PETG',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Installed module with a removable cell lid, fixed connectors and a representative host panel.',
    },
    {
      id: 'unlocked',
      label: 'Lid unlocked',
      description:
        'Sliding bolt retracted 4 mm by hand. Tilt the right lid edge, feed the soft sling loop through its slot, then withdraw the two left hooks.',
    },
    {
      id: 'open',
      label: 'Open lid',
      description:
        'Lid tilted 17 degrees, withdrawn 4 mm from its left hooks and lifted 35 mm after feeding the soft loop through. The sling and cells remain in the holder.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Inspect the separate frame, rear tray, drilled main board, board-mounted balance header, holder and fasteners.',
    },
    {
      id: 'print-layout',
      label: 'Print layout',
      description:
        'All PETG occurrences, including the sliding bolt, removable latch cover and retaining rails, in their print poses. Print separately; small removable supports are permitted.',
    },
    {
      id: 'panel-template',
      label: 'Panel template',
      description: 'Flat cutting/drilling template: rounded opening and four M4 mounting holes.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['3S', '4S'].includes(String(p.pack))) errors.push('Choose a 3S or 4S module.');
    if (
      !['assembled', 'unlocked', 'open', 'exploded', 'print-layout', 'panel-template'].includes(
        state,
      )
    )
      errors.push('Choose a module inspection, printing or panel-template view.');
    return errors;
  },
  composition,
  buildGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configuredPieces(p, s), true),
  python: (p, s) => componentPython(libraries, configuredPieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configuredPieces(p, s)),
  assessment(p) {
    const d = layout(p);
    return [
      `${p.pack}: ${d.cells} cells in MPD ${d.holder.designation}, with independent contacts. Prepare insulated series links and ${d.headerPins} balance nodes; no completed circuit or current rating is implied by this mechanical example.`,
      `Front flange ${d.flangeLength} x ${d.flangeWidth} mm, flat underside. Cut ${d.cutoutLength.toFixed(1)} x ${d.cutoutWidth.toFixed(1)} mm, R${d.cutoutRadius.toFixed(1)} corners. Four 4.5 mm M4 holes; use Panel template for coordinates.`,
      `Host panel ${d.panelThickness} mm: four M4 x ${d.panelBoltLength} bolts and two printed rear clamp strips with recessed nuts. The rear tray lies 36 mm behind the panel plane.`,
      'Retract the recessed slider 4 mm, tilt the right lid edge 17 degrees and feed the soft loop through its central slot. Withdraw the two left hooks by 4 mm, then lift the lid clear before pulling cells. The sling is unanchored and is not a locked-lid carrying handle.',
      'The latch uses a nominal 8 mm OD x 10 mm free-length spring with 0.4 mm wire: 9 mm installed length when locked, 5 mm released. Measure the delivered spring and qualify free return in the printed channel; no return-force rating is assigned.',
      `White keyed ${d.headerPins}-way XH-style balance header, 2.54 mm pitch, soldered directly to the main board at X-50.5, Y0 and facing the left side wall. Release the M4 panel mounts and withdraw the whole module to connect its matching lead, or remove cells for separate charging.`,
      `Main perfboard ${d.boardLength} x ${d.boardWidth} x 1.5 mm, cut from 100 x 100 mm donor stock: drill 1.8 mm for MPD blade tails, 1.1 mm for balance-header tails and 3.4 mm for M3 board mounts. External M3 rails capture the unmodified holder end walls. Unused stock perforations/pads are omitted from the installation model.`,
      ...(d.boardReliefs.length
        ? [
            'Both packs need two left-edge U reliefs: diameter 10 mm round ends with 10 mm-wide entries from X-55 to the left rail-post centres. Use Main PCB template; the two added connector support lands need no extra screws.',
          ]
        : []),
      `${printedIds.length} printed PETG occurrences, including a sliding bolt, removable latch cover and two holder rails. Use Print layout poses; local removable supports are permitted. Internal fasteners are M3, with captive nuts or inserts where provided; panel fasteners are M4.`,
      'Use the selected holder-compatible protected button-top cells; the preview uses 68 x 18.3 mm envelopes. Verify actual cell length, spring travel, polarity and soft lid preload before use.',
    ];
  },
  notes:
    'Mechanical enclosure and installation example. Original MPD holder CAD and the AMASS drawing-based XT60E-F retain their library identities. The white XH-style balance header is an authored nominal 2.54 mm reference; qualify the delivered right-angle mating pair and its side access. The header is soldered at X-50.5 to a 100 mm-long main board centred at X-5. Use 100x100 donor stock, trimming width to 70 mm for 3S. Two left-edge U reliefs clear the rail posts. Release the M4 host mounts and withdraw the module to connect the balance lead, or remove cells for separate charging. A recessed spring-return bolt and two left under-rim hooks retain the lid. Retract the slider 4 mm, tilt the lid 17 degrees, feed the unanchored soft sling through its central slot, withdraw the hooks 4 mm and lift 35 mm before extracting cells. Do not carry or pull the locked assembly by the sling. Spring OD8/free10/wire0.4, six total coils and closed unground ends are nominal assumptions; installed lengths are 9 mm locked and 5 mm released, with a conservative 2.8 mm solid height. Qualify actual spring return and printed friction; no return-force or life rating is assigned. Two stationary rear M3x10 countersunk screws retain the latch cover. M3 external rails retain the purchased holder without machining its fixing seats. The drilled main board is a preparation envelope; verify donor stock and critical holes. Series links, fuses, BMS, solder joints and wiring are not included; select them for the actual holder, cells and load. XT60 capability does not set a pack current rating. Small removable print supports are permitted; no sealing or impact rating is assigned.',
  sources: [
    { label: 'MPD BK-18650-PC6', url: 'https://www.batteryholders.com/part.php?pn=BK-18650-PC6' },
    { label: 'MPD BK-18650-PC8', url: 'https://www.batteryholders.com/part.php?pn=BK-18650-PC8' },
    {
      label: 'AMASS XT60E-F engineering drawing',
      url: 'https://www.aksotronik.com.pl/gniazdo-xt60e-f-zenskie-przykrecane.html',
    },
    { label: 'PY donor perfboards', url: 'https://www.nikom.biz/ua/product_A066023.html' },
    {
      label: 'Acxess Spring solid-height method / assumed spring reference',
      url: 'https://www.acxesspring.com/solid-height.html',
    },
  ],
};
export default part;
