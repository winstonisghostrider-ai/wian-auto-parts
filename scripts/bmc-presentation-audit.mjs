import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Dependency-free behavioural checks; browser layout/visual QA is separate.
const root = path.resolve(import.meta.dirname, "..");
const readJSON = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const sourceManifest = readJSON("data/bmc-products.json");
const rawProducts = sourceManifest.chunks.flatMap((name) => readJSON(`data/${name}`));
// Keep this independent from the production classification predicate: the
// source intake kit is retained internally but must not enter Phase 1 UI.
const expectedPublicProducts = rawProducts.filter((product) => product.p !== "ACOTASP-33");
const imageManifest = readJSON("data/bmc-product-images.json");
const source = fs.readFileSync(path.join(root, "products/bmc/catalogue.js"), "utf8");
const forbiddenCopy = /MRP|₹|incl\.\s*GST|Source Listed|Exact SKU image|being verified|verification pending|image coming soon|July 2024|internal review/i;
const decode = (value) => String(value).replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[entity]));

// Only the DOM operations used by catalogue.js are implemented. The real
// production script still creates its own markup and binds its own handlers.
class Element {
  constructor(tag = "div", attributes = {}) {
    this.tagName = tag;
    this.attributes = attributes;
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.style = {};
    this.hidden = false;
    this.value = "";
    this.complete = false;
    this.naturalWidth = 1200;
  }
  get dataset() {
    return Object.fromEntries(Object.entries(this.attributes).filter(([key]) => key.startsWith("data-")).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
  }
  matches(selector) {
    if (selector.startsWith(".")) return (this.attributes.class || "").split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith("#")) return this.attributes.id === selector.slice(1);
    const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attr) return attr[2] === undefined ? Object.hasOwn(this.attributes, attr[1]) : this.attributes[attr[1]] === attr[2];
    return this.tagName === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => typeof child === "string" ? [] : [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  closest(selector) {
    for (let element = this; element; element = element.parentElement) if (element.matches(selector)) return element;
    return null;
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  addEventListener(type, callback, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ callback, once: options.once });
    this.listeners.set(type, entries);
  }
  dispatch(type, extras = {}) {
    const entries = this.listeners.get(type) || [];
    for (const entry of [...entries]) entry.callback({ target: this, ...extras });
    this.listeners.set(type, entries.filter((entry) => !entry.once));
  }
  focus() { this.focused = true; }
  get textContent() { return this.children.map((child) => typeof child === "string" ? decode(child) : child.textContent).join(""); }
  set textContent(value) { this.children = [String(value)]; }
  get innerHTML() {
    return this.children.map((child) => {
      if (typeof child === "string") return child;
      const attributes = Object.entries(child.attributes).map(([key, value]) => ` ${key}="${value}"`).join("");
      return `<${child.tagName}${attributes}>${child.innerHTML}</${child.tagName}>`;
    }).join("");
  }
  set innerHTML(html) {
    this.children = [];
    const stack = [this];
    for (const token of String(html).match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith("</")) { stack.pop(); continue; }
      if (!token.startsWith("<")) { stack.at(-1).children.push(token); continue; }
      const tag = /^<([a-z0-9-]+)/i.exec(token)?.[1];
      if (!tag) continue;
      const attributes = Object.fromEntries([...token.matchAll(/([a-z][a-z0-9-]*)="([^"]*)"/gi)].map((match) => [match[1], decode(match[2])]));
      const element = new Element(tag, attributes);
      element.parentElement = stack.at(-1);
      element.parentElement.children.push(element);
      if (!["img", "input", "br", "hr", "meta", "link"].includes(tag) && !token.endsWith("/>")) stack.push(element);
    }
  }
}

async function boot({ images = imageManifest, imageFailure = null } = {}) {
  const body = new Element("body");
  const elements = Object.fromEntries(["productGrid", "resultCount", "emptyState", "searchInput", "clearSearch", "modalClose", "modalBackdrop", "modalContent"].map((id) => {
    const element = new Element("div", { id });
    element.parentElement = body;
    body.children.push(element);
    return [id, element];
  }));
  const document = new Element("document");
  document.body = body;
  document.children = [body];
  document.getElementById = (id) => elements[id];
  const errors = [];
  const requests = [];
  const context = vm.createContext({
    document,
    console: { error: (...messages) => errors.push(messages), warn() {}, log() {} },
    fetch: async (url) => {
      requests.push(url);
      const pathname = url.split("?")[0];
      if (pathname === "/data/bmc-product-images.json") {
        if (imageFailure === "network") throw new Error("Simulated unavailable image manifest");
        return { ok: imageFailure !== "http", status: imageFailure === "http" ? 404 : 200, json: async () => {
          if (imageFailure === "json") throw new SyntaxError("Simulated malformed image manifest JSON");
          return images;
        } };
      }
      return { ok: true, status: 200, json: async () => readJSON(pathname.slice(1)) };
    }
  });
  // Expose existing functions and await init in this VM only, without changing
  // the shipped implementation or running a separate copy of renderer logic.
  const instrumented = source.replace(/\binit\(\);\s*\}\)\(\);\s*$/, "globalThis.__audit = { state, normalize, card, openDetails, render, bindImageFallbacks }; globalThis.__ready = init();\n})();");
  assert.notEqual(instrumented, source, "Audit hook must match the production IIFE");
  vm.runInContext(instrumented, context, { filename: "products/bmc/catalogue.js" });
  await context.__ready;
  assert.equal(errors.length, 0, "Catalogue must initialize without console errors");
  return { ...elements, document, errors, requests, api: context.__audit };
}

function cleanPublicCopy(element) {
  assert.doesNotMatch(element.textContent, forbiddenCopy, "No source/status/internal price text may leak into public output");
  assert.doesNotMatch(element.innerHTML, /product-placeholder|placeholder-media/, "No placeholder image stage may render");
}

function assertCatalogue(harness, imageCount) {
  const cards = harness.productGrid.querySelectorAll("article");
  assert.equal(cards.length, 239);
  assert.equal(Number(harness.resultCount.textContent), 239);
  assert.equal(harness.emptyState.hidden, true);
  assert.equal(harness.productGrid.querySelectorAll("img").length, imageCount);
  cleanPublicCopy(harness.productGrid);
  assert.doesNotMatch(harness.productGrid.textContent, /ACOTASP-33|cold[ -]?air[ -]?intake|induction kit|Oval Trumpet Air[ -]?Box/i);
  for (const card of cards) {
    assert.equal(card.querySelectorAll(".price").length, 1);
    assert.equal(card.querySelectorAll(".price")[0].textContent, "Enquire for Price");
    assert.equal(card.querySelectorAll("[data-details]").length, 1);
    assert.equal(card.querySelectorAll(".whatsapp").length, 1);
    assert.equal(card.querySelectorAll(".product-media").length, card.querySelectorAll("img").length);
  }
  return cards;
}

const main = await boot();
const cards = assertCatalogue(main, 3);
assert.match(source, /const SHOW_BMC_PUBLIC_PRICES\s*=\s*false/);
assert.equal(rawProducts.length, 240, "All 240 source products must remain available internally");
assert.equal(expectedPublicProducts.length, 239);
assert.equal(rawProducts.filter((product) => typeof product.m === "number").length, 236);
assert.ok(rawProducts.some((product) => product.p === "ACOTASP-33"), "Withheld intake source record must not be deleted");
assert.equal(main.api.state.products.some((product) => product.part_number === "ACOTASP-33"), false);
for (const raw of rawProducts) {
  const normalized = main.api.normalize(raw);
  assert.equal(normalized.mrp, raw.m, `${raw.p}: normalized source MRP must remain intact`);
  assert.equal(normalized.applications.length, raw.a.length, `${raw.p}: fitment rows must remain intact`);
  if (raw.p !== "ACOTASP-33") {
    const renderedProduct = main.api.state.products.find((product) => product.part_number === raw.p);
    assert.ok(renderedProduct, `${raw.p}: replacement filter must remain in Phase 1`);
    assert.equal(renderedProduct.mrp, raw.m);
    assert.equal(renderedProduct.applications.length, raw.a.length);
  }
}

assert.equal(imageManifest.length, 3);
for (const entry of imageManifest) {
  assert.equal(entry.verification, "VERIFIED EXACT");
  assert.ok(rawProducts.some((product) => product.p === entry.part_number));
  assert.ok(fs.statSync(path.join(root, entry.image_path)).isFile());
  const image = main.productGrid.querySelectorAll("img").find((element) => element.dataset.bmcProductImage === entry.part_number);
  assert.ok(image, `${entry.part_number}: exact photo must render despite hidden prices`);
  assert.equal(image.attributes.src, `/${entry.image_path}`);
  assert.match(entry.source_image_url, /^https:\/\/www\.bmcairfilters\.com\//);
}

const imageless = cards.filter((card) => !card.querySelectorAll("img").length);
assert.equal(imageless.length, 236);
for (const card of imageless.slice(0, 12)) {
  assert.equal(card.querySelectorAll(".product-media").length, 0);
  card.querySelectorAll("[data-details]")[0].dispatch("click");
  assert.equal(main.modalBackdrop.hidden, false);
  assert.equal(main.modalContent.querySelectorAll(".product-media").length, 0);
  assert.equal(main.modalContent.querySelectorAll(".whatsapp").length, 1);
  assert.equal(main.modalContent.querySelectorAll(".price")[0].textContent, "Enquire for Price");
  cleanPublicCopy(main.modalContent);
  main.modalClose.dispatch("click");
  assert.equal(main.modalBackdrop.hidden, true);
}
for (const entry of imageManifest) {
  main.api.openDetails(entry.part_number);
  assert.equal(main.modalContent.querySelectorAll("img").length, 1);
  assert.equal(main.modalContent.querySelectorAll("img")[0].attributes.src, `/${entry.image_path}`);
  const whatsapp = main.modalContent.querySelectorAll(".whatsapp")[0].attributes.href;
  assert.ok(whatsapp.startsWith("https://wa.me/919108327761?text="));
  assert.ok(decodeURIComponent(whatsapp).includes(entry.part_number));
  cleanPublicCopy(main.modalContent);
}
const priceConflicts = rawProducts.filter((product) => product.s === "C");
assert.equal(priceConflicts.length, 4);
for (const product of priceConflicts) {
  main.api.openDetails(product.p);
  assert.equal(main.modalContent.querySelectorAll(".price")[0].textContent, "Enquire for Price");
  cleanPublicCopy(main.modalContent);
}
main.document.dispatch("keydown", { key: "Escape" });
assert.equal(main.modalBackdrop.hidden, true);
assert.equal(main.document.body.style.overflow, "");

for (const query of ["FB01020", "volkswagen", "1.5", "ACOTASP-33", "cold air intake", "not-a-real-bmc-part-zzz"]) {
  main.searchInput.value = query;
  main.searchInput.dispatch("input");
  const expected = expectedPublicProducts.filter((product) => [product.p, ...product.a.flat()].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())).length;
  if (["ACOTASP-33", "cold air intake"].includes(query)) assert.equal(expected, 0);
  assert.equal(Number(main.resultCount.textContent), expected, `Search matches preserved data: ${query}`);
  assert.equal(main.emptyState.hidden, expected !== 0);
  cleanPublicCopy(main.productGrid);
}
main.api.openDetails("ACOTASP-33");
assert.equal(main.modalBackdrop.hidden, true, "Withheld intake kit cannot be opened through the details function");
main.clearSearch.dispatch("click");
assert.equal(main.searchInput.value, "");
assert.equal(main.searchInput.focused, true);
assertCatalogue(main, 3);

const broken = main.productGrid.querySelectorAll("img")[0];
const brokenPart = broken.dataset.bmcProductImage;
const brokenCard = broken.closest(".product-card");
broken.dispatch("error");
assert.equal(brokenCard.querySelectorAll(".product-media").length, 0, "A failed image must collapse its entire stage");
main.api.render();
assertCatalogue(main, 2);
main.api.openDetails(brokenPart);
assert.equal(main.modalContent.querySelectorAll(".product-media").length, 0, "Failed image must not reappear in details");

const cachedFailure = main.productGrid.querySelectorAll("img")[0];
const cachedFailureCard = cachedFailure.closest(".product-card");
cachedFailure.complete = true;
cachedFailure.naturalWidth = 0;
main.api.bindImageFallbacks(main.productGrid);
assert.equal(cachedFailureCard.querySelectorAll(".product-media").length, 0, "An already-failed cached image must also collapse its stage");
const modalFailurePart = main.productGrid.querySelectorAll("img")[0].dataset.bmcProductImage;
main.api.openDetails(modalFailurePart);
main.modalContent.querySelectorAll("img")[0].dispatch("error");
assert.equal(main.modalContent.querySelectorAll(".product-media").length, 0, "Failed detail image must collapse its stage");
main.api.render();
assertCatalogue(main, 0);

const base = imageManifest[0];
const malformed = await boot({ images: [
  ...imageManifest,
  null,
  {},
  { part_number: 123, image_path: base.image_path, verification: "VERIFIED EXACT" },
  { part_number: "FB01011/01", image_path: base.image_path, verification: "PENDING" },
  { part_number: "ACOTASP-33", image_path: base.image_path, verification: "VERIFIED EXACT" },
  { part_number: "CRF605/08", image_path: "https://example.invalid/filter.webp", verification: "VERIFIED EXACT" },
  { part_number: "CRF612/08", image_path: "assets/../secret.webp", verification: "VERIFIED EXACT" },
  { part_number: "CRF726/01", image_path: 'assets/x.webp" onerror="alert(1)', verification: "VERIFIED EXACT" },
  { part_number: "FB01002/20", image_path: "assets/not-a-filter.svg", verification: "VERIFIED EXACT" },
  { part_number: "FB01002", image_path: base.image_path, verification: "VERIFIED EXACT" },
  { part_number: "UNKNOWN-PART", image_path: base.image_path, verification: "VERIFIED EXACT" }
] });
assertCatalogue(malformed, 3);
for (const imageFailure of ["network", "http", "json"]) assertCatalogue(await boot({ imageFailure }), 0);
for (const images of [{ entries: imageManifest }, null, []]) assertCatalogue(await boot({ images }), 0);

console.log("BMC presentation audit PASS");
console.log("240 source products preserved; 239 Phase 1 cards; 236 compact imageless cards; 3 exact local photos.");
console.log("12 imageless + 3 photographed + 4 price-conflict detail checks; withheld intake search/details checks pass.");
console.log("Source MRP/fitments preserved; public prices/internal statuses hidden; search/reset and WhatsApp pass.");
console.log("Failed-image collapse, pending/unsafe manifest entries, unavailable/malformed manifests pass.");
console.log("Desktop/mobile geometry and image authenticity still require browser/source review.");
