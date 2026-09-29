import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const readJSON = (name) => JSON.parse(read(name));
const manifest = readJSON("data/bmc-products.json");
const products = (manifest.chunks || []).flatMap((name) => readJSON(`data/${name}`));
const review = readJSON("data/bmc-review-queue.json");
const catalogueSource = read("products/bmc/catalogue.js");
const bmcHTML = read("products/bmc/index.html");
const performanceHTML = read("performance/index.html");

// Independent classification of the preserved source catalogue. The three CRFs
// are OEM-airbox replacement filters, confirmed by BMC's product pages:
// https://www.bmcairfilters.com/en/products/engine-filter/cylindrical/crf605-08
// https://www.bmcairfilters.com/en/products/engine-filter/cylindrical/crf612-08
// https://www.bmcairfilters.com/en/products/engine-filter/panel/crf726-01
const replacementCRFs = new Set(["CRF605/08", "CRF612/08", "CRF726/01"]);
const intakeTerms = /\b(?:ACOTASP(?:-\d+)?|CDA|DIA|OTA|OVAL\s+TRUMPET\s+AIR[-\s]?BOX|(?:SPECIAL\s+)?COLD[-\s]+AIR[-\s]+INTAKE(?:\s+(?:KIT|SYSTEMS?))?|INDUCTION\s+KITS?)\b/i;
const sourceDescription = (product) => [product.p, ...(product.a || []).flat()].filter(Boolean).join(" ");
const isIntake = (product) => /^(?:ACOTASP|ACCDA|ADDIA)/i.test(product.p) || intakeTerms.test(sourceDescription(product));
const isReplacement = (product) => !isIntake(product) && (/^FB\d+(?:\/\d+)?(?:[A-Z]|-\d+)?$/.test(product.p) || replacementCRFs.has(product.p));
const replacementProducts = products.filter(isReplacement);
const phaseTwo = products.filter(isIntake);
const unclassified = products.filter((product) => !isReplacement(product) && !isIntake(product));

// Execute the shipped renderer, rather than assuming the source manifest's
// historical public_products field is still the customer-visible count.
const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) elements.set(id, {
    innerHTML: "", textContent: "", hidden: false, style: {}, value: "",
    addEventListener() {}, querySelectorAll() { return []; }, focus() {}
  });
  return elements.get(id);
};
const runtimeErrors = [];
const context = vm.createContext({
  document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, body: { style: {} } },
  console: { error: (...messages) => runtimeErrors.push(messages.map(String).join(" ")), warn() {}, log() {} },
  fetch: async (url) => ({ ok: true, status: 200, json: async () => readJSON(String(url).split("?")[0].replace(/^\//, "")) })
});
const instrumented = catalogueSource.replace(/\binit\(\);\s*\}\)\(\);\s*$/, "globalThis.__audit = { state, openDetails, SHOW_BMC_PUBLIC_PRICES }; globalThis.__ready = init();\n})();");
if (instrumented === catalogueSource) throw new Error("Catalogue audit could not attach to the production renderer");
vm.runInContext(instrumented, context, { filename: "products/bmc/catalogue.js", timeout: 5000 });
await context.__ready;
const publicProducts = Array.from(context.__audit.state.products);
const publicParts = new Set(publicProducts.map((product) => product.part_number));
const publicSourceProducts = products.filter((product) => publicParts.has(product.p));
const runtimeHTML = [element("productGrid").innerHTML];
for (const product of publicProducts) {
  context.__audit.openDetails(product.part_number);
  runtimeHTML.push(element("modalContent").innerHTML);
}
const visibleText = (html) => html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const renderedPublicText = [bmcHTML, performanceHTML, ...runtimeHTML].map(visibleText).join("\n");
const publicCode = [bmcHTML, performanceHTML, catalogueSource].join("\n");
const occurrences = (text, pattern) => [...text.matchAll(new RegExp(pattern.source, `${pattern.ignoreCase ? "i" : ""}g`))].length;
const internalCopy = /BMC India July 2024 source|July 2024 source|MRP conflict|source review|source applications|supplied source|supplied BMC India|conflicting source prices|Exact product images (?:appear|are added) only after SKU-level verification|240 BMC performance-filter SKUs/gi;
const forbiddenPublicCopy = occurrences(publicCode, internalCopy) + occurrences(renderedPublicText, internalCopy);

const imageManifest = readJSON("data/bmc-product-images.json");
const imageEntries = Array.isArray(imageManifest) ? imageManifest : [];
const invalidMappings = Array.isArray(imageManifest) ? [] : ["Manifest must be an array (an empty array is valid)"];
const missingImages = [];
const fakeMappings = [];
const seenParts = new Set();
const seenPaths = new Map();
const safeImagePath = /^assets\/[a-z0-9_/-]+\.(?:avif|webp|png|jpe?g)$/i;
const fakeImageTerms = /(?:^|[\W_])(?:placeholder|fake|mockup|generated|generic|pending|coming[-_ ]soon|logo)(?:[\W_]|$)/i;
const validSourceURL = (value) => {
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname); } catch { return false; }
};
for (const [index, entry] of imageEntries.entries()) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) { invalidMappings.push(`Entry ${index}: expected an object`); continue; }
  const part = entry.part_number;
  const imagePath = entry.image_path;
  if (typeof part !== "string" || !publicParts.has(part) || seenParts.has(part) || entry.verification !== "VERIFIED EXACT" || typeof imagePath !== "string" || !safeImagePath.test(imagePath) || !validSourceURL(entry.source_url) || !validSourceURL(entry.source_image_url)) {
    invalidMappings.push(`Entry ${index} (${part ?? "missing part"}): requires unique exact public SKU, VERIFIED EXACT, safe asset path and source provenance`);
  }
  seenParts.add(part);
  if (typeof imagePath !== "string" || !safeImagePath.test(imagePath)) continue;
  const absolutePath = path.resolve(root, imagePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) missingImages.push(imagePath);
  if (fakeImageTerms.test([imagePath, entry.source_url, entry.source_image_url].join(" ")) || (seenPaths.has(imagePath.toLowerCase()) && seenPaths.get(imagePath.toLowerCase()) !== part)) fakeMappings.push(`${part}: ${imagePath}`);
  seenPaths.set(imagePath.toLowerCase(), part);
}
// Public banners and the approved hero also need their referenced local images.
for (const html of [bmcHTML, performanceHTML]) {
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="(\/assets\/[^"?]+)(?:\?[^\"]*)?"/gi)) {
    if (!fs.existsSync(path.join(root, match[1].slice(1)))) missingImages.push(match[1]);
  }
}

const heldTba = review.filter((product) => product.s === "WITHHELD_TBA");
const conflicts = products.filter((product) => product.s === "C");
const mrpBacked = products.filter((product) => product.s === "M");
const sourceRows = products.reduce((count, product) => count + (product.a?.length || 0), 0);
const publishedRows = publicSourceProducts.reduce((count, product) => count + (product.a?.length || 0), 0);
const duplicateParts = [...new Set(products.map((product) => product.p).filter((part, index, all) => all.indexOf(part) !== index))];
const classifiedParts = new Set(replacementProducts.map((product) => product.p));
const classificationMismatch = [...publicParts].filter((part) => !classifiedParts.has(part)).length + [...classifiedParts].filter((part) => !publicParts.has(part)).length;
const stats = {
  source_application_rows: sourceRows + heldTba.length,
  unique_source_groups: products.length + heldTba.length,
  stored_source_products: products.length,
  public_products: publicProducts.length,
  public_application_rows: publishedRows,
  phase_2_products_preserved_internally: phaseTwo.length,
  phase_2_application_rows_preserved_internally: phaseTwo.reduce((count, product) => count + product.a.length, 0),
  mrp_source_products: mrpBacked.length,
  mrp_conflict_products: conflicts.length,
  tba_withheld: heldTba.length,
  duplicate_product_cards: duplicateParts.length,
  lost_application_rows: 372 - (sourceRows + heldTba.length),
  conflict_price_accidentally_published: conflicts.filter((product) => product.m != null).length,
  tba_accidentally_published: publicProducts.filter((product) => product.part_number === "TBA").length,
  source_manifest_count_mismatches: Object.entries({ source_application_rows: 372, unique_groups: 241, public_products: 240, mrp_products: 236, conflict_products: 4, tba_withheld: 1 }).filter(([key, value]) => manifest.counts?.[key] !== value).length,
  unclassified_source_products: unclassified.length,
  public_classification_mismatches: classificationMismatch,
  public_result_count_mismatch: Number(element("resultCount").textContent) === publicProducts.length ? 0 : 1,
  catalogue_runtime_errors: runtimeErrors.length,
  PHASE_1_NON_FILTER_PRODUCTS: publicSourceProducts.filter((product) => !isReplacement(product)).length,
  COLD_AIR_INTAKE_PRODUCTS_IN_PHASE_1: publicSourceProducts.filter(isIntake).length,
  PUBLIC_MRP_RENDERING_ENABLED: context.__audit.SHOW_BMC_PUBLIC_PRICES,
  PUBLIC_MRP_DISPLAYED: occurrences(renderedPublicText, /\bMRP\b|₹|incl\.\s*GST/i),
  INTERNAL_SOURCE_TEXT_IN_PUBLIC_HTML_JS: forbiddenPublicCopy,
  EXACT_SKU_IMAGE_BEING_VERIFIED_OCCURRENCES: occurrences(publicCode, /Exact SKU image|being verified/i),
  SOURCE_LISTED_OCCURRENCES: occurrences(publicCode, /Source Listed/i) + occurrences(renderedPublicText, /Source Listed/i),
  PLACEHOLDER_PRODUCT_MEDIA_RENDERED: occurrences(runtimeHTML.join("\n"), /product-placeholder|placeholder-media|image coming soon|image pending/i),
  EXACT_IMAGE_MANIFEST_INVALID_MAPPINGS: invalidMappings.length,
  MISSING_REFERENCED_IMAGE_FILES: new Set(missingImages).size,
  FAKE_PLACEHOLDER_PRODUCT_IMAGE_MAPPINGS: fakeMappings.length
};
console.table(stats);
console.log("Source classification:", JSON.stringify({ replacement_filters: replacementProducts.length, phase_2_preserved: phaseTwo.map((product) => ({ part_number: product.p, applications: product.a.length, description: product.a[0]?.[1] })), unclassified: unclassified.map((product) => product.p) }));

const expected = {
  source_application_rows: 372,
  unique_source_groups: 241,
  stored_source_products: 240,
  public_products: 239,
  public_application_rows: 370,
  phase_2_products_preserved_internally: 1,
  phase_2_application_rows_preserved_internally: 1,
  mrp_source_products: 236,
  mrp_conflict_products: 4,
  tba_withheld: 1,
  PUBLIC_MRP_RENDERING_ENABLED: false
};
let failed = false;
for (const [key, value] of Object.entries(stats)) {
  const target = Object.hasOwn(expected, key) ? expected[key] : 0;
  if (value !== target) { console.error(`FAIL ${key}: expected ${target}, got ${value}`); failed = true; }
}
for (const detail of [...runtimeErrors, ...invalidMappings, ...missingImages, ...fakeMappings]) console.error(detail);
if (failed) process.exit(1);
console.log("BMC catalogue source and customer-facing integrity audit PASS");
console.log("372 source applications = 370 public replacement-filter applications + 1 preserved intake application + 1 withheld TBA.");
console.log("240 stored source products = 239 public replacement filters + 1 preserved Phase 2 intake. Source MRPs remain internal.");
console.log("Exact image mappings may be empty; provenance and asset checks supplement visual authenticity review.");
