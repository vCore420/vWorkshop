/**
 * WorkshopAssetSchema
 * ---------------------
 * "Please introduce a unified Workshop Asset architecture. Every asset
 * should share common information... Name, Asset Type, Unique Asset ID,
 * Description, Author, Creation Date, Modification Date, Version,
 * Categories, Tags, Thumbnail, Dependencies, Validation Status,
 * Metadata." This file is that shape — a plain object, a
 * `normalizeDescriptor()` that fills in sensible defaults for whatever a
 * kind's own `toDescriptor()` didn't provide, the identical
 * shape-module-vs-consumer split every other configuration in the
 * Workshop already follows (`MemoryConfiguration.js`,
 * `EmbodimentConfiguration.js`, `TraitConfiguration.js`).
 *
 * **Deliberately a wrapper, not a replacement.** `ObjectLibraryStore`,
 * `BlueprintStore`, `AnimationLibraryStore`, and the rest each keep their
 * own real, working internal shape — a Blueprint's own `objects` array,
 * an Animation's own `frames`, none of that changes. A Workshop Asset
 * descriptor is a normalized *envelope* `AssetService.js` builds around
 * whatever a kind's own item actually is, computed on demand, never
 * stored back onto the original object. Rewriting six independent,
 * already-working stores to share one literal internal shape would touch
 * the Builder, the Animation Editor, Beings, the Music Player, and more
 * — a large, risky change for a phase whose own brief asks for "a shared
 * language," not a shared data structure underneath every existing
 * system.
 *
 * "Unique Asset ID... avoid relying on filenames... reference assets by
 * identity rather than location." An asset id is simply `"<kind>:<item
 * id>"` (`"objects:42"`, `"blueprints:blueprint-a1b2"`) — every existing
 * store already gives its own items a stable id that has nothing to do
 * with a filename or a display name; this just namespaces that id by
 * which kind it belongs to, so two different kinds can never collide
 * even if their own internal ids happen to coincide.
 */

/** "Categories should organise assets at a high level" — the brief's own
 *  suggested vocabulary. Deliberately a reference list, not an enforced
 *  one: existing stores (`ObjectLibraryStore`, `AnimationLibraryStore`)
 *  already have their own real, working category values, and forcing
 *  those to be silently remapped onto this list risked being simply
 *  wrong. New asset kinds are encouraged to draw from this list; nothing
 *  currently rejects a category that isn't on it. */
export const WORKSHOP_ASSET_CATEGORIES = ["Furniture", "Architecture", "Nature", "Lighting", "Characters", "Workshop", "Tools", "Effects"];

export function defaultAssetDescriptor() {
  return {
    assetId: null,
    type: null,
    name: "Untitled Asset",
    description: "",
    author: "You",
    createdAt: null,
    updatedAt: null,
    version: 1,
    categories: [],
    tags: [],
    thumbnail: null,
    dependencies: [],
  };
}

/** Fills in defaults for whatever a kind's own `toDescriptor()` left out
 *  — the same tolerant, additive normalisation
 *  `TraitConfiguration.normalizeTraitConfig()` and its siblings already
 *  use, so a kind that only bothers to return `{name, createdAt}` still
 *  produces a fully-shaped descriptor rather than one with holes in it. */
export function normalizeAssetDescriptor(partial) {
  const defaults = defaultAssetDescriptor();
  return {
    ...defaults,
    ...partial,
    categories: Array.isArray(partial?.categories) ? partial.categories : defaults.categories,
    tags: Array.isArray(partial?.tags) ? partial.tags : defaults.tags,
    dependencies: Array.isArray(partial?.dependencies) ? partial.dependencies : defaults.dependencies,
  };
}

/** "Thumbnail generation... begin preparing the Workshop for future
 *  asset optimisation." A genuinely real, if simple, thumbnail — a small
 *  inline SVG data URI built from a handful of real colours (an object
 *  or blueprint's own part colours, say), not a placeholder image and
 *  not nothing. Renders as an ordinary `<img>` anywhere a thumbnail is
 *  wanted, unlike the raw swatch `<div>`s `AssetPages.js` renders
 *  directly in its own detail pages — this is the portable, reusable
 *  form of the same real data. Returns `null` for an empty colour list
 *  (an object with no parts, say) rather than a blank image. */
export function buildSwatchThumbnail(colors) {
  if (!colors || colors.length === 0) return null;
  const size = 64;
  const cellWidth = size / colors.length;
  const rects = colors
    .map((color, i) => `<rect x="${(i * cellWidth).toFixed(1)}" y="0" width="${cellWidth.toFixed(1)}" height="${size}" fill="${color || "#999"}" />`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Workshop Personality phase — the pixel-art equivalent of
 *  `buildSwatchThumbnail()` above, for Expression Sets
 *  (`ExpressionSetStore.js`). Renders the actual drawn pixels as small
 *  SVG rectangles, transparent cells simply omitted — a real thumbnail
 *  of what was actually drawn, not an abstract colour summary, the same
 *  "genuinely real, if simple" standard the swatch thumbnail already
 *  holds itself to. `null` for a set with nothing drawn for the
 *  requested expression yet, same as the empty-colour-list case above. */
export function buildPixelThumbnail(pixels, gridSize) {
  if (!pixels || pixels.every((p) => !p)) return null;
  const size = 64;
  const cell = size / gridSize;
  const rects = [];
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const color = pixels[gy * gridSize + gx];
      if (!color) continue;
      rects.push(`<rect x="${(gx * cell).toFixed(1)}" y="${(gy * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${color}" />`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
