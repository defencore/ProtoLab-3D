import { parseProject } from './design-project';
import type { DesignProject } from './product-types';
import type { PartDefinition } from './types';

/** Replace only the imported project, preserving the current collection and its edits. */
export function mergeImportedProject(
  projects: readonly DesignProject[],
  imported: DesignProject,
): DesignProject[] {
  return projects.some((project) => project.id === imported.id)
    ? projects.map((project) => (project.id === imported.id ? imported : project))
    : [...projects, imported];
}

/** File reads can finish out of order. Only the latest active read may apply data or errors. */
export function createProjectImporter() {
  let revision = 0;
  return {
    cancel() {
      revision++;
    },
    async read(
      file: Pick<File, 'size' | 'text'>,
      parts: readonly PartDefinition[],
      apply: (project: DesignProject) => void,
      reportError: (error: unknown) => void,
    ): Promise<void> {
      const request = ++revision;
      try {
        if (file.size > 10_000_000) throw new Error('Choose a project smaller than 10 MB.');
        const text = await file.text();
        if (request !== revision) return;
        apply(parseProject(text, parts));
      } catch (error) {
        if (request === revision) reportError(error);
      }
    },
  };
}
