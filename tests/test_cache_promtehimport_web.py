"""Regression checks for standalone supplier cache imports."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'cache-promtehimport-web.py'
spec = importlib.util.spec_from_file_location('cache_promtehimport_web', SCRIPT)
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)

URL = 'https://promtehimport.com.ua/offer/first-o1/'
SOURCE = f'# First bearing\n{URL}\nd = 10 mm\nD = 30 mm\nB = 9 mm'


class CacheImportTests(unittest.TestCase):
    def test_assigned_dimension_at_end_of_input_is_preserved(self):
        for suffix in ('', '\n'):
            with self.subTest(suffix=suffix):
                products = list(cache.parse(SOURCE + suffix, [URL]))
                self.assertEqual(len(products), 1)
                self.assertEqual(products[0]['tables'], [
                    ['d', '10 mm'], ['D', '30 mm'], ['B', '9 mm'],
                ])

    def test_cli_creates_missing_cache_directory(self):
        with tempfile.TemporaryDirectory(prefix='protolab-cache-test-') as temporary:
            root = Path(temporary)
            source = root / 'source.txt'
            source.write_text(SOURCE)
            inventory = root / 'inventory.json'
            inventory.write_text(json.dumps({
                'categories': {'c34': {'productUrls': [URL]}},
            }))
            destination = root / 'new-cache' / 'products'
            result = subprocess.run([
                sys.executable, str(SCRIPT), str(source),
                '--inventory', str(inventory), '--cache', str(destination),
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {'added': 1, 'urls': [URL]})
            files = list(destination.glob('*.json'))
            self.assertEqual(len(files), 1)
            product = json.loads(files[0].read_text())
            self.assertEqual(product['url'], URL)
            self.assertEqual(product['tables'][-1], ['B', '9 mm'])


if __name__ == '__main__':
    unittest.main()
