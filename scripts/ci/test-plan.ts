import { execFile, spawn } from 'node:child_process';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import {
  extraTestInputs,
  generatedReadTests,
  pythonTestInputs,
  registryManifestOwners,
  registryTestOwners,
} from './test-ownership';

const execute = promisify(execFile);
const registry = 'src/parts/index.ts';
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;
const partId = (file: string) => /^src\/parts\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\//.exec(file)?.[1];
const partDocument = (file: string) => /^src\/parts\/[^/]+\/(?:README|GUIDE)\.md$/.test(file);
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
const testFile = (file: string) => /^tests\/.+\.test\.ts$/.test(file);
const pythonTest = (file: string) => /^tests\/(?:test_[^/]+\.py|[^/]+\.test\.py)$/.test(file);
const genericTest = (file: string) => /^tests\/parts-catalog-[1-8]\.test\.ts$/.test(file);
const operationalTest = (file: string) => /^tests\/ci-[^/]+\.test\.ts$/.test(file);
const operationalInput = (file: string) =>
  file.startsWith('scripts/ci/') ||
  file.startsWith('.github/workflows/') ||
  operationalTest(file) ||
  [
    'scripts/ci-test-key.mjs',
    'tests/helpers/part-scope.ts',
    'tests/part-scope.test.ts',
    'package.json',
  ].includes(file) ||
  /^tsconfig[^/]*\.json$/.test(file);
const posix = path.posix;

export interface TestPlan {
  mode: 'affected' | 'full';
  reason: string;
  changedFiles: string[];
  affectedParts: string[];
  tests: string[];
  pythonTests: string[];
  packageIds: string[];
}
export interface PlanOptions {
  root: string;
  base?: string;
  head?: string;
  full?: boolean;
}
interface FileEntry {
  oid: string;
  mode: string;
}
interface Snapshot {
  files: Map<string, FileEntry>;
  text: Map<string, string>;
  ids: Set<string>;
}
interface NodeInputs {
  edges: Set<string>;
  registry: boolean;
  unknown: boolean;
}
interface Analysis {
  snapshot: Snapshot;
  nodes: Map<string, NodeInputs>;
  parts: Map<string, Set<string>>;
}

async function git(root: string, args: string[]) {
  return (await execute('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 })).stdout;
}

async function blobs(root: string, oids: string[], cache: Map<string, string>) {
  const missing = oids.filter((id) => !cache.has(id));
  if (!missing.length) return;
  const output = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [],
      errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(Buffer.concat(errors).toString())),
    );
    child.stdin.on('error', reject);
    child.stdin.end(`${missing.join('\n')}\n`);
  });
  let offset = 0;
  for (const oid of missing) {
    const end = output.indexOf(10, offset);
    const header = output.subarray(offset, end).toString();
    const match = /^([a-f0-9]+) blob (\d+)$/.exec(header);
    if (!match || match[1] !== oid) throw new Error(`Cannot read Git blob ${oid}.`);
    const size = Number(match[2]);
    cache.set(oid, output.subarray(end + 1, end + 1 + size).toString('utf8'));
    offset = end + 1 + size + 1;
  }
}

async function snapshot(root: string, ref: string, cache: Map<string, string>): Promise<Snapshot> {
  const files = new Map<string, FileEntry>();
  for (const record of (await git(root, ['ls-tree', '-r', '-z', '--full-tree', ref])).split('\0')) {
    if (!record) continue;
    const match = /^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/.exec(record);
    if (match) files.set(match[3], { mode: match[1], oid: match[2] });
  }
  const inputs = [...files].filter(
    ([file, entry]) =>
      entry.mode !== '120000' &&
      (sourceExtension.test(file) ||
        /(?:^|\/)(?:product|presets)\.json$/.test(file) ||
        file === 'package.json' ||
        /^tsconfig[^/]*\.json$/.test(file) ||
        file.startsWith('.github/workflows/') ||
        Object.values(registryManifestOwners).some((owner) => owner.file === file)),
  );
  await blobs(root, sorted(inputs.map(([, entry]) => entry.oid)), cache);
  return {
    files,
    text: new Map(inputs.map(([file, entry]) => [file, cache.get(entry.oid)!])),
    ids: new Set(
      [...files.keys()].flatMap((file) => /^src\/parts\/([^/]+)\/index\.ts$/.exec(file)?.[1] ?? []),
    ),
  };
}

function resolveFile(
  file: string,
  value: string,
  snapshot_: Snapshot,
  relative = true,
): string | undefined {
  const clean = value.replace(/[?#].*$/, '');
  const normalized = posix.normalize(relative ? posix.join(posix.dirname(file), clean) : clean);
  if (normalized.startsWith('../') || posix.isAbsolute(normalized)) return;
  const withoutJs = normalized.replace(/\.[cm]?jsx?$/, '');
  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.json`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
  ];
  return candidates.find((candidate) => snapshot_.files.has(candidate));
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  )
    expression = expression.expression;
  return expression;
}

function wildcard(pattern: string) {
  return new RegExp(
    `^${pattern
      .split('**')
      .map((piece) =>
        piece
          .split('*')
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]*'),
      )
      .join('.*')}$`,
  );
}

function analyze(snapshot_: Snapshot): Analysis {
  const nodes = new Map<string, NodeInputs>();
  const parts = new Map([...snapshot_.ids].map((id) => [id, new Set<string>()]));
  for (const [file, text] of snapshot_.text) {
    const input: NodeInputs = { edges: new Set(), registry: false, unknown: false };
    nodes.set(file, input);
    // The generated registry is a semantic boundary, never a path to all geometry.
    if (file === registry) continue;
    if (!sourceExtension.test(file)) {
      for (const match of text.matchAll(/["']\/?(references\/[^'"\s?#]+)["']/g))
        if (snapshot_.files.has(`public/${match[1]}`)) input.edges.add(`public/${match[1]}`);
      continue;
    }
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const declaredOwners = registryTestOwners[file];
    const templateOwners = new Set(declaredOwners === 'all' ? [] : (declaredOwners ?? []));
    const manifestOwner = registryManifestOwners[file];
    if (manifestOwner) {
      try {
        for (const row of JSON.parse(snapshot_.text.get(manifestOwner.file) ?? '{}')[
          manifestOwner.property
        ] ?? [])
          if (typeof row.id === 'string') templateOwners.add(row.id);
      } catch {
        /* The registry selection below safely broadens an invalid manifest. */
      }
    }
    const bindings = new Map<string, ts.Expression>();
    const readNames = new Set(['readFile', 'readFileSync', 'readdir', 'readdirSync']);
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier) ||
        !/^(?:node:)?fs(?:\/promises)?$/.test(statement.moduleSpecifier.text)
      )
        continue;
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamedImports(named))
        for (const item of named.elements)
          if (readNames.has((item.propertyName ?? item.name).text)) readNames.add(item.name.text);
    }
    function bind(node: ts.Node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        !bindings.has(node.name.text)
      )
        bindings.set(node.name.text, node.initializer);
      ts.forEachChild(node, bind);
    }
    bind(source);
    // A * denotes an unknown fragment, so template fixture names still retain edges.
    function stringPattern(
      expression: ts.Expression,
      seen = new Set<string>(),
    ): string | undefined {
      const node = unwrap(expression);
      if (ts.isStringLiteralLike(node)) return node.text;
      if (ts.isIdentifier(node) && !seen.has(node.text)) {
        const bound = bindings.get(node.text);
        return bound ? stringPattern(bound, new Set([...seen, node.text])) : undefined;
      }
      if (ts.isTemplateExpression(node))
        return (
          node.head.text +
          node.templateSpans
            .map((span) => (stringPattern(span.expression, seen) ?? '**') + span.literal.text)
            .join('')
        );
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = stringPattern(node.left, seen),
          right = stringPattern(node.right, seen);
        return left || right ? `${left ?? '**'}${right ?? '**'}` : undefined;
      }
      if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && node.arguments?.length) {
        const name = node.expression.getText(source).split('.').at(-1);
        if (['URL', 'fileURLToPath'].includes(name!)) return stringPattern(node.arguments[0], seen);
        if (['join', 'resolve'].includes(name!))
          return node.arguments.map((arg) => stringPattern(arg, seen) ?? '**').join('/');
      }
      return;
    }
    function addPath(value: string, fromUrl = false): boolean {
      if (/^(?:https?:|node:|data:|#)/.test(value)) return true;
      if (value.startsWith('/references/')) value = `public${value}`;
      if (posix.isAbsolute(value)) return true; // installed runtimes and temporary outputs are not Git inputs
      // An unknown caller-supplied root is not a repository-wide glob. Keep it
      // unresolved so the consumer's explicit ownership (or broad fallback) applies.
      if (value.startsWith('*')) return false;
      const candidates = sorted([
        posix.normalize(value),
        posix.normalize(posix.join(posix.dirname(file), value)),
      ]);
      if (value.includes('*')) {
        let matched = false;
        for (const candidate of candidates) {
          const pattern = wildcard(candidate);
          for (const target of snapshot_.files.keys())
            if (pattern.test(target)) {
              const targetOwner = partId(target);
              if (templateOwners.size && targetOwner && !templateOwners.has(targetOwner)) continue;
              input.edges.add(target);
              matched = true;
            }
        }
        // A meaningful static prefix may point exclusively at generated outputs.
        return matched || /^(?:test-results|\.\/test-results|\.\.\/test-results)\//.test(value);
      }
      const resolved =
        resolveFile(file, value, snapshot_, fromUrl || value.startsWith('.')) ??
        resolveFile(file, value, snapshot_, false);
      if (resolved) {
        input.edges.add(resolved);
        return true;
      }
      for (const candidate of candidates) {
        const prefix = `${candidate.replace(/\/$/, '')}/`;
        for (const target of snapshot_.files.keys())
          if (target.startsWith(prefix)) input.edges.add(target);
        if ([...snapshot_.files.keys()].some((target) => target.startsWith(prefix))) return true;
      }
      return /^(?:test-results|\.\/test-results|\.\.\/test-results)\//.test(value);
    }
    function addImport(expression: ts.Expression) {
      const value = stringPattern(expression);
      if (value && !value.includes('*') && !value.startsWith('.')) return; // external package
      if (!value) {
        input.unknown = true;
        return;
      }
      if (value.includes('*')) {
        if (!addPath(value)) input.unknown = true;
        return;
      }
      const target = resolveFile(file, value, snapshot_);
      if (target === registry && file !== 'tests/helpers/part-scope.ts') input.registry = true;
      if (target) input.edges.add(target);
      else input.unknown = true;
    }
    function visit(node: ts.Node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        addImport(node.moduleSpecifier);
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression
      )
        addImport(node.moduleReference.expression);
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source).split('.').at(-1);
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || name === 'require') {
          if (node.arguments[0]) addImport(node.arguments[0]);
          else input.unknown = true;
        } else if (readNames.has(name!)) {
          const value = node.arguments[0] && stringPattern(node.arguments[0]);
          if (!value || !addPath(value)) input.unknown = true;
        }
      }
      if (
        ts.isNewExpression(node) &&
        node.expression.getText(source) === 'URL' &&
        node.arguments?.[1]?.getText(source) === 'import.meta.url'
      ) {
        const value = stringPattern(node.arguments[0]);
        if (!value || !addPath(value, true)) input.unknown = true;
      }
      if (ts.isStringLiteralLike(node) && /^\/?references\//.test(node.text))
        addPath(`public/${node.text.replace(/^\//, '')}`);
      ts.forEachChild(node, visit);
    }
    visit(source);
    const owner = partId(file);
    if (owner && file === `src/parts/${owner}/index.ts`) {
      function dependencyNode(expression: ts.Expression): ts.Expression {
        const node = unwrap(expression);
        return ts.isIdentifier(node) && bindings.has(node.text)
          ? dependencyNode(bindings.get(node.text)!)
          : node;
      }
      function dependencies(node: ts.Node) {
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(source).replace(/['"]/g, '') === 'dependencies'
        ) {
          const array = dependencyNode(node.initializer);
          if (ts.isArrayLiteralExpression(array) && array.elements.every(ts.isStringLiteralLike))
            for (const item of array.elements)
              parts.get(owner!)?.add((item as ts.StringLiteral).text);
          else throw new Error(`Nonliteral part dependencies in ${file}.`);
        }
        ts.forEachChild(node, dependencies);
      }
      dependencies(source);
    }
  }
  for (const [file, input] of nodes) {
    const owner = partId(file);
    if (owner)
      for (const dependency of input.edges) {
        const other = partId(dependency);
        if (other && other !== owner) parts.get(owner)?.add(other);
      }
  }
  return { snapshot: snapshot_, nodes, parts };
}

function closure(
  analysis: Analysis,
  starts: Iterable<string>,
): { files: Set<string>; registry: boolean; unknown: boolean } {
  const files = new Set<string>(),
    pending = [...starts];
  let usesRegistry = false,
    unknown = false;
  while (pending.length) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const node = analysis.nodes.get(file);
    if (!node || file === registry) continue;
    usesRegistry ||= node.registry;
    unknown ||= node.unknown;
    pending.push(...node.edges);
  }
  return { files, registry: usesRegistry, unknown };
}

function sameJson(
  left: string | undefined,
  right: string | undefined,
  clean: (value: Record<string, unknown>) => unknown,
) {
  if (left === undefined || right === undefined) return left === right;
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, stable(child)]),
          )
        : value;
  try {
    return (
      JSON.stringify(stable(clean(ts.parseConfigFileTextToJson('input.json', left).config))) ===
      JSON.stringify(stable(clean(ts.parseConfigFileTextToJson('input.json', right).config)))
    );
  } catch {
    return false;
  }
}

/** Recognize only the scope adapter around an otherwise identical contract loop.
 * An assertion, shard expression, or geometry-body edit never qualifies. */
export function isScopeOnlyContractChange(before: string | undefined, after: string | undefined) {
  if (!before || !after) return false;
  const printer = ts.createPrinter({ removeComments: true });
  function normalized(text: string) {
    const source = ts.createSourceFile('contract.ts', text, ts.ScriptTarget.Latest, true);
    const statements: ts.Statement[] = [];
    for (const statement of source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === './part-scope'
      ) {
        const names = statement.importClause?.namedBindings;
        if (
          names &&
          ts.isNamedImports(names) &&
          names.elements.length === 1 &&
          names.elements[0].name.text === 'affectedParts' &&
          !names.elements[0].propertyName
        )
          continue;
        return;
      }
      if (
        !ts.isFunctionDeclaration(statement) ||
        statement.name?.text !== 'registerPartContractTests'
      ) {
        statements.push(statement);
        continue;
      }
      if (!statement.body || statement.parameters.length < 1 || statement.parameters.length > 2)
        return;
      const injected = statement.parameters[1];
      if (
        injected &&
        (!ts.isIdentifier(injected.name) ||
          injected.name.text !== 'definitions' ||
          injected.initializer?.getText(source) !== 'parts')
      )
        return;
      const body = [...statement.body.statements];
      const loop = body.pop();
      if (!loop || !ts.isForOfStatement(loop) || loop.awaitModifier) return;
      let expression = loop.expression;
      if (
        ts.isCallExpression(expression) &&
        expression.expression.getText(source) === 'affectedParts'
      ) {
        if (
          expression.arguments.length !== 1 ||
          expression.arguments[0].getText(source) !== 'assigned'
        )
          return;
        const temporary = body.pop();
        if (
          !temporary ||
          !ts.isVariableStatement(temporary) ||
          !(temporary.declarationList.flags & ts.NodeFlags.Const) ||
          temporary.declarationList.declarations.length !== 1
        )
          return;
        const declaration = temporary.declarationList.declarations[0];
        if (declaration.name.getText(source) !== 'assigned' || !declaration.initializer) return;
        expression = declaration.initializer;
      }
      const transformed = ts.transform(expression, [
        (context) => {
          const visit: ts.Visitor = (node) =>
            injected && ts.isIdentifier(node) && node.text === 'definitions'
              ? ts.factory.createIdentifier('parts')
              : ts.visitEachChild(node, visit, context);
          return (node) => ts.visitNode(node, visit) as ts.Expression;
        },
      ]);
      const selection = transformed.transformed[0];
      if (
        !ts.isCallExpression(selection) ||
        !ts.isPropertyAccessExpression(selection.expression) ||
        !ts.isIdentifier(selection.expression.expression) ||
        selection.expression.expression.text !== 'parts' ||
        selection.expression.name.text !== 'filter'
      ) {
        transformed.dispose();
        return;
      }
      const canonicalLoop = ts.factory.updateForOfStatement(
        loop,
        undefined,
        loop.initializer,
        selection,
        loop.statement,
      );
      statements.push(
        ts.factory.updateFunctionDeclaration(
          statement,
          statement.modifiers,
          statement.asteriskToken,
          statement.name,
          statement.typeParameters,
          [statement.parameters[0]],
          statement.type,
          ts.factory.updateBlock(statement.body, [...body, canonicalLoop]),
        ),
      );
      transformed.dispose();
    }
    return printer.printFile(ts.factory.updateSourceFile(source, statements));
  }
  const left = normalized(before),
    right = normalized(after);
  return left !== undefined && left === right;
}

/** Compare full/default execution after removing only the known scope adapters.
 * Every assertion, source check, inventory guard, body and selector remains exact. */
export function isScopeOnlyTestChange(
  before: string | undefined,
  after: string | undefined,
  legacyExpansion = false,
) {
  if (!before || !after) return false;
  const importsScope = (text: string) =>
    ts
      .createSourceFile('scope.ts', text, ts.ScriptTarget.Latest, true)
      .statements.some(
        (statement) =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === './helpers/part-scope',
      );
  // Only adoption is operational; later guard/argument edits are real test changes.
  if (importsScope(before) || !importsScope(after)) return false;
  function normalized(text: string) {
    const source = ts.createSourceFile('scoped-test.ts', text, ts.ScriptTarget.Latest, true);
    const helpers = new Set<string>();
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== './helpers/part-scope' ||
        statement.importClause?.name
      )
        continue;
      const names = statement.importClause?.namedBindings;
      if (
        names &&
        ts.isNamedImports(names) &&
        names.elements.every(
          (name) =>
            !name.propertyName && ['affectedParts', 'partIsAffected'].includes(name.name.text),
        )
      )
        for (const name of names.elements) helpers.add(name.name.text);
    }
    const compact = (node: ts.Node) => node.getText(source).replace(/\s+/g, '');
    const pure = (node: ts.Expression): boolean =>
      ts.isIdentifier(node) ||
      ts.isStringLiteral(node) ||
      (ts.isPropertyAccessExpression(node) && pure(node.expression));
    const scopeCall = (node: ts.Expression): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'partIsAffected' &&
      helpers.has('partIsAffected') &&
      node.arguments.length === 1 &&
      pure(node.arguments[0]);
    const negated = (node: ts.Expression) =>
      ts.isPrefixUnaryExpression(unwrap(node)) &&
      (unwrap(node) as ts.PrefixUnaryExpression).operator === ts.SyntaxKind.ExclamationToken &&
      scopeCall((unwrap(node) as ts.PrefixUnaryExpression).operand);
    const transformed = ts.transform(source, [
      (context) => {
        const visit: ts.Visitor = (node) => {
          if (
            ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier) &&
            node.moduleSpecifier.text === './helpers/part-scope' &&
            !node.importClause?.name
          ) {
            const names = node.importClause?.namedBindings;
            if (
              names &&
              ts.isNamedImports(names) &&
              names.elements.every((name) => !name.propertyName && helpers.has(name.name.text))
            )
              return undefined;
          }
          if (
            legacyExpansion &&
            ts.isVariableStatement(node) &&
            node.declarationList.declarations.length === 1
          ) {
            const declaration = node.declarationList.declarations[0];
            if (
              declaration.name.getText(source) === 'filter' &&
              declaration.initializer &&
              /^process\.env\.PART_FILTER\?\.split\((['"]),\1\)$/.test(
                compact(declaration.initializer),
              )
            )
              return undefined;
          }
          if (
            legacyExpansion &&
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
            compact(unwrap(node.right)) === '!filter||filter.includes(p.id)'
          )
            return ts.visitNode(node.left, visit);
          if (ts.isIfStatement(node) && !node.elseStatement && negated(node.expression)) {
            const branch =
              ts.isBlock(node.thenStatement) && node.thenStatement.statements.length === 1
                ? node.thenStatement.statements[0]
                : node.thenStatement;
            if (
              (ts.isReturnStatement(branch) && !branch.expression) ||
              (ts.isContinueStatement(branch) && !branch.label)
            )
              return undefined;
          }
          if (ts.isCallExpression(node)) {
            if (
              ts.isIdentifier(node.expression) &&
              node.expression.text === 'affectedParts' &&
              helpers.has('affectedParts') &&
              node.arguments.length === 1
            )
              return ts.visitNode(node.arguments[0], visit);
            if (
              ts.isPropertyAccessExpression(node.expression) &&
              node.expression.name.text === 'filter' &&
              node.arguments.length === 1 &&
              helpers.has('partIsAffected')
            ) {
              const callback = unwrap(node.arguments[0]);
              if (
                (ts.isIdentifier(callback) && callback.text === 'partIsAffected') ||
                (ts.isArrowFunction(callback) &&
                  !ts.isBlock(callback.body) &&
                  scopeCall(unwrap(callback.body)))
              ) {
                let receiver: ts.Expression = node.expression.expression;
                while (ts.isParenthesizedExpression(receiver)) receiver = receiver.expression;
                return ts.visitNode(receiver, visit);
              }
            }
            if (
              ts.isIdentifier(node.expression) &&
              node.expression.text === 'test' &&
              node.arguments.length === 3 &&
              ts.isObjectLiteralExpression(node.arguments[1])
            ) {
              const options = node.arguments[1];
              if (
                options.properties.length === 1 &&
                ts.isPropertyAssignment(options.properties[0]) &&
                options.properties[0].name.getText(source) === 'skip' &&
                negated(options.properties[0].initializer)
              )
                return ts.visitEachChild(
                  ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
                    node.arguments[0],
                    node.arguments[2],
                  ]),
                  visit,
                  context,
                );
            }
          }
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit) as ts.SourceFile;
      },
    ]);
    function structure(node: ts.Node): unknown {
      const scalars: unknown[] = [];
      if (
        ts.isIdentifier(node) ||
        ts.isLiteralExpression(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      )
        scalars.push(node.text);
      if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
        scalars.push(node.operator);
      if (ts.isVariableDeclarationList(node))
        scalars.push(
          node.flags &
            (ts.NodeFlags.Let | ts.NodeFlags.Const | ts.NodeFlags.Using | ts.NodeFlags.AwaitUsing),
        );
      if ('isTypeOnly' in node) scalars.push(node.isTypeOnly);
      if (ts.isExportAssignment(node)) scalars.push(node.isExportEquals);
      const children: unknown[] = [];
      ts.forEachChild(node, (child) => {
        children.push(structure(child));
      });
      return [node.kind, scalars, children];
    }
    const result = JSON.stringify(structure(transformed.transformed[0]));
    transformed.dispose();
    return result;
  }
  return normalized(before) === normalized(after);
}

function workflowRuntimes(text: string | undefined) {
  const lines = (text ?? '').split('\n'),
    fields: string[] = [];
  const normalize = (line: string) =>
    line
      .trim()
      .replace(/^-[ \t]*/, '')
      .replace(/:[ \t]+/, ':');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/\bsetup-node@/.test(line)) fields.push(normalize(line));
    const match =
      /^(\s*)(?:-[ \t]*)?(?:runs-on|container|node-version|node-version-file|node|architecture|arch|platform|os)\s*:/.exec(
        line,
      );
    if (!match) continue;
    const field = [normalize(line)],
      indentation = match[1].length;
    // Include mapping/list values, including container image/options and runner labels.
    for (let child = index + 1; child < lines.length; child++) {
      if (!lines[child].trim() || lines[child].trimStart().startsWith('#')) continue;
      if ((/^\s*/.exec(lines[child])?.[0].length ?? 0) <= indentation) break;
      field.push(normalize(lines[child]));
    }
    fields.push(field.join('\n'));
  }
  // Extra jobs with the same runtime do not change the execution environment.
  return sorted(fields);
}

function fullReason(changed: string[], before: Snapshot, after: Snapshot): string | undefined {
  for (const file of changed) {
    if (file.startsWith('src/core/')) return `Shared runtime changed: ${file}.`;
    if (
      [
        'package-lock.json',
        'npm-shrinkwrap.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '.nvmrc',
        '.node-version',
        '.npmrc',
      ].includes(file)
    )
      return `Dependencies or runtime changed: ${file}.`;
    if (
      file === 'package.json' &&
      !sameJson(before.text.get(file), after.text.get(file), (value) => {
        const {
          scripts: _scripts,
          description: _description,
          keywords: _keywords,
          ...semantic
        } = value;
        return semantic;
      })
    )
      return 'Package dependencies or runtime metadata changed.';
    if (
      /^tsconfig[^/]*\.json$/.test(file) &&
      !sameJson(before.text.get(file), after.text.get(file), (value) => {
        const options = value.compilerOptions as Record<string, unknown> | undefined;
        if (!options) return value;
        const { tsBuildInfoFile: _cache, ...semantic } = options;
        return { ...value, compilerOptions: semantic };
      })
    )
      return `TypeScript compiler semantics changed: ${file}.`;
    if (file.startsWith('.github/workflows/')) {
      if (
        JSON.stringify(workflowRuntimes(before.text.get(file))) !==
        JSON.stringify(workflowRuntimes(after.text.get(file)))
      )
        return `CI execution runtime or platform changed: ${file}.`;
    }
    if (before.files.get(file)?.mode === '120000' || after.files.get(file)?.mode === '120000')
      return `Changed symbolic-link input: ${file}.`;
  }
}

/** Plan from two immutable Git trees. The baseline must be a successful tested commit. */
export async function createTestPlan({
  root,
  base,
  head = 'HEAD',
  full = false,
}: PlanOptions): Promise<TestPlan> {
  const repository = await realpath(root);
  if (
    (await realpath((await git(repository, ['rev-parse', '--show-toplevel'])).trim())) !==
    repository
  )
    throw new Error('Run the test planner from the Git repository root.');
  const headSha = (await git(repository, ['rev-parse', '--verify', `${head}^{commit}`])).trim();
  const cache = new Map<string, string>();
  const after = await snapshot(repository, headSha, cache);
  const all = (reason: string, changedFiles: string[] = []): TestPlan => ({
    mode: 'full',
    reason,
    changedFiles,
    affectedParts: sorted(after.ids),
    tests: sorted([...after.files.keys()].filter(testFile)),
    pythonTests: sorted([...after.files.keys()].filter(pythonTest)),
    packageIds: sorted(after.ids),
  });
  if (full) return all('Complete test run explicitly requested.');
  if (!base) return all('No successful tested baseline is available.');
  let baseSha: string;
  try {
    baseSha = (await git(repository, ['rev-parse', '--verify', `${base}^{commit}`])).trim();
  } catch {
    return all('The successful baseline is unavailable in this checkout.');
  }
  let before: Snapshot;
  try {
    before = await snapshot(repository, baseSha, cache);
  } catch {
    return all('The successful baseline tree or its tracked inputs are unavailable.');
  }
  const records = (
    await git(repository, ['diff', '--name-status', '-z', '--find-renames', baseSha, headSha, '--'])
  ).split('\0');
  const changedSet = new Set<string>();
  for (let i = 0; i < records.length && records[i];) {
    const status = records[i++];
    changedSet.add(records[i++]);
    if (/^[RC]/.test(status)) changedSet.add(records[i++]);
  }
  const changedFiles = sorted(changedSet);
  const selectionOnlyInputs = new Set<string>();
  const contractHelper = 'tests/helpers/part-contract.ts';
  if (
    changedSet.has(contractHelper) &&
    isScopeOnlyContractChange(before.text.get(contractHelper), after.text.get(contractHelper))
  )
    selectionOnlyInputs.add(contractHelper);
  for (const file of changedFiles.filter(testFile))
    if (
      (registryTestOwners[file] !== undefined || registryManifestOwners[file]) &&
      isScopeOnlyTestChange(
        before.text.get(file),
        after.text.get(file),
        file === 'tests/library-expansion.test.ts',
      )
    )
      selectionOnlyInputs.add(file);
  const reason = fullReason(changedFiles, before, after);
  if (reason) return all(reason, changedFiles);
  for (const id of changedFiles.flatMap((file) => partId(file) ?? []))
    if (!after.ids.has(id) && [...after.files.keys()].some((file) => partId(file) === id))
      return all(`Part package ${id} has files but no analyzable index descriptor.`, changedFiles);
  let analyses: Analysis[];
  try {
    analyses = [analyze(before), analyze(after)];
  } catch (error) {
    return all(
      `Static dependency analysis could not prove a smaller scope: ${(error as Error).message}`,
      changedFiles,
    );
  }
  const affected = new Set(
    changedFiles.filter((file) => !partDocument(file)).flatMap((file) => partId(file) ?? []),
  );
  const reverse = new Map<string, Set<string>>();
  for (const analysis of analyses) {
    for (const [owner, dependencies] of analysis.parts)
      for (const dependency of dependencies) {
        if (!reverse.has(dependency)) reverse.set(dependency, new Set());
        reverse.get(dependency)!.add(owner);
      }
    // Package assets/references and source reached outside a package belong to that package.
    for (const id of analysis.snapshot.ids) {
      const files = closure(
        analysis,
        [...analysis.snapshot.files.keys()].filter(
          (file) => partId(file) === id && !partDocument(file),
        ),
      );
      if ([...files.files].some((file) => file !== registry && changedSet.has(file)))
        affected.add(id);
      if (files.unknown && changedFiles.some((file) => /^(?:src|data|public)\//.test(file)))
        affected.add(id);
    }
  }
  // A selected scoped test must receive owners in its environment even when only
  // that test, a helper, or a checked-in fixture changed. Otherwise it silently skips.
  const changedTestInputs = new Set(
    changedFiles.filter(
      (file) =>
        (!partId(file) || partDocument(file)) &&
        file !== registry &&
        !operationalInput(file) &&
        !selectionOnlyInputs.has(file),
    ),
  );
  for (const file of [...after.files.keys()].filter(testFile)) {
    for (const analysis of analyses) {
      const input = closure(analysis, [file]);
      if (![...input.files].some((dependency) => changedTestInputs.has(dependency))) continue;
      const owner = registryTestOwners[file];
      const manifest = registryManifestOwners[file];
      if (
        genericTest(file) ||
        file === 'tests/physical-library-composition.test.ts' ||
        (input.registry && owner === undefined && !manifest)
      ) {
        for (const id of after.ids) affected.add(id);
      } else if (owner !== 'all') {
        for (const id of owner ?? []) affected.add(id);
        if (manifest)
          for (const revision of analyses) {
            try {
              for (const row of JSON.parse(revision.snapshot.text.get(manifest.file) ?? '{}')[
                manifest.property
              ] ?? [])
                if (typeof row.id === 'string') affected.add(row.id);
            } catch {
              for (const id of after.ids) affected.add(id);
            }
          }
        for (const dependency of owner === undefined && !manifest ? input.files : []) {
          const id = partId(dependency);
          if (id) affected.add(id);
        }
      }
    }
  }
  const pending = [...affected];
  while (pending.length)
    for (const dependent of reverse.get(pending.pop()!) ?? [])
      if (!affected.has(dependent)) {
        affected.add(dependent);
        pending.push(dependent);
      }
  const affectedParts = sorted([...affected].filter((id) => after.ids.has(id)));
  const anyPart = affected.size > 0 || changedSet.has(registry);
  const operational = changedFiles.some(operationalInput);
  const potentiallyDynamicInputs = changedFiles.filter((file) => !operationalInput(file));
  const tests = new Set<string>();
  for (const file of [...after.files.keys()].filter(testFile)) {
    if (
      changedSet.has(file) ||
      (genericTest(file) && affectedParts.length) ||
      (operational && operationalTest(file))
    ) {
      tests.add(file);
      continue;
    }
    const owner = registryTestOwners[file];
    const owners = new Set(owner === 'all' ? [] : (owner ?? []));
    const manifest = registryManifestOwners[file];
    if (manifest)
      for (const analysis of analyses) {
        try {
          const rows = JSON.parse(analysis.snapshot.text.get(manifest.file) ?? '{}')[
            manifest.property
          ];
          if (!Array.isArray(rows)) throw new Error('Expected manifest array.');
          for (const row of rows) if (typeof row.id === 'string') owners.add(row.id);
        } catch {
          if (anyPart) tests.add(file);
        }
      }
    if (anyPart && (owner === 'all' || [...owners].some((id) => affected.has(id)))) tests.add(file);
    for (const analysis of analyses) {
      const input = closure(analysis, [file]);
      // Do not turn generated index changes into a family geometry rerun.
      if (
        [...input.files].some((dependency) => dependency !== registry && changedSet.has(dependency))
      )
        tests.add(file);
      if (
        [...input.files].some((dependency) => {
          const id = partId(dependency);
          return id !== undefined && affected.has(id);
        })
      )
        tests.add(file);
      if (input.registry && owner === undefined && !manifest && anyPart && !genericTest(file))
        tests.add(file);
      // Unknown dynamic file inputs need explicit ownership or a safe broad selection.
      if (
        input.unknown &&
        !generatedReadTests.has(file) &&
        owner === undefined &&
        !manifest &&
        potentiallyDynamicInputs.some((dependency) =>
          /^(?:src|tests|scripts|data|public|docs)\//.test(dependency),
        )
      )
        tests.add(file);
    }
    for (const pattern of extraTestInputs[file] ?? [])
      if (changedFiles.some((dependency) => wildcard(pattern).test(dependency))) tests.add(file);
  }
  const pythonTests = [...after.files.keys()].filter(pythonTest).filter(
    (file) =>
      changedSet.has(file) ||
      // Unknown ownership cannot prove that a changed fixture/data file is irrelevant.
      (!pythonTestInputs[file] && potentiallyDynamicInputs.length > 0) ||
      (pythonTestInputs[file] ?? []).some((pattern) =>
        changedFiles.some((input) => wildcard(pattern).test(input)),
      ) ||
      // Unmapped Python helpers must not silently drop a possible importer consumer.
      changedFiles.some(
        (input) =>
          input.endsWith('.py') &&
          !pythonTest(input) &&
          !Object.values(pythonTestInputs)
            .flat()
            .some((pattern) => wildcard(pattern).test(input)),
      ),
  );
  return {
    mode: 'affected',
    reason: changedFiles.length
      ? 'Selected tests from changed inputs and reverse part dependencies in both Git revisions.'
      : 'The successful baseline and target have identical inputs.',
    changedFiles,
    affectedParts,
    tests: sorted(tests),
    pythonTests: sorted(pythonTests),
    packageIds: sorted([
      ...affectedParts,
      ...changedFiles.flatMap((file) => {
        const id = partId(file);
        return id && after.ids.has(id) ? [id] : [];
      }),
    ]),
  };
}

async function main() {
  const args = process.argv.slice(2),
    options: Record<string, string> = {};
  let full = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--full' && !full) {
      full = true;
      continue;
    }
    if (!['--base', '--head', '--output'].includes(args[i]) || !args[i + 1] || options[args[i]])
      throw new Error(
        'Usage: test-plan.ts [--base <successful SHA>] [--head HEAD] [--full] --output <file>',
      );
    options[args[i++]] = args[i];
  }
  if (!options['--output']) throw new Error('--output is required.');
  const plan = await createTestPlan({
    root: process.cwd(),
    base: options['--base'],
    head: options['--head'],
    full,
  });
  const output = path.resolve(options['--output']);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(
    `${plan.mode}: ${plan.tests.length} TypeScript tests, ${plan.pythonTests.length} Python tests, ${plan.affectedParts.length} parts. ${plan.reason}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
