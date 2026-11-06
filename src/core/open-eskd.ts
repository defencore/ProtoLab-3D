import type { DesignProject, ManufacturingProcess, ProductConfiguration } from './product-types';
import type { PartDefinition } from './types';
import { validateProject } from './design-project';
import { eskdIdentity } from './eskd';

/** Published ProtoLab annotations; core Open ESKD fields retain their original meaning. */
const namespace = 'com.defencore.protolab';
const encoder = new TextEncoder();
const reservedIds = new Set(['__proto__', 'constructor', 'prototype']);

function shortened(value: string, maximum: number): string {
  const characters = [...value];
  return characters.length <= maximum
    ? value
    : characters.slice(0, maximum - 1).join('') + '\u2026';
}

function draftIdentity(configuration: ProductConfiguration) {
  text(configuration.name, 'Original component name', 65536, true);
  text(configuration.designation, 'Original component designation', 65536);
  const unresolved: string[] = [];
  const originalDesignation = configuration.designation;
  const designationIsDraft = !originalDesignation.trim() || [...originalDesignation].length > 200;
  if (designationIsDraft)
    unresolved.push(
      originalDesignation.trim()
        ? 'Original designation exceeds the Open ESKD 200-character limit; the draft export label is not an ordering code.'
        : 'Ordering or enterprise designation is missing; the draft export label is not a supplier SKU.',
    );
  const suffix = ` [${configuration.id}]`;
  const designation = designationIsDraft
    ? `Draft: ${shortened(originalDesignation.trim() || configuration.name, 200 - 7 - [...suffix].length)}${suffix}`
    : originalDesignation;
  const nameIsAbbreviated = [...configuration.name].length > 200;
  if (nameIsAbbreviated)
    unresolved.push(
      'Original component name exceeds the Open ESKD 200-character limit; the full original remains in ProtoLab annotations.',
    );
  if ([...(configuration.manufacturing?.requirements.join('\n') ?? '')].length > 2000)
    unresolved.push(
      'Complete manufacturing and inspection requirements exceed the operation check field; read the full requirements in ProtoLab annotations before manufacture.',
    );
  if (configuration.supply === 'purchased' || configuration.supply === 'standard') {
    if (!configuration.procurement?.name?.trim())
      unresolved.push('Exact supplier listing title is unresolved.');
    if (!configuration.procurement?.designation.trim())
      unresolved.push('Supplier ordering designation is unresolved.');
    if (!configuration.procurement?.manufacturer.trim())
      unresolved.push('Manufacturer is unresolved.');
    if (!configuration.procurement?.source.trim())
      unresolved.push('Supplier ordering evidence is unresolved.');
    if (configuration.supply === 'standard' && !configuration.procurement?.standard?.trim())
      unresolved.push('Applicable product standard is unresolved.');
  }
  return {
    designation,
    name: shortened(configuration.name, 200),
    designationIsDraft,
    nameIsAbbreviated,
    unresolved,
  };
}

function configurationAnnotations(
  configuration: ProductConfiguration,
  part: PartDefinition,
  occurrence: DesignProject['occurrences'][number],
  identity: ReturnType<typeof draftIdentity>,
) {
  const payload = {
    configuration,
    position: occurrence.position,
    placement: occurrence.placement,
    ...(identity.designationIsDraft
      ? { designationIsDraft: true, originalDesignation: configuration.designation }
      : {}),
    ...(identity.nameIsAbbreviated
      ? { nameIsAbbreviated: true, originalName: configuration.name }
      : {}),
    ...(identity.unresolved.length ? { unresolved: identity.unresolved } : {}),
    ...([...(configuration.manufacturing?.requirements.join('\n') ?? '')].length > 2000
      ? { manufacturingRequirementsInAnnotations: true }
      : {}),
  };
  const parameterBytes = encoder.encode(JSON.stringify(configuration.parameters)).length;
  if (encoder.encode(JSON.stringify({ [namespace]: { version: 1, ...payload } })).length <= 65536)
    return { extensions: annotations(payload), parametersOmitted: false };
  const { parameters: _parameters, ...metadata } = configuration;
  const reason =
    'Geometry parameters exceed the Open ESKD 64 KiB annotation limit. The complete configuration remains in the ProtoLab Project JSON backup.';
  return {
    extensions: annotations({
      ...payload,
      configuration: metadata,
      configurationKey: eskdIdentity(
        part,
        configuration.parameters,
        configuration.state,
        configuration.presetId,
        configuration,
      ).configurationKey,
      parameterBytes,
      parametersOmitted: true,
      parametersOmittedReason: reason,
      unresolved: [...identity.unresolved, reason],
    }),
    parametersOmitted: true,
  };
}

function text(value: string, label: string, limit: number, required = false): string {
  if (
    typeof value !== 'string' ||
    [...value].length > limit ||
    /[\uD800-\uDFFF]/u.test(value) ||
    (required && !value.trim())
  )
    throw new Error(
      `${label} must be valid Unicode text of at most ${limit} characters${required ? ' and cannot be blank' : ''}.`,
    );
  return value;
}

function id(value: string, label: string): string {
  text(value, label, 100, true);
  if (/[\s\x00-\x1f\x7f]/u.test(value) || reservedIds.has(value))
    throw new Error(`${label} is not a portable Open ESKD ID.`);
  return value;
}

function annotations(payload: object): Record<string, object> {
  function inspect(value: unknown, depth = 0): void {
    if (depth > 16) throw new Error('ProtoLab annotations exceed the Open ESKD nesting limit.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value === 'string') {
      text(value, 'ProtoLab annotation', 65536);
      return;
    }
    if (!value || typeof value !== 'object')
      throw new Error('ProtoLab annotations require finite JSON values.');
    for (const [key, item] of Object.entries(value)) {
      if (reservedIds.has(key)) throw new Error('ProtoLab annotations contain a reserved key.');
      inspect(item, depth + 1);
    }
  }
  // Optional TypeScript fields have the same absent-field meaning in both JSON formats.
  const serialized = JSON.stringify({ [namespace]: { version: 1, ...payload } });
  if (encoder.encode(serialized).length > 65536)
    throw new Error('ProtoLab annotations exceed the Open ESKD 64 KiB limit.');
  const result = JSON.parse(serialized) as Record<string, object>;
  inspect(result[namespace]);
  return result;
}

function portablePath(path: string): void {
  if (
    !path ||
    path.length > 800 ||
    /[\uD800-\uDFFF]/u.test(path) ||
    /[\\\x00-\x1f\x7f<>:"|?*]/u.test(path) ||
    path
      .split('/')
      .some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          segment.length > 120 ||
          encoder.encode(segment).length > 200 ||
          /[ .]$/u.test(segment) ||
          /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(segment),
      ) ||
    /\.eskd-placeholder$/iu.test(path) ||
    ['project.json', 'report.html', 'verification.json'].includes(path.split('/')[0].toLowerCase())
  )
    throw new Error(`Document path must be a portable relative Open ESKD path: ${path}`);
}

/** Match the reference application's directory suggestion solely to detect path collisions. */
function directorySegment(value: string): string {
  const cleaned = value.normalize('NFC').replace(/[\\/\x00-\x1f\x7f<>:"|?*]/gu, '_');
  let result = '';
  let bytes = 0;
  for (const character of [...cleaned].slice(0, 80)) {
    const size = encoder.encode(character).length;
    if (bytes + size > 160) break;
    result += character;
    bytes += size;
  }
  result = result.replace(/[ .]+$/gu, '');
  return !result || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(result)
    ? '_' + (result || 'item')
    : result;
}

const operations: Record<ManufacturingProcess, string> = {
  turning: 'turning',
  milling: 'milling',
  cutting: 'cutStock',
  drilling: 'drilling',
  bending: 'bending',
  printing: 'printing3d',
  moulding: 'casting',
  winding: 'other',
  assembly: 'assembly',
};
const technologies: Partial<Record<ManufacturingProcess, string>> = {
  turning: 'turning',
  milling: 'milling',
  bending: 'sheetMetal',
  printing: 'printing3d',
  moulding: 'casting',
  assembly: 'assembly',
};

function route(configuration: ProductConfiguration) {
  const manufacturing = configuration.manufacturing;
  const processes = manufacturing?.processes ?? [];
  const check = manufacturing?.requirements.join('\n') ?? '';
  text(check, 'Manufacturing inspection requirements', 65536);
  const checkField =
    [...check].length <= 2000
      ? check
      : "Read the complete manufacturing and inspection requirements in the ProtoLab annotations before manufacture. The authored requirements exceed this field's 2,000-character limit.";
  return {
    technology:
      configuration.supply === 'manufactured'
        ? processes.length
          ? (technologies[processes[0]] ?? 'other')
          : ''
        : 'purchase',
    stock: text(manufacturing?.blank ?? '', 'Manufacturing stock', 2000),
    preparation: '',
    steps: processes.map((process, index) => ({
      id: `operation-${index + 1}`,
      operation: operations[process],
      instructions: process === 'winding' ? 'Winding' : '',
      inputs: '',
      equipment: '',
      facility: '',
      check: index === processes.length - 1 ? checkField : '',
      dependsOn: [],
      componentInputs: [],
      documents: [],
    })),
  };
}

/** Export a draft schema-6 snapshot, preserving product identity and external file references. */
export function exportOpenEskd(project: DesignProject, parts: readonly PartDefinition[]): string {
  const errors = validateProject(project, parts);
  if (errors.length) throw new Error(errors.join(' '));
  id(project.id, 'Project ID');
  text(project.name, 'Project name', 200, true);
  text(project.designation, 'Project designation', 200);
  text(project.revision, 'Project revision', 100, true);
  const library = new Map(parts.map((part) => [part.id, part]));
  const configurations = new Map(
    project.configurations.map((configuration) => [configuration.id, configuration]),
  );
  const children = new Map<string | null, typeof project.occurrences>();
  for (const occurrence of project.occurrences)
    children.set(occurrence.parentId, [...(children.get(occurrence.parentId) ?? []), occurrence]);
  const definitions = new Map<string, string>();
  const exported = new Map<string, ProductConfiguration>();
  const components: Array<{
    id: string;
    definitionId: string;
    source: null;
    baseRevisionId: null;
    parentId: string | null;
    name: string;
    designation: string;
    type: string;
    quantity: number;
    unit: string;
    revision: string;
    status: string;
    owner: string;
    material: string;
    manufacturer: string;
    process: string;
    manufacturing: ReturnType<typeof route>;
    notes: string;
    extensions: Record<string, object>;
  }> = [];
  function append(
    parentId: string | null,
    depth = 1,
    multiplier = 1,
    ancestors = new Set<string>(),
  ): void {
    for (const occurrence of children.get(parentId) ?? []) {
      const configuration = configurations.get(occurrence.configurationId)!;
      const part = library.get(configuration.libraryId)!;
      if (configuration.supply === 'reference' || part.product.kind === 'reference')
        throw new Error(
          `${configuration.name}: resolve reference geometry before Open ESKD export.`,
        );
      if (depth > 64) throw new Error('Open ESKD supports at most 64 product levels.');
      const total = multiplier * occurrence.quantity;
      if (occurrence.quantity > 1000000 || !Number.isSafeInteger(total))
        throw new Error(
          'Open ESKD quantities must be at most 1,000,000 per occurrence and totals must be safe integers.',
        );
      id(occurrence.id, 'Occurrence ID');
      id(configuration.id, 'Configuration ID');
      const identity = draftIdentity(configuration);
      text(configuration.revision, 'Component revision', 100, true);
      const designationKey = identity.designation.trim().toLowerCase();
      if (ancestors.has(designationKey))
        throw new Error(
          `${configuration.designation}: an Open ESKD definition cannot contain another revision of itself.`,
        );
      const definitionId = definitions.get(designationKey) ?? configuration.id;
      definitions.set(designationKey, definitionId);
      const bought = configuration.supply === 'purchased' || configuration.supply === 'standard';
      const type =
        configuration.supply === 'standard'
          ? 'standard'
          : configuration.supply === 'purchased'
            ? 'purchased'
            : part.product.kind === 'detail'
              ? 'part'
              : part.product.kind === 'kit'
                ? 'set'
                : part.product.kind;
      exported.set(occurrence.id, configuration);
      const annotation = configurationAnnotations(configuration, part, occurrence, identity);
      components.push({
        id: occurrence.id,
        definitionId,
        source: null,
        baseRevisionId: null,
        parentId,
        name: identity.name,
        designation: identity.designation,
        type,
        quantity: occurrence.quantity,
        unit: 'pcs',
        revision: configuration.revision,
        status: 'draft',
        owner: '',
        material: text(configuration.manufacturing?.material ?? '', 'Material', 200),
        manufacturer: text(configuration.procurement?.manufacturer ?? '', 'Manufacturer', 200),
        process: text(
          configuration.manufacturing?.processes.join(' -> ') ?? '',
          'Process summary',
          1000,
        ),
        manufacturing: route(configuration),
        notes: text(
          [
            occurrence.notes,
            ...identity.unresolved,
            ...(annotation.parametersOmitted
              ? [
                  'Geometry parameters omitted from exchange annotations; retain the complete ProtoLab Project JSON backup.',
                ]
              : []),
          ]
            .filter(Boolean)
            .join('\n'),
          'Component notes',
          10000,
        ),
        extensions: annotation.extensions,
      });
      if (!bought) append(occurrence.id, depth + 1, total, new Set([...ancestors, designationKey]));
    }
  }
  append(null);
  if (components.length > 10000) throw new Error('Open ESKD supports at most 10,000 components.');
  const documents = project.documents.flatMap((document) =>
    [...exported]
      .filter(([, configuration]) => configuration.id === document.configurationId)
      .map(([componentId]) => {
        portablePath(document.file);
        return {
          id: id(`${document.id.length}:${document.id}${componentId}`, 'Exported document ID'),
          name: text(document.name, 'Document name', 300, true),
          path: document.file,
          componentId,
          kind: document.kind === 'assembly-drawing' ? 'assemblyDrawing' : document.kind,
          revision: text(document.revision, 'Document revision', 100, true),
          sha256: null,
          required: true,
          extensions: annotations({
            sourceId: document.id,
            configurationId: document.configurationId,
            designation: document.designation,
            format: document.format,
          }),
        };
      }),
  );
  if (documents.length > 10000)
    throw new Error('Open ESKD supports at most 10,000 document references.');
  const pathKey = (path: string) => path.toLowerCase().normalize('NFC');
  const paths = new Map<string, string>();
  const directories = new Set(['documents', 'manufacturing', 'reports']);
  for (const component of components)
    directories.add(
      pathKey(
        `components/${directorySegment(component.designation)}/rev-${directorySegment(component.revision)}`,
      ),
    );
  for (const document of documents) {
    const key = pathKey(document.path);
    if (paths.has(key) && paths.get(key) !== document.path)
      throw new Error(`Document paths conflict on a case-insensitive filesystem: ${document.path}`);
    paths.set(key, document.path);
    const segments = document.path.split('/');
    for (let index = 1; index < segments.length; index++)
      directories.add(pathKey(segments.slice(0, index).join('/')));
  }
  for (const key of paths.keys())
    if (directories.has(key))
      throw new Error(`Document path is also a directory: ${paths.get(key)}`);
  const snapshot = {
    meta: {
      name: project.name,
      designation: project.designation,
      description: '',
      owner: '',
      workflow: 'design',
    },
    components,
    documents,
  };
  const date = new Date().toISOString();
  return JSON.stringify(
    {
      schema: 'open-eskd',
      schemaVersion: 6,
      kind: 'project',
      id: project.id,
      createdAt: date,
      updatedAt: date,
      activeBranch: 'main',
      branches: { main: { head: 'protolab-export', working: snapshot } },
      commits: {
        'protolab-export': {
          id: 'protolab-export',
          parents: [],
          author: 'ProtoLab export',
          message: 'Imported ProtoLab design configuration',
          version: project.revision,
          status: 'draft',
          createdAt: date,
          snapshot,
        },
      },
      catalog: {},
      production: [],
      fileCheck: null,
      extensions: annotations({
        sourceSchemaVersion: project.schemaVersion,
        documentationPolicy: project.documentationPolicy,
        documentationRules: project.documentationRules,
      }),
    },
    null,
    2,
  );
}
