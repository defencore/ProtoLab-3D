#!/usr/bin/env python3
"""Import every published product in the Kosmodrom M3 standoff category.

Public category/product HTML and linked dimensional PDFs are cached outside the
repository. No account, cart, checkout, prices or inventory data are imported.
Run with --offline --snapshot-date YYYY-MM-DD to reproduce a cached snapshot.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://kosmodrom.ua"
CATEGORY = BASE + "/mizhplatni-stiyki-z-rizblennyam-m3"

LABEL_KEYS = {
    "\u043c\u0430\u0442\u0435\u0440\u0456\u0430\u043b": "material",
    "\u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b": "material",
    "\u043c\u0430\u0442\u0435\u0440\u0456\u0430\u043b \u043f\u043e\u043a\u0440\u0438\u0442\u0442\u044f": "finish",
    "\u043f\u043e\u043a\u0440\u044b\u0442\u0438\u0435": "finish",
    "\u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u044f": "finish",
    "\u0444\u043e\u0440\u043c\u0430 \u0441\u0442\u0456\u0439\u043a\u0438": "profile",
    "\u0444\u043e\u0440\u043c\u0430 \u0441\u0442\u043e\u0439\u043a\u0438": "profile",
    "\u0432\u0456\u0434\u0441\u0442\u0430\u043d\u044c \u043c\u0456\u0436 \u043f\u043b\u0430\u0442\u0430\u043c\u0438": "bodyLength",
    "\u0434\u043e\u0432\u0436\u0438\u043d\u0430 \u0441\u0442\u0456\u0439\u043a\u0438": "bodyLength",
    "\u0440\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043c\u0435\u0436\u0434\u0443 \u043f\u043b\u0430\u0442\u0430\u043c\u0438": "bodyLength",
    "\u0434\u043b\u0438\u043d\u0430 \u0441\u0442\u043e\u0439\u043a\u0438": "bodyLength",
    "\u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0430 \u0434\u043e\u0432\u0436\u0438\u043d\u0430": "overallLength",
    "\u043e\u0431\u0449\u0430\u044f \u0434\u043b\u0438\u043d\u0430": "overallLength",
    "\u0440\u043e\u0437\u043c\u0456\u0440 \u043a\u043b\u044e\u0447\u0430": "bodyWidth",
    "\u0440\u0430\u0437\u043c\u0435\u0440 \u043a\u043b\u044e\u0447\u0430": "bodyWidth",
    "\u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0454 \u0440\u0456\u0437\u044c\u0431\u043b\u0435\u043d\u043d\u044f": "femaleThread",
    "\u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u044f \u0440\u0456\u0437\u044c\u0431\u0430": "femaleThread",
    "\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u0440\u0435\u0437\u044c\u0431\u0430": "femaleThread",
    "\u0437\u043e\u0432\u043d\u0456\u0448\u043d\u0454 \u0440\u0456\u0437\u044c\u0431\u043b\u0435\u043d\u043d\u044f": "maleThread",
    "\u043d\u0430\u0440\u0443\u0436\u043d\u0430\u044f \u0440\u0435\u0437\u044c\u0431\u0430": "maleThread",
    "\u0440\u0456\u0437\u044c\u0431\u043b\u0435\u043d\u043d\u044f": "genericThread",
    "\u0440\u0435\u0437\u044c\u0431\u0430": "genericThread",
    "\u0434\u043e\u0432\u0436\u0438\u043d\u0430 \u0440\u0456\u0437\u044c\u0431\u043b\u0435\u043d\u043d\u044f": "externalThreadLength",
    "\u0434\u043b\u0438\u043d\u0430 \u0440\u0435\u0437\u044c\u0431\u044b": "externalThreadLength"
}
WORDS = {
    "hex": [
        "\u0448\u0435\u0441\u0442\u0438\u0433\u0440\u0430\u043d",
        "hexagon"
    ],
    "round": [
        "\u043a\u0440\u0443\u0433\u043b",
        "\u0446\u0438\u043b\u0456\u043d\u0434\u0440",
        "\u0446\u0438\u043b\u0438\u043d\u0434\u0440"
    ],
    "brass": [
        "\u043b\u0430\u0442\u0443\u043d",
        "brass"
    ],
    "steel": [
        "\u0441\u0442\u0430\u043b\u044c",
        "steel"
    ],
    "nickel": [
        "\u043d\u0456\u043a\u0435\u043b\u044c",
        "\u043d\u0438\u043a\u0435\u043b\u044c",
        "nickel"
    ],
    "blackened": [
        "\u0447\u043e\u0440\u043d\u0435\u043d",
        "\u0447\u0435\u0440\u043d\u0435\u043d",
        "\u0447\u0435\u0440\u043d\u0451",
        "blackened"
    ],
    "doubleFemale": [
        "\u0434\u0432\u043e\u0441\u0442\u043e\u0440\u043e\u043d",
        "\u0434\u0432\u0443\u0441\u0442\u043e\u0440\u043e\u043d",
        "\u043c\u0430\u043c\u0430-\u043c\u0430\u043c\u0430",
        "\u043c\u0430\u043c\u0430/\u043c\u0430\u043c\u0430",
        "female/female"
    ],
    "doubleMale": [
        "\u0442\u0430\u0442\u043e/\u0442\u0430\u0442\u043e",
        "\u0442\u0430\u0442\u043e-\u0442\u0430\u0442\u043e",
        "\u043f\u0430\u043f\u0430/\u043f\u0430\u043f\u0430",
        "\u043f\u0430\u043f\u0430-\u043f\u0430\u043f\u0430",
        "male/male"
    ],
    "mixed": [
        "\u043c\u0430\u043c\u0430-\u0442\u0430\u0442\u043e",
        "\u043c\u0430\u043c\u0430/\u0442\u0430\u0442\u043e",
        "\u043c\u0430\u043c\u0430-\u043f\u0430\u043f\u0430",
        "\u043c\u0430\u043c\u0430/\u043f\u0430\u043f\u0430",
        "female/male"
    ],
    "femaleword": [
        "\u0432\u043d\u0443\u0442\u0440",
        "\u043e\u0442\u0432\u0456\u0440 \u043f\u0456\u0434 \u0433\u0432\u0438\u043d\u0442"
    ]
}


def clean(value):
    return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value or "")).split())


def table_rows(description):
    rows = []
    for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>", description or "", re.S | re.I):
        cells = [clean(cell) for cell in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.S | re.I)]
        if len(cells) >= 2:
            rows.append(cells)
    return rows


class Payloads(HTMLParser):
    def __init__(self):
        super().__init__()
        self.categories = []
        self.products = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "products-wrapper":
            self.categories.append((json.loads(attrs[":products"]), json.loads(attrs[":paginator"])))
        if tag == "by-block" and ":product" in attrs:
            product = json.loads(attrs[":product"])
            if isinstance(product, dict):
                self.products.append(product)


def payloads(source):
    parser = Payloads()
    parser.feed(source)
    return parser


def source_record(product):
    translations = product.get("translations") or []
    source = {
        "title": clean(product.get("title")),
        "shortDescription": clean(product.get("short_description")),
        "description": clean(product.get("description")),
        "tables": table_rows(product.get("description")),
        "translations": [
            {
                "locale": record["locale"],
                "title": clean(record.get("title")),
                "shortDescription": clean(record.get("short_description")),
                "description": clean(record.get("description")),
                "tables": table_rows(record.get("description")),
            }
            for record in translations
            if record.get("locale") in ("uk", "ru")
        ],
    }
    return source


def allowed_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "kosmodrom.ua":
        raise ValueError("Unexpected source host: " + url)
    if not (parsed.path.startswith(urlparse(CATEGORY).path) or parsed.path.startswith("/storage/pdf/")):
        raise ValueError("Unexpected source path: " + url)
    return url


class SourceCache:
    def __init__(self, directory, offline=False, refresh=False):
        self.directory, self.offline, self.refresh = directory, offline, refresh
        self.directory.mkdir(parents=True, exist_ok=True)

    def fetch(self, url, extension="html"):
        allowed_url(url)
        path = self.directory / (hashlib.sha256(url.encode()).hexdigest() + "." + extension)
        if path.exists() and not self.refresh:
            return path.read_bytes()
        if self.offline:
            raise ValueError("Missing offline source: " + url)
        error = None
        for attempt in range(3):
            # Use a fresh process on retry: curl --retry can concatenate partial stdout.
            result = subprocess.run(
                ["curl", "--fail", "--location", "--silent", "--show-error", "--max-time", "60",
                 "--user-agent", "ProtoLab-Catalog-Importer/1.0", url],
                capture_output=True,
            )
            if result.returncode == 0:
                temporary = path.with_suffix(path.suffix + ".tmp")
                temporary.write_bytes(result.stdout)
                temporary.replace(path)
                return result.stdout
            error = result.stderr.decode("utf-8", errors="replace").strip()
            if attempt < 2:
                time.sleep(2 ** attempt)
        raise ValueError("Could not fetch " + url + ": " + str(error))


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=True, indent=2) + "\n")
    temporary.replace(path)


def inventory(cache):
    pending = [(1, CATEGORY)]
    pages, products = {}, {}
    while pending:
        number, url = pending.pop(0)
        if number in pages:
            continue
        source = cache.fetch(url)
        parser = payloads(source.decode("utf-8"))
        if len(parser.categories) != 1:
            raise ValueError("Expected one public category product payload: " + url)
        rows, paginator = parser.categories[0]
        if paginator["current"] != number:
            raise ValueError("Category pagination did not match requested page: " + url)
        pages[number] = {
            "page": number, "url": url, "sha256": hashlib.sha256(source).hexdigest(),
            "productCount": len(rows), "lastPage": paginator["lastPage"],
        }
        for row in rows:
            if row["id"] in products:
                raise ValueError("Duplicate catalog product across pages: " + str(row["id"]))
            allowed_url(row["url"])
            products[row["id"]] = {**row, "sourceCategoryPage": url}
        for group in paginator["pages"]:
            for page, link in group.items():
                page = int(page)
                if page not in pages and all(page != candidate[0] for candidate in pending):
                    pending.append((page, allowed_url(link)))
        if paginator.get("nextPage"):
            following = number + 1
            if following not in pages and all(following != candidate[0] for candidate in pending):
                pending.append((following, allowed_url(paginator["nextPage"])))
        print(json.dumps({"phase": "category", "page": number, "products": len(rows)}), flush=True)
    last_page = max(page["lastPage"] for page in pages.values())
    if sorted(pages) != list(range(1, last_page + 1)):
        raise ValueError("The category pagination coverage is incomplete.")
    return list(products.values()), [pages[number] for number in sorted(pages)]


def fetch_product(cache, listed):
    url = listed["url"]
    source = cache.fetch(url)
    parser = payloads(source.decode("utf-8"))
    selected = [product for product in parser.products if product.get("id") == listed["id"]]
    if len(selected) != 1 or selected[0].get("code") != listed["code"]:
        raise ValueError("The product page does not match its category identity: " + url)
    product = selected[0]
    pdf = product.get("pdf")
    drawing_urls = [allowed_url(urljoin(BASE, "/storage/" + pdf.lstrip("/")))] if pdf else []
    variation_urls = sorted(set(
        item["url"] for item in product.get("replacements", [])
        if isinstance(item, dict) and item.get("url", "").startswith(CATEGORY + "/")
    ))
    return {
        "catalogId": product["id"], "sku": product["code"], "model": clean(product["title"]),
        "url": url, "categoryPage": listed["sourceCategoryPage"],
        "manufacturer": clean((product.get("brand") or {}).get("title")) or None,
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "source": source_record(product), "categorySource": source_record(listed),
        "drawingUrls": drawing_urls, "variationUrls": variation_urls,
    }


def numeric(value):
    match = re.search(r"(?<![\w.])(\d+(?:[.,]\d+)?)", value)
    return float(match[1].replace(",", ".")) if match else None


def contains(text, key):
    return any(word in text.casefold() for word in WORDS[key])


def normalize_product(record):
    parameters = dict.fromkeys([
        "profile", "endA", "endB", "bodyLength", "bodyWidth", "cornerDiameter", "threadDiameter",
        "threadPitch", "threadDesignation", "maleLengthA", "maleLengthB", "femaleDepthA", "femaleDepthB",
        "boreDiameter", "throughBore", "threadedThrough", "overallLength",
    ])
    evidence, issues, fields = {}, [], {}
    for row in record["source"]["tables"]:
        key = LABEL_KEYS.get(row[0].casefold().strip(" :"))
        if key:
            fields.setdefault(key, []).append(row[1])
            evidence.setdefault(key, []).append({"kind": "product-table", "label": row[0], "value": row[1]})
    text = (record["source"]["description"] + " " + record["source"]["shortDescription"]).casefold()
    for key in ("bodyLength", "bodyWidth", "overallLength"):
        values = {numeric(value) for value in fields.get(key, [])} - {None}
        if len(values) == 1:
            parameters[key] = values.pop()
        elif len(values) > 1:
            issues.append({"field": key, "reason": "Conflicting published table values", "values": sorted(values)})

    # A wrench-size label is explicit dimensional evidence; unrelated summary numbers are not.
    wrench_labels = [label for label, key in LABEL_KEYS.items() if key == "bodyWidth"]
    wrench = re.search("(?:" + "|".join(re.escape(label) for label in wrench_labels) + r")\s*:\s*(\d+(?:[.,]\d+)?)", text)
    if wrench:
        width = float(wrench[1].replace(",", "."))
        evidence.setdefault("bodyWidth", []).append({"kind": "product-short-description", "text": record["source"]["shortDescription"], "value": width})
        if parameters["bodyWidth"] is None:
            parameters["bodyWidth"] = width
        elif parameters["bodyWidth"] != width:
            issues.append({"field": "bodyWidth", "reason": "Table and short-description wrench widths conflict", "values": [parameters["bodyWidth"], width]})
            parameters["bodyWidth"] = None

    if contains(" ".join(fields.get("profile", [])), "hex") or contains(text, "hex"):
        parameters["profile"] = "hex"
        evidence.setdefault("profile", [{"kind": "product-description", "text": record["source"]["description"] + " " + record["source"]["shortDescription"]}])
    elif contains(" ".join(fields.get("profile", [])), "round"):
        parameters["profile"] = "round"
    material_text = " ".join(fields.get("material", [])).casefold()
    material = "brass" if contains(material_text, "brass") else "steel" if contains(material_text, "steel") else None
    finish_text = " ".join(fields.get("finish", [])) + " " + record["source"]["shortDescription"]
    finish = "nickel-plated" if contains(finish_text, "nickel") else "blackened" if contains(finish_text, "blackened") else None

    thread_values = fields.get("femaleThread", []) + fields.get("maleThread", []) + fields.get("genericThread", [])
    designations = set()
    for value in thread_values:
        match = re.search(r"M\s*(\d+(?:[.,]\d+)?)(?:\s*[xX\u00d7]\s*(\d+(?:[.,]\d+)?))?", value.replace("\u041c", "M").replace("\u043c", "M"), re.I)
        if match:
            designations.add("M" + match[1].replace(",", ".") + ("x" + match[2].replace(",", ".") if match[2] else ""))
    if len(designations) == 1:
        parameters["threadDesignation"] = next(iter(designations))
        parts = parameters["threadDesignation"][1:].split("x")
        parameters["threadDiameter"] = float(parts[0])
        thread_evidence = sum([evidence.get(key, []) for key in ("femaleThread", "maleThread", "genericThread")], [])
        evidence["threadDiameter"] = evidence["threadDesignation"] = thread_evidence
        if len(parts) == 2:
            parameters["threadPitch"] = float(parts[1])
    elif designations:
        issues.append({"field": "threadDesignation", "reason": "Different end-thread designations", "values": sorted(designations)})
    if fields.get("femaleThread") and fields.get("maleThread") or contains(text, "mixed"):
        parameters["endA"], parameters["endB"] = "female", "male"
    elif contains(text, "doubleFemale"):
        parameters["endA"], parameters["endB"] = "female", "female"
    elif contains(text, "doubleMale"):
        parameters["endA"], parameters["endB"] = "male", "male"
    elif fields.get("femaleThread") or contains(record["source"]["shortDescription"], "femaleword"):
        parameters["endA"] = "female"
    for end in ("A", "B"):
        if parameters["end" + end] is not None:
            evidence["end" + end] = [{"kind": "product-description", "text": record["source"]["description"] + " " + record["source"]["shortDescription"]}]

    lengths = fields.get("externalThreadLength", [])
    if parameters["endA"] == "female" and parameters["endB"] == "male" and lengths:
        values = {numeric(value) for value in lengths} - {None}
        if len(values) == 1:
            parameters["maleLengthB"] = values.pop()
            evidence["maleLengthB"] = evidence["externalThreadLength"]
    pair = re.search(r"(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*(?:\u043c\u043c|mm)", text)
    if parameters["endA"] == parameters["endB"] == "male" and pair:
        parameters["maleLengthA"], parameters["maleLengthB"] = [float(value.replace(",", ".")) for value in pair.groups()]
        evidence["maleLengths"] = [{"kind": "product-short-description", "text": record["source"]["shortDescription"]}]
        evidence["maleLengthA"] = evidence["maleLengthB"] = evidence["maleLengths"]
    if parameters["endA"] == "female" and parameters["endB"] == "male" and parameters["maleLengthB"] is None:
        if parameters["bodyLength"] is not None and parameters["overallLength"] is not None:
            extension = parameters["overallLength"] - parameters["bodyLength"]
            if extension > 0:
                parameters["maleLengthB"] = extension
                evidence["maleLengthB"] = [{"kind": "derived-from-published-dimensions", "formula": "overallLength - bodyLength", "value": extension}]

    designation = re.fullmatch(r"(TFF|TFM|TMM)(?:-(Ni|B))?-M(\d+)X(\d+(?:\.\d+)?)", record["model"], re.I)
    hints = {}
    if designation:
        family = designation[1].upper()
        hints = {"kind": "parsed-commercial-designation", "bodyLength": float(designation[4]),
                 "threadDiameter": float(designation[3]), "endA": "female" if family in ("TFF", "TFM") else "male",
                 "endB": "female" if family == "TFF" else "male"}
        if parameters["bodyLength"] is not None and parameters["bodyLength"] != hints["bodyLength"]:
            issues.append({"field": "bodyLength", "reason": "Published body length conflicts with the commercial designation", "tableValue": parameters["bodyLength"], "designationValue": hints["bodyLength"]})
            parameters["bodyLength"] = None
    drawing_evidence = []
    for url in record["drawingUrls"]:
        filename = url.rsplit("/", 1)[-1]
        if filename in ("KLS8-DBK.pdf", "KLS8-DBL.pdf"):
            item = {"url": url, "page": 1, "kind": "generic-linked-series-drawing", "series": filename[:-4],
                    "row": "M3", "D": "M3.0", "E": {"nominal": 5, "lowerDeviation": -0.2, "upperDeviation": 0},
                    "H": {"nominal": 5.5, "lowerDeviation": -0.2, "upperDeviation": 0},
                    "L": None, "B": None, "C": None,
                    "notes": ["E is across flats; H is the drawing's corner width.", "L, B and C are according to customer requirements; no numeric thread depth or stud length is published.", "No full corner profile or chamfer dimensions are specified."]}
            drawing_evidence.append(item)
            if parameters["threadDiameter"] == 3:
                parameters["throughBore"] = parameters["threadedThrough"] = False
                if parameters["profile"] is None:
                    parameters["profile"] = "hex"
                if parameters["bodyWidth"] is None and not any(issue["field"] == "bodyWidth" for issue in issues):
                    parameters["bodyWidth"] = 5
                    evidence["bodyWidth"] = [{"kind": "linked-drawing", "url": url, "symbol": "E", "nominal": 5}]
                if parameters["bodyWidth"] == 5:
                    parameters["cornerDiameter"] = 5.5
                    evidence["cornerDiameter"] = [{"kind": "linked-drawing", "url": url, "symbol": "H", "nominal": 5.5}]
                else:
                    issues.append({"field": "bodyWidth", "reason": "The linked generic drawing's E5 does not match the explicit product width", "productValue": parameters["bodyWidth"], "drawingValue": 5})
        elif filename == "PCHS.pdf":
            drawing_evidence.append({"url": url, "page": 1, "kind": "generic-linked-series-photo-sheet",
                                     "notes": ["PCHSS has two screw holes; PCHSN has one screw hole and one stud.", "No numeric thread depth, stud length, wrench size or hole connectivity is given."]})

    missing = [key for key in ("profile", "endA", "endB", "bodyLength", "bodyWidth", "threadDiameter") if parameters[key] is None]
    for end in ("A", "B"):
        if parameters["end" + end] == "male" and parameters["maleLength" + end] is None:
            missing.append("maleLength" + end)
        if parameters["end" + end] == "female" and parameters["femaleDepth" + end] is None:
            missing.append("femaleDepth" + end)
    return {"catalogId": record["catalogId"], "sku": record["sku"], "model": record["model"],
            "supplier": "Kosmodrom", "manufacturer": record["manufacturer"], "url": record["url"],
            "material": material, "finish": finish, "parameters": parameters,
            "designationHints": hints, "parameterEvidence": evidence, "drawings": drawing_evidence,
            "sourceSha256": record["sourceSha256"], "issues": issues, "missingGeometryFields": missing,
            "notes": ["Null means not published or unresolved; it is not a default zero.", "Commercial-designation hints are separate from explicit product dimensions.", "The supplier does not publish M3 pitch or exact chamfer geometry for this category."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/protolab-kosmodrom-cache"))
    parser.add_argument("--output", type=Path, default=ROOT / "src/catalog/kosmodrom")
    parser.add_argument("--snapshot-date", default=datetime.now(timezone.utc).date().isoformat())
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=3)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    if args.offline and args.refresh:
        parser.error("--offline and --refresh cannot be combined")
    cache = SourceCache(args.cache, args.offline, args.refresh)
    listed, pages = inventory(cache)
    products, errors = [], []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(fetch_product, cache, row): row for row in listed}
        for future in as_completed(jobs):
            row = jobs[future]
            try:
                products.append(future.result())
            except Exception as error:
                errors.append({"url": row["url"], "error": str(error)})
            if (len(products) + len(errors)) % 10 == 0 or errors:
                print(json.dumps({"phase": "products", "fetched": len(products), "errors": len(errors), "total": len(listed)}), flush=True)
    products.sort(key=lambda record: record["sku"])
    catalog_urls = {row["url"] for row in listed}
    for product in products:
        for url in product["variationUrls"]:
            if url not in catalog_urls:
                errors.append({"url": url, "error": "A linked category variation is absent from the pagination inventory."})
    drawings = []
    for url in sorted(set(url for product in products for url in product["drawingUrls"])):
        try:
            data = cache.fetch(url, "pdf")
            if not data.startswith(b"%PDF-"):
                raise ValueError("Linked drawing is not a PDF.")
            drawings.append({"url": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
        except Exception as error:
            errors.append({"url": url, "error": str(error)})
    snapshot = {"schemaVersion": 1, "supplier": "Kosmodrom", "categoryUrl": CATEGORY,
                "snapshotDate": args.snapshot_date, "products": products, "drawings": drawings}
    coverage = {"categoryUrl": CATEGORY, "snapshotDate": args.snapshot_date,
                "status": "complete" if not errors and len(products) == len(listed) else "incomplete",
                "pages": pages, "listedProducts": len(listed), "fetchedProducts": len(products),
                "skuCount": len(set(record["sku"] for record in products)),
                "productUrlCount": len(set(record["url"] for record in products)), "drawings": drawings,
                "errors": errors}
    if coverage["status"] != "complete":
        atomic_json(args.output / "coverage.incomplete.json", coverage)
        print(json.dumps({"phase": "incomplete", "products": len(products), "errors": errors}), flush=True)
        raise SystemExit(1)
    atomic_json(args.output / "source-products.json", snapshot)
    normalized = [normalize_product(record) for record in products]
    atomic_json(args.output / "m3-standoffs.json", {"schemaVersion": 1, "supplier": "Kosmodrom",
                "categoryUrl": CATEGORY, "snapshotDate": args.snapshot_date, "products": normalized})
    coverage["normalizedProducts"] = len(normalized)
    coverage["productsWithRequiredEnvelopeFields"] = sum(not record["missingGeometryFields"] and not record["issues"] for record in normalized)
    coverage["productsWithUnpublishedGeometry"] = sum(bool(record["missingGeometryFields"]) for record in normalized)
    coverage["productsWithSourceIssues"] = sum(bool(record["issues"]) for record in normalized)
    coverage["productsWithUnpublishedPitch"] = sum(record["parameters"]["threadPitch"] is None for record in normalized)
    coverage["exactManufacturingGeometryPublished"] = False
    atomic_json(args.output / "coverage.json", coverage)
    print(json.dumps({"phase": "complete", "products": len(products), "errors": errors, "drawings": len(drawings)}), flush=True)


if __name__ == "__main__":
    main()
