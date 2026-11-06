/** Shared document properties for both standalone and project FreeCAD exports. */
export const freecadEskdPython = `def _protolab_apply_eskd(obj, identity, set_label=True):
    properties = {
        "LibraryId": identity["libraryId"],
        "PresetId": identity.get("presetId", ""),
        "LibraryEntryId": identity["libraryEntryId"],
        "Designation": identity["designation"],
        "ProductName": identity["name"],
        "Revision": identity["revision"],
        "BaseDesignation": identity["baseDesignation"],
        "Execution": identity["execution"],
        "ConfigurationKey": identity["configurationKey"],
        "ProductType": identity["productType"],
        "SupplyPolicy": identity["supply"],
    }
    for key, value in properties.items():
        if key not in obj.PropertiesList:
            obj.addProperty("App::PropertyString", key, "Design")
        setattr(obj, key, str(value))
    if set_label:
        label = identity["label"]
        existing = {other.Label for other in obj.Document.Objects if other.Name != obj.Name}
        if label in existing:
            instance = 2
            while label + " [instance %d]" % instance in existing:
                instance += 1
            label += " [instance %d]" % instance
        obj.Label = label
`;
