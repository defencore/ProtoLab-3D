#!/usr/bin/env python3
"""Rebuild exact DREMEC manufacturer rows and the normalized standoff snapshot.

The UA shop currently resets direct connections. The official manufacturer PDF
is the dimensional source; shop URLs establish the offered product families,
not stock, WooCommerce variation IDs, or a Cartesian product of dropdowns.
Requires Poppler pdftotext for --pdf/--refresh. --snapshot-only is offline.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src/catalog/dremec"
PDF_URL = "https://shop.dremec.de/api/downloads/Dremec_Katalog_Deutsch_doppelseitig.pdf"
SHOP = "https://dremec.ua/product/"

# Printed-page mappings are authored against the official catalog's index.
# A range on a row explicitly offers intermediate integer-mm lengths (p.6).
PAGE_MAP = {
    8: ("DII", "hex", "brass", "mama-mama-latyn"),
    9: ("DII", "hex", "brass", "mama-mama-unc"),
    10: ("DII", "hex", "steel", "mama-mama-stal"),
    11: ("DII", "hex", "aluminium", "mama-mama-aluminium"),
    12: ("DII", "hex", "stainless-steel", "mama-mama-stainless"),
    13: ("DII", "hex", "polyamide-brass", "mama-mama-polyamid-latun"),
    14: ("DII", "hex", "polyamide-brass", "mama-mama-polyamid-latun"),
    15: ("DII", "hex", "polyamide", "%D0%B4%D0%B8%D1%81%D1%82%D0%B0%D0%BD%D1%86%D1%96%D0%B9%D0%BD%D1%96-%D1%81%D1%82%D1%96%D0%B9%D0%BA%D0%B8-internal-internal-%D0%BF%D0%BE%D0%BB%D1%96%D0%B0%D0%BC%D1%96%D0%B4-%D1%87%D0%BE"),
    16: ("DII", "round", "polyamide", "mizhplatni-stiyki-polyamid-mama-mama"),
    17: ("DIA", "hex", "brass", "papa-mama-latyn"),
    18: ("DIA", "hex", "brass", "mama-papa-latun-selftapping"),
    19: ("DIA", "hex", "brass", "mama-papa-unc"),
    20: ("DIA", "hex", "steel", "papa-mama-stal"),
    21: ("DIA", "hex", "steel", "papa-mama-selftapping"),
    22: ("DIA", "hex", "aluminium", "papa-mama-aluminium"),
    23: ("DIA", "hex", "stainless-steel", "papa-mama-stainless"),
    24: ("DIA", "hex", "polyamide-brass", "papa-mama-polyamid-latyn"),
    25: ("DIA", "hex", "polyamide-brass", "papa-mama-polyamid-latyn"),
    26: ("DIA", "hex", "polyamide", "%D0%B4%D0%B8%D1%81%D1%82%D0%B0%D0%BD%D1%86%D1%96%D0%B9%D0%BD%D1%96-%D1%81%D1%82%D1%96%D0%B9%D0%BA%D0%B8-%D0%B2%D0%BD%D1%83%D1%82%D1%80%D1%96%D1%88%D0%BD%D1%8F-%D0%B7%D0%BE%D0%B2%D0%BD%D1%96%D1%88"),
    27: ("DIA", "round", "polyamide", "mizhplatni-stoyki-polyamid-mama-papa"),
    28: ("DAA", "hex", "brass", "papa-papa-latun"),
    29: ("DAA", "hex", "steel", "papa-papa-steel"),
    30: ("DAA", "hex", "aluminium", "papa-papa-aluminium"),
    31: ("DAA", "hex", "stainless-steel", "papa-papa-stainless"),
    32: ("DAA", "hex", "polyamide-brass", "dremec-daa-papa-papa-polyamidlatyn"),
    33: ("DAA", "hex", "polyamide-brass", "dremec-daa-papa-papa-polyamidlatyn"),
    34: ("DAA", "hex", "polyamide", "papa-papa-polyamid"),
}
GRADES = {
    "brass": "CuZn39Pb3 / 2.0401", "steel": "11SMnPb30 / 1.0718",
    "aluminium": "AlCuBiPb / 3.1655", "stainless-steel": "1.4305",
    "polyamide-brass": "Polyamide 6.6 body; CuZn39Pb3 brass thread inserts",
}
FINISHES = {"brass": "nickel-plated", "steel": "zinc-plated", "aluminium": "self-finish", "stainless-steel": "self-finish", "polyamide": "black", "polyamide-brass": "natural"}
THREAD = r"(?:UNC4-40|ST\d+(?:\.\d+)?|M\d+(?:\.\d+)?)"


def number(value):
    return float(value.replace(",", "."))


def pdf_pages(pdf):
    result = {}
    for page in range(5, 20):
        for side, x in [(0, 0), (1, 595)]:
            raw = subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), "-r", "72", "-x", str(x), "-y", "0", "-W", "595", "-H", "842", "-layout", str(pdf), "-"], capture_output=True, check=True).stdout.decode()
            result[(page - 1) * 2 + side] = raw
    return result


def parse_table(page, text):
    """Parse each printed size row; blank cells cannot become offered sizes."""
    rows = []
    if page not in PAGE_MAP:
        return rows
    for line in text.splitlines():
        match = re.match(r"^\s*(\d+(?:ST[\d.]+)?\s*(?:rd)?)\s*\u00d7\s*(?:\(L\u00e4nge\))?\s+(SW[\d.,]+|[\d.,]+)\s+(" + THREAD + r")\s+(.*)$", line)
        if not match:
            continue
        prefix, body, thread, rest = match.groups()
        prefix = re.sub(r"\s+", "", prefix)
        second = re.match("(" + THREAD + r")\s+(.*)", rest)
        threads = [thread]
        if second:
            threads.append(second[1]); rest = second[2]
        interval = re.match(r"(?:von\s+)?(\d+)\s*(?:mm\s+bis\s+|-)\s*(\d+)(?:\s+mm)?(?:\s|$)", rest.strip())
        if interval:
            lower, upper = map(int, interval.groups())
            lengths = list(range(lower, upper + 1))
            availability = "explicit-integer-length-range"
        elif re.fullmatch(r"\s*\d+(?:\s+\d+)*\s*", rest):
            lengths = [int(v) for v in rest.split()]
            availability = "explicit-length-cells"
        else:
            raise ValueError(f"Unparsed length cells on p.{page}: {line!r}")
        assert len(lengths) == len(set(lengths)) and lengths == sorted(lengths)
        rows.append({"prefix": prefix, "bodySize": number(body.removeprefix("SW")), "threads": threads, "lengths": lengths, "availability": availability, "sourceRow": line.strip(), "printedPage": page, "pdfPage": page // 2 + 1})
    return rows


def lookup(matrix, length, diameter, threshold=None):
    key = length if length in matrix else threshold if threshold is not None and length >= threshold else None
    if key is None:
        return None
    return matrix[key].get(diameter)


def columns(values, diameters):
    return dict(zip(diameters, values))


# Explicit L1 rows. Missing cells/lengths stay unresolved, including brass/steel
# DII L=6 and L=25, and aluminium DAA M2.5 L2 (not listed on p.30).
def depth(page, length, thread):
    if page == 9:
        return length
    if page == 19:
        return {5: 3, 6: 4}.get(length)
    if page in (13, 14, 24, 25):
        return {"M2.5": 6, "M3": 6, "M4": 6, "M5": 6, "M6": 10, "M8": 11}.get(thread)
    d = number(thread[1:]) if thread.startswith("M") else None
    if page in (15, 16):
        through_max = 14 if d in (2, 2.5) else 15 if d == 3 else 20
        return length if length <= through_max else length / 2 if length <= 20 else 10
    if page in (18, 21):
        return {8: 5, 10: 6, 12: 7, 15: 10, 20: 10}.get(length)
    if page in (26, 27):
        return (2.5 if length == 4 else (3.5 if page == 27 else 3) if length == 5 else 4 if length < 8 else 6 if length < 10 else 8 if length < 12 else 10)
    diameters = [2, 2.5, 3, 4, 5, 6, 8]
    if page in (8, 10):
        matrix = {5: [5]*7, 8: [8]*7, 10: [10]*7, 12: [6,12,12,12,12,12,12], 15: [6,15,15,15,15,15,15], 18: [6,9,9,9,9,9,18], 20: [6,10,10,10,10,10,20], 30: [6,10,10,10,10,12,14]}
        return lookup({k: columns(v, diameters) for k,v in matrix.items()}, length, d, 30)
    if page in (11, 12):
        matrix = {5: [5]*7, 8: [8]*7, 10: [10]*7, 12: [12]*7, 15: [6,7,7,15,15,15,15], 18: [6,7,7,9,9,9,18], 20: [6,7,7,9,10,10,20], 25: [6,7,7,9,10,12,12], 30: [6,7,7,9,10,12,14]}
        return lookup({k: columns(v, diameters) for k,v in matrix.items()}, length, d, 30)
    if page in (17, 20):
        matrix = {5: [3,3,3,3,3,None,None], 6: [4,4,4,4,4,None,None], 8: [5,5,5,5,5,None,None], 10: [6,6,6,6,6,6,None], 12: [6,7,7,7,7,7,None], 15: [6,10,10,10,10,10,10], 18: [6,10,10,10,10,10,10 if page==17 else None], 20: [6,10,10,10,10,12,14]}
        return lookup({k: columns(v, diameters) for k,v in matrix.items()}, length, d, 20)
    if page in (22, 23):
        matrix = {5: [2.5,2.5,2.5,None,None,None,None], 8: [5,5,5,5,None,None,None], 10: [6,6,6,6,6,5,None], 12: [6,7,7,8,8,7,None], 15: [6,7,7,9,10,10,10], 18: [6,7,7,9,10,12,12], 20: [6,7,7,9,10,12,14]}
        return lookup({k: columns(v, diameters) for k,v in matrix.items()}, length, d, 20)
    return None


def stud_lengths(page, thread, prefix, length):
    if page == 19:
        return [4,5,6,8,10,12] if length == 5 else [6,8]
    if page in (18,21):
        return [{"ST2.2":5,"ST2.9":6,"ST3.3":6,"ST3.5":7,"ST4.2":8,"ST4.8":8,"ST6.3":10}[thread]]
    if page in (24,25,32,33):
        return [{"M2.5":6,"M3":8,"M4":8,"M5":10,"M6":12,"M8":14}[thread]]
    if page in (26,27):
        return [10 if thread == "M6" else 8]
    if page == 34:
        return [{"M2.5":6,"M3":6,"M4":6.4}[thread]]
    if page == 30 and thread == "M2.5":
        return [None]
    regular = {"M2":5,"M2.5":6,"M3":8 if page in (17,28) else 6,"M4":8,"M5":8,"M6":10,"M8":14}
    return [regular[thread]]


def thread_diameter(thread):
    if not thread:
        return None
    # A metric nominal is contained in its designation. UNC #4 major diameter
    # and pitches are left to a separately evidenced thread-standard adapter.
    return number(thread[1:]) if thread.startswith("M") else None


def model_parameters(record):
    """Nullable source dimensions in the model's vocabulary, not CAD defaults."""
    kind, female, male = record["kind"], record["femaleThread"], record["maleThread"]
    same_thread = not female or not male or female == male
    male_end = "male"
    through = record["femaleThrough"] and kind == "DII"
    return {
        "profile": record["shape"], "endA": "female" if female else male_end,
        "endB": "female" if kind == "DII" else male_end,
        "bodyLength": record["bodyLength"],
        "bodyWidth": record["acrossFlats"] or record["bodyDiameter"],
        "cornerDiameter": None,
        "threadDiameter": thread_diameter(female or male) if same_thread else None,
        "threadPitch": None,
        "threadDesignation": female or male if same_thread else None,
        "threadDesignationA": female or male,
        "threadDesignationB": female if kind == "DII" else male,
        "threadDiameterA": thread_diameter(female or male),
        "threadDiameterB": record.get("selfTappingMajorDiameter", thread_diameter(female if kind == "DII" else male)),
        "threadRootDiameterA": None,
        "threadRootDiameterB": record.get("selfTappingRootDiameter"),
        "threadPitchA": None, "threadPitchB": None,
        "maleLengthA": record["maleThreadLength"] if kind == "DAA" else 0,
        "maleLengthB": record["maleThreadLength"] if male else 0,
        "femaleDepthA": 0 if through else record["femaleThreadDepth"] if female else 0,
        "femaleDepthB": 0 if through else record["femaleThreadDepth"] if kind == "DII" else 0,
        "femaleEnvelopeDepthA": None if female else 0,
        "femaleEnvelopeDepthB": None if kind == "DII" else 0,
        "boreDiameter": None, "throughBore": False,
        "threadedThrough": through,
        "appearance": {"brass":"nickel","steel":"steel","aluminium":"aluminium","stainless-steel":"steel","polyamide":"nylon-black","polyamide-brass":"nylon-white"}[record["material"]],
        **({"insertOuterDiameter":None,"insertLengthA":None,"insertLengthB":None,"insertThrough":None} if record["material"] == "polyamide-brass" else {}),
    }


def build(tables):
    records = []
    for row in tables["rows"]:
        page = row["printedPage"]
        kind, shape, material, slug = PAGE_MAP[page]
        female = row["threads"][-1] if kind == "DIA" and page != 19 else row["threads"][0] if kind != "DAA" else None
        male = row["threads"][-1] if page == 19 else row["threads"][0] if kind != "DII" else None
        for length in row["lengths"]:
            for stud in stud_lengths(page, male, row["prefix"], length) if male else [None]:
                sku = f'{row["prefix"]}x{length}' + (f"/{stud}" if page == 19 else "")
                female_depth = depth(page, length, female) if female else None
                missing = []
                if female and female_depth is None: missing.append("femaleThreadDepth")
                if male and stud is None: missing.append("maleThreadLength")
                record = {
                    "id": "dremec-" + sku.replace("/", "-"), "sku": sku,
                    "series": row["prefix"], "kind": kind, "shape": shape,
                    "material": material,
                    "materialGrade": GRADES.get(material, "Polyamide 6.0 glass-fiber reinforced" if kind == "DII" else "Polyamide 6.6"),
                    "finish": FINISHES[material], "bodyLength": length,
                    "acrossFlats": row["bodySize"] if shape == "hex" else None,
                    "bodyDiameter": row["bodySize"] if shape == "round" else None,
                    "femaleThread": female, "femaleThreadDepth": female_depth,
                    "femaleThrough": bool(female and female_depth == length),
                    "maleThread": male, "maleThreadLength": stud,
                    "overallLength": None if male and stud is None else length + (stud or 0) * (2 if kind == "DAA" else 1),
                    "supplierUrl": SHOP + slug + "/",
                    "drawingUrl": PDF_URL + f'#page={row["pdfPage"]}',
                    "printedPage": page, "pdfPage": row["pdfPage"],
                    "availabilityEvidence": row["availability"],
                    "sourceKind": "manufacturer-catalog",
                    "localVariationStatus": "not-confirmed", "variationId": None,
                    "missingDimensions": missing,
                    "relief": "DIN76-B" if material in ("brass","steel","aluminium","stainless-steel") and male else "none",
                    "optionalNoReliefSuffix": "oF" if material in ("brass","steel","aluminium","stainless-steel") and male else None,
                    "lengthTolerance": 0.2 if material == "polyamide-brass" else None if row["bodySize"] == 13 and material in ("steel","aluminium","stainless-steel") else 0.1,
                    "lengthToleranceStandard": "DIN2768-m" if row["bodySize"] == 13 and material in ("steel","aluminium","stainless-steel") else None,
                }
                if page in (18,21):
                    record["selfTappingMajorDiameter"] = {"ST2.2":2.1,"ST2.9":2.8,"ST3.3":3.2,"ST3.5":3.4,"ST4.2":4.1,"ST4.8":4.7,"ST6.3":6.1}[male]
                    record["selfTappingRootDiameter"] = {"ST2.2":1.6,"ST2.9":2.1,"ST3.3":2.3,"ST3.5":2.6,"ST4.2":3.0,"ST4.8":3.5,"ST6.3":4.8}[male]
                if row["prefix"] in ("213","214","413","414"):
                    record["shortStudOption"] = {"sku":sku+"k","maleThreadLength":6,"sourcePrintedPage":6}
                if material in ("brass","steel"):
                    record["optionalBareFinishSuffix"] = "bl"
                if material == "stainless-steel":
                    record["optionalA2Material"] = {"suffix":"A2","materialGrade":"1.4301","sourcePrintedPage":6}
                record["parameters"] = model_parameters(record)
                record["geometryNotes"] = ["Thread pitch, edge-break dimensions and detailed production profiles are not published by this catalog."]
                if kind == "DII" and female_depth is not None and 2*female_depth == length:
                    record["geometryNotes"].append("Opposing thread depths meet at the body midpoint; the table does not declare a continuous through thread or drill-tip geometry.")
                if material == "polyamide-brass":
                    record["geometryNotes"].append("Insert outside diameter, installation length and retention profile are not published; do not invent internal insert geometry.")
                if page in (26,34):
                    record["geometryNotes"].append("The indexed UA parent title says Polyamide 6.0 GV, while this 2020 manufacturer series specifies Polyamide 6.6; equivalence to the local listing is unconfirmed.")
                records.append(record)
    ids = [v["id"] for v in records]
    assert len(ids) == len(set(ids)), "Duplicate authored SKU"
    return records


def source_products(records):
    parents = {}
    for page, (kind, shape, material, slug) in PAGE_MAP.items():
        url = SHOP + slug + "/"
        thread_family = "UNC" if page in (9,19) else "self-tapping" if page in (18,21) else "metric"
        parents.setdefault(url, {"url":url,"name":f"DREMEC {kind} {shape} {material} {thread_family}","kind":kind,"shape":shape,"material":material,"threadFamily":thread_family,"parentSku":"DREMEC-M-M-LATUN" if page == 8 else None,"printedPages":[],"sourceKind":"indexed-UA-shop-listing","localVariationStatus":"not-confirmed"})["printedPages"].append(page)
    sleeves = []
    for material, slug, sku in [("brass","spacer-sleeves-latun",None),("steel","spacer-sleeves-steel","SLEEVE-ST-ZN"),("aluminium","spacer-sleeves-alu","SLEEVE-AL-SF"),("stainless-steel","spacer-sleeves-stainless",None)]:
        item = {"url":SHOP+slug+"/","name":"DREMEC DH metal sleeve "+material,"kind":"DH","shape":"round","material":material,"materialGrade":GRADES[material],"finish":FINISHES[material],"parentSku":sku,"printedPages":[36],"sourceKind":"indexed-UA-shop-listing","localVariationStatus":"not-confirmed","manufacturerRange":{"outerDiameterMin":4,"outerDiameterMax":36,"bodyLengthMin":1,"bodyLengthMax":60,"boreDiameter":"freely-selectable; dimensions must be specified by customer"},"drawingUrl":PDF_URL+"#page=19","fixedVariationRecords":[],"evidenceNotes":["Official p.36 publishes a custom size range, not a finite fixed-SKU dimension table.","UA dropdown sets do not prove all diameter/length combinations and do not specify the free bore."]}
        # This is the exact example actually printed on p.36, not an inferred
        # four-material cross-product or a local confirmed variation.
        if material == "steel":
            item["manufacturerOrderExample"] = {"sku":"324/2.1x10","bodyDiameter":4,"boreDiameter":2.1,"bodyLength":10,"printedPage":36,"evidenceKind":"printed-order-example"}
        sleeves.append(item); parents[item["url"]] = item
    assert len(parents) == 28
    for item in parents.values():
        item["manufacturerConfigurations"] = sum(v["supplierUrl"]==item["url"] for v in records)
    return {"schemaVersion":1,"shopUrl":"https://dremec.ua/shop/","shopPages":["https://dremec.ua/shop/","https://dremec.ua/shop/page/2/"],"listedParents":28,"listingEvidence":"Indexed public UA shop pages enumerate 20 + 8 parent products; direct UA transport resets and variation records are not confirmed.","products":list(parents.values())}


def save(name, value):
    target = TARGET / name
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=True, indent=2) + "\n")
    temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--snapshot-only", action="store_true")
    args = parser.parse_args()
    TARGET.mkdir(parents=True, exist_ok=True)
    tables_path = TARGET / "manufacturer-tables.json"
    if args.snapshot_only and (args.pdf or args.refresh or not tables_path.exists()):
        parser.error("--snapshot-only requires the saved tables and cannot refresh or parse a PDF.")
    if args.pdf or args.refresh or not tables_path.exists():
        pdf = args.pdf or Path("/tmp/protolab-dremec-catalog.pdf")
        if not args.pdf:
            with urllib.request.urlopen(PDF_URL, timeout=90) as response:
                pdf.write_bytes(response.read())
        pages = pdf_pages(pdf)
        rows = [r for p in PAGE_MAP for r in parse_table(p, pages[p])]
        counts = Counter(r["printedPage"] for r in rows)
        expected = {8:10,9:1,10:11,11:7,12:7,13:4,14:2,15:6,16:4,17:10,18:7,19:3,20:11,21:7,22:7,23:7,24:4,25:2,26:5,27:4,28:10,29:11,30:7,31:6,32:4,33:2,34:3}
        assert counts == expected, f"Unexpected table coverage: {dict(counts)}"
        tables = {"schemaVersion":1,"sourceUrl":PDF_URL,"sourceSha256":hashlib.sha256(pdf.read_bytes()).hexdigest(),"catalogModifiedAt":"2020-03-26","rows":rows}
        save("manufacturer-tables.json", tables)
    else:
        tables = json.loads(tables_path.read_text())
    records = build(tables)
    save("standoffs.json", {"schemaVersion":1,"sourceUrl":PDF_URL,"sourceSha256":tables["sourceSha256"],"catalogModifiedAt":tables["catalogModifiedAt"],"records":records})
    save("source-products.json", source_products(records))
    save("coverage.json", {"schemaVersion":1,"sourceUrl":PDF_URL,"sourceSha256":tables["sourceSha256"],"sourceRows":len(tables["rows"]),"catalogConfigurations":len(records),"completePrincipalDimensions":sum(not r["missingDimensions"] for r in records),"unresolvedPrincipalDimensions":sum(bool(r["missingDimensions"]) for r in records),"byType":dict(Counter(r["kind"] for r in records)),"byMaterial":dict(Counter(r["material"] for r in records)),"localVariationsConfirmed":0,"localStockConfirmed":False,"metalSleeves":"Supplier-declared custom outer diameter/bore/length; fixed catalog variants are not inferred.","excludedPrintedPages":[35,37],"scopeNotes":["Printed p.35 sign-holder construction is not one of the 28 UA product parents.","Printed p.37 nylon sleeves are outside the four offered UA metal sleeve parents.","Self-tapping pitch and DIN76-B relief dimensions are not supplied; principal dimensions do not imply exact production geometry.","Standard rows and explicit integer-length ranges are expanded; unspecified material/thread/length cross-products are not."]})
    print(json.dumps(json.loads((TARGET / "coverage.json").read_text()), ensure_ascii=True))


if __name__ == "__main__":
    main()
