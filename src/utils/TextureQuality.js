import { detectRecommendedPreset } from "../settings/SettingsStore.js";

/**
 * TextureQuality
 * ----------------
 * Version 4, Phase 10a ("The Visual Upgrade — Foundation"). One shared
 * answer to "how much surface detail should this device generate?",
 * consulted by `PlaceholderFactory.js` when it builds a material and by
 * anything else that generates geometry detail rather than loading it.
 *
 * **Why this isn't a Settings field, and why it's decided at boot.**
 * Materials are built during system `init()` — `FurnitureSystem` has
 * already constructed every piece of furniture in the Workshop by the
 * time `engine.init()` resolves, and a save (and therefore any real
 * `SettingsStore` data) doesn't load until the `engine:ready` event at
 * the *end* of that same call. There is genuinely no persisted setting
 * to read at the moment this decision has to be made. Rather than invent
 * a second, earlier storage read purely to beat that ordering — a new
 * door into `localStorage` that `StorageUtils`/`PersistenceSystem` are
 * deliberately the only owners of — this reuses the one heuristic the
 * Workshop already trusts to make exactly this class of call with no
 * saved data available: `SettingsStore.js`'s own
 * `detectRecommendedPreset()`, a pure function of `navigator` that the
 * first-session graphics auto-tune already uses (see
 * `SettingsSystem.js`'s `world:continuity` handler).
 *
 * **The honest limitation, stated plainly rather than hidden:** a player
 * who manually overrides their graphics preset does *not* change their
 * texture tier for that session. Surface detail is treated as a
 * device-capability decision made once at load, not a live preference.
 * Changing it live would mean regenerating and re-uploading every cached
 * texture mid-session, and — because `ObjectCompiler.js` deliberately
 * *clones* its materials per instance (see its own comment) — those
 * clones would not pick the change up, so a live rebuild would leave the
 * Workshop visibly inconsistent with itself. A half-applied rebuild is a
 * worse outcome than an honest boot-time decision, so this does the
 * boot-time decision and says so. See docs/PERFORMANCE.md.
 */

/**
 * Each tier is a plain description of how much detail to generate — never
 * a Three.js object, so this module stays dependency-free and trivially
 * readable from anywhere.
 *
 * - `surfaceMaps` — whether to generate normal/roughness companions for a
 *   textured material at all. This is the one field with a real per-frame
 *   cost rather than a one-off generation cost: a normal map adds genuine
 *   per-fragment shading work on every lit surface that carries one,
 *   which is precisely what a "performance" device should not be paying.
 * - `textureSize` — canvas edge length for generators that accept one.
 *   Deliberately *not* applied blanket-fashion to every generator in
 *   `ProceduralTexture.js`: several tune their own detail density against
 *   a specific canvas size (`concreteTexture()`'s `repeat.set(4, 4)`,
 *   `woodGrainTexture()`'s own documented tiling-seam behaviour), so
 *   raising those is per-surface art work belonging with each surface's
 *   own pass in Waves 10b/10c, not a global knob flipped here.
 * - `bevelSegments` — corner subdivision for `PlaceholderFactory.bevelBox()`.
 */
export const TEXTURE_TIERS = {
  low: { surfaceMaps: false, textureSize: 256, bevelSegments: 1 },
  medium: { surfaceMaps: true, textureSize: 256, bevelSegments: 2 },
  high: { surfaceMaps: true, textureSize: 512, bevelSegments: 3 },
};

/** Graphics preset → texture tier. A straight one-to-one mapping today;
 *  it exists as a named function rather than an inline object so the two
 *  concepts stay separable if a future tier ever wants to diverge from a
 *  preset (e.g. surface maps on a "performance" device once they're
 *  cheap enough to be worth it). */
export function tierForPreset(presetName) {
  return { performance: "low", balanced: "medium", quality: "high" }[presetName] ?? "medium";
}

let _tierName = null;

/** The active tier's own config. Resolves itself on first use rather than
 *  requiring `main.js` to remember to initialise it — a material built by
 *  a module that imported `PlaceholderFactory` directly (a plugin, a
 *  test, the Being Creator's own preview) gets a correct answer without
 *  any wiring, and the resolution is a cheap pure function either way. */
export function textureQuality() {
  if (_tierName === null) _tierName = tierForPreset(detectRecommendedPreset());
  return TEXTURE_TIERS[_tierName];
}

/** The active tier's own name — for diagnostics and doc pages that want
 *  to report what was actually chosen rather than re-deriving it. */
export function textureQualityTier() {
  if (_tierName === null) _tierName = tierForPreset(detectRecommendedPreset());
  return _tierName;
}

/**
 * Override the detected tier. Two real callers are anticipated and
 * neither is a settings screen: a verification session pinning a known
 * tier before checking a material (this sandboxed browser reports
 * `navigator.hardwareConcurrency === 4` and so always auto-detects
 * `low` — the identical threshold problem `.claude/DEV_NOTES.md` already
 * documents for shadows), and `main.js` if a future phase ever does gain
 * a real pre-init settings read. Has no effect on materials already
 * built and cached — call it before anything constructs geometry.
 */
export function setTextureQualityTier(tierName) {
  if (!TEXTURE_TIERS[tierName]) return false;
  _tierName = tierName;
  return true;
}
