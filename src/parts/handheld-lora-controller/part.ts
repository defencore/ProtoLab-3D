import type { PartDefinition, Preset, Parameters } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { libraries, configuredPieces, composition } from './lib/model';
import { layout } from './lib/layout';
import { previewGeometry } from './lib/appearance';
import { initializeManifoldGeometry } from '../../core/assembly/manifold-boundary';
import product from './product.json';
import presets from './presets.json';

const states = [
  {
    id: 'assembled',
    label: 'Assembly',
    description: 'Closed enclosure; the board and measured 102540 battery envelope are inside.',
  },
  {
    id: 'open',
    label: 'Open case',
    description:
      'Move the lid aside to inspect edge retention, battery insulation and switch wiring clearance.',
  },
  {
    id: 'exploded',
    label: 'Inspection separation',
    description: 'Lift the lid, battery clamp, Heltec board and screws for inspection.',
  },
  {
    id: 'print-layout',
    label: 'Print layout',
    description:
      'Three prints for Straight and Palm; five for Palm Lock; electronics, foam and hardware omitted.',
  },
  {
    id: 'base-only',
    label: 'Base only',
    description:
      'Export the single printed base with integral guards, supported posts, battery tray and lanyard anchor.',
  },
  {
    id: 'lid-only',
    label: 'Lid only',
    description:
      'Export the single printed lid with OLED mask, relieved PCB feet and alignment lip.',
  },
];
const physical = (p: Parameters, state: string) =>
  configuredPieces(p, state).filter((piece) => piece.component.supply !== 'reference');
const part: PartDefinition = {
  id: 'handheld-lora-controller',
  name: 'Heltec V4 handheld controller',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'HANDHELD CONTROLLERS',
  icon: 'box',
  preview: 'worker',
  complexity: 'Two DS-225 controls · OLED · optional mechanical lock',
  product: product as ProductProfile,
  description:
    'Right-handed Heltec V4 controller with guarded DS-225 finger controls, an OLED mask, a direct tactile power key, thick gusseted PCB seats, supported internal posts and a lanyard anchor. Choose Straight, Palm or Palm Lock independently of External SMA or Internal FPC. Palm Lock adds a recessed second button with a captive sliding safety with a recessed metal friction clamp. External mounts are Bottom, Top and Compact top. The 102540 battery uses the measured 43 × 25 × 10 mm envelope; the internal antenna remains an unselected packaging reference.',
  keywords: [
    'Heltec',
    'LoRa',
    'DS-225',
    'handheld',
    'remote',
    'controller',
    'ergonomic',
    'right-handed',
    'right hand',
    'enclosure',
    'case',
    'guard',
    'button',
    'battery',
    'LiPo',
    '102540',
    'OLED',
    'display',
    'screen',
    'bezel',
    'power button',
    'long press',
    'momentary',
    '12x12x4 tactile',
    'direct power button',
    'thumb well',
    'SMA',
    'antenna mount',
    'pigtail',
    'internal antenna',
    'FPC',
    '928 MHz',
    'contoured grip',
    'palm grip',
    'Straight',
    'Palm Lock',
    'web grip',
    'recessed button',
    'sliding safety',
    'mechanical safety',
    'thumb button',
    'gusset',
    'lanyard',
    'cord tunnel',
    'index finger',
    'middle finger',
    'USB-C',
  ],
  defaults,
  parameters,
  catalogSelection: [],
  presets: presets as Preset[],
  presetMatchKeys: ['bodyModel', 'antennaType'],
  states,
  validate(p, state) {
    const errors: string[] = [];
    for (const key of Object.keys(p))
      if (!parameters.some((field) => field.key === key))
        errors.push(`Unsupported enclosure setting: ${key}.`);
    for (const field of parameters) {
      const value = p[field.key];
      if (field.type === 'number') {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!
        )
          errors.push(
            `Choose ${field.label.toLowerCase()} between ${field.min} and ${field.max} mm.`,
          );
      } else if (!field.options?.some((option) => option.value === value))
        errors.push(`Choose a supported ${field.label.toLowerCase()}.`);
    }
    if (p.bodyModel === 'web-grip' && p.safetyPosition === 'locked' && p.buttonA === 'last')
      errors.push('Unlock the mechanical safety before pressing the web button');
    if (!states.some((s) => s.id === state)) errors.push('Choose a supported enclosure view.');
    return errors;
  },
  composition,
  initializeGeometry: initializeManifoldGeometry,
  buildGeometry: (p, s) => previewGeometry(configuredPieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, physical(p, s), true),
  python: (p, s) => componentPython(libraries, physical(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, configuredPieces(p, s)),
  exportDimensions: (p, s) => componentDimensions(libraries, physical(p, s)),
  assessment(p) {
    const d = layout(p);
    const internalAntenna = p.antennaType === 'internal';
    const topAntenna = p.externalMount === 'top';
    const compactAntenna = p.externalMount === 'compact-top';
    const contouredGrip = p.bodyModel === 'contoured';
    const webGrip = p.bodyModel === 'web-grip';
    const fpc = d.antenna.internalFpc;
    const modeledWidth = ((contouredGrip ? 43.33 : 42) + Number(p.guardProjection)).toFixed(2);
    const modeledLength = internalAntenna ? 106 : topAntenna || compactAntenna ? 111.49 : 111.69;
    const modeledHeight = contouredGrip || webGrip ? 31.2 : 29;
    return [
      `${webGrip ? 'Palm Lock with a recessed second button and sliding safety' : contouredGrip ? 'Palm with an added lower contour to Z=-2.2 mm and 31.2 mm overall height' : 'Straight tapered grip'}; nominal walls are 2.2 mm, the inner floor is 2 mm and the lid seam is at Z=28 mm. The Straight body is 106 × 42 × 29 mm. A smooth local shoulder around the power-end fasteners preserves the overall width and leaves a continuous counterbore rim. ${webGrip ? 'Five PETG prints include the base, lid, battery clamp, guided second-button plunger and captive sliding safety.' : 'Three PETG prints: base, lid with four relieved PCB edge feet, and battery end clamp.'} All body models include 3 mm gussets at the internal supports and a compact corner lanyard eyelet with adjacent mouths 7 mm apart, a smooth R3.5 mm U-route, 3.6 mm cord clearance and a 2.4 mm loaded bridge. The bottom perimeter has a tangent R4 mm round on Straight and R5 mm on Palm/Palm Lock; internal floor-rooted stock follows that exterior. No printed load rating is assigned.`,
      webGrip
        ? 'The +X guard protects only the index-finger control on Palm Lock, with a continuous rounded blend joining its pillow collar, protective cheek and softened ends to the case. Its 24 × 18.6 mm root has R2.5 corners and a 1.8 mm shoulder return; the 15.5 mm square aperture has R1.10 corners and nominal 0.25 mm straight-side clearance. The second control is recessed on the opposite -X side and protected by its guided paddle and sliding safety. Check actual switch projection and all printed clearances.'
        : `Guard plane X=${d.guardPlane} mm, nominal released cap plane X=${d.releasedCapPlane} mm: ${d.flatSurfaceClearance.toFixed(1)} mm clearance to a flat surface on the button side. Open concave scallops lie between rounded crests, continuing into a recessed grip edge and a low end toe. One continuous rounded surface blends the protective cheek, bezel collars and end transitions into the case on every body model. ${!internalAntenna && compactAntenna ? 'The keyed SMA flange sits at least 0.4 mm inside the recessed mouth; the surrounding support follows the case contour.' : `This variant's modeled exterior is approximately ${modeledWidth} × ${modeledLength} × ${modeledHeight} mm.`} ${internalAntenna ? 'The internal antenna reserve adds no exterior RF connector.' : compactAntenna ? 'The compact SMA mount faces the power end.' : topAntenna ? 'The Top SMA mount faces the power end.' : 'The Bottom SMA mount faces the USB end.'} Verify actual cap height and printed guard stiffness.`,
      webGrip
        ? `Viewed from the display side, power is at the top, USB at the bottom and the red index control at the upper left. The black recessed second control stays on the opposite side for the thumb web. The sliding safety is ${p.safetyPosition}: slide its broad pad 8.4 mm to unlock before pressing. A 3 mm solid gate supports the paddle heel in the locked position; 3 mm captive flanges and rigid guide walls replace the slender ring and printed return leaves. An M3 × 10 low button-head screw, flat washer and captive nylon-insert nut regulate sliding resistance. Set the drag with a 2 mm hex key so the slider stays selected but moves comfortably; do not clamp it immobile. The stock button spring returns the paddle to contact, leaving up to 0.5 mm captured free play. A broad cam nose lifts the returned paddle during relocking; its final inward displacement remains below the contact take-up. Lock only after releasing the paddle. Actual force, wear and service life need a printed prototype check.`
        : 'Viewed from the display side, the power end (-Y) is at the top and USB (+Y) at the bottom, with the two DS-225 controls at the upper left. Red upper button B (Y=-35 mm) serves the index finger; black lower button A (Y=-10 mm) serves the middle finger. Both independent DS-225 buttons mount at X=+21 mm and Z=18.5 mm through the 2.2 mm side wall. Rounded pillow shoulders grow from 24 × 18.6 mm roots with R2.5 corners and a 1.8 mm return. Their 15.5 mm square apertures use R1.10 corners and nominal 0.25 mm straight-side clearance. The nominal shoulder-front limit at X=23.2 mm lies 0.8 mm behind the black front and 2.8 mm behind the released actuator. An R0.5 return rounds the aperture rim; the upper rim recedes into the case. Tighten the nuts before electronics, insulate the solder lugs and route leads in the reserved gap above the battery.',
      'Selected Heltec WiFi LoRa 32 V4 without populated headers, with its USB-C facing +Y and OLED facing +Z, retained by PCB edge supports and four relieved lid feet. Module datum X=0, Y=25, Z=16.9 mm; PCB bottom/top Z=20.5/22.1 mm and outer OLED frame center Y=19.65 mm; the user-calibrated face center is X=+2 mm, Y=18.65 mm. Its top Z=27.6 mm stays 0.4 mm below the base wall. The four edge feet use Ø2.1 mm relief around adjacent GPIO pads and bear above matching base ledges. Confirm contact lands against the delivered PCB revision.',
      `Measured 102540 LiPo envelope ${d.battery.length} × ${d.battery.width} × ${d.battery.height} mm below the board, on ${d.battery.tapeThickness} mm double-sided adhesive. The user-confirmed existing tray and battery position are retained, and a padded removable clamp holds the USB-side end. The clamp is raised 1 mm for the 10 mm cell. Capacity, protection, leads, connector and polarity remain to be specified; fit padding without crushing the pouch. The measured reference is omitted from physical exports and procurement.`,
      'OLED viewport 11.8 × 22.4 mm with an opaque mask and 12.8 × 23.4 mm entrance chamfer, shifted 2 mm left and 1 mm up toward the power end (X=+2 mm, Y=18.65 mm) in the exterior working view; modeled display face 1.5 mm below the lid exterior. The mask clears the protective frame by 0.35 mm. Closed USB-C window 10.4 × 4.4 mm at Z=23.59 mm, entirely below the base-wall top. A 12.6 × 5.8 mm shallow outer relief leaves approximately 0.4 mm approach recess to the socket. A local 0.3 mm PCB pocket preserves approximately 1.3 mm minimum front wall. Verify full USB insertion with the actual cable. Antenna mounting follows the selected enclosure variant.',
      'The user-owned momentary power switch has a 12 × 12 × 4 mm body and a Ø6 mm actuator projecting 6 mm above it, for 10 mm total axial height. Its body occupies X=±6, Y=-46.5..-42.5, Z=15..27 mm. Press the actual switch directly through a Ø6.6 mm opening; its released face is 0.5 mm behind the nominal tail plane. The open-top round-bottom slot allows the complete switch to drop into its cradle. The lid closes that slot with a rooted front key and retains the body with corner grooves and an 8 × 3.6 mm bearing pad. The 3.2 mm side cheeks retain at least 2.1 mm material beside the wire grooves and adjacent nut pockets. Two 2.9 mm shoulders extend continuously to the actuator aperture. The base and lid rear stops each have a 6 × 2.8 mm T crossbar and a 3.2 × 4.1 mm central rib. There is no separate printed power cap or loose retaining bridge. Supplier, terminal pattern, electrical rating and actual travel remain unspecified; the 0.2 mm pressed pose is illustrative. Wire the normally-open contact between GPIO0 and GND for firmware-defined long-press sleep and wake. This package includes no firmware or battery-isolating power circuit.',
      internalAntenna
        ? `Internal antenna option: an unselected 38 × 10 × 0.3 mm adhesive-film reference lies on the inner lid near the power end, centered at X=${fpc.x}, Y=-17.5 mm and Z=27.3..27.6 mm. A 3 × 4 × 2 mm feed reserve at X=${fpc.x}, Y=-34.5 mm occupies Z=25.6..27.6 mm, including the film. Palm Lock shifts the reserve between its opposed control zones. It moves with the lid and is omitted from physical exports and procurement. The requested operating frequency is 928 MHz; no antenna model, tuning, gain or range is established.`
        : topAntenna || compactAntenna
          ? 'The Top and Compact top selections share the recessed Amphenol SMA seat at [0, -50, 7.8] mm, rotation [90, -30, 0]. The 11 mm AF flange sits in an 11.4 mm AF hex pocket at least 2.4 mm deep and a D-key through the 2.2 mm seat prevents rotation. The flange remains at least 0.4 mm behind the recessed mouth; the SMA mating thread remains exposed. The surround follows the case contour. Fit the inner washer, nut and jack before the power switch and lid; an axial Ø11 mm tool envelope and nominal 1.5 mm power-cradle arch are reserved. Confirm the delivered kit and tool fit.'
          : 'The Bottom SMA kit seats at [0, 50.2, 13] mm, rotated -90° about X. Its flange is recessed in a keyed 2.4 mm-deep hex pocket, behind the Y=52.6 mm mouth, with a D-key through the 2.2 mm seat to prevent rotation. Fit the inner washer and nut from the open cradle before the PCB. The front/rear connector limits are Y=58.69/40.19 mm. This variant has a smooth central cable relief in the removable battery retainer, preserving its two arms and broad front tie.',
      internalAntenna
        ? 'Molex 2111400100 is dimensional evidence only: its 38 × 10 × 0.1 mm flex and 902–928 MHz band do not select it for this enclosure. Its application guide specifies a clean smooth nonmetal mounting surface, recommends at least 5 mm separation from ground planes, and keeps the cable away from the flex edge. Actual metal, hand loading, cable routing and adhesive preparation require checks in the final assembly. No RF qualification follows from a collision-free reserve.'
        : topAntenna || compactAntenna
          ? 'Only the bulkhead end and approximate retaining hardware appear as physical geometry; the complete 100 mm flexible coax and remote AMC plug remain unrouted. Verify actual lead bend allowance, strain relief and LoRa U.FL engagement. Select an antenna for the requested 928 MHz operation; neither the DC–6 GHz cable specification nor this geometry establishes system RF performance.'
          : 'The bulkhead geometry includes its approximate seal/washer/nut, while the purchased kit includes the complete 100 mm cable assembly. A separate 3.1 mm diameter clearance route bends the first 12.7 mm of heatshrink through opposite R8 arcs, raising its centre by 3.2 mm from Z=13 to 16.2 mm. This authored route is not a supplier bend rating; remaining coax and AMC are unrouted and no complete cable-fit claim is made. Choose a standard SMA male antenna for the requested 928 MHz operation and connect the lead to LoRa U.FL, keeping the WiFi socket free.',
      webGrip
        ? `Palm Lock has five printed parts, two adhesive and clamp-pad cut parts, ${internalAntenna ? 'four purchased products and fifteen standard hardware pieces, totaling 26 physical occurrences' : 'five purchased products and fifteen standard hardware pieces, totaling 27 physical occurrences'}. Its metal safety clamp adds one M3 × 10 ISO 7380-1 screw, one M3 DIN 125 washer and one M3 DIN 985 nut. Common case fasteners remain four M2 × 8 lid screws, two M2 × 6 battery-clamp screws and six cavity-loaded M2 nuts. The deeper blind wells also accept M2 × 6/10/12 at the lid and M2 × 8/10 at the battery retainer. The lid opens with the safety clamp installed; remove its screw and washer only to withdraw the slider. Battery and internal-antenna references are excluded.`
        : `Four M2 × 8 lid screws and two M2 × 6 battery-clamp screws, all with cavity-loaded captive M2 nuts. The deeper blind wells also accept M2 × 6/10/12 at the lid and M2 × 8/10 at the battery retainer. Three printed parts, two adhesive and clamp-pad cut parts, ${internalAntenna ? 'four purchased products and twelve standard hardware pieces form 21 physical occurrences; the unselected internal antenna and battery references are excluded' : 'five purchased products and twelve standard hardware pieces form 22 physical occurrences; the complete pigtail kit is one purchased occurrence despite its six visual solids'}. Insert the PCB nose under the USB wall before lowering its rear; the lid provides relieved edge retention.`,
    ];
  },
  notes:
    'Right-handed prototype with Straight, Palm and Palm Lock body models; antenna type is selected independently. The Straight tapered body is 106 × 42 × 29 mm and retains its case shape, switch datums and all three antenna positions. Every body model receives a continuous rounded guard surface blending the protective cheek, bezel collars and softened end transitions into the case. Palm Lock protects one index control on +X and adds a recessed second-button plunger and captive sliding safety on the opposite side. Overall Palm Lock dimensions depend on the selected control and antenna geometry. All models include full-width wall-connected PCB supports, gusseted internal posts, tangent circular bottom rounds and a compact U-routed corner lanyard anchor. Internal stock is clipped to the rounded floor. Deeper closed screw wells accommodate the declared short and long M2 screws. The external SMA flange is recessed and held against rotation by hex and D keys. The selected working orientation puts power (-Y) at the top and USB (+Y) at the bottom; antenna placement follows the selected variant; the index finger operates B; A serves the middle finger on Straight and Palm bodies and the thumb on Palm Lock. Unlock the Palm Lock blocker before pressing A. Heltec V4 is selected; confirm its delivered revision. The 102540 battery envelope follows the user measurement of 43 × 25 × 10 mm and includes a configurable 0.5 mm default adhesive allowance. The supplied button photo establishes the rectangular DS-225 bezel shape; its 15 mm nominal footprint and 5 mm front projection remain approximate. The default guard projects 0.5 mm beyond that nominal released cap; the adjustable range is 0.5–1 mm above it. Its seat lip is lowered by 0.5 mm and uses an R0.5 return. The close-fitting opaque OLED mask blocks views into the interior; modeled display height remains approximate. The user-owned 12 × 12 × 4 mm tactile power switch has a Ø6 mm actuator projecting 6 mm above its body. It drops into an open-top cradle and is retained by lid grooves and a broad bearing pad, with no separate printed cap. Terminal pattern, actual travel, electrical rating and sealing remain unspecified; use GPIO0 to GND and suitable firmware for long-press sleep and short-press wake. A strict long hold to turn on needs additional firmware behavior. Holding GPIO0 at power-up/reset may enter the bootloader. This package contains no firmware or battery-isolating power circuit. Flat-plane separation does not establish safety under impact, deformation or contact with small objects. Confirm that all four relieved lid feet contact PCB edge lands and clear GPIO pads, onboard components and U.FL sockets. Header pins must remain unpopulated. The external options use the Amphenol SMA kit with approximate retaining hardware; exact kit dimensions and panel-thickness capacity remain unverified. Bottom, Top and Compact top SMA installations remain separate choices. The internal option replaces SMA with an unselected adhesive FPC reserve near the power end, excluded from physical exports and procurement. The requested frequency is 928 MHz; no antenna is selected and no RF performance is qualified. Only provisional local cable clearances are included; complete coax and connector routing require actual fit checks. Prepare a smooth clean nonmetal adhesive land and assess nearby metal and hand loading for the selected antenna. Complete battery protection, insulation, lead routing, antenna installation and hardware fit checks. Print the base floor-down and lid exterior-down, using local removable support at cross-holes and retainers.',
  sources: [
    {
      label: 'Heltec V4 dimensions',
      url: 'https://resource.heltec.cn/download/WiFi_LoRa_32_V4/datasheet/WiFi_LoRa_32_V4.3.1_Datasheet.pdf',
    },
    {
      label: 'Heltec V4.3.1 PCB outline and component-clearance reference',
      url: 'https://resource.heltec.cn/download/WiFi_LoRa_32_V4/3D/HTIT-WB32LAF_V4.3.1%281%29.step',
    },
    {
      label: 'Amphenol 095-902-545-100 antenna pigtail',
      url: 'https://www.amphenolrf.com/en-us/part/095-902-545-100/8896/',
    },
    {
      label: 'Amphenol front-mount SMA kit drawing',
      url: 'https://www.amphenolrf.com/en-us/assets/file/4068032676/',
    },
    {
      label: 'Molex 2111400100 flex dimensions — unselected reference only',
      url: 'https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/211/211140/2111400100-001.pdf',
    },
    {
      label: 'Molex flex placement and cable guidance — implementation reference',
      url: 'https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/applicationspecificationspdf/211/211140/2111400100-000.pdf',
    },
    {
      label: 'Heltec V4 USER GPIO0 and RESET schematic',
      url: 'https://resource.heltec.cn/download/WiFi_LoRa_32_V4/Schematic/HTIT-WB32LAF_V4.3.pdf',
    },
    {
      label: 'Meshtastic Heltec button behavior',
      url: 'https://meshtastic.org/docs/hardware/devices/heltec-automation/lora32/buttons/',
    },
    { label: 'DS-225 rectangular top photo', url: 'references/daier-ds-225-user-photo.png' },
    {
      label: 'Latest user reference — open scalloped guard and recessed grip edge',
      url: 'references/heltec-handheld-guard-reference-4.png',
    },
    {
      label: 'Additional user reference — contoured palm grip and tactile zones',
      url: 'references/heltec-handheld-palm-grip-reference.png',
    },
    {
      label: 'User original mechanical-blocker reference 1 — no verified dimensions',
      url: 'references/heltec-handheld-rotary-blocker-reference-1.png',
    },
    {
      label: 'User original mechanical-blocker reference 2 — no verified dimensions',
      url: 'references/heltec-handheld-rotary-blocker-reference-2.png',
    },
  ],
};
export default part;
