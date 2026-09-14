import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/bmc-products.json"), "utf8"));
const products = (manifest.chunks || []).flatMap((name) => JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8")));
const review = JSON.parse(fs.readFileSync(path.join(root, "data/bmc-review-queue.json"), "utf8"));

const sourceRowsPublic = products.reduce((n,p)=>n+(p.a?.length || 0),0);
const heldTba = review.filter(x=>x.s==="WITHHELD_TBA");
const conflicts = products.filter(x=>x.s==="C");
const mrpBacked = products.filter(x=>x.s==="M");
const duplicateParts = [...new Set(products.map(p=>p.p).filter((p,i,a)=>a.indexOf(p)!==i))];
const unsafePublished = products.filter(p=>p.p==="TBA");
const conflictWithPrice = conflicts.filter(p=>p.m != null);

const stats = {
  source_application_rows: sourceRowsPublic + heldTba.length,
  unique_source_groups: products.length + heldTba.length,
  public_products: products.length,
  mrp_source_products: mrpBacked.length,
  mrp_conflict_products: conflicts.length,
  tba_withheld: heldTba.length,
  duplicate_product_cards: duplicateParts.length,
  lost_application_rows: 372 - (sourceRowsPublic + heldTba.length),
  conflict_price_accidentally_published: conflictWithPrice.length,
  tba_accidentally_published: unsafePublished.length
};
console.table(stats);

const expected = {
  source_application_rows: 372,
  unique_source_groups: 241,
  public_products: 240,
  mrp_source_products: 236,
  mrp_conflict_products: 4,
  tba_withheld: 1,
  duplicate_product_cards: 0,
  lost_application_rows: 0,
  conflict_price_accidentally_published: 0,
  tba_accidentally_published: 0
};

let failed = false;
for (const [key,value] of Object.entries(expected)) {
  if (stats[key] !== value) {
    console.error(`FAIL ${key}: expected ${value}, got ${stats[key]}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("BMC catalogue source-count audit PASS");
