import fs from "node:fs";
import path from "node:path";

const PUBLIC_ROOT = "public";
const DIST_ROOT = "dist";

const REQUIRED_PUBLIC_FILES = [
  "public/one/index.html",
  "public/assets/app.js",
  "public/assets/loot.js",
  "public/assets/particles.js",
  "public/assets/physics.js",
  "public/assets/shared.js",
  "public/assets/styles.css",
  "public/assets/fonts/outfit-regular.woff2",
  "public/assets/fonts/outfit-bold.woff2",
  "public/favicon.svg",
  "public/apple-touch-icon.png",
];

const REQUIRED_ONE_REFERENCES = [
  "../assets/fonts/outfit-regular.woff2",
  "../assets/styles.css",
  "../assets/app.js",
  "../favicon.svg",
  "../apple-touch-icon.png",
];

function resolveLocalPath(filePath) {
  return path.resolve(process.cwd(), filePath);
}

function assertFilesExist(paths, label) {
  const missing = paths.filter((filePath) => !fs.existsSync(resolveLocalPath(filePath)));

  if (missing.length > 0) {
    console.error(`\n[verify:one] Missing ${label}:`);
    for (const filePath of missing) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }
}

function assertHtmlReferences(filePath, requiredReferences, label) {
  const html = fs.readFileSync(resolveLocalPath(filePath), "utf8");
  const missingReferences = requiredReferences.filter((reference) => !html.includes(reference));

  if (missingReferences.length > 0) {
    console.error(`\n[verify:one] Missing ${label} references in ${filePath}:`);
    for (const reference of missingReferences) {
      console.error(`- ${reference}`);
    }
    process.exit(1);
  }
}

function toDistPath(publicFilePath) {
  return publicFilePath.replace(new RegExp(`^${PUBLIC_ROOT}/`), `${DIST_ROOT}/`);
}

assertFilesExist(REQUIRED_PUBLIC_FILES, "public artifact files");
assertHtmlReferences("public/one/index.html", REQUIRED_ONE_REFERENCES, "artifact");

if (fs.existsSync(resolveLocalPath(DIST_ROOT))) {
  const requiredDistFiles = REQUIRED_PUBLIC_FILES.map(toDistPath);
  assertFilesExist(requiredDistFiles, "dist artifact files");
  assertHtmlReferences("dist/one/index.html", REQUIRED_ONE_REFERENCES, "dist artifact");
}

console.log("[verify:one] OK - /one artifact files are present and linked.");
