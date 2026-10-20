import type { DesignProject } from './product-types';
import type { PartDefinition } from './types';
import { projectReadiness, validateProject } from './design-project';
import { currentGeometryMode, withGeometryMode, type GeometryMode } from './geometry-mode';
import { modelEvidence } from './model-evidence';

/** Export configured library products with occurrence placements and document identity. */
export function generateProjectScript(
  project: DesignProject,
  parts: readonly PartDefinition[],
  mode: GeometryMode = currentGeometryMode(),
): string {
  return withGeometryMode(mode, () => projectScriptInMode(project, parts));
}

function projectScriptInMode(project: DesignProject, parts: readonly PartDefinition[]): string {
  const errors = validateProject(project, parts);
  if (errors.length) throw new Error(errors.join(' '));
  const readiness = projectReadiness(project, parts);
  const parents = new Set(project.occurrences.map((item) => item.parentId));
  const used = new Set(
    project.occurrences.filter((item) => !parents.has(item.id)).map((item) => item.configurationId),
  );
  const configurations = project.configurations.filter((item) => used.has(item.id));
  const functions = configurations
    .map((configuration, index) => {
      const part = parts.find((item) => item.id === configuration.libraryId)!;
      return `def _definition_${index}():\n    component_labels = None\n    component_colors = None\n    component_metadata = None\n    component_groups = None\n${part
        .python(configuration.parameters, configuration.state)
        .split('\n')
        .map((line) => '    ' + line)
        .join('\n')}\n    return shape, component_labels, component_colors, component_metadata`;
    })
    .join('\n\n');
  const indices = Object.fromEntries(
    configurations.map((configuration, index) => [configuration.id, index]),
  );
  const provenance = Object.fromEntries(
    project.configurations.map((configuration) => {
      const part = parts.find((item) => item.id === configuration.libraryId)!;
      const evidence = modelEvidence(part, configuration.parameters, configuration.presetId);
      const catalog = part.presets.find((preset) => preset.id === evidence.presetId)?.catalog;
      return [configuration.id, { geometryEvidence: evidence, ...(catalog ? { catalog } : {}) }];
    }),
  );
  return `# ProtoLab design project. Millimetres; local occurrence rotations X, Y, then Z.
# Geometry mode: ${currentGeometryMode()}
# Preview geometry and documentation records do not constitute engineering approval.
import FreeCAD as App
import Part
import math
import json

${functions}

_project = json.loads(${JSON.stringify(JSON.stringify(project))})
_indices = json.loads(${JSON.stringify(JSON.stringify(indices))})
_provenance = json.loads(${JSON.stringify(JSON.stringify(provenance))})

def _metadata(obj, configuration, occurrence):
    for key, value in {
        "OccurrenceId": occurrence["id"], "ConfigurationId": configuration["id"],
        "LibraryId": configuration["libraryId"], "Designation": configuration["designation"],
        "Revision": configuration["revision"], "BOMPosition": occurrence["position"],
        "SupplyPolicy": configuration["supply"], "GeometryMode": ${JSON.stringify(currentGeometryMode())},
        "ManufacturingDefinition": json.dumps(configuration.get("manufacturing")),
        "ProcurementDefinition": json.dumps(configuration.get("procurement")),
    }.items():
        obj.addProperty("App::PropertyString", key, "Design")
        setattr(obj, key, value)
    obj.addProperty("App::PropertyFloat", "BOMQuantity", "Design")
    obj.BOMQuantity = occurrence["quantity"]
    provenance = _provenance[configuration["id"]]
    obj.addProperty("App::PropertyString", "GeometryEvidence", "ProtoLab")
    obj.GeometryEvidence = json.dumps(provenance["geometryEvidence"])
    if "catalog" in provenance:
        obj.addProperty("App::PropertyString", "CatalogDefinition", "ProtoLab")
        obj.CatalogDefinition = json.dumps(provenance["catalog"])

def _create_project():
    doc = App.ActiveDocument or App.newDocument("ProtoLabProject")
    doc.openTransaction("Create design project")
    created = []
    try:
        root = doc.addObject("App::Part", "ProtoLabProject")
        created.append(root.Name)
        root.Label = _project["designation"] + " " + _project["name"]
        root.addProperty("App::PropertyString", "ProjectDefinition", "Design")
        root.ProjectDefinition = json.dumps(_project)
        root.addProperty("App::PropertyString", "GeometryMode", "Design")
        root.GeometryMode = ${JSON.stringify(currentGeometryMode())}
        root.addProperty("App::PropertyStringList", "DocumentationIssues", "Design")
        root.DocumentationIssues = ${JSON.stringify(readiness.issues)}
        root.addProperty("App::PropertyStringList", "EngineeringReviewRequirements", "Design")
        root.EngineeringReviewRequirements = ${JSON.stringify(readiness.reviewRequirements)}
        configurations = {item["id"]: item for item in _project["configurations"]}
        children = {}
        for item in _project["occurrences"]:
            children.setdefault(item["parentId"], []).append(item)
        definitions = {}
        def append(occurrence, parent):
            configuration = configurations[occurrence["configurationId"]]
            obj = doc.addObject("App::Part", "ProtoLabOccurrence")
            created.append(obj.Name)
            obj.Label = occurrence["position"] + " " + (configuration["designation"] or configuration["name"])
            parent.addObject(obj)
            _metadata(obj, configuration, occurrence)
            placement = occurrence["placement"]
            x, y, z = placement["rotation"]
            rotation = App.Rotation(App.Vector(0,0,1), z).multiply(App.Rotation(App.Vector(0,1,0), y)).multiply(App.Rotation(App.Vector(1,0,0), x))
            obj.Placement = App.Placement(App.Vector(*placement["translation"]), rotation)
            nested = children.get(occurrence["id"], [])
            if nested:
                for child in nested:
                    append(child, obj)
            else:
                key = configuration["id"]
                if key not in definitions:
                    definitions[key] = globals()["_definition_" + str(_indices[key])]()
                shape, labels, colors, metadata = definitions[key]
                if shape.isNull() or not shape.isValid() or not shape.isClosed() or not shape.Solids or shape.Volume <= 0:
                    raise ValueError("Invalid configured library product: " + configuration["name"])
                solids = shape.childShapes() if shape.ShapeType == "Compound" else [shape]
                if any(values is not None and len(values) != len(solids) for values in [labels, colors, metadata]):
                    raise ValueError("Product component records do not match its geometry")
                for index, solid in enumerate(solids):
                    if solid.isNull() or not solid.isValid() or not solid.isClosed() or not solid.Solids or solid.Volume <= 0:
                        raise ValueError("Invalid physical library component: " + configuration["name"])
                    child = doc.addObject("Part::Feature", "ProtoLabGeometry")
                    created.append(child.Name)
                    child.Label = labels[index] if labels is not None else configuration["name"]
                    child.Shape = solid.copy()
                    obj.addObject(child)
                    if metadata is not None:
                        child.addProperty("App::PropertyString", "ManufacturingMetadata", "Design")
                        child.ManufacturingMetadata = json.dumps(metadata[index])
                        for key, value in metadata[index].items():
                            property_name = key
                            while hasattr(child, property_name):
                                property_name = "Manufacturing" + property_name
                            child.addProperty("App::PropertyString", property_name, "Manufacturing")
                            setattr(child, property_name, str(value))
                        if metadata[index].get("ThreadLabels"):
                            child.Label += " · threads: " + metadata[index]["ThreadLabels"]
                    if App.GuiUp:
                        child.ViewObject.ShapeColor = tuple(colors[index]) if colors is not None else (0.62,0.70,0.78)
            return obj
        for occurrence in children.get(None, []):
            append(occurrence, root)
        doc.recompute()
        doc.commitTransaction()
    except Exception:
        doc.abortTransaction()
        for name in reversed(created):
            if doc.getObject(name) is not None:
                doc.removeObject(name)
        doc.recompute()
        raise
    if App.GuiUp:
        import FreeCADGui as Gui
        Gui.activeDocument().activeView().viewAxonometric()
        Gui.activeDocument().activeView().fitAll()
    return root

_create_project()
`;
}
