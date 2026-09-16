# Squib retainer

**Electronics & vision → SRS Airbag → Squib retainer** contains device-side keyed inserts:

- TE 1-1823640-1, 2-1823640-1 and 3-1823640-1: original customer-view STEP solids for AK II keys I/II/III.
- Aptiv AK-1: reconstructed dimensional sample for the AK-1 family used by CA281A/CA282B; exact key tolerances are not supplied.

These are retainers, not complete holders or initiators. TE states the 1823640 family is for two-way connectors. No pairing is asserted for the three-way TE connector or JST SQXW. Read `public/references/srs-retainers/interfaces.md` for the standard map, source revisions and compatibility limitations.

`scripts/import-srs-retainers.py` imports three pinned public STEP assets, translates them +7.5 mm in Z, and bakes preview tessellations plus compressed BREP into `lib/native.json`. Each source is one valid solid. The model preserves all source surfaces; preview colors are illustrative. Source hashes are included in preset metadata and FreeCAD exports. The native height is 7.85 mm and nominal body diameter is 11 mm; ears extend beyond it.

The full supplied ISO 19072-2 PDF is not published in the repository. It specifies tests. A dimensioned holder requires the relevant part 1/4 drawings or supplier CAD, which were not available for this addition.
