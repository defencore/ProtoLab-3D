import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addProduct, createProject } from '../src/core/design-project';
import { exportOpenEskd } from '../src/core/open-eskd';
import type { PartDefinition } from '../src/core/types';

export interface EskdProjectAuditRecord {
  id: string;
  kind: PartDefinition['product']['kind'];
  state: string;
  stage: 'addProduct' | 'exportOpenEskd' | 'complete';
  projectCreated?: boolean;
  configurations?: number;
  occurrences?: number;
  largestParameterBytes?: number;
  openEskdExported?: boolean;
  exportBytes?: number;
  error?: string;
  milliseconds: number;
}

export interface EskdProjectAuditReport {
  schemaVersion: 1;
  generatedAt: string;
  scope: string;
  totalFamilies: number;
  mechanisms: number;
  finished: boolean;
  projectPass: number;
  exportPass: number;
  verification: { source: string; geometryValidated: false; engineeringApproval: false };
  records: EskdProjectAuditRecord[];
}

/** Exercise each default physical assembly without generating or opening CAD files. */
export function auditEskdProjects(
  parts: readonly PartDefinition[],
  checkpoint?: (report: EskdProjectAuditReport) => void,
): EskdProjectAuditReport {
  const mechanisms = parts.filter(
    (part) =>
      part.product.supply === 'manufactured' &&
      ['assembly', 'complex', 'kit'].includes(part.product.kind),
  );
  const report: EskdProjectAuditReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope:
      'Default configurations of every manufactured assembly, complex and kit in the current library.',
    totalFamilies: parts.length,
    mechanisms: mechanisms.length,
    finished: false,
    projectPass: 0,
    exportPass: 0,
    verification: {
      source:
        'ProtoLab project creation, source parameter validation, exporter constraints and JSON parsing. External Open ESKD conformance validation is a separate check.',
      geometryValidated: false,
      engineeringApproval: false,
    },
    records: [],
  };
  checkpoint?.(report);
  const encoder = new TextEncoder();
  for (const part of mechanisms) {
    const state =
      part.states?.find((item) => item.id === 'assembled')?.id ?? part.states?.[0]?.id ?? 'default';
    const record: EskdProjectAuditRecord = {
      id: part.id,
      kind: part.product.kind,
      state,
      stage: 'addProduct',
      milliseconds: 0,
    };
    const began = performance.now();
    try {
      const { project } = addProduct(createProject(part.name), parts, {
        part,
        parameters: { ...part.defaults },
        state,
      });
      record.projectCreated = true;
      report.projectPass++;
      record.configurations = project.configurations.length;
      record.occurrences = project.occurrences.length;
      record.largestParameterBytes = Math.max(
        0,
        ...project.configurations.map(
          (configuration) => encoder.encode(JSON.stringify(configuration.parameters)).length,
        ),
      );
      record.stage = 'exportOpenEskd';
      const exported = exportOpenEskd(project, parts);
      JSON.parse(exported);
      record.openEskdExported = true;
      report.exportPass++;
      record.exportBytes = encoder.encode(exported).length;
      record.stage = 'complete';
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
    }
    record.milliseconds = Math.round(performance.now() - began);
    report.records.push(record);
    checkpoint?.(report);
  }
  report.finished = true;
  checkpoint?.(report);
  return report;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1]))
    throw new Error(
      'Usage: node --import tsx scripts/audit-eskd-projects.ts [--output report.json]',
    );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const output = args[1]
    ? path.resolve(args[1])
    : path.join(root, 'test-results/eskd-project-coverage.json');
  mkdirSync(path.dirname(output), { recursive: true });
  const { parts } = await import('../src/parts/index');
  const report = auditEskdProjects(parts, (progress) =>
    writeFileSync(output, JSON.stringify(progress, null, 2) + '\n'),
  );
  console.log(
    JSON.stringify(
      {
        total: report.mechanisms,
        projects: report.projectPass,
        exports: report.exportPass,
        errors: report.records
          .filter((record) => record.error)
          .map(({ id, stage, error }) => ({ id, stage, error })),
        output,
      },
      null,
      2,
    ),
  );
  if (report.projectPass !== report.mechanisms || report.exportPass !== report.mechanisms)
    process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
