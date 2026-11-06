"""Build website catalogue data (assets/catalogue/*.js) from the WIAN Master Product Catalogue xlsx (Ready rows only).
Usage: python3 scripts/build-catalogue-data.py "WIAN Master Product Catalogue.xlsx" assets/catalogue"""
import sys, re, json
import pandas as pd

SRC, OUT = sys.argv[1], sys.argv[2]
x = pd.read_excel(SRC, sheet_name="Website Product Index")
x = x[x["Website Status"] == "Ready"].copy()
report = {}

def mrp(v):
    try:
        v = float(v)
        return int(round(v)) if v > 0 else None
    except (TypeError, ValueError):
        return None

def s(v):
    return "" if pd.isna(v) else str(v).strip()

# ---------------- WIX filters ----------------
CUT = re.compile(r"(\s\d{5,}\b|MPQ|HSN|\br Ref No|OE Ref|Competitor Ref|\||Picture for reference|MRP in INR)", re.I)
CV = re.compile(r"\b(ashok leyland|eicher|bharat ?benz|hino|man tipper|tata (prima|lpt|ultra|\d{3,4})|truck|tipper|haulage|"
                r"maxximo|cummins|super ace|bada dost|dost|ace\b|407|cargo|bus|tractor|forklift|jcb|excavator|lynx|boss|"
                r"tata 1\d{3}|tata 2\d{3}|tata 3\d{3}|tata 4\d{3}|comet|partner|guru|captain|ecomet|signa|mahindra 13t|blazo|furio|jayo)\b", re.I)
TYPE = {"WA": "Air filter", "WL": "Oil filter", "WF": "Fuel filter", "WP": "Cabin filter", "WS": "Filter kit"}
wix, dropped = [], []
for _, r in x[x.Brand == "WIX"].iterrows():
    pn = s(r["Part Number"])
    if pn.upper().startswith("WP"):
        continue  # cabin filters live on /parts/, transcribed and checked row by row
    app = s(r["Vehicle / Applications"])
    m = CUT.search(app)
    clean = app[: m.start()].strip(" ,;-|") if m else app
    clean = re.sub(r"\s+", " ", clean)
    clean = re.sub(r"^(?:[^A-Za-z]+|[a-z]\s+)", "", clean).strip(" ,;-|/")
    clean = re.sub(r"\s+(?:9400|9090|39090|Ref No|r Ref)\s*$", "", clean).strip(" ,;-|/")
    bad = (len(clean) < 3 or len(clean) > 130 or " " not in clean or clean.lower().startswith(("air filter", "fuel f", "oil filter", "ck ", "- ", "1a)", "ltr "))
           or re.search(r"\d{6,}", clean))
    if bad:
        dropped.append((pn, app[:80])); continue
    kind = TYPE.get(pn[:2].upper(), "Filter")
    if pn.upper().startswith("WS"): kind = "Filter kit"
    title = s(r["Website Product Title"])
    if "(Imported)" in title: kind += " (imported)"
    seg = "Commercial vehicle" if CV.search(clean) else "Passenger car"
    wix.append({"group": kind.replace(" (imported)", "") + "s" if not kind.endswith("kit") else "Filter kits",
                "segment": seg, "brand": "WIX", "title": clean, "part": pn, "detail": kind,
                "mrp": mrp(r["MRP"]), "apps": ""})
report["wix_kept"], report["wix_dropped"] = len(wix), len(dropped)
report["wix_segments"] = pd.Series([w["segment"] for w in wix]).value_counts().to_dict()

# ---------------- Oils & fluids: Liqui Moly + Hella ----------------
def oil_group(sub, title):
    t = (sub + " " + title).lower()
    if any(k in t for k in ("motorbike", "street", "off road", "fork oil", "2w ")): return "Motorbike"
    if "additive" in t: return "Additives"
    if any(k in t for k in ("transmission", "atf", "gear oil", "gear", "steering")): return "Transmission & gear oils"
    if any(k in t for k in ("radiator", "coolant", "break fluid", "brake fluid")): return "Coolant & brake fluid"
    if any(k in t for k in ("grease", "paste", "hydraulic", "lubricant")): return "Grease & lubricants"
    if "engine oil" in t or "leichlauf" in t: return "Engine oils"
    return "Service & care products"
oils = []
for _, r in x[x.Brand.isin(["Liqui Moly", "Hella"])].iterrows():
    title = s(r["Website Product Title"])
    pn = s(r["Part Number"])
    title = re.sub(r"\s*\(" + re.escape(pn) + r"\)\s*$", "", title) if pn else title
    title = re.sub(r"^(Liqui Moly|Hella)\s+", "", title)
    sub = s(r["Website Subcategory"])
    pack = s(r["Pack Size"])
    if not pack:
        m = re.search(r"(\d+(?:\.\d+)?\s?(?:L|LTR|ML|ml|Kg|KG|g|GM))\b", title, re.I)
        pack = m.group(1) if m else ""
    apps = s(r["Vehicle / Applications"]).replace(" , ", ", ")
    oils.append({"group": oil_group(sub, title), "brand": s(r["Brand"]), "title": title, "part": pn,
                 "detail": pack, "mrp": mrp(r["MRP"]), "apps": apps})
report["oils"] = len(oils)

# ---------------- Car X: transcribed from the PDF (catalogue rows were partly garbled) ----------------
carx = [
 {"group": "LED headlamps (cars)", "brand": "Car X", "title": "Panther Beam LED 130W", "part": "", "detail": "6000K · 2-year warranty", "mrp": 6499, "apps": "Bulb type per vehicle"},
 {"group": "LED headlamps (cars)", "brand": "Car X", "title": "Panther Beam LED 200W", "part": "", "detail": "6000K / 4300K · 2-year warranty", "mrp": 11999, "apps": "Bulb type per vehicle"},
 {"group": "LED headlamps (cars)", "brand": "Car X", "title": "Panther Beam LED 260W", "part": "", "detail": "6000K / 4300K · 2-year warranty", "mrp": 14999, "apps": "Bulb type per vehicle"},
 {"group": "Fog lamp projectors", "brand": "Car X", "title": "Fog Lamp Projector 70W", "part": "", "detail": "1 colour · 2-year warranty", "mrp": 14999, "apps": ""},
 {"group": "Fog lamp projectors", "brand": "Car X", "title": "Fog Lamp Projector 90W", "part": "", "detail": "3 colour · 2-year warranty", "mrp": 16999, "apps": ""},
 {"group": "Fog lamp projectors", "brand": "Car X", "title": "Fog Lamp Projector 110W", "part": "", "detail": "1 colour + 2 laser · 2-year warranty", "mrp": 18999, "apps": ""},
 {"group": "Dash cameras", "brand": "Car X", "title": "2K Dash Camera (4MP)", "part": "", "detail": "Rear camera 1080p, 2-inch screen · 1-year warranty", "mrp": 10999, "apps": ""},
 {"group": "Dash cameras", "brand": "Car X", "title": "4K Dash Camera (8MP)", "part": "", "detail": "Rear camera 1080p, 1.47-inch screen · 1-year warranty", "mrp": 14999, "apps": ""},
 {"group": "LED headlamps (bikes)", "brand": "Car X", "title": "Panther Beam LED Bike 14W", "part": "", "detail": "6000K · 6-month warranty", "mrp": 580, "apps": ""},
 {"group": "LED headlamps (bikes)", "brand": "Car X", "title": "Panther Beam LED Bike 36W", "part": "", "detail": "6000K · 6-month warranty", "mrp": 999, "apps": ""},
 {"group": "LED headlamps (bikes)", "brand": "Car X", "title": "Panther Beam LED Bike 48W", "part": "", "detail": "6000K · 1-year warranty", "mrp": 1499, "apps": ""},
 {"group": "Car care accessories", "brand": "Car X", "title": "Microfibre cloth 600 GSM", "part": "", "detail": "", "mrp": 599, "apps": ""},
 {"group": "Car care accessories", "brand": "Car X", "title": "Microfibre cloth 1200 GSM", "part": "", "detail": "", "mrp": 1199, "apps": ""},
 {"group": "Phone holders", "brand": "Car X", "title": "Mobile Holder One – Twist Lock (Alpha)", "part": "", "detail": "6-month warranty", "mrp": None, "apps": ""},
 {"group": "Phone holders", "brand": "Car X", "title": "Mobile Holder One – Alpha Charge (USB)", "part": "", "detail": "6-month warranty", "mrp": None, "apps": ""},
]

# ---------------- Würth: Ready rows only ----------------
wurth = []
for _, r in x[x.Brand == "Würth"].iterrows():
    if s(r["Website Subcategory"]) == "Car Care Services / Treatments":
        continue  # workshop treatments, not products — publish only once WIAN offers them
    title = re.sub(r"^Würth\s+", "", s(r["Website Product Title"]))
    pn = s(r["Part Number"])
    title = re.sub(r"\s*\(" + re.escape(pn) + r"\)\s*$", "", title) if pn else title
    if not title or title[0].islower() or title.upper() in ("SOLVENT-FREE",) or title.endswith(".") or title.lower().startswith("removes "):
        continue
    title = title.title() if title.isupper() else title
    title = re.sub(r"(\d)\s?Ml\b", r"\1 ml", title).replace("Hhs ", "HHS ").replace("_", " ").replace("Step1", "Step 1").replace("Step3", "Step 3")
    wurth.append({"group": s(r["Website Subcategory"]) or s(r["Category"]), "brand": "Würth", "title": title,
                  "part": pn, "detail": s(r["Pack Size"]), "mrp": mrp(r["MRP"]), "apps": ""})
report["wurth"] = len(wurth)

def litres(i):
    m = re.search(r"(\d+(?:\.\d+)?)\s?(L|LTR|ML)\b", (i["detail"] + " " + i["title"]).upper())
    if not m: return 0
    v = float(m.group(1)); return v / 1000 if m.group(2) == "ML" else v
for o in oils:
    if litres(o) >= 20:
        o["detail"] = (o["detail"] + " · Bulk / workshop pack").strip(" ·")
oils.sort(key=lambda o: (litres(o) >= 20, o["group"], o["brand"], o["title"]))
wix.sort(key=lambda w: (w["segment"] != "Passenger car", w["group"], w["title"].lower()))

def dump(name, var, items, meta):
    payload = {"meta": meta, "items": items}
    open(f"{OUT}/{name}", "w", encoding="utf-8").write(
        f"/* Generated from WIAN Master Product Catalogue (Sep 2026), Ready rows only. Do not hand-edit. */\nwindow.{var} = " +
        json.dumps(payload, ensure_ascii=False, indent=0) + ";\n")

dump("filters-data.js", "WIAN_FILTERS", wix, {"source": "WIX NPI 2022–2025 and WIX picture catalogues Sep 2025"})
dump("oils-data.js", "WIAN_OILS", oils, {"source": "Liqui Moly retailer list 15 Jul 2025; Hella lube rate list"})
dump("accessories-data.js", "WIAN_ACCESSORIES", carx, {"source": "Car X price list"})
dump("car-care-data.js", "WIAN_CARCARE", wurth, {"source": "Würth VAS 2024, Perfect Care 2021, Automotive 2025 (Ready rows)"})
print(json.dumps(report, indent=1))
print("\nDROPPED WIX (first 15):"); [print(" ", d) for d in dropped[:15]]
print("\nWIX sample:"); [print(" ", w["segment"][:2], w["part"], "|", w["title"], "|", w["mrp"]) for w in wix[::12]]
print("\nWürth:"); [print(" ", w["group"], "|", w["title"][:70], "|", w["part"], "|", w["mrp"]) for w in wurth]
print("\nOil groups:", pd.Series([o["group"] for o in oils]).value_counts().to_dict())
