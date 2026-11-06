import { parseProject } from './design-project';
import { createFileImporter } from './file-import';
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
  const importer = createFileImporter();
  return {
    cancel: importer.cancel,
    read(
      file: Pick<File, 'size' | 'text'>,
      parts: readonly PartDefinition[],
      apply: (project: DesignProject) => void,
      reportError: (error: unknown) => void,
    ): Promise<void> {
      return importer.read(file, {
        maxBytes: 10_000_000,
        sizeMessage: 'Choose a project smaller than 10 MB.',
        parse: (text) => parseProject(text, parts),
        apply,
        reportError,
      });
    },
  };
}
