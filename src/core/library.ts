import type { PartDefinition } from './types';

/** Navigation order is independent of package registration and the current search. */
export const librarySections: { name: string; icon: PartDefinition['icon']; groups: string[] }[] = [
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
      'BOXES & CASES',
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
      'GROUND VEHICLES',
      'AIRFRAME STRUCTURE',
      'WINGS & CONTROL SURFACES',
      'PROPELLERS & ROTORS',
      'DUCTS & LANDING GEAR',
      'VEHICLE MOUNTS',
    ],
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
  'PANEL CONTROLS': ['panel-switch', 'panel-control'],
  'MODEL ROCKETS': [
    'model-rocket-airframe',
    'rocket-parachute-recovery',
    'rocket-co2-recovery',
    'rocket-airbrakes',
    'rocket-release',
    'clamp-band-release',
  ],
  'SRS AIRBAG': ['srs-connector', 'srs-retainer', 'srs-igniter'],
  'SINGLE-BOARD COMPUTERS': ['raspberry-pi', 'nanopi'],
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
