import { physicalProductState, productIdentityParameters, stableDesignText } from './eskd';
import { libraryEntryId } from './library-identity';
import { selectedMatchingPreset } from './preset-resolution';
import type { AssemblyComponent } from './product-types';
import type { PartDefinition } from './types';

export interface AssemblyBomRow {
  key: string;
  /** Preserve the first occurrence's metadata; the aggregate count is separate. */
  component: AssemblyComponent;
  quantity: number;
  libraryEntryId: string;
}

function checkedQuantity(quantity: number, libraryId: string): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new Error(`${libraryId}: BOM quantity must be a positive safe integer.`);
  return quantity;
}

/** Aggregate physical components; the supplied list contains occurrences below the host. */
export function assemblyBomRows(
  components: readonly AssemblyComponent[],
  parts: readonly PartDefinition[],
): AssemblyBomRow[] {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const rows = new Map<string, AssemblyBomRow>();

  function visit(
    component: AssemblyComponent,
    multiplier: number,
    ancestors: readonly string[],
    depth: number,
  ): void {
    if (depth > 128) throw new Error('Library composition exceeds 128 assembly levels.');
    const part = byId.get(component.libraryId);
    if (!part) throw new Error(`Missing library component: ${component.libraryId}.`);
    const quantity = checkedQuantity(
      multiplier * checkedQuantity(component.quantity, part.id),
      part.id,
    );
    const purchased = component.supply === 'purchased' || component.supply === 'standard';
    const expandsLibrary = !purchased && component.children === undefined;
    if (expandsLibrary && ancestors.includes(part.id))
      throw new Error(`Cyclic library composition: ${[...ancestors, part.id].join(' -> ')}.`);

    if (component.supply !== 'reference') {
      const preset = selectedMatchingPreset(part, component.parameters, component.presetId);
      const verifiedKeys =
        purchased && part.catalogSelectionOnly ? preset?.catalog?.verifiedParameters : undefined;
      const parameters = verifiedKeys?.length
        ? Object.fromEntries(verifiedKeys.map((key) => [key, component.parameters[key]]))
        : productIdentityParameters(part, component.parameters);
      const key = stableDesignText({
        libraryId: part.id,
        ...(purchased && preset ? { presetId: preset.id } : {}),
        parameters,
        state: physicalProductState(part, component.state, component.parameters),
        supply: component.supply,
        manufacturing: component.manufacturing,
        procurement: component.procurement,
      });
      const previous = rows.get(key);
      if (previous) previous.quantity = checkedQuantity(previous.quantity + quantity, part.id);
      else
        rows.set(key, {
          key,
          component,
          quantity,
          libraryEntryId: libraryEntryId(part.id, preset?.id),
        });
    }

    // A bought unit's display solids do not become separately ordered components.
    if (purchased) return;
    const children =
      component.children ?? part.composition?.(component.parameters).components ?? [];
    const nextAncestors = expandsLibrary ? [...ancestors, part.id] : ancestors;
    for (const child of children) visit(child, quantity, nextAncestors, depth + 1);
  }

  for (const component of components) visit(component, 1, [], 0);
  return [...rows.values()];
}
