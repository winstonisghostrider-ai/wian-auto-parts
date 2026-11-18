"""Import manufacturer product photos and attach them to catalogue items by part number.

Step 1 (import):  python3 scripts/add-product-images.py import "Liqui Moly" /path/to/unzipped/folder
    Finds images whose file or folder name contains a part number listed on the site for that brand,
    picks the best photo per part, trims the white border, fits it into 400x400 and saves
    assets/products/<brand-slug>/<part>.webp (about 6-15 KB each). Writes a match report.
Step 2 (apply):   python3 scripts/add-product-images.py apply
    Sets "img" on every catalogue item whose assets/products/<brand-slug>/<part>.webp exists.
    Run after build-catalogue-data.py / merge-wurth.py, because those regenerate the data files.
"""
import sys, re, json, pathlib
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAT, PROD = ROOT / "assets" / "catalogue", ROOT / "assets" / "products"
DATA = {"filters-data.js": "WIAN_FILTERS", "oils-data.js": "WIAN_OILS", "accessories-data.js": "WIAN_ACCESSORIES",
        "car-care-data.js": "WIAN_CARCARE", "tools-data.js": "WIAN_TOOLS", "cabin-imported-data.js": "WIAN_CABIN_IMPORTED"}
EXT = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
slug = lambda b: re.sub(r"[^a-z0-9]+", "-", b.lower().replace("ü", "u")).strip("-")
norm = lambda p: re.sub(r"[^0-9A-Za-z]", "", p or "").upper()

def load(name):
    s = (CAT / name).read_text(encoding="utf-8")
    return s[: s.index("{")], json.loads(s[s.index("{"): s.rindex("}") + 1]), s[s.rindex("}") + 1:]

def to_webp(src, dst):
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA"); bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg
    im = im.convert("RGB")
    diff = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))).convert("L").point(lambda v: 255 if v > 12 else 0)
    box = diff.getbbox()
    if box: im = im.crop(box)
    im.thumbnail((360, 360), Image.LANCZOS)
    canvas = Image.new("RGB", (400, 400), (255, 255, 255))
    canvas.paste(im, ((400 - im.width) // 2, (400 - im.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "WEBP", quality=78, method=6)

def do_import(brand, folder):
    parts = set()
    for name in DATA:
        if (CAT / name).exists():
            parts |= {norm(i["part"]) for i in load(name)[1]["items"] if i["brand"] == brand and i["part"]}
    files = [p for p in pathlib.Path(folder).rglob("*") if p.suffix.lower() in EXT and not p.name.startswith(".")]
    cands = {}
    for f in files:
        tokens = re.findall(r"(?<![0-9A-Za-z])([0-9][0-9A-Za-z]{2,13})(?![0-9A-Za-z])", f.stem + " " + f.parent.name)
        for t in {norm(t) for t in tokens} & parts:
            cands.setdefault(t, []).append(f)
    def score(f):  # prefer front/main shots, then the largest file
        n = f.name.lower()
        bonus = 2 if re.search(r"front|vorne|main|_v\b|_f\b", n) else 0
        bonus -= 2 if re.search(r"back|rueck|rück|side|detail|_r\b|group|set", n) else 0
        return (bonus, f.stat().st_size)
    report = {"brand": brand, "files_scanned": len(files), "matched": {}, "missing": sorted(parts - set(cands))}
    for part, fs in sorted(cands.items()):
        best = max(fs, key=score)
        to_webp(best, PROD / slug(brand) / f"{part}.webp")
        report["matched"][part] = {"used": str(best.relative_to(folder)), "alternatives": len(fs) - 1}
    out = ROOT / "scripts" / "data" / f"images-{slug(brand)}-report.json"
    out.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{brand}: {len(files)} files scanned, {len(cands)} of {len(parts)} parts matched, report {out.name}")

def do_apply():
    total = 0
    for name, var in DATA.items():
        if not (CAT / name).exists(): continue
        head, payload, tail = load(name); n = 0
        for i in payload["items"]:
            f = PROD / slug(i["brand"]) / f"{norm(i['part'])}.webp"
            if i["part"] and f.exists():
                i["img"] = f"/assets/products/{slug(i['brand'])}/{norm(i['part'])}.webp"; n += 1
        (CAT / name).write_text(head + json.dumps(payload, ensure_ascii=False, indent=0) + tail, encoding="utf-8")
        total += n; print(f"{name}: {n} items with photos")
    print("total", total)

if __name__ == "__main__":
    if sys.argv[1:2] == ["import"]: do_import(sys.argv[2], sys.argv[3])
    elif sys.argv[1:2] == ["apply"]: do_apply()
    else: print(__doc__)
