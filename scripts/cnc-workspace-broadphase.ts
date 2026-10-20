/** The workspace runner and its native equivalence proof execute these same functions. */
export const workspaceBroadphasePython = `def _workspace_bounds(shape):
    b = shape.BoundBox
    return (b.XMin,b.XMax,b.YMin,b.YMax,b.ZMin,b.ZMax)

def _workspace_translation(motion,dx,dy,dz):
    return (dx if motion in ['x','z'] else 0,dy if motion != 'fixed' else 0,dz if motion == 'z' else 0)

def _workspace_translated_bounds(bounds,translation):
    # The workspace poses are translations only; rotations remain in the actual installed shapes.
    return tuple(value+translation[index//2] for index,value in enumerate(bounds))

def _workspace_bounds_overlap(a,b):
    # Face, edge and corner contact do not have a positive-volume bounding intersection.
    return all(min(a[index+1],b[index+1])-max(a[index],b[index]) > 0 for index in (0,2,4))
`;

/** Procurement notes and hierarchy are not executed by the native workspace verification. */
export function workspaceDefinition<
  T extends { id: string; libraryId: string; parameters: unknown },
>(component: T) {
  return {
    id: component.id,
    libraryId: component.libraryId,
    parameters: component.parameters,
  };
}
