// Validates manifest.json and confirms every file it references actually exists.
// Used by CI and the release workflow. Run: `node scripts/validate.mjs`
import { readFileSync, existsSync } from "node:fs";

const errs = [];
let m;
try {
  m = JSON.parse(readFileSync("manifest.json", "utf8"));
} catch (e) {
  console.error("manifest.json is not valid JSON:", e.message);
  process.exit(1);
}

for (const k of ["manifest_version", "name", "version"]) {
  if (!(k in m)) errs.push(`missing required field: ${k}`);
}
if (m.manifest_version !== 3) errs.push("manifest_version must be 3");
if (!/^\d+(\.\d+){0,3}$/.test(m.version || "")) errs.push(`invalid version string: ${m.version}`);

// Collect every path the manifest points at.
const refs = [];
if (m.background?.service_worker) refs.push(m.background.service_worker);
for (const cs of m.content_scripts || []) {
  (cs.js || []).forEach((f) => refs.push(f));
  (cs.css || []).forEach((f) => refs.push(f));
}
if (m.action?.default_popup) refs.push(m.action.default_popup);
for (const iconSet of [m.action?.default_icon, m.icons]) {
  if (iconSet) Object.values(iconSet).forEach((f) => refs.push(f));
}
for (const f of refs) {
  if (!existsSync(f)) errs.push(`referenced file is missing: ${f}`);
}

if (errs.length) {
  console.error("Manifest validation FAILED:\n- " + errs.join("\n- "));
  process.exit(1);
}
console.log(`manifest.json OK — version ${m.version}, ${refs.length} referenced files present.`);
