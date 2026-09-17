import { promises as fs } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PART_ID_PATTERN, PART_MODULE_API_VERSION } from '../../src/core/part-modules';

export const SDK_FILES = [
  'types.ts',
  'parameter-states.ts',
  'geometry.ts',
  'mechanical.ts',
  'solid-union.ts',
  'manufacturer-cad.ts',
  'part-modules.ts',
] as const;
export const REQUIRED_FILES = [
  'index.ts',
  'part.ts',
  'configurator.ts',
  'presets.json',
  'README.md',
] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']);
const inside = (root: string, file: string) =>
  file === root || file.startsWith(`${root}${path.sep}`);
const normalize = (value: string) => value.split(path.sep).join('/');

export interface PackageInspection {
  id: string;
  order: number;
  directory: string;
  files: string[];
  references: string[];
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Do not follow symlinks while inspecting or copying a handoff package. */
export async function packageFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(current: string) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error(`Package symlinks are not supported: ${path.join(current, entry.name)}`);
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) result.push(file);
      else throw new Error(`Unsupported package entry: ${file}`);
    }
  }
  if ((await fs.lstat(directory)).isSymbolicLink())
    throw new Error('The package directory cannot be a symlink.');
  await visit(directory);
  return result.sort();
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isSatisfiesExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  let result: ts.Expression | undefined;
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      property.name.getText().replace(/^['"]|['"]$/g, '') === name
    )
      result = property.initializer;
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name)
      result = property.name;
  }
  return result;
}

function staticDescriptor(source: ts.SourceFile): { id: string; order: number } {
  const bindings = new Map<string, ts.Expression>();
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          bindings.set(declaration.name.text, declaration.initializer);
  function resolve(expression: ts.Expression | undefined): ts.Expression | undefined {
    const visited = new Set<string>();
    while (expression) {
      expression = unwrap(expression);
      if (!ts.isIdentifier(expression)) return expression;
      if (visited.has(expression.text)) return undefined;
      visited.add(expression.text);
      expression = bindings.get(expression.text);
    }
    return undefined;
  }
  const assignment = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals,
  );
  const descriptor = resolve(assignment?.expression);
  if (!descriptor || !ts.isObjectLiteralExpression(descriptor))
    throw new Error('index.ts must default-export a PartModule object.');
  if (descriptor.properties.some(ts.isSpreadAssignment))
    throw new Error(
      'PartModule metadata must be explicit; do not spread another object into the module descriptor.',
    );
  const version = resolve(objectProperty(descriptor, 'apiVersion'));
  if (!version || !ts.isNumericLiteral(version) || Number(version.text) !== PART_MODULE_API_VERSION)
    throw new Error(`index.ts must declare literal apiVersion: ${PART_MODULE_API_VERSION}.`);
  const order = resolve(objectProperty(descriptor, 'order'));
  if (!order || !ts.isNumericLiteral(order) || !Number.isFinite(Number(order.text)))
    throw new Error('index.ts must declare a finite, nonnegative literal order.');
  const part = resolve(objectProperty(descriptor, 'part'));
  if (!part || !ts.isObjectLiteralExpression(part))
    throw new Error('index.ts must define its part object locally with an explicit id.');
  const id = resolve(objectProperty(part, 'id'));
  if (!id || !ts.isStringLiteral(id) || !PART_ID_PATTERN.test(id.text))
    throw new Error('index.ts part must declare a literal lowercase, hyphen-separated id.');
  const idPosition = part.properties.reduce(
    (last, property, index) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText().replace(/^['"]|['"]$/g, '') === 'id'
        ? index
        : last,
    -1,
  );
  if (part.properties.slice(idPosition + 1).some(ts.isSpreadAssignment))
    throw new Error(
      'Declare the explicit part id after object spreads so another object cannot override it.',
    );
  return { id: id.text, order: Number(order.text) };
}

function moduleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteral(node.moduleSpecifier))
        throw new Error('Module imports must use literal paths.');
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      specifiers.push(node.argument.literal.text);
    if (ts.isImportEqualsDeclaration(node))
      throw new Error('Use ESM imports inside a part package.');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteral(argument))
        throw new Error('Dynamic imports must use literal package-local paths.');
      specifiers.push(argument.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    )
      throw new Error('Use ESM imports inside a part package.');
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers;
}

async function resolveImport(file: string, specifier: string): Promise<string> {
  const base = path.resolve(path.dirname(file), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    path.join(base, 'index.ts'),
  ];
  if (base.endsWith('.js')) candidates.push(`${base.slice(0, -3)}.ts`);
  for (const candidate of candidates)
    if (await exists(candidate)) {
      const stat = await fs.lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error(`Imported files cannot be symlinks: ${candidate}`);
      if (stat.isFile()) return candidate;
    }
  throw new Error(`Cannot resolve ${specifier} from ${file}.`);
}

/** Static preflight deliberately never imports or evaluates a handed-off part. */
export async function inspectPackage(
  directory: string,
  projectRoot: string,
): Promise<PackageInspection> {
  directory = path.resolve(directory);
  projectRoot = path.resolve(projectRoot);
  const files = await packageFiles(directory);
  for (const name of REQUIRED_FILES)
    if (!files.includes(path.join(directory, name)))
      throw new Error(`Missing required package file: ${name}.`);
  const source = ts.createSourceFile(
    'index.ts',
    await fs.readFile(path.join(directory, 'index.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const descriptor = staticDescriptor(source);
  if (path.basename(directory) !== descriptor.id)
    throw new Error(`Folder ${path.basename(directory)} does not match part ID ${descriptor.id}.`);
  const sdk = new Set(SDK_FILES.map((name) => path.join(projectRoot, 'src/core', name)));
  const references = new Set<string>();
  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file)) && path.extname(file) !== '.json') continue;
    const content = await fs.readFile(file, 'utf8');
    if (path.extname(file) === '.json') {
      try {
        JSON.parse(content);
      } catch {
        throw new Error(`Invalid JSON: ${file}.`);
      }
    } else {
      const parsed = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
      const diagnostics = (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
        .parseDiagnostics;
      if (diagnostics.length)
        throw new Error(
          `${normalize(path.relative(directory, file))}: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, ' ')}`,
        );
      for (const specifier of moduleSpecifiers(parsed)) {
        if (
          specifier === 'three' ||
          specifier.startsWith('three/') ||
          specifier === '@jscad/modeling' ||
          specifier.startsWith('@jscad/modeling/')
        )
          continue;
        if (!specifier.startsWith('.'))
          throw new Error(
            `${normalize(path.relative(directory, file))}: unsupported dependency ${specifier}.`,
          );
        const imported = await resolveImport(file, specifier);
        if (!inside(directory, imported) && !sdk.has(imported))
          throw new Error(
            `${normalize(path.relative(directory, file))}: ${specifier} crosses the part boundary. Copy domain helpers into this package's lib folder.`,
          );
      }
    }
    for (const match of content.matchAll(/['"]\/?(references\/[^'"\s?#]+)['"]/g)) {
      const reference = match[1];
      if (reference.includes('..') || reference.includes('\\'))
        throw new Error(`Invalid local reference path: ${reference}.`);
      references.add(reference);
    }
  }
  const presets: unknown = JSON.parse(
    await fs.readFile(path.join(directory, 'presets.json'), 'utf8'),
  );
  if (!Array.isArray(presets)) throw new Error('presets.json must contain an array.');
  const presetIds = new Set<string>();
  for (const preset of presets) {
    if (
      !preset ||
      typeof preset.id !== 'string' ||
      presetIds.has(preset.id) ||
      !preset.parameters ||
      typeof preset.parameters !== 'object'
    )
      throw new Error('Every preset needs a unique id and a parameters object.');
    presetIds.add(preset.id);
  }
  return { ...descriptor, directory, files, references: [...references].sort() };
}

export async function discoverPackages(projectRoot: string): Promise<PackageInspection[]> {
  const directory = path.join(projectRoot, 'src/parts');
  const modules: PackageInspection[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Part folders cannot be symlinks: ${entry.name}.`);
    if (entry.isDirectory())
      modules.push(await inspectPackage(path.join(directory, entry.name), projectRoot));
  }
  if (!modules.length) throw new Error('No part packages were found in src/parts.');
  const ids = new Set<string>();
  for (const module of modules) {
    if (ids.has(module.id)) throw new Error(`Duplicate part module ID: ${module.id}.`);
    ids.add(module.id);
  }
  return modules.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function registrySource(packages: readonly Pick<PackageInspection, 'id'>[]): string {
  return `// Generated by npm run parts:sync. Add or remove a part folder instead of editing this file.\nimport { registerPartModules } from '../core/part-modules';\n${packages.map(({ id }, index) => `import module${index} from './${id}/index';`).join('\n')}\n\nexport const parts = registerPartModules([\n${packages.map((_, index) => `  module${index},`).join('\n')}\n]);\n`;
}

export async function syncRegistry(projectRoot: string): Promise<PackageInspection[]> {
  const packages = await discoverPackages(projectRoot);
  const file = path.join(projectRoot, 'src/parts/index.ts');
  const content = registrySource(packages);
  if (!(await exists(file)) || (await fs.readFile(file, 'utf8')) !== content)
    await fs.writeFile(file, content);
  return packages;
}

export async function copyPackage(source: PackageInspection, destination: string): Promise<void> {
  for (const file of source.files) {
    const target = path.join(destination, path.relative(source.directory, file));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }
}

export async function assertNewDestination(destination: string): Promise<void> {
  if (await exists(destination))
    throw new Error(`Destination already exists: ${destination}. Choose a new path.`);
}
