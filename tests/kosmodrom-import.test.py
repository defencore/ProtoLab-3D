"""Focused source-provenance checks; no network, CAD or browser is required."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("kosmodrom_import", ROOT / "scripts/import-kosmodrom.py")
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)
RAW = json.loads((ROOT / "src/catalog/kosmodrom/source-products.json").read_text())


class KosmodromImportTests(unittest.TestCase):
    def product(self, model):
        return next(record for record in RAW["products"] if record["model"] == model)

    def test_every_category_product_retains_its_exact_identity_and_source(self):
        coverage = json.loads((ROOT / "src/catalog/kosmodrom/coverage.json").read_text())
        normalized = json.loads((ROOT / "src/catalog/kosmodrom/m3-standoffs.json").read_text())
        self.assertEqual(coverage["status"], "complete")
        self.assertEqual(coverage["errors"], [])
        self.assertEqual(sum(page["productCount"] for page in coverage["pages"]), len(RAW["products"]))
        self.assertEqual(len(RAW["products"]), 126)
        self.assertEqual(len(coverage["pages"]), 9)
        self.assertEqual(len({record["sku"] for record in RAW["products"]}), 126)
        self.assertEqual(len({record["url"] for record in RAW["products"]}), 126)
        self.assertEqual(len(RAW["drawings"]), 3)
        self.assertEqual(normalized["products"], [IMPORTER.normalize_product(record) for record in RAW["products"]])
        for source, product in zip(RAW["products"], normalized["products"]):
            for key in ("catalogId", "sku", "model", "manufacturer", "url", "sourceSha256"):
                self.assertEqual(product[key], source[key])
            self.assertIsNone(product["parameters"]["threadPitch"])
            self.assertIsNone(product["parameters"]["femaleDepthA"])
            self.assertIsNone(product["parameters"]["femaleDepthB"])

    def test_generic_drawings_do_not_invent_customer_defined_depths_or_override_variant_widths(self):
        ff = IMPORTER.normalize_product(self.product("TFF-M3X10"))
        self.assertEqual((ff["parameters"]["bodyWidth"], ff["parameters"]["cornerDiameter"]), (5, 5.5))
        self.assertEqual(ff["drawings"][0]["E"], {"nominal": 5, "lowerDeviation": -0.2, "upperDeviation": 0})
        self.assertEqual(ff["drawings"][0]["H"], {"nominal": 5.5, "lowerDeviation": -0.2, "upperDeviation": 0})
        self.assertIs(ff["parameters"]["throughBore"], False)
        self.assertIsNone(ff["parameters"]["femaleDepthA"])
        self.assertIsNone(ff["parameters"]["femaleDepthB"])
        mf = IMPORTER.normalize_product(self.product("TFM-M3X8"))
        self.assertEqual(mf["parameters"]["bodyWidth"], 4.5)
        self.assertIsNone(mf["parameters"]["cornerDiameter"])
        self.assertEqual(mf["parameters"]["maleLengthB"], 6)
        self.assertTrue(any(issue.get("drawingValue") == 5 for issue in mf["issues"]))

    def test_published_stud_lengths_and_conflicting_body_lengths_remain_distinct(self):
        mm = IMPORTER.normalize_product(self.product("TMM-M3X10"))
        self.assertEqual((mm["parameters"]["endA"], mm["parameters"]["endB"]), ("male", "male"))
        self.assertEqual((mm["parameters"]["maleLengthA"], mm["parameters"]["maleLengthB"]), (6, 6))
        self.assertEqual(mm["parameters"]["bodyWidth"], 5.5)
        mf = IMPORTER.normalize_product(self.product("TFM-M3X25"))
        self.assertIsNone(mf["parameters"]["bodyLength"])
        self.assertEqual(mf["designationHints"]["bodyLength"], 25)
        self.assertTrue(any(issue.get("tableValue") == 31 for issue in mf["issues"]))
        overall = IMPORTER.normalize_product(self.product("TFM-M3X20"))
        self.assertEqual(overall["parameters"]["overallLength"], 26)
        self.assertIsNone(overall["parameters"]["bodyLength"])
        self.assertIsNone(overall["parameters"]["maleLengthB"])

    def test_manufacturer_and_black_steel_are_not_guessed_from_linked_brass_drawings(self):
        unbranded = IMPORTER.normalize_product(self.product("TFF-M3X10"))
        self.assertIsNone(unbranded["manufacturer"])
        branded = IMPORTER.normalize_product(self.product("TFF-M3X7"))
        self.assertEqual(branded["manufacturer"], "KLS")
        steel = IMPORTER.normalize_product(self.product("TFM-B-M3X12"))
        self.assertEqual((steel["material"], steel["finish"]), ("steel", "blackened"))
        self.assertIsNone(steel["parameters"]["endB"])
        self.assertIsNone(steel["parameters"]["maleLengthB"])

    def test_an_interrupted_download_cannot_concatenate_partial_html_with_a_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = IMPORTER.SourceCache(Path(directory))
            partial = subprocess.CompletedProcess([], 28, b"partial HTML", b"timeout")
            complete = subprocess.CompletedProcess([], 0, b"complete HTML", b"")
            with patch.object(IMPORTER.subprocess, "run", side_effect=[partial, complete]), patch.object(IMPORTER.time, "sleep"):
                self.assertEqual(cache.fetch(IMPORTER.CATEGORY), b"complete HTML")
            self.assertEqual(cache.fetch(IMPORTER.CATEGORY), b"complete HTML")
            with self.assertRaisesRegex(ValueError, "Unexpected source host"):
                cache.fetch("https://example.org/not-the-catalog")
            with self.assertRaisesRegex(ValueError, "Unexpected source path"):
                cache.fetch("https://kosmodrom.ua/cart")
            with self.assertRaisesRegex(ValueError, "Missing offline source"):
                IMPORTER.SourceCache(Path(directory), offline=True).fetch(IMPORTER.CATEGORY + "?page=2")


if __name__ == "__main__":
    unittest.main()
