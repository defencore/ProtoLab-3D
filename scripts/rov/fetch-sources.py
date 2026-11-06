"""Fetch the reviewed, SHA-256 locked public ROV sources. No upstream code is run.

python3 scripts/rov/fetch-sources.py [/tmp/protolab-rov]
"""
import hashlib
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

destination = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/protolab-rov')
sources = json.loads(Path(__file__).with_name('sources.json').read_text())


def fetch(source):
    path = destination / source['projectId'] / source['path']
    if not path.exists():
        data = urllib.request.urlopen(source['url'], timeout=90).read()
        if hashlib.sha256(data).hexdigest() != source['sha256']:
            raise ValueError('Unexpected source contents: ' + source['url'])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
        raise ValueError('Source checksum mismatch: ' + str(path))
    return source['projectId'] + '/' + source['path']


with ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(fetch, sources):
        print(result)
