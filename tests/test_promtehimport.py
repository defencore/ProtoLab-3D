"""Regression checks for supplier retrieval boundaries and mixed search excerpts."""
import importlib.util
import json
from pathlib import Path
import unittest


def load_script(name):
    path = Path(__file__).resolve().parents[1] / 'scripts' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


source = load_script('import-promtehimport')
fallback = load_script('cache-promtehimport-web')


class SourceParsingTests(unittest.TestCase):
    def test_category_count_ignores_cart_count(self):
        page = '<span>Товарів: 0</span><strong>Товарів: 75</strong>'
        page += '<a href="?pageNumber=4">4</a><a href="/offer/bearing-o1/">Item</a>'
        result = source.parse_category(page, source.BASE + '/category/')
        self.assertEqual(result['reportedCount'], 75)
        self.assertEqual(result['pages'], 4)
        self.assertEqual(result['products'], ['/offer/bearing-o1/'])

    def test_product_tables_preserve_subscript_symbols_and_contradictions(self):
        product = {'@type': 'Product', 'name': '1200', 'brand': {'name': 'SKF'}}
        page = '<script type="application/ld+json">' + json.dumps(product) + '</script>'
        page += '<table><tr><td>d<sub>1</sub></td><td>20&nbsp;mm</td></tr>'
        page += '<tr><td>D</td><td>30 mm</td></tr>'
        page += '<tr><td>Зовнішній діаметр</td><td>110</td></tr></table>'
        result = source.parse_product(page, source.BASE + '/offer/1200-o1/')
        self.assertEqual(result['tables'], [['d 1', '20 mm'], ['D', '30 mm'], ['Зовнішній діаметр', '110']])

    def test_metal_cage_is_not_evidence_of_metal_shields(self):
        self.assertNotIn('closure', source.source_features('Штампований сталевий металевий сепаратор.'))
        self.assertEqual(source.source_features('Ущільнювач підшипника: одностороння металева захисна шайба. Внутрішній діаметр: 10')['closure'], 'metal-one')

    def test_fallback_rejects_combined_product_results(self):
        first = source.BASE + '/offer/first-o1/'
        second = source.BASE + '/offer/second-o2/'
        excerpt = f'# First bearing\n{first}\n| d | 10 mm |\n| D | 30 mm |\n| B | 9 mm |\n# Second bearing\n{second}\n| d | 15 mm |'
        self.assertEqual(list(fallback.parse(excerpt, [first, second])), [])
        single = f'# First bearing\n{first}\n|d|10 mm\n|D|30 mm\n|B|9 mm'
        self.assertEqual(len(list(fallback.parse(single, [first]))), 1)


if __name__ == '__main__':
    unittest.main()
