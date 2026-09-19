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
        page = '<span>\u0422\u043e\u0432\u0430\u0440\u0456\u0432: 0</span><strong>\u0422\u043e\u0432\u0430\u0440\u0456\u0432: 75</strong>'
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
        page += '<tr><td>\u0417\u043e\u0432\u043d\u0456\u0448\u043d\u0456\u0439 \u0434\u0456\u0430\u043c\u0435\u0442\u0440</td><td>110</td></tr></table>'
        result = source.parse_product(page, source.BASE + '/offer/1200-o1/')
        self.assertEqual(result['tables'], [['d 1', '20 mm'], ['D', '30 mm'], ['\u0417\u043e\u0432\u043d\u0456\u0448\u043d\u0456\u0439 \u0434\u0456\u0430\u043c\u0435\u0442\u0440', '110']])

    def test_metal_cage_is_not_evidence_of_metal_shields(self):
        self.assertNotIn('closure', source.source_features('\u0428\u0442\u0430\u043c\u043f\u043e\u0432\u0430\u043d\u0438\u0439 \u0441\u0442\u0430\u043b\u0435\u0432\u0438\u0439 \u043c\u0435\u0442\u0430\u043b\u0435\u0432\u0438\u0439 \u0441\u0435\u043f\u0430\u0440\u0430\u0442\u043e\u0440.'))
        self.assertEqual(source.source_features('\u0423\u0449\u0456\u043b\u044c\u043d\u044e\u0432\u0430\u0447 \u043f\u0456\u0434\u0448\u0438\u043f\u043d\u0438\u043a\u0430: \u043e\u0434\u043d\u043e\u0441\u0442\u043e\u0440\u043e\u043d\u043d\u044f \u043c\u0435\u0442\u0430\u043b\u0435\u0432\u0430 \u0437\u0430\u0445\u0438\u0441\u043d\u0430 \u0448\u0430\u0439\u0431\u0430. \u0412\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456\u0439 \u0434\u0456\u0430\u043c\u0435\u0442\u0440: 10')['closure'], 'metal-one')

    def test_fallback_rejects_combined_product_results(self):
        first = source.BASE + '/offer/first-o1/'
        second = source.BASE + '/offer/second-o2/'
        excerpt = f'# First bearing\n{first}\n| d | 10 mm |\n| D | 30 mm |\n| B | 9 mm |\n# Second bearing\n{second}\n| d | 15 mm |'
        self.assertEqual(list(fallback.parse(excerpt, [first, second])), [])
        single = f'# First bearing\n{first}\n|d|10 mm\n|D|30 mm\n|B|9 mm'
        self.assertEqual(len(list(fallback.parse(single, [first]))), 1)


if __name__ == '__main__':
    unittest.main()
