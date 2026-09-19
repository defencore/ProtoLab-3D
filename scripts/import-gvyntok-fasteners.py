#!/usr/bin/env python3
"""Import every public bolt/screw category page, retaining source rows and coverage.

Run explicitly to refresh the checked-in catalogue. No cart, account or checkout
requests are made. Discovered next-page links are followed without a page cap.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
START = "https://gvyntok.com/product-category/bolty-i-vinty/"


def clean(value):
    return html.unescape(re.sub(r"<[^>]*>", "", value)).strip()


def import_catalog(cache):
    cache.mkdir(parents=True, exist_ok=True)

    def fetch(url):
        file = cache / (hashlib.sha256(url.encode()).hexdigest() + ".html")
        if not file.exists():
            result = subprocess.run(
                ["curl", "--fail", "--location", "--silent", "--show-error", "--max-time", "45", url],
                capture_output=True, check=True,
            )
            file.write_bytes(result.stdout)
        return file.read_text()

    main = fetch(START)
    categories = {}
    for url, body in re.findall(r'<a class="iksm-term__link" href=[\'\"]([^\'\"]+)[\'\"](.*?)</a>', main, re.S):
        if "/product-category/bolty-i-vinty/" not in url or url.rstrip("/").endswith("bolty-i-vinty"):
            continue
        name = re.search(r'iksm-term__text">(.*?)</span>', body, re.S)
        count = re.search(r'iksm-term__posts-count__text"\s*>(.*?)</span>', body, re.S)
        categories[url] = {"url": html.unescape(url), "sourceTitle": clean(name.group(1)), "listedCount": int(clean(count.group(1)))}

    def crawl(category):
        url = category["url"]
        pages, products, errors = [], {}, []
        visible_count = None
        while url:
            if url in pages:
                errors.append("Repeated pagination URL: " + url)
                break
            try:
                page = fetch(url)
            except Exception as error:
                errors.append(str(error))
                break
            pages.append(url)
            if visible_count is None:
                count_text = re.search(r'<p class="woocommerce-result-count[^>]*>(.*?)</p>', page, re.S)
                counts = re.findall(r'\d+', clean(count_text.group(1))) if count_text else []
                visible_count = int(counts[-1]) if counts else None
                if count_text and "\u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u0442\u043e\u0432\u0430\u0440\u0430" in clean(count_text.group(1)):
                    visible_count = 1
            rows = re.findall(r'<p class="name product-title woocommerce-loop-product__title"><a href="([^"]+)"[^>]*>(.*?)</a></p>\s*<span class="sku">SKU:\s*([^<]+)', page, re.S)
            for product_url, name, sku in rows:
                name, sku = clean(name), clean(sku)
                standard = re.search(r'\b(DIN|ISO)\s*(\d+(?:-\d+)?)', category["sourceTitle"], re.I)
                sizes = re.search(r'(?<!\d)[\u043cm]?(\d+(?:[.,]\d+)?)\s*[\u0445x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[\u0445x×]\s*(\d+(?:[.,]\d+)?))?', name, re.I)
                diameter = length = pitch = None
                if sizes:
                    values = [float(value.replace(",", ".")) for value in sizes.groups() if value]
                    diameter, length = values[0], values[-1]
                    if len(values) == 3:
                        length, pitch = values[1], values[2]
                else:
                    nominal = re.search(r'[\u043cm](\d+(?:[.,]\d+)?)', name, re.I)
                    if nominal:
                        diameter = float(nominal.group(1).replace(",", "."))
                products[product_url] = {"sku": sku, "sourceTitle": name, "url": html.unescape(product_url),
                    "categoryUrl": category["url"], "standard": f"{standard.group(1).upper()} {standard.group(2)}" if standard else None,
                    "diameter": diameter, "length": length, "pitch": pitch}
            next_page = re.search(r'<link rel="next" href="([^"]+)"', page)
            url = urljoin(url, html.unescape(next_page.group(1))) if next_page else None
        summary = {**category, "visibleCount": visible_count, "pages": pages, "importedCount": len(products), "errors": errors}
        if len(products) != visible_count:
            summary["errors"].append(f"Category results list {visible_count} rows but extracted {len(products)} rows.")
        return summary, list(products.values())

    summaries, products = [], {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        tasks = [executor.submit(crawl, category) for category in categories.values()]
        for task in as_completed(tasks):
            summary, rows = task.result()
            summaries.append(summary)
            products.update({row["url"]: row for row in rows})
            print(summary["sourceTitle"], summary["importedCount"], "/", summary["listedCount"], flush=True)
    return {"source": START, "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "categories": sorted(summaries, key=lambda item: item["url"]),
        "products": sorted(products.values(), key=lambda item: item["sku"])}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/private/tmp/protolab-gvyntok-fasteners-cache"))
    args = parser.parse_args()
    data = import_catalog(args.cache)
    target = ROOT / "src/catalog/data/gvyntok-fasteners.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=True, separators=(",", ":")) + "\n")
    # Runtime rows omit the original-language evidence and repeated category URLs.
    categories = [item["url"] for item in data["categories"]]
    runtime = {"categories": categories, "rows": [[item["sku"], item["url"], categories.index(item["categoryUrl"]), item["standard"], item["diameter"], item["length"], item["pitch"]] for item in data["products"]]}
    (ROOT / "src/catalog/data/gvyntok-fasteners-runtime.json").write_text(json.dumps(runtime, ensure_ascii=True, separators=(",", ":")) + "\n")
    report = {"source": data["source"], "retrievedAt": data["retrievedAt"], "categories": len(data["categories"]),
        "listedProducts": sum(item["listedCount"] for item in data["categories"]),
        "visibleProducts": sum(item["visibleCount"] or 0 for item in data["categories"]),
        "importedProducts": len(data["products"]), "pages": sum(len(item["pages"]) for item in data["categories"]),
        "errors": [{"url": item["url"], "errors": item["errors"]} for item in data["categories"] if item["errors"]],
        "navigationCountDifferences": [{"url": item["url"], "navigation": item["listedCount"], "results": item["visibleCount"]} for item in data["categories"] if item["listedCount"] != item["visibleCount"]],
        "unparsedSizes": [item for item in data["products"] if item["diameter"] is None]}
    (ROOT / "src/catalog/data/gvyntok-fasteners-coverage.json").write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "unparsedSizes"}, ensure_ascii=True))
    if report["errors"]:
        raise SystemExit("Catalogue extraction was incomplete; inspect the coverage report.")
