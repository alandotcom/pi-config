import fs from "node:fs";
import path from "node:path";

export const LEGACY_PACKAGE = "git:github.com/alandotcom/pi-extensions";

export function readJson(file) {
  return parseJsonConfig(fs.readFileSync(file, "utf8"));
}

export function parseJsonConfig(content) {
  return JSON.parse(stripTrailingCommas(stripComments(content)));
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

export function mergeModelConfig(existing, profile) {
  const merged = deepMerge(existing, { ...profile, providers: {} });
  merged.providers ??= {};

  for (const [providerName, profileProvider] of Object.entries(profile.providers ?? {})) {
    const existingProvider = existing.providers?.[providerName] ?? {};
    const provider = deepMerge(existingProvider, { ...profileProvider, models: [] });
    const profileModels = profileProvider.models ?? [];
    const profileIds = new Set(profileModels.map((model) => model.id));
    provider.models = [
      ...(existingProvider.models ?? []).filter((model) => !profileIds.has(model.id)),
      ...structuredClone(profileModels),
    ];
    merged.providers[providerName] = provider;
  }

  return merged;
}

export function isProfileSubset(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.length === actual.length
      && expected.every((value, index) => isProfileSubset(actual[index], value));
  }
  if (isObject(expected)) {
    return isObject(actual)
      && Object.entries(expected).every(([key, value]) => isProfileSubset(actual[key], value));
  }
  return Object.is(actual, expected);
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

function stripComments(content) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
        output += content[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripTrailingCommas(content) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (/\s/.test(content[next] ?? "")) next += 1;
      if (content[next] === "}" || content[next] === "]") continue;
    }
    output += char;
  }
  return output;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
