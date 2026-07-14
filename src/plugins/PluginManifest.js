/**
 * PluginManifest
 * ----------------
 * "The manifest should become the single source of truth for every
 * plugin." A plugin manifest is a plain object — no class, nothing to
 * instantiate — with this shape:
 *
 * ```js
 * {
 *   id: "your-name.plugin-id",      // required — unique, dotted convention by voluntary practice, not enforced
 *   name: "Human-Readable Name",    // required
 *   version: "1.0.0",               // required — plain string, compared with isVersionAtLeast() below
 *   description: "What it does.",   // optional
 *   author: "Your name",            // optional
 *   permissions: ["assets", "browser"], // optional — see PLUGIN_CAPABILITIES below; anything not listed here that a plugin tries to use gets a clear console warning, not a silent failure
 *   minWorkshopVersion: "2.1.2",    // optional — see isVersionAtLeast()
 * }
 * ```
 *
 * `validateManifest()` is the one gate every plugin passes through
 * before `PluginLoader.js` ever calls its own `setup()` — a plugin with
 * a missing `id`/`name`/`version`, or a `permissions` entry that isn't a
 * real capability, is refused with a specific, actionable error rather
 * than failing confusingly later (a `registerPage()` call erroring
 * because `manifest` was `undefined`, say). See docs/PLUGIN_SDK.md's own
 * "Manifest" section for the full reference.
 */

/** "Filesystem. Host. Browser. Phone. Residents. Projects. Assets.
 *  Storage. Automation. Future hardware" — the brief's own list, given
 *  real ids and honest descriptions. `storage` isn't gated at all (see
 *  `WorkshopSDK.js`'s own comment on why — it's safe by construction,
 *  namespaced per plugin) but stays in this list so a manifest can still
 *  declare it for clarity in the Plugin Manager's own display. Three
 *  entries — `residents`, `automation`, `hardware` — are honestly
 *  prepared extension points, not yet backed by a real capability to
 *  grant access to, the same status `PermissionsService.js`'s own
 *  matching categories already have at the Host level. */
export const PLUGIN_CAPABILITIES = [
  { id: "assets", label: "Assets", description: "Register or read Workshop Assets (objects, blueprints, animations, and more)." },
  { id: "browser", label: "Browser", description: "Register a page under plugin:// and read what pages exist." },
  { id: "phone", label: "Phone", description: "Add an application to the Workshop Phone or the Computer." },
  { id: "builder", label: "Builder", description: "Add a new piece to the Builder's Construction Library." },
  { id: "host", label: "Host", description: "Register a Host service, or use another Host service directly." },
  { id: "projects", label: "Projects", description: "Read the Workshop's own project list." },
  { id: "storage", label: "Storage", description: "Save and load the plugin's own isolated data. Always available — see docs/PLUGIN_SDK.md." },
  { id: "residents", label: "Residents", description: "Introduce or extend a Workshop resident. Architecture only — not yet functional." },
  { id: "automation", label: "Automation", description: "Hook into scheduled or background Workshop tasks. Architecture only — not yet functional." },
  { id: "hardware", label: "Hardware", description: "Controllers, microphones, and other connected devices. Architecture only — not yet functional." },
];

export function getCapability(id) {
  return PLUGIN_CAPABILITIES.find((c) => c.id === id) ?? null;
}

/** `{ valid, errors }` — `errors` is always an array, empty when valid.
 *  Deliberately permissive about *extra* fields (a plugin author's own
 *  `homepage`/`license`/whatever isn't rejected, just ignored) — only
 *  the fields this file's own top comment lists as required are
 *  actually checked. */
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return { valid: false, errors: ["A plugin manifest object is required — see docs/PLUGIN_SDK.md's own \"Manifest\" section."] };
  if (!manifest.id || typeof manifest.id !== "string") errors.push("manifest.id is required and must be a non-empty string.");
  if (!manifest.name || typeof manifest.name !== "string") errors.push("manifest.name is required and must be a non-empty string.");
  if (!manifest.version || typeof manifest.version !== "string") errors.push('manifest.version is required and must be a string (e.g. "1.0.0").');
  if (manifest.permissions !== undefined && !Array.isArray(manifest.permissions)) {
    errors.push("manifest.permissions, if present, must be an array of capability ids.");
  } else {
    for (const capabilityId of manifest.permissions ?? []) {
      if (!getCapability(capabilityId)) errors.push(`manifest.permissions contains an unknown capability: "${capabilityId}". See PLUGIN_CAPABILITIES in PluginManifest.js for the real list.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** A small, deliberately simple semver-lite comparison — "is `current`
 *  at least as new as `required`" — good enough for a manifest's own
 *  `minWorkshopVersion` to warn (never block; see PluginLoader.js) a
 *  plugin built against an older Workshop, not a full semver-range
 *  implementation (no `^`/`~`/pre-release tags). Missing or malformed
 *  version strings compare as `0`, the most permissive possible
 *  reading, rather than throwing. */
export function isVersionAtLeast(current, required) {
  const parse = (v) => String(v ?? "0").split(".").map((n) => parseInt(n, 10) || 0);
  const c = parse(current);
  const r = parse(required);
  for (let i = 0; i < Math.max(c.length, r.length); i++) {
    const cv = c[i] ?? 0;
    const rv = r[i] ?? 0;
    if (cv > rv) return true;
    if (cv < rv) return false;
  }
  return true;
}
