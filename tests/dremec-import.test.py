#!/usr/bin/env python3
"""Offline source-row, dimensional-evidence and importer reproducibility checks."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/catalog/dremec"
spec = importlib.util.spec_from_file_location("dremec_import", ROOT / "scripts/import-dremec.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class DremecImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables = json.loads((SOURCE / "manufacturer-tables.json").read_text())
        cls.snapshot = json.loads((SOURCE / "standoffs.json").read_text())
        cls.records = {v["sku"]:v for v in cls.snapshot["records"]}

    def test_exact_offered_cells_and_published_length_ranges(self):
        # The displayed page-8 row leaves M5 lengths 5 and 6 blank, unlike M3.
        self.assertNotIn("118x5", self.records)
        self.assertNotIn("118x6", self.records)
        self.assertIn("118x8", self.records)
        self.assertEqual(self.records["114x70"]["acrossFlats"], 5.5)
        self.assertNotIn("114x75", self.records)
        # The page-26 nylon range explicitly reaches 61; it is not a 5-mm grid.
        self.assertIn("285x59", self.records)
        self.assertIn("285x61", self.records)
        self.assertNotIn("285x62", self.records)
        self.assertEqual(self.records["285x59"]["availabilityEvidence"], "explicit-integer-length-range")

    def test_missing_table_cells_are_not_interpolated(self):
        for sku, field in [("111x6","femaleThreadDepth"),("113x25","femaleThreadDepth"),("432x10","maleThreadLength")]:
            self.assertIsNone(self.records[sku][field])
            self.assertIn(field, self.records[sku]["missingDimensions"])
        self.assertEqual(self.records["1313x25"]["femaleThreadDepth"], 12)
        self.assertNotIn("femaleThreadDepth", self.records["1313x25"]["missingDimensions"])

    def test_thread_ends_and_source_exceptions_remain_distinct(self):
        self.assertEqual((self.records["213x10"]["maleThreadLength"], self.records["213x10"]["shortStudOption"]["maleThreadLength"]), (8,6))
        self.assertNotIn("shortStudOption", self.records["215x10"])
        self.assertEqual(self.records["285x5"]["femaleThreadDepth"], 3)
        self.assertEqual(self.records["285rdx5"]["femaleThreadDepth"], 3.5)
        mixed = self.records["2103x5/12"]
        self.assertEqual((mixed["femaleThread"], mixed["maleThread"]), ("UNC4-40","M3"))
        self.assertIsNone(mixed["parameters"]["threadDiameter"])
        self.assertNotIn("2103x6/12", self.records)
        st = self.records["214ST2.9x10"]
        self.assertEqual((st["selfTappingMajorDiameter"], st["selfTappingRootDiameter"]), (2.8,2.1))
        self.assertEqual(st["parameters"]["endB"], "male")
        self.assertEqual((st["parameters"]["threadDiameterB"], st["parameters"]["threadRootDiameterB"]), (2.8,2.1))
        self.assertIsNone(st["parameters"]["threadPitchB"])

    def test_insert_internals_and_half_depth_topology_are_not_invented(self):
        item = self.records["1183x30"]
        self.assertEqual(item["femaleThreadDepth"], 6)
        self.assertEqual(item["lengthTolerance"], 0.2)
        for key in ["insertOuterDiameter","insertLengthA","insertLengthB","insertThrough"]:
            self.assertIsNone(item["parameters"][key])
        half = self.records["113x18"]
        self.assertEqual(half["femaleThreadDepth"], 9)
        self.assertFalse(half["parameters"]["threadedThrough"])
        self.assertIn("midpoint", " ".join(half["geometryNotes"]))
        self.assertTrue(self.records["110x12"]["parameters"]["threadedThrough"])

    def test_complete_accounting_and_deterministic_offline_rebuild(self):
        rebuilt = importer.build(self.tables)
        self.assertEqual(rebuilt, self.snapshot["records"])
        self.assertEqual(len(rebuilt), 4250)
        self.assertEqual(len(self.tables["rows"]), 162)
        self.assertEqual(len({v["id"] for v in rebuilt}), len(rebuilt))
        self.assertTrue(all(v["variationId"] is None and v["localVariationStatus"] == "not-confirmed" for v in rebuilt))
        parents = importer.source_products(rebuilt)
        self.assertEqual(parents, json.loads((SOURCE / "source-products.json").read_text()))
        self.assertEqual(len(parents["products"]), 28)
        sleeves = [v for v in parents["products"] if v["kind"] == "DH"]
        self.assertEqual(len(sleeves), 4)
        self.assertTrue(all(not v["fixedVariationRecords"] for v in sleeves))
        examples = [v["manufacturerOrderExample"] for v in sleeves if "manufacturerOrderExample" in v]
        self.assertEqual(examples, [{"sku":"324/2.1x10","bodyDiameter":4,"boreDiameter":2.1,"bodyLength":10,"printedPage":36,"evidenceKind":"printed-order-example"}])

    def test_each_source_row_reparses_and_bounds_every_variant(self):
        for row in self.tables["rows"]:
            self.assertEqual(importer.parse_table(row["printedPage"], row["sourceRow"]), [row])
            variants = [v for v in self.snapshot["records"] if v["series"] == row["prefix"] and v["printedPage"] == row["printedPage"]]
            self.assertEqual(sorted({v["bodyLength"] for v in variants}), row["lengths"])
            self.assertTrue(all((v["acrossFlats"] or v["bodyDiameter"]) == row["bodySize"] for v in variants))


if __name__ == "__main__":
    unittest.main()
