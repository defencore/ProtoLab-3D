import type { PartDefinition } from './types';
import type { DesignProject } from './product-types';
import { parseProject, serializeProject } from './design-project';

const storageKey = 'protolab.engineering-projects.v1';

export function storedProjectText(): string | null {
  return localStorage.getItem(storageKey);
}

export function readProjects(parts: readonly PartDefinition[]): {
  projects: DesignProject[];
  errors: string[];
} {
  const projects: DesignProject[] = [];
  const errors: string[] = [];
  try {
    const text = localStorage.getItem(storageKey);
    if (!text) return { projects, errors };
    const saved: unknown = JSON.parse(text);
    if (!Array.isArray(saved)) throw new Error('Stored project collection is not a list.');
    for (const [index, value] of saved.entries()) {
      try {
        const project = parseProject(JSON.stringify(value), parts);
        if (projects.some((item) => item.id === project.id))
          throw new Error('Duplicate stored project ID.');
        projects.push(project);
      } catch (error) {
        errors.push(
          `Project ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { projects, errors };
}

export function storeProjects(
  projects: readonly DesignProject[],
  parts: readonly PartDefinition[],
): void {
  if (new Set(projects.map((item) => item.id)).size !== projects.length)
    throw new Error('Project IDs must be unique.');
  const records = projects.map((project) => JSON.parse(serializeProject(project, parts)));
  localStorage.setItem(storageKey, JSON.stringify(records));
}
