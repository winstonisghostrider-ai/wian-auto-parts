#!/usr/bin/env node

import {
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const CATALOGUE_PATH = resolve(REPOSITORY_ROOT, "data/kn-products.json");
const MANIFEST_PATH = resolve(REPOSITORY_ROOT, "data/kn-vehicle-images.json");
const FRONTEND_PATH = resolve(REPOSITORY_ROOT, "products/kn/catalogue.js");
const VEHICLE_ASSET_DIRECTORY = resolve(REPOSITORY_ROOT, "assets/vehicles");

const VERIFIED_EXACT = "VERIFIED EXACT";
const VEHICLE_IMAGE_PATH_PATTERN = /^assets\/vehicles\/[a-z0-9][a-z0-9._\/-]*\.(?:avif|webp|png|jpe?g)$/i;
const VEHICLE_IMAGE_EXTENSION_PATTERN = /\.(?:avif|webp|png|jpe?g)$/i;
const REQUIRED_VERIFIED_FIELDS = [
  "vehicle_key",
  "make",
  "model",
  "year_range",
  "generation",
  "body_style",
  "image_path",
  "source_url",
  "source_type",
  "pictured_year_range"
];
const LIVE_QA_PARTS = [
  "33-2943",
  "33-2942",
  "33-2154",
  "33-2422",
  "33-2920",
  "33-2826",
  "33-2955",
  "33-3030",
  "33-3052",
  "33-3068",
  "33-3075",
  "E-2997",
  "E-2998",
  "E-2987",
  "33-3005",
  "33-3111"
];

const issues = {
  catalogue: [],
  manifest: [],
  pending: [],
  missingVisuals: [],
  brokenAssets: [],
  crossEngineLeakage: [],
  wrongOrUnscopedEngineMatches: [],
  orphanManifestRecords: [],
  unrelatedAssetReuse: [],
  frontend: []
};

function readJsonArray(filePath, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error.message}`);
  }
  if (!Array.isArray(value)) throw new Error(`${label} must contain a JSON array`);
  return value;
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// This is intentionally identical to the key construction used by the catalogue.
function referenceVehicleKey(application) {
  return [application[0], application[1], application[2]]
    .map((value) => String(value || "").toLowerCase())
    .join("-")
    .replace(/\+/g, "-plus-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseManifestPath(imagePath) {
  return typeof imagePath === "string" ? imagePath.trim().replace(/^\/+/, "") : "";
}

function applicationIdentity(application) {
  return JSON.stringify(application.slice(0, 4));
}

function applicationLabel(partNumber, application) {
  return `${partNumber}: ${application.slice(0, 4).join(" | ")}`;
}

function manifestLabel(manifest, index) {
  const identity = [manifest?.make, manifest?.model, manifest?.year_range, manifest?.engine]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" | ");
  return `manifest[${index}]${identity ? ` ${identity}` : ""}`;
}

function extractNamedFunction(source, functionName) {
  const marker = new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`);
  const match = marker.exec(source);
  if (!match) throw new Error(`function ${functionName} was not found`);

  const start = match.index;
  const openingBrace = source.indexOf("{", start + match[0].length);
  if (openingBrace === -1) throw new Error(`function ${functionName} has no body`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "\"" || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`function ${functionName} has an unterminated body`);
}

function loadFrontendMatcher(vehicleManifest) {
  const source = readFileSync(FRONTEND_PATH, "utf8");
  const vehicleKeySource = extractNamedFunction(source, "vehicleKey");
  const configuredVehicleImagesSource = extractNamedFunction(source, "configuredVehicleImages");
  const state = { vehicleManifest };
  const createMatcher = new Function(
    "state",
    `"use strict";\n${vehicleKeySource}\n${configuredVehicleImagesSource}\nreturn { vehicleKey, configuredVehicleImages };`
  );
  return createMatcher(state);
}

function strictManifestMatchesApplication(manifest, application) {
  if (!manifest || manifest.verification !== VERIFIED_EXACT) return false;
  const applicationRange = manifest.application_year_range || manifest.year_range;
  if (manifest.make !== application[0] || manifest.model !== application[1] || applicationRange !== application[2]) return false;
  // Exact requested engine scope: an omitted/blank manifest engine is a wildcard;
  // every nonempty manifest engine must equal the catalogue application verbatim.
  if (typeof manifest.engine === "string" && manifest.engine.trim() && manifest.engine !== application[3]) return false;
  if (typeof manifest.image_path !== "string") return false;
  const imagePath = normaliseManifestPath(manifest.image_path);
  return VEHICLE_IMAGE_PATH_PATTERN.test(imagePath);
}

function strictConfiguredVehicleImages(application, manifestByKey) {
  const manifests = manifestByKey.get(referenceVehicleKey(application)) || [];
  const seen = new Set();
  return manifests.reduce((images, manifest) => {
    if (!strictManifestMatchesApplication(manifest, application)) return images;
    const imagePath = normaliseManifestPath(manifest.image_path);
    const identity = `${imagePath}|${manifest.pictured_year_range || ""}|${manifest.generation || ""}`;
    if (seen.has(identity)) return images;
    seen.add(identity);
    images.push({ imagePath, manifest });
    return images;
  }, []);
}

function listFilesRecursively(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function resolveWithExactCase(repositoryRelativePath) {
  const segments = repositoryRelativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return { error: "path contains an empty, current-directory, or parent-directory segment" };
  }

  let current = REPOSITORY_ROOT;
  for (const segment of segments) {
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      return { error: `parent directory does not exist: ${relative(REPOSITORY_ROOT, current).split(sep).join("/") || "."}` };
    }
    if (!entries.includes(segment)) {
      const caseInsensitiveMatch = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
      return caseInsensitiveMatch
        ? { error: `case mismatch: expected '${caseInsensitiveMatch}' instead of '${segment}'` }
        : { error: `file or directory segment does not exist: '${segment}'` };
    }
    current = resolve(current, segment);
  }
  return { path: current };
}

function hasExpectedImageSignature(filePath) {
  const data = readFileSync(filePath);
  const extension = extname(filePath).toLowerCase();
  if (extension === ".webp") {
    return data.length >= 12
      && data.subarray(0, 4).toString("ascii") === "RIFF"
      && data.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (extension === ".png") {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return data.length >= pngSignature.length && data.subarray(0, pngSignature.length).equals(pngSignature);
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (extension === ".avif") {
    return data.length >= 16
      && data.subarray(4, 8).toString("ascii") === "ftyp"
      && /avif|avis/.test(data.subarray(8, Math.min(data.length, 64)).toString("ascii"));
  }
  return false;
}

function inspectAsset(repositoryRelativePath) {
  const problems = [];
  if (!VEHICLE_IMAGE_PATH_PATTERN.test(repositoryRelativePath)) {
    problems.push("path is not an allowed frontend vehicle-image path");
    return problems;
  }

  const caseSensitiveResolution = resolveWithExactCase(repositoryRelativePath);
  if (caseSensitiveResolution.error) {
    problems.push(caseSensitiveResolution.error);
    return problems;
  }

  let stats;
  try {
    stats = statSync(caseSensitiveResolution.path);
  } catch (error) {
    problems.push(`could not stat asset: ${error.message}`);
    return problems;
  }
  if (!stats.isFile()) problems.push("asset path is not a regular file");
  if (stats.size === 0) problems.push("asset file is empty");
  if (problems.length) return problems;

  try {
    if (!hasExpectedImageSignature(caseSensitiveResolution.path)) {
      problems.push(`contents do not match the ${extname(repositoryRelativePath).toLowerCase()} extension`);
    }
  } catch (error) {
    problems.push(`could not read asset: ${error.message}`);
  }
  return problems;
}

function printIssueSection(title, entries) {
  console.log(`${title}: ${entries.length}`);
  entries.forEach((entry) => console.log(`  - ${entry}`));
}

function readCurrentCommitSha() {
  const dotGitPath = resolve(REPOSITORY_ROOT, ".git");
  let gitDirectory = dotGitPath;
  try {
    if (!statSync(dotGitPath).isDirectory()) {
      const gitFile = readFileSync(dotGitPath, "utf8").trim();
      const match = /^gitdir:\s*(.+)$/i.exec(gitFile);
      if (!match) return "UNAVAILABLE";
      gitDirectory = resolve(REPOSITORY_ROOT, match[1]);
    }

    const head = readFileSync(resolve(gitDirectory, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return head;
    const refMatch = /^ref:\s*(.+)$/i.exec(head);
    if (!refMatch) return "UNAVAILABLE";

    const refName = refMatch[1];
    const refLocations = [resolve(gitDirectory, refName)];
    try {
      const commonDirectory = readFileSync(resolve(gitDirectory, "commondir"), "utf8").trim();
      refLocations.push(resolve(gitDirectory, commonDirectory, refName));
    } catch {
      // A normal checkout has no commondir file.
    }
    for (const refPath of refLocations) {
      try {
        const value = readFileSync(refPath, "utf8").trim();
        if (/^[0-9a-f]{40}$/i.test(value)) return value;
      } catch {
        // The ref may be packed instead.
      }
    }

    const packedRefLocations = [resolve(gitDirectory, "packed-refs")];
    try {
      const commonDirectory = readFileSync(resolve(gitDirectory, "commondir"), "utf8").trim();
      packedRefLocations.push(resolve(gitDirectory, commonDirectory, "packed-refs"));
    } catch {
      // A normal checkout has no commondir file.
    }
    for (const packedRefsPath of packedRefLocations) {
      try {
        const packedRefs = readFileSync(packedRefsPath, "utf8");
        const packedMatch = packedRefs
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/))
          .find(([sha, name]) => /^[0-9a-f]{40}$/i.test(sha || "") && name === refName);
        if (packedMatch) return packedMatch[0];
      } catch {
        // Try the next packed-refs location.
      }
    }
  } catch {
    return "UNAVAILABLE";
  }
  return "UNAVAILABLE";
}

let catalogue;
let manifest;
try {
  catalogue = readJsonArray(CATALOGUE_PATH, "K&N catalogue");
  manifest = readJsonArray(MANIFEST_PATH, "K&N vehicle image manifest");
} catch (error) {
  console.error(`K&N vehicle image audit: FAIL\n${error.message}`);
  process.exitCode = 1;
  process.exit();
}

const applicationRows = [];
const uniqueApplications = new Map();
catalogue.forEach((product, productIndex) => {
  if (!product || typeof product !== "object" || !isNonemptyString(product.p) || !Array.isArray(product.a)) {
    issues.catalogue.push(`catalogue[${productIndex}] must have a nonempty part number and an application array`);
    return;
  }
  product.a.forEach((application, applicationIndex) => {
    if (!Array.isArray(application) || application.length < 4 || application.slice(0, 4).some((value) => !isNonemptyString(value))) {
      issues.catalogue.push(`${product.p} application[${applicationIndex}] must contain nonempty make, model, year, and engine strings`);
      return;
    }
    const row = { application, partNumber: product.p };
    applicationRows.push(row);
    const identity = applicationIdentity(application);
    if (!uniqueApplications.has(identity)) uniqueApplications.set(identity, row);
  });
});

const manifestByKey = new Map();
const referencedImagePaths = new Set();
const assetOwners = new Map();
const assetProblems = new Map();

manifest.forEach((entry, index) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    issues.manifest.push(`manifest[${index}] must be an object`);
    issues.pending.push(`manifest[${index}] is not a usable verified record`);
    return;
  }

  if (isNonemptyString(entry.vehicle_key)) {
    const entries = manifestByKey.get(entry.vehicle_key) || [];
    entries.push(entry);
    manifestByKey.set(entry.vehicle_key, entries);
  } else {
    issues.manifest.push(`${manifestLabel(entry, index)} has no vehicle_key`);
  }

  const imagePath = normaliseManifestPath(entry.image_path);
  const pendingReasons = [];
  if (entry.verification !== VERIFIED_EXACT) pendingReasons.push(`verification is '${entry.verification ?? "missing"}'`);
  if (!imagePath) pendingReasons.push("image_path is missing");
  if (pendingReasons.length) {
    const note = isNonemptyString(entry.notes) ? `; note: ${entry.notes.trim()}` : "";
    issues.pending.push(`${manifestLabel(entry, index)} — ${pendingReasons.join("; ")}${note}`);
  }

  if (entry.verification === VERIFIED_EXACT) {
    const missingFields = REQUIRED_VERIFIED_FIELDS.filter((field) => !isNonemptyString(entry[field]));
    if (missingFields.length) {
      issues.manifest.push(`${manifestLabel(entry, index)} is VERIFIED EXACT but lacks ${missingFields.join(", ")}`);
    }
    if (isNonemptyString(entry.make) && isNonemptyString(entry.model) && isNonemptyString(entry.application_year_range || entry.year_range)) {
      const expectedKey = referenceVehicleKey([entry.make, entry.model, entry.application_year_range || entry.year_range]);
      if (entry.vehicle_key !== expectedKey) {
        issues.manifest.push(`${manifestLabel(entry, index)} has vehicle_key '${entry.vehicle_key}' but frontend key is '${expectedKey}'`);
      }
    }
  }

  if (imagePath) {
    referencedImagePaths.add(imagePath);
    const owners = assetOwners.get(imagePath) || new Set();
    if (isNonemptyString(entry.make) && isNonemptyString(entry.model)) owners.add(`${entry.make} ${entry.model}`);
    assetOwners.set(imagePath, owners);
    if (!assetProblems.has(imagePath)) assetProblems.set(imagePath, inspectAsset(imagePath));
  }
});

for (const [imagePath, problems] of assetProblems) {
  problems.forEach((problem) => issues.brokenAssets.push(`${imagePath} — ${problem}`));
}

for (const [imagePath, owners] of assetOwners) {
  if (owners.size > 1) {
    issues.unrelatedAssetReuse.push(`${imagePath} is assigned to unrelated vehicles: ${[...owners].join(", ")}`);
  }
}

manifest.forEach((entry, index) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
  const hasCatalogueApplication = applicationRows.some(({ application }) => {
    if (entry.vehicle_key !== referenceVehicleKey(application)) return false;
    if (entry.make !== application[0] || entry.model !== application[1]) return false;
    if ((entry.application_year_range || entry.year_range) !== application[2]) return false;
    return !(typeof entry.engine === "string" && entry.engine.trim() && entry.engine !== application[3]);
  });
  if (!hasCatalogueApplication) {
    issues.orphanManifestRecords.push(`${manifestLabel(entry, index)} does not map to any product application row`);
  }
});

let physicalVehicleImages = [];
try {
  physicalVehicleImages = listFilesRecursively(VEHICLE_ASSET_DIRECTORY)
    .map((filePath) => relative(REPOSITORY_ROOT, filePath).split(sep).join("/"))
    .filter((filePath) => VEHICLE_IMAGE_EXTENSION_PATTERN.test(filePath));
} catch (error) {
  issues.brokenAssets.push(`assets/vehicles could not be enumerated — ${error.message}`);
}

for (const imagePath of physicalVehicleImages) {
  if (!assetProblems.has(imagePath)) {
    const problems = inspectAsset(imagePath);
    problems.forEach((problem) => issues.brokenAssets.push(`${imagePath} — ${problem}`));
  }
}

let frontendMatcher;
try {
  frontendMatcher = loadFrontendMatcher(manifestByKey);
} catch (error) {
  issues.frontend.push(`could not execute the catalogue's vehicle matcher: ${error.message}`);
}

const applicationResults = new Map();
const applicationRowResults = [];
for (const { application, partNumber } of applicationRows) {
  let configured;
  try {
    configured = frontendMatcher
      ? frontendMatcher.configuredVehicleImages(application)
      : strictConfiguredVehicleImages(application, manifestByKey);
  } catch (error) {
    issues.frontend.push(`${applicationLabel(partNumber, application)} threw while matching: ${error.message}`);
    configured = [];
  }
  if (!Array.isArray(configured)) {
    issues.frontend.push(`${applicationLabel(partNumber, application)} matcher result is not an array`);
    configured = [];
  }

  const scopedImages = [];
  for (const configuredImage of configured) {
    const configuredManifest = configuredImage?.manifest;
    if (!configuredManifest || typeof configuredManifest !== "object") {
      issues.frontend.push(`${applicationLabel(partNumber, application)} returned an image without a manifest record`);
      continue;
    }
    const manifestEngine = configuredManifest.engine;
    if (!(typeof manifestEngine === "string" && manifestEngine.trim())) {
      issues.wrongOrUnscopedEngineMatches.push(
        `${applicationLabel(partNumber, application)} received a manifest with no engine scope (${normaliseManifestPath(configuredManifest.image_path) || "no path"})`
      );
    }
    if (typeof manifestEngine === "string" && manifestEngine.trim() && manifestEngine !== application[3]) {
      const description = `${applicationLabel(partNumber, application)} received manifest engine '${manifestEngine}' (${normaliseManifestPath(configuredManifest.image_path) || "no path"})`;
      issues.crossEngineLeakage.push(description);
      issues.wrongOrUnscopedEngineMatches.push(description);
      continue;
    }
    scopedImages.push(configuredImage);
  }

  const validImages = scopedImages.filter(({ manifest: configuredManifest }) => {
    const imagePath = normaliseManifestPath(configuredManifest.image_path);
    return imagePath && (assetProblems.get(imagePath) || inspectAsset(imagePath)).length === 0;
  });

  const identity = applicationIdentity(application);
  applicationRowResults.push({ application, partNumber, validImages });
  const existingResult = applicationResults.get(identity) || { rows: [], validImages: [] };
  existingResult.rows.push({ application, partNumber });
  existingResult.validImages.push(...validImages);
  applicationResults.set(identity, existingResult);

  if (!validImages.length) {
    const sameVehicleRecords = manifestByKey.get(referenceVehicleKey(application)) || [];
    const mismatchedEngines = [...new Set(sameVehicleRecords
      .filter((entry) => entry?.verification === VERIFIED_EXACT
        && entry.make === application[0]
        && entry.model === application[1]
        && (entry.application_year_range || entry.year_range) === application[2]
        && typeof entry.engine === "string"
        && entry.engine.trim()
        && entry.engine !== application[3])
      .map((entry) => entry.engine))];
    const reason = mismatchedEngines.length
      ? `no engine-scoped visual; rejected manifest engine(s): ${mismatchedEngines.join(", ")}`
      : "no VERIFIED EXACT frontend-compatible manifest with a readable local asset";
    issues.missingVisuals.push(`${applicationLabel(partNumber, application)} — ${reason}`);
  }
}

const coveredUniqueApplications = [...applicationResults.values()]
  .filter((result) => result.validImages.length > 0)
  .length;
const coveragePercentage = uniqueApplications.size
  ? (coveredUniqueApplications / uniqueApplications.size) * 100
  : 0;

const qaPartResults = LIVE_QA_PARTS.map((partNumber) => {
  const rows = applicationRows.filter((row) => String(row.partNumber)
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .includes(partNumber));
  const failures = rows.filter(({ application }) => {
    const result = applicationResults.get(applicationIdentity(application));
    return !result || !result.validImages.length;
  });
  return {
    partNumber,
    passed: rows.length > 0 && failures.length === 0,
    reason: rows.length === 0 ? "part is absent from catalogue" : `${rows.length - failures.length}/${rows.length} applications render-ready`
  };
});

qaPartResults.filter((result) => !result.passed).forEach((result) => {
  issues.catalogue.push(`required live-QA part ${result.partNumber} failed: ${result.reason}`);
});

const bmw520dApplication = applicationRows.find(({ partNumber, application }) =>
  partNumber === "33-2943" && application[0] === "BMW" && application[1] === "520d"
);
const bmw520dResult = bmw520dApplication
  ? applicationResults.get(applicationIdentity(bmw520dApplication.application))
  : null;
const bmw520dVisible = Boolean(bmw520dResult?.validImages.length);

const commitSha = readCurrentCommitSha();
const orphanedAssets = physicalVehicleImages.filter((imagePath) => !referencedImagePaths.has(imagePath));
const missingLocalAssetPaths = [...assetProblems]
  .filter(([, problems]) => problems.some((problem) => /does not exist|could not stat|parent directory/i.test(problem)))
  .map(([imagePath]) => imagePath);
const applicationsWithImages = applicationRowResults.filter((result) => result.validImages.length > 0).length;
const applicationsWithoutImages = applicationRows.length - applicationsWithImages;
const nullImagePathCount = manifest.filter((entry) => entry?.image_path === null).length;
const failureCount = Object.values(issues).reduce((total, entries) => total + entries.length, 0);

console.log("K&N vehicle image audit");
console.log(`TOTAL PRODUCT APPLICATION ROWS: ${applicationRows.length}`);
console.log(`APPLICATIONS WITH >=1 MATCHING VEHICLE IMAGE: ${applicationsWithImages}`);
console.log(`APPLICATIONS WITH ZERO VEHICLE IMAGE: ${applicationsWithoutImages}`);
console.log(`PENDING MANIFEST RECORDS: ${issues.pending.length}`);
console.log(`NULL IMAGE_PATH: ${nullImagePathCount}`);
console.log(`MISSING LOCAL ASSETS: ${missingLocalAssetPaths.length}`);
console.log(`CROSS-ENGINE LEAKAGE: ${issues.crossEngineLeakage.length}`);
console.log(`WRONG/UNSCOPED ENGINE MATCHES: ${issues.wrongOrUnscopedEngineMatches.length}`);
console.log(`ORPHAN MANIFEST RECORDS: ${issues.orphanManifestRecords.length}`);
console.log(`UNIQUE VEHICLE APPLICATIONS: ${uniqueApplications.size}`);
console.log(`VERIFIED EXACT MANIFEST RECORDS: ${manifest.filter((entry) => entry?.verification === VERIFIED_EXACT).length}/${manifest.length}`);
console.log(`APPLICATION COVERAGE: ${coveredUniqueApplications}/${uniqueApplications.size} (${coveragePercentage.toFixed(2)}%)`);
console.log(`ACTUAL VEHICLE IMAGE FILE COUNT: ${physicalVehicleImages.length}`);
console.log(`Referenced unique vehicle image files: ${referencedImagePaths.size}`);
console.log(`Unreferenced vehicle image files: ${orphanedAssets.length}`);
console.log(`BMW 520d 2008-2010 image visible preflight: ${bmw520dVisible ? "YES" : "NO"}`);
console.log(`Production commit SHA: ${commitSha}`);
console.log("Pages deployment result: NOT CHECKED (local filesystem/frontend preflight)");
console.log("");
console.log("Required live-QA searches:");
qaPartResults.forEach((result) => console.log(`  - ${result.partNumber}: ${result.passed ? "PASS" : "FAIL"} (${result.reason})`));
console.log("");

printIssueSection("Catalogue/schema failures", issues.catalogue);
printIssueSection("Manifest metadata failures", issues.manifest);
printIssueSection("Pending manifest records", issues.pending);
printIssueSection("Missing vehicle visuals", issues.missingVisuals);
printIssueSection("Broken vehicle assets", issues.brokenAssets);
printIssueSection("Cross-engine frontend leakage", issues.crossEngineLeakage);
printIssueSection("Wrong or unscoped engine matches", issues.wrongOrUnscopedEngineMatches);
printIssueSection("Orphan manifest records", issues.orphanManifestRecords);
printIssueSection("Unrelated vehicle asset reuse", issues.unrelatedAssetReuse);
printIssueSection("Frontend matcher failures", issues.frontend);

if (orphanedAssets.length) {
  console.log(`Unreferenced assets (warning only): ${orphanedAssets.length}`);
  orphanedAssets.forEach((imagePath) => console.log(`  - ${imagePath}`));
}

console.log("");
console.log(`K&N vehicle image audit: ${failureCount ? `FAIL (${failureCount} issue${failureCount === 1 ? "" : "s"})` : "PASS"}`);
process.exitCode = failureCount ? 1 : 0;
