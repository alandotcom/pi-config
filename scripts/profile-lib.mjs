import fs from "node:fs";
import path from "node:path";

export const LEGACY_PACKAGE = "git:github.com/alandotcom/pi-extensions";

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function deepMerge(base, overlay) {
  if (!isObject(base) || !isObject(overlay)) return structuredClone(overlay);

  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = isObject(value) && isObject(merged[key])
      ? deepMerge(merged[key], value)
      : structuredClone(value);
  }
  return merged;
}

export function packageSource(entry) {
  return typeof entry === "string" ? entry : entry?.source;
}

export function packageIdentity(entry) {
  const source = packageSource(entry);
  if (!source) return undefined;
  if (source.startsWith("npm:")) {
    const spec = source.slice(4);
    const separator = spec.lastIndexOf("@");
    return `npm:${separator > 0 ? spec.slice(0, separator) : spec}`;
  }
  if (source.startsWith("git:")) return source.replace(/@[^/@]+$/, "");
  return source;
}

export function mergePackageEntries(existing = [], desired = []) {
  const desiredIds = new Set(desired.map(packageIdentity).filter(Boolean));
  const legacyId = packageIdentity(LEGACY_PACKAGE);
  const kept = existing.filter((entry) => {
    const identity = packageIdentity(entry);
    return identity && identity !== legacyId && !desiredIds.has(identity);
  });
  return [...kept, ...structuredClone(desired)];
}

export function mergeSettings(existing, profile, packages) {
  const merged = deepMerge(existing, profile);
  merged.packages = mergePackageEntries(existing.packages, packages);

  if (Array.isArray(existing.extensions)) {
    const extensions = existing.extensions.filter((entry) => {
      if (typeof entry !== "string") return true;
      return !/[/\\]pi-extensions[/\\]extensions[/\\](?:recall|ask-async|compact-bash)\.ts$/.test(entry);
    });
    if (extensions.length > 0) merged.extensions = extensions;
    else delete merged.extensions;
  }

  return merged;
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
