import type { Parameters, PartDefinition } from './types';
import type {
  AssemblyComponent,
  DesignDocument,
  DesignProject,
  DocumentationRules,
  ManufacturingProcess,
  ProductConfiguration,
  ProductOccurrence,
  SpecificationSection,
} from './product-types';
import { createPresetId } from './storage';
import { validateParameters } from './validation';
import { specificationSection } from './product-library';
import { selectedMatchingPreset } from './preset-resolution';

export interface ProductSelection {
  part: PartDefinition;
  parameters: Parameters;
  state: string;
  presetId?: string;
}

export interface SpecificationRow {
  section: SpecificationSection;
  position: string;
  designation: string;
  name: string;
  revision: string;
  quantity: number | '';
  format: string;
  notes: string;
  configurationId?: string;
}

export interface ProjectReadiness {
  complete: boolean;
  issues: string[];
  reviewRequirements: string[];
}

const processes: ManufacturingProcess[] = [
  'turning',
  'milling',
  'cutting',
  'drilling',
  'bending',
  'printing',
  'moulding',
  'winding',
  'assembly',
];
const sections: SpecificationSection[] = [
  'documents',
  'complexes',
  'assemblies',
  'details',
  'standard-products',
  'other-products',
  'materials',
  'kits',
];
const documentKinds: DesignDocument['kind'][] = [
  'drawing',
  'assembly-drawing',
  'specification',
  'model',
  'instructions',
  'other',
];

export function defaultDocumentationRules(): DocumentationRules {
  return {
    sectionOrder: [...sections],
    sectionLabels: {
      documents: 'Documents',
      complexes: 'Complexes',
      assemblies: 'Assembly units',
      details: 'Details',
      'standard-products': 'Standard products',
      'other-products': 'Other products',
      materials: 'Materials',
      kits: 'Kits',
    },
    designationPattern: '',
    requiredDocuments: [],
  };
}

/** A bounded full-match pattern supports enterprise numbering without executable expressions. */
function designationExpression(pattern: string): RegExp | undefined {
  if (!pattern) return undefined;
  if (pattern.length > 128 || !pattern.startsWith('^') || !pattern.endsWith('$'))
    throw new Error(
      'Designation patterns must be anchored with ^ and $ and at most 128 characters.',
    );
  let characterClass = false;
  let variableRepeats = 0;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === '\\') {
      const escaped = pattern[++index];
      if (!escaped || /[1-9bBpPkKuUxX]/.test(escaped))
        throw new Error('Designation patterns cannot contain references or complex escapes.');
      continue;
    }
    if (character === '[') {
      characterClass = true;
      continue;
    }
    if (character === ']') {
      characterClass = false;
      continue;
    }
    if (characterClass) continue;
    if ('()|?'.includes(character))
      throw new Error(
        'Designation patterns cannot contain groups, alternatives or optional repetitions.',
      );
    if (character === '*' || character === '+') {
      if (++variableRepeats > 1)
        throw new Error('Designation patterns allow at most one variable repetition.');
    }
    if (character === '{') {
      const repeat = /^\{([0-9]{1,2})\}/.exec(pattern.slice(index));
      if (!repeat || +repeat[1] < 1 || +repeat[1] > 64)
        throw new Error('Designation repetitions must be fixed counts from 1 to 64.');
      index += repeat[0].length - 1;
    }
  }
  return new RegExp(pattern);
}

function documentationRuleErrors(rules: DocumentationRules): string[] {
  const errors: string[] = [];
  if (
    rules.sectionOrder.length !== sections.length ||
    new Set(rules.sectionOrder).size !== sections.length ||
    rules.sectionOrder.some((section) => !sections.includes(section))
  )
    errors.push('Enterprise specification order must contain each section exactly once.');
  if (
    Object.keys(rules.sectionLabels).length !== sections.length ||
    sections.some(
      (section) =>
        typeof rules.sectionLabels[section] !== 'string' ||
        !rules.sectionLabels[section].trim() ||
        rules.sectionLabels[section].length > 120,
    )
  )
    errors.push('Every enterprise specification section needs a label of 1–120 characters.');
  if (
    new Set(rules.requiredDocuments).size !== rules.requiredDocuments.length ||
    rules.requiredDocuments.some((kind) => !documentKinds.includes(kind))
  )
    errors.push('Enterprise document requirements must be known, unique document kinds.');
  try {
    designationExpression(rules.designationPattern);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}
const identity = (prefix: string) => `${prefix}-${createPresetId()}`;
const clone = <T>(value: T): T => structuredClone(value);
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

export function createProject(name = 'New engineering project'): DesignProject {
  return {
    schemaVersion: 1,
    id: identity('project'),
    name,
    designation: '',
    revision: 'A',
    documentationPolicy: 'enterprise-eskd',
    documentationRules: defaultDocumentationRules(),
    configurations: [],
    occurrences: [],
    documents: [],
  };
}

export function configureProduct(selection: ProductSelection): ProductConfiguration {
  const { part, parameters, state, presetId } = selection;
  const errors = validateParameters(part, parameters, state);
  if (errors.length) throw new Error(`${part.name}: ${errors.join(' ')}`);
  const preset = selectedMatchingPreset(part, parameters, presetId);
  const catalog = preset?.catalog;
  const configuration: ProductConfiguration = {
    id: identity('configuration'),
    libraryId: part.id,
    parameters: clone(parameters),
    state: physicalState(part, state),
    ...(presetId && presetId !== 'custom' ? { presetId } : {}),
    designation: catalog?.designation ?? '',
    name: catalog?.designation ? preset!.name : part.name,
    revision: 'A',
    supply: catalog ? (preset?.product?.supply ?? part.product.supply) : part.product.supply,
  };
  if (configuration.supply === 'manufactured')
    configuration.manufacturing = {
      material: '',
      blank: '',
      processes: [...part.product.processes],
      requirements: [],
    };
  if (configuration.supply === 'purchased' || configuration.supply === 'standard')
    configuration.procurement = {
      designation: catalog?.designation ?? '',
      manufacturer: catalog?.manufacturer ?? '',
      source: catalog?.sourceUrl ?? '',
      ...(catalog?.standard ? { standard: catalog.standard } : {}),
    };
  return configuration;
}

function designIdentity(
  configuration: ProductConfiguration,
  parameters = configuration.parameters,
): string {
  return stable({
    libraryId: configuration.libraryId,
    parameters,
    state: configuration.state,
    supply: configuration.supply,
    manufacturing: configuration.manufacturing,
    procurement: configuration.procurement,
  });
}

/** Poses remain separate geometry configurations of one fixed purchased product. */
function designationIdentity(
  configuration: ProductConfiguration,
  part: PartDefinition | undefined,
): string {
  const preset =
    part?.catalogSelectionOnly && ['purchased', 'standard'].includes(configuration.supply)
      ? selectedMatchingPreset(part, configuration.parameters, configuration.presetId)
      : undefined;
  const keys = preset?.catalog?.verifiedParameters;
  return designIdentity(
    configuration,
    keys?.length
      ? Object.fromEntries(keys.map((key) => [key, configuration.parameters[key]]))
      : configuration.parameters,
  );
}

function physicalState(part: PartDefinition, selected: string): string {
  return part.physicalStates?.includes(selected)
    ? selected
    : (part.states?.find((item) => item.id === 'assembled')?.id ??
        part.states?.[0]?.id ??
        'default');
}

/** Add a configured library product and its explicitly declared physical composition. */
export function addProduct(
  project: DesignProject,
  parts: readonly PartDefinition[],
  selection: ProductSelection,
  parentId: string | null = null,
): { project: DesignProject; occurrenceId: string } {
  const existingErrors = validateProject(project, parts);
  if (existingErrors.length) throw new Error(existingErrors.join(' '));
  if (parentId !== null) {
    const parent = project.occurrences.find((item) => item.id === parentId);
    if (!parent) throw new Error('The parent assembly no longer exists.');
    const configuration = project.configurations.find(
      (item) => item.id === parent.configurationId,
    )!;
    const part = parts.find((item) => item.id === configuration.libraryId)!;
    if (!['assembly', 'complex', 'kit'].includes(part.product.kind))
      throw new Error('Only an assembly, complex or kit can contain another product.');
  }
  const next = clone(project);
  const byId = new Map(parts.map((part) => [part.id, part]));
  function append(
    selected: ProductSelection,
    parent: string | null,
    component?: AssemblyComponent,
    ancestors: string[] = [],
    depth = 0,
  ): string {
    const expandsLibrary = component?.children === undefined;
    if (expandsLibrary && ancestors.includes(selected.part.id))
      throw new Error(
        `Cyclic library composition: ${[...ancestors, selected.part.id].join(' -> ')}.`,
      );
    if (depth > 128) throw new Error('Library composition exceeds 128 assembly levels.');
    const configuration = configureProduct(selected);
    if (component) {
      configuration.name = component.name;
      configuration.supply = component.supply;
      if (component.manufacturing) configuration.manufacturing = clone(component.manufacturing);
      else if (component.supply !== 'manufactured') delete configuration.manufacturing;
      if (component.procurement) {
        configuration.procurement = clone(component.procurement);
        configuration.designation = component.procurement.designation;
      } else if (!['purchased', 'standard'].includes(component.supply))
        delete configuration.procurement;
    }
    const reusable = next.configurations.find(
      (item) => designIdentity(item) === designIdentity(configuration),
    );
    if (!reusable) next.configurations.push(configuration);
    const siblings = next.occurrences.filter((item) => item.parentId === parent);
    let position = 1;
    while (siblings.some((item) => item.position === String(position))) position++;
    const occurrence: ProductOccurrence = {
      id: identity('occurrence'),
      parentId: parent,
      configurationId: reusable?.id ?? configuration.id,
      position: String(position),
      quantity: component?.quantity ?? 1,
      placement: component
        ? clone(component.placement)
        : { translation: [0, 0, 0], rotation: [0, 0, 0] },
      notes: component?.notes ?? '',
    };
    next.occurrences.push(occurrence);
    const children =
      component?.children ??
      (['purchased', 'standard'].includes(configuration.supply)
        ? []
        : (selected.part.composition?.(selected.parameters).components ?? []));
    if (children.length && !['assembly', 'complex', 'kit'].includes(selected.part.product.kind))
      throw new Error(`${selected.part.name}: a detail cannot contain assembly occurrences.`);
    for (const child of children) {
      const part = byId.get(child.libraryId);
      if (!part) throw new Error(`Missing library component: ${child.libraryId}.`);
      append(
        { part, parameters: child.parameters, state: child.state, presetId: child.presetId },
        occurrence.id,
        child,
        expandsLibrary ? [...ancestors, selected.part.id] : ancestors,
        depth + 1,
      );
    }
    return occurrence.id;
  }
  const occurrenceId = append(selection, parentId);
  const errors = validateProject(next, parts);
  if (errors.length) throw new Error(errors.join(' '));
  return { project: next, occurrenceId };
}

export function removeOccurrence(project: DesignProject, occurrenceId: string): DesignProject {
  const next = clone(project);
  const removed = new Set([occurrenceId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of next.occurrences)
      if (item.parentId && removed.has(item.parentId) && !removed.has(item.id)) {
        removed.add(item.id);
        changed = true;
      }
  }
  next.occurrences = next.occurrences.filter((item) => !removed.has(item.id));
  const used = new Set(next.occurrences.map((item) => item.configurationId));
  next.configurations = next.configurations.filter((item) => used.has(item.id));
  next.documents = next.documents.filter((item) => used.has(item.configurationId));
  return next;
}

/** Fork assembly design records in this subtree; unmodified leaf details stay reusable. */
export function forkOccurrenceDesign(
  project: DesignProject,
  parts: readonly PartDefinition[],
  occurrenceId: string,
): DesignProject {
  const next = clone(project);
  if (!next.occurrences.some((item) => item.id === occurrenceId))
    throw new Error('The selected occurrence no longer exists.');
  const descendants = new Set([occurrenceId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of next.occurrences)
      if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
        descendants.add(item.id);
        changed = true;
      }
  }
  const forked = new Map<string, string>();
  for (const item of next.occurrences.filter((occurrence) => descendants.has(occurrence.id))) {
    const configuration = next.configurations.find(
      (configured) => configured.id === item.configurationId,
    );
    if (!configuration) throw new Error('The selected product refers to a missing design.');
    const definition = parts.find((part) => part.id === configuration.libraryId);
    if (!definition)
      throw new Error('The selected product refers to a missing library definition.');
    if (
      item.id !== occurrenceId &&
      !['assembly', 'complex', 'kit'].includes(definition.product.kind)
    )
      continue;
    let id = forked.get(configuration.id);
    if (!id) {
      id = identity('configuration');
      forked.set(configuration.id, id);
      next.configurations.push({
        ...clone(configuration),
        id,
        designation: '',
        name: `${configuration.name} (independent)`,
      });
    }
    item.configurationId = id;
  }
  const used = new Set(next.occurrences.map((item) => item.configurationId));
  next.configurations = next.configurations.filter((item) => used.has(item.id));
  next.documents = next.documents.filter((item) => used.has(item.configurationId));
  return next;
}

export function validateProject(
  project: DesignProject,
  parts: readonly PartDefinition[],
): string[] {
  const errors: string[] = documentationRuleErrors(project.documentationRules);
  const library = new Map(parts.map((part) => [part.id, part]));
  const configurations = new Map<string, ProductConfiguration>();
  const designations = new Map<string, string>();
  for (const configuration of project.configurations) {
    if (!configuration.id.trim()) errors.push('A configured product needs a stable ID.');
    if (configurations.has(configuration.id))
      errors.push(`Duplicate configuration ID: ${configuration.id}.`);
    configurations.set(configuration.id, configuration);
    const part = library.get(configuration.libraryId);
    if (!part) errors.push(`Unknown library product: ${configuration.libraryId}.`);
    else {
      if (configuration.state !== physicalState(part, configuration.state))
        errors.push(
          `${configuration.name}: an inspection state cannot define a physical configured product.`,
        );
      errors.push(
        ...validateParameters(part, configuration.parameters, configuration.state).map(
          (error) => `${configuration.name}: ${error}`,
        ),
      );
      if (
        Object.keys(configuration.parameters).some(
          (key) => !part.parameters.some((field) => field.key === key),
        )
      )
        errors.push(`${configuration.name}: unknown configuration parameter.`);
      if (
        configuration.presetId &&
        !part.presets.some((preset) => preset.id === configuration.presetId)
      )
        errors.push(`${configuration.name}: unknown catalog preset ${configuration.presetId}.`);
      if ((part.product.kind === 'reference') !== (configuration.supply === 'reference'))
        errors.push(`${configuration.name}: reference geometry cannot become a physical product.`);
    }
    if (configuration.manufacturing && configuration.supply !== 'manufactured')
      errors.push(`${configuration.name}: manufacturing records require manufactured supply.`);
    if (configuration.procurement && !['standard', 'purchased'].includes(configuration.supply))
      errors.push(`${configuration.name}: procurement records require bought supply.`);
    if (
      configuration.manufacturing &&
      (new Set(configuration.manufacturing.processes).size !==
        configuration.manufacturing.processes.length ||
        configuration.manufacturing.processes.some((process) => !processes.includes(process)))
    )
      errors.push(`${configuration.name}: manufacturing processes must be known and unique.`);
    if (configuration.designation.trim()) {
      const key = `${configuration.designation.trim()}@${configuration.revision.trim()}`;
      const definition = designationIdentity(configuration, part);
      if (designations.has(key) && designations.get(key) !== definition)
        errors.push(
          `Designation ${configuration.designation}, revision ${configuration.revision} identifies conflicting designs.`,
        );
      designations.set(key, definition);
    }
  }
  const occurrences = new Map<string, ProductOccurrence>();
  const positions = new Set<string>();
  for (const occurrence of project.occurrences) {
    if (!occurrence.id.trim()) errors.push('A product occurrence needs a stable ID.');
    if (occurrences.has(occurrence.id)) errors.push(`Duplicate occurrence ID: ${occurrence.id}.`);
    occurrences.set(occurrence.id, occurrence);
    if (!configurations.has(occurrence.configurationId))
      errors.push(`Occurrence ${occurrence.id} refers to an unknown configuration.`);
    if (occurrence.quantity <= 0 || !Number.isSafeInteger(occurrence.quantity))
      errors.push(`Position ${occurrence.position}: quantity must be a positive safe integer.`);
    if (!occurrence.position.trim()) errors.push(`Occurrence ${occurrence.id} needs a position.`);
    const key = stable([occurrence.parentId, occurrence.position]);
    if (positions.has(key))
      errors.push(`Duplicate position ${occurrence.position} in the same assembly.`);
    positions.add(key);
    for (const values of [occurrence.placement.translation, occurrence.placement.rotation])
      if (
        !Array.isArray(values) ||
        values.length !== 3 ||
        values.some((value) => !Number.isFinite(value))
      )
        errors.push(
          `Position ${occurrence.position}: placement must contain three finite coordinates.`,
        );
  }
  for (const occurrence of occurrences.values()) {
    const visited = new Set([occurrence.id]);
    const ancestorConfigurations = new Set([occurrence.configurationId]);
    let parentId = occurrence.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) {
        errors.push(`Cyclic project assembly at position ${occurrence.position}.`);
        break;
      }
      visited.add(parentId);
      const parent = occurrences.get(parentId);
      if (!parent) {
        errors.push(`Position ${occurrence.position}: parent assembly does not exist.`);
        break;
      }
      if (ancestorConfigurations.has(parent.configurationId)) {
        errors.push(
          `Position ${occurrence.position}: a configured assembly cannot contain itself.`,
        );
        break;
      }
      ancestorConfigurations.add(parent.configurationId);
      const parentConfiguration = configurations.get(parent.configurationId);
      const parentPart = parentConfiguration
        ? library.get(parentConfiguration.libraryId)
        : undefined;
      if (parentPart && !['assembly', 'complex', 'kit'].includes(parentPart.product.kind)) {
        errors.push(`Position ${occurrence.position}: parent product cannot contain components.`);
        break;
      }
      if (visited.size > 128) {
        errors.push('Project exceeds 128 assembly levels.');
        break;
      }
      parentId = parent.parentId;
    }
  }
  const structures = new Map<string, string>();
  const designatedStructures = new Map<string, string>();
  for (const occurrence of project.occurrences) {
    const configuration = configurations.get(occurrence.configurationId);
    const part = configuration ? library.get(configuration.libraryId) : undefined;
    if (!part || !['assembly', 'complex', 'kit'].includes(part.product.kind)) continue;
    const children = project.occurrences
      .filter((item) => item.parentId === occurrence.id)
      .map((item) => ({
        configurationId: item.configurationId,
        position: item.position,
        quantity: item.quantity,
        placement: item.placement,
      }))
      .sort((a, b) => a.position.localeCompare(b.position, 'en', { numeric: true }));
    const structure = stable(children);
    if (
      structures.has(occurrence.configurationId) &&
      structures.get(occurrence.configurationId) !== structure
    )
      errors.push(
        `${configuration!.name}: occurrences of the same assembly design have inconsistent component structures. Fork an independent design before changing its composition.`,
      );
    structures.set(occurrence.configurationId, structure);
    if (configuration!.designation.trim()) {
      const key = `${configuration!.designation.trim()}@${configuration!.revision.trim()}`;
      if (designatedStructures.has(key) && designatedStructures.get(key) !== structure)
        errors.push(
          `Designation ${configuration!.designation}, revision ${configuration!.revision} identifies conflicting assembly structures.`,
        );
      designatedStructures.set(key, structure);
    }
  }
  const documentIds = new Set<string>();
  for (const document of project.documents) {
    if (!document.id.trim()) errors.push('A design document needs a stable ID.');
    if (documentIds.has(document.id)) errors.push(`Duplicate document ID: ${document.id}.`);
    documentIds.add(document.id);
    if (!configurations.has(document.configurationId))
      errors.push(`${document.name || 'Document'} refers to an unknown configuration.`);
  }
  return [...new Set(errors)];
}

export function projectReadiness(
  project: DesignProject,
  parts: readonly PartDefinition[],
): ProjectReadiness {
  const issues = validateProject(project, parts);
  const reviewRequirements: string[] = [];
  let designationRule: RegExp | undefined;
  try {
    designationRule = designationExpression(project.documentationRules.designationPattern);
  } catch {
    /* Invalid rules are already structural issues. */
  }
  function verifyDesignation(value: string, label: string) {
    if (value.trim() && designationRule && (value.length > 128 || !designationRule.test(value)))
      issues.push(`${label}: designation does not match the enterprise numbering rule.`);
  }
  if (!project.name.trim()) issues.push('The project needs a name.');
  if (!project.designation.trim()) issues.push('The project needs a designation.');
  if (!project.revision.trim()) issues.push('The project needs a revision.');
  verifyDesignation(project.designation, project.name);
  if (!project.occurrences.length) issues.push('The project has no products.');
  const used = new Set(project.occurrences.map((occurrence) => occurrence.configurationId));
  for (const configuration of project.configurations.filter((item) => used.has(item.id))) {
    const label = configuration.designation || configuration.name;
    const part = parts.find((item) => item.id === configuration.libraryId);
    if (!part) continue;
    if (!configuration.designation.trim()) issues.push(`${label}: designation is missing.`);
    if (!configuration.name.trim()) issues.push(`${label}: name is missing.`);
    if (!configuration.revision.trim()) issues.push(`${label}: revision is missing.`);
    verifyDesignation(configuration.designation, label);
    if (configuration.supply === 'reference')
      issues.push(
        `${label}: reference geometry cannot be released for procurement or manufacture.`,
      );
    if (configuration.supply === 'manufactured') {
      const definition = configuration.manufacturing;
      const assembled = ['assembly', 'complex', 'kit'].includes(part.product.kind);
      if (!assembled && !definition?.material.trim()) issues.push(`${label}: material is missing.`);
      if (!assembled && !definition?.blank.trim())
        issues.push(`${label}: blank or stock specification is missing.`);
      if (!definition?.processes.length) issues.push(`${label}: manufacturing route is missing.`);
      if (
        !definition?.requirements.length ||
        definition.requirements.some((value) => !value.trim())
      )
        issues.push(`${label}: manufacturing and inspection requirements are missing.`);
      const drawings = project.documents.filter(
        (document) => document.configurationId === configuration.id && document.file.trim(),
      );
      const required = [
        ...new Set([
          ...(assembled ? ['assembly-drawing', 'specification'] : ['drawing']),
          ...project.documentationRules.requiredDocuments,
        ]),
      ];
      for (const kind of required)
        if (!drawings.some((document) => document.kind === kind))
          issues.push(`${label}: ${kind.replaceAll('-', ' ')} record is missing.`);
    }
    if (configuration.supply === 'standard' || configuration.supply === 'purchased') {
      if (!configuration.procurement?.designation.trim())
        issues.push(`${label}: supplier designation is missing.`);
      if (!configuration.procurement?.manufacturer.trim())
        issues.push(`${label}: manufacturer is missing.`);
      if (!configuration.procurement?.source.trim())
        issues.push(`${label}: purchasing source is missing.`);
      if (configuration.supply === 'standard' && !configuration.procurement?.standard?.trim())
        issues.push(`${label}: product standard is missing.`);
    }
    reviewRequirements.push(...part.product.releaseRequirements.map((item) => `${label}: ${item}`));
    if (part.composition && !['purchased', 'standard'].includes(configuration.supply)) {
      try {
        issues.push(
          ...part.composition(configuration.parameters).issues.map((item) => `${label}: ${item}`),
        );
      } catch (error) {
        issues.push(`${label}: composition could not be resolved: ${String(error)}`);
      }
    }
  }
  for (const document of project.documents) {
    verifyDesignation(document.designation, document.name || 'Document');
    if (
      !document.designation.trim() ||
      !document.name.trim() ||
      !document.revision.trim() ||
      !document.format.trim() ||
      !document.file.trim()
    )
      issues.push(
        `${document.name || 'Document'}: designation, name, revision, format and file are required.`,
      );
  }
  return {
    complete: !issues.length,
    issues: [...new Set(issues)],
    reviewRequirements: [...new Set(reviewRequirements)],
  };
}

export function specificationRows(
  project: DesignProject,
  parts: readonly PartDefinition[],
  parentId: string | null = null,
): SpecificationRow[] {
  const errors = validateProject(project, parts);
  if (errors.length) throw new Error(errors.join(' '));
  const rows: SpecificationRow[] = [];
  const parent = project.occurrences.find((item) => item.id === parentId);
  if (parentId !== null && !parent) throw new Error('Unknown assembly specification.');
  if (parent)
    for (const document of project.documents.filter(
      (item) => item.configurationId === parent.configurationId,
    ))
      rows.push({
        section: 'documents',
        position: '',
        designation: document.designation,
        name: document.name,
        revision: document.revision,
        quantity: '',
        format: document.format,
        notes: document.file,
      });
  for (const occurrence of project.occurrences.filter((item) => item.parentId === parentId)) {
    const configuration = project.configurations.find(
      (item) => item.id === occurrence.configurationId,
    )!;
    const part = parts.find((item) => item.id === configuration.libraryId)!;
    if (configuration.supply === 'reference') continue;
    rows.push({
      section: specificationSection(part, configuration.supply),
      position: occurrence.position,
      designation: configuration.designation,
      name: configuration.name,
      revision: configuration.revision,
      quantity: occurrence.quantity,
      format: '',
      notes: occurrence.notes,
      configurationId: configuration.id,
    });
  }
  return rows.sort(
    (a, b) =>
      project.documentationRules.sectionOrder.indexOf(a.section) -
        project.documentationRules.sectionOrder.indexOf(b.section) ||
      a.position.localeCompare(b.position, 'en', { numeric: true }),
  );
}

/** Procurement stops at a bought assembly: its internal parts are already supplied. */
export function supplyRows(
  project: DesignProject,
  parts: readonly PartDefinition[],
  supply: 'manufactured' | 'purchased',
): SpecificationRow[] {
  const errors = validateProject(project, parts);
  if (errors.length) throw new Error(errors.join(' '));
  const totals = new Map<string, number>();
  function visit(parentId: string | null, multiplier: number) {
    for (const occurrence of project.occurrences.filter((item) => item.parentId === parentId)) {
      const configuration = project.configurations.find(
        (item) => item.id === occurrence.configurationId,
      )!;
      const quantity = multiplier * occurrence.quantity;
      if (!Number.isSafeInteger(quantity))
        throw new Error('Multiplied project quantity exceeds the safe integer range.');
      const bought = ['standard', 'purchased'].includes(configuration.supply);
      if (supply === 'manufactured' ? configuration.supply === 'manufactured' : bought) {
        const total = (totals.get(configuration.id) ?? 0) + quantity;
        if (!Number.isSafeInteger(total))
          throw new Error('Aggregated project quantity exceeds the safe integer range.');
        totals.set(configuration.id, total);
      }
      if (!bought) visit(occurrence.id, quantity);
    }
  }
  visit(null, 1);
  return [...totals]
    .map(([id, quantity]) => {
      const configuration = project.configurations.find((item) => item.id === id)!;
      const part = parts.find((item) => item.id === configuration.libraryId)!;
      const notes =
        supply === 'manufactured'
          ? [
              configuration.manufacturing?.material,
              configuration.manufacturing?.blank,
              configuration.manufacturing?.processes.join(' / '),
              configuration.manufacturing?.requirements.join('; '),
            ]
              .filter(Boolean)
              .join(' | ')
          : [
              configuration.procurement?.manufacturer,
              configuration.procurement?.designation,
              configuration.procurement?.standard,
              configuration.procurement?.source,
            ]
              .filter(Boolean)
              .join(' | ');
      return {
        section: specificationSection(part, configuration.supply),
        position: '',
        designation: configuration.designation,
        name: configuration.name,
        revision: configuration.revision,
        quantity,
        format: '',
        notes,
        configurationId: id,
      };
    })
    .sort(
      (a, b) =>
        a.designation.localeCompare(b.designation, 'en', { numeric: true }) ||
        a.name.localeCompare(b.name),
    );
}

export function specificationCsv(
  rows: readonly SpecificationRow[],
  rules?: DocumentationRules,
): string {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    '\uFEFF' +
    [
      ['Section', 'Format', 'Position', 'Designation', 'Name', 'Revision', 'Quantity', 'Notes'],
      ...rows.map((row) => [
        rules?.sectionLabels[row.section] ?? row.section,
        row.format,
        row.position,
        row.designation,
        row.name,
        row.revision,
        row.quantity,
        row.notes,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n') +
    '\r\n'
  );
}

export function serializeProject(project: DesignProject, parts: readonly PartDefinition[]): string {
  const errors = validateProject(project, parts);
  if (errors.length) throw new Error(errors.join(' '));
  return JSON.stringify(project, null, 2) + '\n';
}

function object(
  value: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a project record.');
  const record = value as Record<string, unknown>;
  if (
    required.some((key) => !Object.hasOwn(record, key)) ||
    Object.keys(record).some((key) => !required.includes(key) && !optional.includes(key))
  )
    throw new Error('Project records contain missing or unsupported fields.');
  return record;
}
function strings(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys)
    if (typeof record[key] !== 'string') throw new Error(`Project field ${key} must be text.`);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a project list.');
  return value;
}
function choice(value: unknown, values: readonly string[]) {
  if (typeof value !== 'string' || !values.includes(value))
    throw new Error(`Unsupported project value: ${String(value)}.`);
}

/** Only the current schema is accepted; malformed projects never become partial imports. */
export function parseProject(text: string, parts: readonly PartDefinition[]): DesignProject {
  if (text.length > 10_000_000) throw new Error('Choose a project JSON file smaller than 10 MB.');
  const project = object(JSON.parse(text), [
    'schemaVersion',
    'id',
    'name',
    'designation',
    'revision',
    'documentationPolicy',
    'documentationRules',
    'configurations',
    'occurrences',
    'documents',
  ]);
  if (project.schemaVersion !== 1) throw new Error('Unsupported engineering project schema.');
  strings(project, ['id', 'name', 'designation', 'revision']);
  choice(project.documentationPolicy, ['enterprise-eskd', 'dstu-eskd', 'gost-eskd']);
  const rules = object(project.documentationRules, [
    'sectionOrder',
    'sectionLabels',
    'designationPattern',
    'requiredDocuments',
  ]);
  strings(rules, ['designationPattern']);
  for (const section of array(rules.sectionOrder)) choice(section, sections);
  const labels = object(rules.sectionLabels, sections);
  strings(labels, sections);
  for (const kind of array(rules.requiredDocuments)) choice(kind, documentKinds);
  for (const value of array(project.configurations)) {
    const item = object(
      value,
      ['id', 'libraryId', 'parameters', 'state', 'designation', 'name', 'revision', 'supply'],
      ['presetId', 'manufacturing', 'procurement'],
    );
    strings(item, ['id', 'libraryId', 'state', 'designation', 'name', 'revision']);
    if (item.presetId !== undefined) strings(item, ['presetId']);
    choice(item.supply, ['manufactured', 'standard', 'purchased', 'reference']);
    if (!item.parameters || typeof item.parameters !== 'object' || Array.isArray(item.parameters))
      throw new Error('Product parameters must be a record.');
    if (
      Object.values(item.parameters).some(
        (entry) =>
          !['string', 'number', 'boolean'].includes(typeof entry) ||
          (typeof entry === 'number' && !Number.isFinite(entry)),
      )
    )
      throw new Error('Product parameters must be finite primitive values.');
    if (item.manufacturing !== undefined) {
      const definition = object(item.manufacturing, [
        'material',
        'blank',
        'processes',
        'requirements',
      ]);
      strings(definition, ['material', 'blank']);
      for (const process of array(definition.processes)) choice(process, processes);
      if (array(definition.requirements).some((entry) => typeof entry !== 'string'))
        throw new Error('Manufacturing requirements must be text.');
    }
    if (item.procurement !== undefined) {
      const definition = object(
        item.procurement,
        ['designation', 'manufacturer', 'source'],
        ['standard'],
      );
      strings(definition, ['designation', 'manufacturer', 'source']);
      if (definition.standard !== undefined) strings(definition, ['standard']);
    }
  }
  for (const value of array(project.occurrences)) {
    const item = object(value, [
      'id',
      'parentId',
      'configurationId',
      'position',
      'quantity',
      'placement',
      'notes',
    ]);
    strings(item, ['id', 'configurationId', 'position', 'notes']);
    if (item.parentId !== null && typeof item.parentId !== 'string')
      throw new Error('Parent occurrence must be an ID or null.');
    if (typeof item.quantity !== 'number') throw new Error('Occurrence quantity must be numeric.');
    const placement = object(item.placement, ['translation', 'rotation']);
    for (const coordinates of [placement.translation, placement.rotation])
      if (
        array(coordinates).length !== 3 ||
        (coordinates as unknown[]).some(
          (entry) => typeof entry !== 'number' || !Number.isFinite(entry),
        )
      )
        throw new Error('Placements require three finite coordinates.');
  }
  for (const value of array(project.documents)) {
    const item = object(value, [
      'id',
      'configurationId',
      'designation',
      'name',
      'kind',
      'revision',
      'format',
      'file',
    ]);
    strings(item, ['id', 'configurationId', 'designation', 'name', 'revision', 'format', 'file']);
    choice(item.kind, [
      'drawing',
      'assembly-drawing',
      'specification',
      'model',
      'instructions',
      'other',
    ]);
  }
  const result = project as unknown as DesignProject;
  // Saved ST3215 units predate the optional reworked-disc installation.
  // Upgrade that known interface explicitly; other missing fields still fail validation.
  for (const configuration of result.configurations)
    if (
      configuration.libraryId === 'bus-servo' &&
      configuration.parameters.model === 'st3215-12v' &&
      !Object.hasOwn(configuration.parameters, 'hornMount')
    )
      configuration.parameters.hornMount = 'original';
  const errors = validateProject(result, parts);
  if (errors.length) throw new Error(errors.join(' '));
  return result;
}

export function createDocument(configuration: ProductConfiguration): DesignDocument {
  return {
    id: identity('document'),
    configurationId: configuration.id,
    designation: '',
    name: '',
    kind: 'drawing',
    revision: configuration.revision,
    format: 'A4',
    file: '',
  };
}

export const manufacturingProcesses = processes;
export const specificationSections = sections;
export const designDocumentKinds = documentKinds;
