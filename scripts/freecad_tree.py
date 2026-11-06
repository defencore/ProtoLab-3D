"""Read generated FreeCAD component features in their original recipe order."""


def component_leaves(root):
    """Accept either a single-body export or an assembly with nested App::Part groups."""
    if root.TypeId != 'App::Part':
        return [root]

    leaves = []

    def visit(group):
        for child in group.Group:
            if child.TypeId == 'App::Part':
                visit(child)
            elif child.TypeId == 'Part::Feature':
                leaves.append(child)

    visit(root)
    return sorted(leaves, key=lambda feature: getattr(feature, 'ComponentIndex', 0))
