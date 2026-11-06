import type { PartDefinition } from './types';

/** Navigation catalogs join model sources, while each source keeps its physical API and identity. */
export const libraryCatalogGroups = [
  {
    id: 'recovery-buzzers',
    label: 'Recovery buzzers & finders',
    members: ['recovery-buzzer', 'jhe42b-finder'],
  },
  {
    id: 'gears',
    label: 'Gears',
    members: ['spur-gear', 'helical-gear', 'bevel-gear'],
  },
  {
    id: 'gearboxes',
    label: 'Gearboxes & gearheads',
    members: ['gearbox', 'bevel-gearbox-42', 'faulhaber-planetary'],
  },
  {
    id: 'profile-linear-guides',
    label: 'Profile linear guides',
    members: ['hiwin-profile-guide', 'linear-guide'],
  },
  {
    id: 'ball-screw-sets',
    label: 'Ball screw sets',
    members: ['ball-screw', 'tbi-ball-screw', 'cnc-precision-axis'],
  },
  {
    id: 'ball-screw-shafts',
    label: 'Ball screw shafts',
    members: ['cnc-drive-screw', 'cnc-precision-screw'],
  },
  {
    id: 'ball-screw-nuts',
    label: 'Ball screw nuts',
    members: ['ball-nut', 'cnc-precision-nut'],
  },
  {
    id: 'shaft-screw-supports',
    label: 'Shaft & screw supports',
    members: ['shaft-support', 'cnc-screw-support', 'cnc-precision-support'],
  },
  {
    id: 'servo-horns',
    label: 'Servo horns',
    members: ['servo-arm', 'metal-servo-horn'],
  },
  {
    id: 'fluid-cylinders',
    label: 'Cylinders',
    members: [
      'fluid-cylinder',
      'compact-pneumatic-cylinder',
      'round-pneumatic-cylinder',
      'profile-pneumatic-cylinder',
    ],
  },
  {
    id: 't-slot-profiles',
    label: 'T-slot profiles',
    members: ['aluminium-profile', 'slot-profile'],
  },
  { id: 'wheels', label: 'Wheels', members: ['wheel', 'robot-wheel'] },
  {
    id: 'lifting-eyes',
    label: 'Lifting eyes',
    members: ['lifting-eye-bolt', 'lifting-eye-nut'],
  },
  {
    id: 'enclosures',
    label: 'Enclosures',
    members: [
      'catalog-enclosure',
      'enclosure',
      'field-daq-enclosure',
      'grandado-tube-mount',
      'jcg108-tube-fairing',
      'underwater-pressure-enclosure',
      'printed-rim-enclosure',
      'printed-self-centering-enclosure',
      'printed-screw-enclosure',
      'printed-bayonet-enclosure',
      'printed-threaded-enclosure',
      'printed-threaded-shell',
    ],
  },
  {
    id: 'servo-motors',
    label: 'Servo motors',
    members: ['servo-motor', 'bus-servo', 'cnc-feed-servo', 'qfs2025-servo'],
  },
  { id: 'stepper-motors', label: 'Stepper motors', members: ['stepper-motor', 'faulhaber-am'] },
  {
    id: 'brushless-motors',
    label: 'Brushless motors',
    members: ['bldc-motor', 'faulhaber-bx4', 'surpass-2838', 'surpass-2845'],
  },
  {
    id: 'dc-motors',
    label: 'DC & industrial motors',
    members: ['industrial-motor', 'chf-gf5560-180'],
  },
  {
    id: 'linear-actuators',
    label: 'Linear actuators',
    members: ['linear-actuator', 'faulhaber-linear-actuator', 'faulhaber-linear-motor'],
  },
  { id: 'gearmotors', label: 'Gearmotors', members: ['gmp16-gearmotor', 'machine-drive-motor'] },
  { id: 'solenoids', label: 'Solenoids', members: ['tubular-solenoid', 'open-frame-solenoid'] },
  {
    id: 'camera-models',
    label: 'Cameras & vision modules',
    members: ['camera', 'board-camera-19', 'waveshare-ov9281-110'],
  },
  {
    id: 'flight-controller-models',
    label: 'Flight controllers',
    members: ['flight-controller', 'lch7-controller'],
  },
  {
    id: 'microcontroller-boards',
    label: 'Microcontroller boards',
    members: ['esp32', 'nrf52840', 'rp-microcontroller', 'arduino'],
  },
  {
    id: 'single-board-computers',
    label: 'Single-board computers',
    members: ['raspberry-pi', 'nanopi'],
  },
  {
    id: 'ball-bearings',
    label: 'Ball bearings',
    members: [
      'ball-bearing',
      'flanged-ball-bearing',
      'self-aligning-bearing',
      'angular-contact-bearing',
      'double-row-bearing',
      'double-row-angular-contact-bearing',
    ],
  },
  {
    id: 'roller-bearings',
    label: 'Roller bearings',
    members: [
      'roller-bearing',
      'spherical-roller-bearing',
      'tapered-roller-bearing',
      'needle-bearing',
    ],
  },
  {
    id: 'thrust-bearings',
    label: 'Thrust bearings',
    members: ['thrust-bearing', 'thrust-roller-bearing', 'spherical-thrust-bearing'],
  },
  {
    id: 'combined-bearings',
    label: 'Combined bearings',
    members: ['combined-bearing', 'zarn-bearing'],
  },
  {
    id: 'linear-bushings',
    label: 'Linear bushings',
    members: ['linear-bearing', 'flanged-linear-bearing', 'round-flange-linear-bearing'],
  },
  {
    id: 'mounted-bearings',
    label: 'Mounted bearings',
    members: [
      'pillow-block-bearing',
      'flange-2-bolt-bearing',
      'flange-4-bolt-bearing',
      'insert-bearing',
    ],
  },
  {
    id: 'plain-bearings',
    label: 'Plain bearings & bushings',
    members: ['plain-bearing', 'plain-bushing'],
  },
  { id: 'one-way-clutches', label: 'One-way clutches', members: ['one-way-clutch', 'csk-clutch'] },
  {
    id: 'shaft-couplings',
    label: 'Shaft couplings',
    members: ['shaft-coupling', 'jaw-coupling', 'cnc-precision-coupling'],
  },
  {
    id: 'bolts-screws',
    label: 'Bolts & screws',
    members: ['bolt-screw', 'set-screw', 'wing-screw', 'swing-eye-bolt'],
  },
  {
    id: 'nuts',
    label: 'Nuts',
    members: [
      'hex-nut',
      'thin-nut',
      'cap-nut',
      'flange-nut',
      'nyloc-nut',
      'wing-nut',
      'square-nut',
      't-slot-nut',
      'coupling-nut',
      'high-nut',
      'metal-lock-nut',
    ],
  },
  {
    id: 'washers',
    label: 'Washers',
    members: ['washer', 'square-washer', 'conical-washer', 'toothed-washer', 'split-lock-washer'],
  },
  { id: 'pins-dowels', label: 'Pins & dowels', members: ['dowel-pin', 'spring-pin', 'cotter-pin'] },
  {
    id: 'torsion-springs',
    label: 'Torsion springs',
    members: ['torsion-spring', 'double-torsion-spring'],
  },
  { id: 'retaining-rings', label: 'Retaining rings', members: ['retaining-ring', 'e-ring'] },
  {
    id: 'battery-cells-packs',
    label: 'Battery cells & packs',
    members: ['li-ion-cell', 'standard-battery', 'lipo-battery', 'li-ion-pack'],
  },
  {
    id: 'power-connectors',
    label: 'Power & industrial connectors',
    members: ['electrical-connector', 'waterproof-connector'],
  },
] as const;

const catalogFamilies = new Map<string, NonNullable<PartDefinition['browseFamily']>>();
for (const catalog of libraryCatalogGroups)
  for (const [index, member] of catalog.members.entries()) {
    if (catalogFamilies.has(member)) throw new Error(`Duplicate catalog membership: ${member}.`);
    catalogFamilies.set(member, {
      id: catalog.id,
      label: catalog.label,
      ...(index === 0 ? { primary: true } : {}),
    });
  }

export function libraryCatalogFamily(partId: string): PartDefinition['browseFamily'] {
  const family = catalogFamilies.get(partId);
  return family ? { ...family } : undefined;
}

/** Navigation order is independent of package registration and the current search. */
export const librarySections: { name: string; icon: PartDefinition['icon']; groups: string[] }[] = [
  {
    name: 'ENCLOSURES & DEVICES',
    icon: 'box',
    groups: ['GENERAL-PURPOSE ENCLOSURES', 'HANDHELD CONTROLLERS'],
  },
  {
    name: 'MACHINE TOOLS',
    icon: 'gear',
    groups: ['CUTTING MACHINES', 'MILLING MACHINES'],
  },
  {
    name: 'WORKSHOP TOOLS',
    icon: 'wheel',
    groups: [
      'SAW BLADES',
      'DRILLING JIGS',
      'ROUTING & PROFILE TEMPLATES',
      'BENDING & ASSEMBLY JIGS',
      'CUTTING & SAWING GUIDES',
      'TOOL SETTING & PROBES',
      'COOLING & COOLANT',
    ],
  },
  {
    name: 'STRUCTURAL PARTS',
    icon: 'bracket',
    groups: [
      'ALUMINIUM PROFILES',
      'STEEL & GENERAL SECTIONS',
      'BRACKETS & MOUNTS',
      'WORK SURFACES & TRAYS',
      'HANDLES HINGES & FEET',
      'CABLE MANAGEMENT',
      'WHEELS & ROLLERS',
    ],
  },
  {
    name: 'FASTENERS & THREADS',
    icon: 'bolt',
    groups: [
      'THREAD GEOMETRY',
      'PRINTED JOINTS',
      'BOLTS & SCREWS',
      'NUTS',
      'INSERTS & RIVETS',
      'WASHERS',
      'SPACERS & STANDOFFS',
      'STUDS & RODS',
      'PINS & DOWELS',
      'RETAINING RINGS',
      'LIFTING EYES',
    ],
  },
  {
    name: 'BEARINGS & SEALS',
    icon: 'bearing',
    groups: [
      'BALL BEARINGS',
      'ROLLER BEARINGS',
      'THRUST BEARINGS',
      'COMBINED BEARINGS',
      'PLAIN BEARINGS',
      'ECCENTRICS & FOLLOWERS',
      'MOUNTED BEARINGS',
      'BEARING MOUNTING',
      'SHAFT SEALS',
      'STATIC SEALS',
      'DAMPERS & ISOLATORS',
      'SLEWING BEARINGS',
    ],
  },
  {
    name: 'LINEAR MOTION',
    icon: 'rail',
    groups: [
      'PROFILE RAILS',
      'ROUND SHAFT GUIDES',
      'LINEAR BUSHINGS',
      'BALL SCREWS',
      'SHAFT & SCREW SUPPORTS',
      'LEAD SCREWS & STAGES',
      'GEAR RACKS',
    ],
  },
  {
    name: 'TRANSMISSION & LINKAGES',
    icon: 'gear',
    groups: [
      'SHAFTS & KEYS',
      'GEARS & GEAR DRIVES',
      'REDUCERS & DIFFERENTIALS',
      'BELTS CHAINS & CABLES',
      'SHAFT COUPLINGS',
      'ONE-WAY CLUTCHES',
      'JOINTS & ROD ENDS',
      'PISTONS & CONNECTING RODS',
      'MOTION MECHANISMS',
      'BRAKES',
    ],
  },
  {
    name: 'SPRINGS',
    icon: 'spring',
    groups: ['HELICAL SPRINGS', 'TORSION SPRINGS', 'SPIRAL SPRINGS', 'DISC & LEAF SPRINGS'],
  },
  {
    name: 'MOTORS & ACTUATORS',
    icon: 'wheel',
    groups: [
      'STEPPER MOTORS',
      'BRUSHLESS MOTORS',
      'SPINDLE MOTORS',
      'DC & INDUSTRIAL MOTORS',
      'MOTOR ASSEMBLIES',
      'LINEAR ACTUATORS',
      'SERVOS',
      'SERVO ACCESSORIES',
      'SOLENOIDS',
      'HOLDING MAGNETS',
      'GRIPPERS',
    ],
  },
  {
    name: 'PNEUMATICS & GAS',
    icon: 'box',
    groups: [
      'CYLINDERS',
      'FITTINGS & HOSES',
      'VALVES & AIR PREPARATION',
      'PUMPS & MOTORS',
      'VACUUM HANDLING',
      'GAS CARTRIDGES',
    ],
  },
  {
    name: 'SWITCHES & BUTTONS',
    icon: 'circuit',
    groups: ['PANEL CONTROLS'],
  },
  {
    name: 'POWER & MOTOR CONTROL',
    icon: 'circuit',
    groups: [
      'BATTERIES & HOLDERS',
      'BEC REGULATORS',
      'DC-DC CONVERTERS',
      'POWER FILTERS',
      'SPEED CONTROLLERS',
      'SERVO CONTROLLERS',
      'INDUSTRIAL CONTROL EQUIPMENT',
      'POWER SWITCHES',
    ],
  },
  {
    name: 'ELECTRONICS & VISION',
    icon: 'circuit',
    groups: [
      'SINGLE-BOARD COMPUTERS',
      'MICROCONTROLLER BOARDS',
      'PROTOTYPING BOARDS',
      'STORAGE & ADAPTERS',
      'LED MODULES',
      'FLIGHT CONTROLLERS',
      'RADIO MODULES',
      'CAMERAS & VISION',
      'SENSORS & SWITCHES',
      'COOLING & MOUNTING',
    ],
  },
  {
    name: 'VEHICLE STRUCTURES',
    icon: 'wing',
    groups: [
      'AIRCRAFT',
      'MULTICOPTERS',
      'MODEL ROCKETS',
      'BOAT HULLS',
      'UNDERWATER ROVS',
      'GROUND VEHICLES',
      'AIRFRAME STRUCTURE',
      'WINGS & CONTROL SURFACES',
      'PROPELLERS & ROTORS',
      'DUCTS & LANDING GEAR',
      'VEHICLE MOUNTS',
    ],
  },
  {
    name: 'ELECTRONICS MOUNTS',
    icon: 'bracket',
    groups: ['MODULE ADAPTERS'],
  },
  {
    name: 'CONNECTORS & INTERFACES',
    icon: 'circuit',
    groups: [
      'POWER & INDUSTRIAL',
      'PCB CONNECTORS',
      'LABORATORY TERMINALS',
      'CABLE ENTRY',
      'SRS AIRBAG',
    ],
  },
];

// Lead with the primary component, then its mating parts and accessories.
// IDs are stable across renames and independent package exports.
const componentOrder: Record<string, string[]> = {
  'PANEL CONTROLS': ['panel-switch', 'panel-indicator', 'panel-control'],
  'MODEL ROCKETS': [
    'model-rocket-airframe',
    'rocket-nose-cone',
    'rocket-camera-nose',
    'rocket-body-tube',
    'rocket-transition',
    'rocket-coupler',
    'rocket-centering-ring',
    'rocket-bulkhead',
    'rocket-fin',
    'rocket-launch-lug',
    'rocket-avionics-sled',
    'rocket-rail-button',
    'rocket-ballast',
    'rocket-parachute',
    'rocket-streamer',
    'rocket-shock-cord',
    'rocket-parachute-recovery',
    'rocket-co2-recovery',
    'rocket-airbrakes',
    'rocket-release',
    'clamp-band-release',
    'rocket-prep-cradle',
  ],
  'SRS AIRBAG': ['srs-connector', 'srs-retainer', 'srs-igniter'],
  'SINGLE-BOARD COMPUTERS': ['raspberry-pi', 'nanopi', 'compute-module-carrier'],
  'MICROCONTROLLER BOARDS': ['esp32', 'nrf52840', 'rp-microcontroller', 'arduino'],
  'BOLTS & SCREWS': ['bolt-screw', 'set-screw', 'wing-screw', 'swing-eye-bolt'],
  NUTS: [
    'hex-nut',
    'thin-nut',
    'high-nut',
    'flange-nut',
    'nyloc-nut',
    'metal-lock-nut',
    'cap-nut',
    'wing-nut',
    'square-nut',
    'coupling-nut',
  ],
  WASHERS: ['washer', 'square-washer', 'split-lock-washer', 'toothed-washer', 'conical-washer'],
  'BALL BEARINGS': [
    'ball-bearing',
    'double-row-bearing',
    'angular-contact-bearing',
    'double-row-angular-contact-bearing',
    'self-aligning-bearing',
  ],
  'MOUNTED BEARINGS': [
    'pillow-block-bearing',
    'flange-2-bolt-bearing',
    'flange-4-bolt-bearing',
    'insert-bearing',
  ],
  'LINEAR BUSHINGS': ['linear-bearing', 'round-flange-linear-bearing', 'flanged-linear-bearing'],
  'PROFILE RAILS': ['hiwin-profile-guide', 'linear-guide', 'cnc-guide-rail', 'cnc-guide-carriage'],
  'BALL SCREWS': [
    'tbi-ball-screw',
    'ball-screw-axis',
    'ball-screw',
    'ball-nut',
    'cnc-drive-screw',
    'cnc-precision-axis',
    'cnc-precision-screw',
    'cnc-precision-nut',
  ],
  'SHAFT & SCREW SUPPORTS': ['shaft-support', 'cnc-screw-support', 'cnc-precision-support'],
  'GEARS & GEAR DRIVES': [
    'spur-gear',
    'helical-gear',
    'bevel-gear',
    'bevel-gear-pair',
    'worm-drive',
  ],
  SERVOS: ['servo-motor', 'bus-servo', 'cnc-feed-servo'],
  'SERVO ACCESSORIES': ['servo-arm', 'servo-gear'],
};

function compareInOrder(a: string, b: string, order: string[]) {
  const rank = (name: string) => {
    const index = order.indexOf(name);
    return index === -1 ? order.length : index;
  };
  // Imported packages can introduce new sections; keep them visible after the built-in ones.
  return rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true });
}

export function libraryCategories(parts: readonly PartDefinition[]) {
  return [...new Set(parts.map((part) => part.category))].sort((a, b) =>
    compareInOrder(
      a,
      b,
      librarySections.map((section) => section.name),
    ),
  );
}

export function librarySubgroups(parts: readonly PartDefinition[], category: string) {
  const order = librarySections.find((section) => section.name === category)?.groups ?? [];
  return [
    ...new Set(parts.filter((part) => part.category === category).map((part) => part.subgroup)),
  ].sort((a, b) => compareInOrder(a, b, order));
}

export function libraryCategoryIcon(category: string) {
  return librarySections.find((section) => section.name === category)?.icon ?? 'box';
}

export function sortLibraryParts(parts: readonly PartDefinition[]) {
  const categories = libraryCategories(parts);
  const groups = new Map(
    categories.map((category) => [category, librarySubgroups(parts, category)]),
  );
  return [...parts].sort(
    (a, b) =>
      compareInOrder(a.category, b.category, categories) ||
      compareInOrder(a.subgroup, b.subgroup, groups.get(a.category)!) ||
      (componentOrder[a.subgroup]
        ? compareInOrder(a.id, b.id, componentOrder[a.subgroup])
        : a.name.localeCompare(b.name, 'en', { numeric: true })) ||
      a.id.localeCompare(b.id),
  );
}
