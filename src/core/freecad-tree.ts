import type { PartDefinition } from './types';

// The CAD tree uses fewer levels than the library browser so installed parts stay easy to find.
const categoryFolders = new Map([
  ['BEARINGS & SEALS', 'Bearings & seals'],
  ['CONNECTORS & INTERFACES', 'Electronics'],
  ['ELECTRONICS & VISION', 'Electronics'],
  ['ELECTRONICS MOUNTS', 'Structural parts'],
  ['ENCLOSURES & DEVICES', 'Enclosures'],
  ['FASTENERS & THREADS', 'Fasteners'],
  ['LINEAR MOTION', 'Motion & drives'],
  ['MACHINE TOOLS', 'Machinery'],
  ['MOTORS & ACTUATORS', 'Motion & drives'],
  ['PNEUMATICS & GAS', 'Pneumatics & gas'],
  ['POWER & MOTOR CONTROL', 'Electronics'],
  ['SPRINGS', 'Springs'],
  ['STRUCTURAL PARTS', 'Structural parts'],
  ['SWITCHES & BUTTONS', 'Electronics'],
  ['TRANSMISSION & LINKAGES', 'Motion & drives'],
  ['VEHICLE STRUCTURES', 'Structural parts'],
  ['WORKSHOP TOOLS', 'Tooling'],
]);

/** Shared FreeCAD tree rules. Folder paths are separate from geometry and product identity. */
export function freecadTreePython(parts: readonly PartDefinition[]): string {
  const folders = Object.fromEntries(
    parts.flatMap((part) => {
      const folder = categoryFolders.get(part.category);
      return folder && !['manufactured-detail', 'purchased-component'].includes(part.id)
        ? [[part.id, folder]]
        : [];
    }),
  );
  return String.raw`import re

_protolab_library_folders = ${JSON.stringify(folders)}

# Classify only recognizable role names on untyped recipes. More specific phrases
# precede their general terms, for example a ball screw is part of the drive.
_protolab_label_folders = [
    ("Motion & drives", r"\b(?:ball screw|lead screw|worm screw|ball nut|lead nut|drive nut)\b"),
    ("Fasteners", r"\b(?:screws?|bolts?|nuts?|washers?|fasteners?|rivets?|circlips?|standoffs?|threaded inserts?|retaining rings?|(?:dowel|spring|roll|cotter) pins?)\b"),
    ("Bearings & seals", r"\bbearing (?:shells?|housings?)\b"),
    ("Enclosures", r"\b(?:enclosures?|housings?|shells?|lids?|covers?|casings?|case halves)\b"),
    ("Structural parts", r"\b(?:brackets?|mounts?|mounting plates?|frames?|chassis|risers?|clamps?|trays?)\b"),
    ("Electronics", r"\b(?:electronics|pcbs?|circuit boards?|controller boards?|cameras?|batter(?:y|ies)|lipo|switch(?:es)?|pushbuttons?|sensors?|encoders?|antennas?|connectors?|wiring|harness(?:es)?)\b"),
    ("Bearings & seals", r"\b(?:bearings?|bushings?|seals?|gaskets?|o rings?)\b"),
    ("Motion & drives", r"\b(?:motors?|servos?|gearboxes|gearbox|gears?|pinions?|pulleys?|shafts?|couplings?|rails?|carriages?|sliders?|linkages?)\b"),
    ("Pneumatics & gas", r"\b(?:pneumatic cylinders?|solenoid valves?|gas cartridges?)\b"),
    ("Springs", r"\bsprings?\b"),
]

def _protolab_group_path(library_id, label):
    folder = _protolab_library_folders.get(library_id)
    if folder:
        return [folder]
    # Prefer the installed component name to descriptions of internal display solids.
    role = label.split(" / ", 1)[0].casefold().replace("-", " ")
    for folder, pattern in _protolab_label_folders:
        if re.search(pattern, role):
            return [folder]
    return []

def _protolab_component_paths(root_category, supply, count, labels, metadata, groups):
    if groups is not None:
        if len(groups) != count:
            raise ValueError("Component groups do not match the generated assembly.")
        if any(not isinstance(path, (list, tuple)) or any(not isinstance(label, str) or not label.strip() for label in path) for path in groups):
            raise ValueError("Each component group must be a path of non-empty labels.")
        return groups
    if count < 2 or supply in ("purchased", "standard"):
        return [[] for _ in range(count)]
    paths = []
    for index in range(count):
        record = metadata[index] if metadata is not None else {}
        label = labels[index] if labels is not None else ""
        path = _protolab_group_path(record.get("LibraryId", ""), label)
        if not path and root_category == "ENCLOSURES & DEVICES" and re.search(r"\b(?:base|body|bezel|case)\b", label.casefold()):
            path = ["Enclosures"]
        paths.append(path)
    if any(paths):
        return [path or ["Other components"] for path in paths]
    return paths

def _protolab_group_parents(doc, root, created, object_name, paths, authored=False):
    groups = {(): root}
    ordered = dict.fromkeys(tuple(path) for path in paths)
    if not authored:
        ordered = sorted(ordered, key=lambda path: (path == ("Other components",), tuple(label.casefold() for label in path)))
    for path in ordered:
        for depth, label in enumerate(path):
            prefix = path[:depth + 1]
            if prefix not in groups:
                group = doc.addObject("App::Part", object_name + str(len(groups)))
                created.append(group.Name)
                group.Label = label
                group.addProperty("App::PropertyStringList", "AssemblyGroup", "ProtoLab")
                group.AssemblyGroup = list(prefix)
                groups[prefix[:-1]].addObject(group)
                groups[prefix] = group
    return [groups[tuple(path)] for path in paths]`;
}
