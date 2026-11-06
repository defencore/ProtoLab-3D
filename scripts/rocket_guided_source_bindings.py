"""Check frozen CAD sources, with an explicit description-only catalog amendment."""
import hashlib
import json
from pathlib import Path


def verify_source_bindings(manifest, amendment_file=None):
    amendment_path = Path(amendment_file) if amendment_file else None
    amendment = None
    if amendment_path and amendment_path.exists():
        amendment = json.loads(amendment_path.read_text())
        assert amendment['passed'] and amendment['nativeGeometryEquivalent']
        assert amendment['kind'] == 'catalog-description-only'
        assert amendment['path'] == 'src/parts/rocket-camera-nose/presets.json'
        root = amendment_path.parent
        before_bytes = (root / amendment['beforeFile']).read_bytes()
        after_bytes = (root / amendment['afterFile']).read_bytes()
        assert hashlib.sha256(before_bytes).hexdigest() == amendment['beforeSHA256']
        assert hashlib.sha256(after_bytes).hexdigest() == amendment['afterSHA256']
        before, after = json.loads(before_bytes), json.loads(after_bytes)
        assert isinstance(before, list) and isinstance(after, list)
        assert all(isinstance(p, dict) for p in before + after)
        without_descriptions = lambda rows: [
            {key: value for key, value in row.items() if key != 'description'}
            for row in rows
        ]
        assert without_descriptions(before) == without_descriptions(after), 'Non-prose catalog change'
        assert before != after, 'Empty catalog amendment'
    used_amendment = False
    for binding in manifest['specification']['sourceBindings']['files']:
        actual = hashlib.sha256(Path(binding['path']).read_bytes()).hexdigest()
        if actual == binding['sha256']:
            continue
        assert amendment and binding['path'] == amendment['path'], 'Source changed: ' + binding['path']
        assert binding['sha256'] == amendment['beforeSHA256']
        assert actual == amendment['afterSHA256'], 'Unreviewed catalog amendment'
        used_amendment = True
    return amendment if used_amendment else None
