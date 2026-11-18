"""Merge the hand-checked Würth list (scripts/data/wurth-curated.json) into the website catalogue data.

Run after scripts/build-catalogue-data.py (which writes oils/accessories/car-care data from the master xlsx).
Idempotent: removes any existing Würth rows from each target file, then adds the curated ones.
  OIL   -> assets/catalogue/oils-data.js        (WIAN_OILS)
  CARE  -> assets/catalogue/car-care-data.js    (WIAN_CARCARE, replaces the old Würth rows)
  LIGHT -> assets/catalogue/accessories-data.js (WIAN_ACCESSORIES)
  TOOLS -> assets/catalogue/tools-data.js       (WIAN_TOOLS, Würth only)
"""
import json, re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAT = ROOT / "assets" / "catalogue"
cur = json.loads((ROOT / "scripts" / "data" / "wurth-curated.json").read_text(encoding="utf-8"))
by = {}
for i in cur["items"]:
    item = {k: i[k] for k in ("group", "brand", "title", "part", "detail", "mrp", "apps")}
    by.setdefault(i["dest"], []).append(item)

def load(name):
    s = (CAT / name).read_text(encoding="utf-8")
    return json.loads(s[s.index("{"): s.rindex("}") + 1])

def dump(name, var, payload, header):
    (CAT / name).write_text(f"/* {header} Do not hand-edit. */\nwindow.{var} = " +
                            json.dumps(payload, ensure_ascii=False, indent=0) + ";\n", encoding="utf-8")

def litres(i):
    m = re.search(r"(\d+(?:\.\d+)?)\s?(L|LTR|ML)\b", (i["detail"] + " " + i["title"]).upper())
    if not m: return 0
    v = float(m.group(1)); return v / 1000 if m.group(2) == "ML" else v

GEN = "Generated from WIAN Master Product Catalogue (Sep 2026) + hand-checked Würth list (scripts/merge-wurth.py)."

oils = load("oils-data.js")
items = [i for i in oils["items"] if i["brand"] != "Würth"] + by.get("OIL", [])
for o in items:
    if litres(o) >= 20 and "Bulk / workshop pack" not in o["detail"]:
        o["detail"] = (o["detail"] + " · Bulk / workshop pack").strip(" ·")
BRAND_SECTIONS = ["Liqui Moly", "Würth"]          # own sections; every other brand goes to "Other brands"
for o in items:
    o["segment"] = o["brand"] if o["brand"] in BRAND_SECTIONS else "Other brands"
sec = lambda o: BRAND_SECTIONS.index(o["segment"]) if o["segment"] in BRAND_SECTIONS else len(BRAND_SECTIONS)
GROUP_ORDER = ["Engine oils", "Transmission & gear oils", "Coolant & brake fluid", "Additives", "Grease & lubricants", "Service & care products", "Motorbike"]
gro = lambda o: GROUP_ORDER.index(o["group"]) if o["group"] in GROUP_ORDER else len(GROUP_ORDER)
items.sort(key=lambda o: (sec(o), litres(o) >= 20, gro(o), o["brand"], o["title"]))
oils["items"] = items
oils["meta"]["source"] = "Liqui Moly retailer list 15 Jul 2025; Hella lube rate list; Würth Automotive Solutions catalogue"
dump("oils-data.js", "WIAN_OILS", oils, GEN)

acc = load("accessories-data.js")
acc["items"] = [i for i in acc["items"] if i["brand"] != "Würth"] + by.get("LIGHT", [])
acc["meta"]["source"] = "Car X price list; Würth Automotive Solutions catalogue"
dump("accessories-data.js", "WIAN_ACCESSORIES", acc, GEN)

care = load("car-care-data.js")
care["items"] = [i for i in care["items"] if i["brand"] != "Würth"] + sorted(by.get("CARE", []), key=lambda i: (i["group"], i["title"]))
care["meta"]["source"] = "Würth Automotive Solutions and Perfect Care catalogues (hand-checked)"
dump("car-care-data.js", "WIAN_CARCARE", care, GEN)

dump("tools-data.js", "WIAN_TOOLS", {"meta": {"source": "Würth Automotive Solutions catalogue Ver. 5.0 (hand-checked)"}, "items": by.get("TOOLS", [])}, GEN)
print({k: len(v) for k, v in by.items()}, "| oils total", len(oils["items"]), "| accessories", len(acc["items"]), "| car care", len(care["items"]))

# Re-attach product photos (assets/products/<brand>/<part>.webp) after regenerating the data files.
import subprocess
subprocess.run([sys.executable, str(ROOT / "scripts" / "add-product-images.py"), "apply"], check=True)
