import { wrapPage } from "./PageShell.js";
import { WORKSHOP_JOINTS } from "../player/WorkshopSkeleton.js";

const DETAIL_URL_PATTERN = /^workshop:\/\/asset\/(object|blueprint|animation|being)\/(.+)$/;
const ASSET_SCHEME_DETAIL_PATTERN = /^asset:\/\/(object|blueprint|animation|being)\/(.+)$/;
// The Browser's own URL segment ("object") vs. AssetService's own kind id
// ("objects") differ by design — the kind id matches the natural-language
// label ("Objects") used everywhere else (tiles, the Dashboard), while the
// URL segment predates AssetService and stays singular for readability
// (`asset://object/42`, not `asset://objects/42`). This is the one map
// between the two.
const URL_SEGMENT_TO_KIND = { object: "objects", blueprint: "blueprints", animation: "animations", being: "beings" };
const KIND_TO_URL_SEGMENT = { objects: "object", blueprints: "blueprint", animations: "animation", beings: "being" };

/**
 * AssetPages
 * ------------
 * "Please begin introducing file-aware pages... whenever practical,
 * opening a Workshop asset should display an informative page rather
 * than simply downloading the file... preview, metadata, categories,
 * creation date, actions, relationships."
 *
 * `asset://` is the canonical scheme (`workshop://assets`/
 * `workshop://asset/<category>/<id>` keep resolving as aliases).
 * `asset://` is the overview — every asset category the Workshop
 * actually has a library for, each a live count read straight from
 * `AssetService`. Three of those six (Objects, Blueprints, Animations)
 * get real per-item detail pages, registered as a single dynamic
 * resolver rather than one exact registration per item.
 *
 * **Workshop Asset System phase: pages now read `AssetService`'s own
 * descriptors, not the underlying stores directly.** Every detail page
 * shows the full common envelope (`WorkshopAssetSchema.js`) — author,
 * version, categories, tags, validation status — plus real dependencies
 * and used-by relationships computed by `AssetService.js` itself, not
 * this file re-deriving them. Favouriting and "recently viewed" are both
 * genuinely real (see their own sections below).
 *
 * **Preview, honestly.** There's no way to render an actual live 3D
 * preview of an object definition inside a `srcdoc` iframe without
 * embedding a second Three.js scene per page view — real, but out of
 * proportion for this phase. Instead, each object/blueprint's own part
 * colours become a small row of swatches, backed by the same
 * `buildSwatchThumbnail()` the descriptor's own `thumbnail` field uses —
 * a genuine, if simplified, visual preview built from the definition's
 * own real data, not a placeholder image.
 */
export function registerAssetPages(pageRegistry, searchIndex, deps) {
  pageRegistry.register("workshop://assets", () => assetsOverviewPage(deps));
  pageRegistry.register("asset://", () => assetsOverviewPage(deps));
  searchIndex.addEntry({
    url: "workshop://assets",
    title: "Shared Asset Library",
    category: "Workshop",
    keywords: ["assets", "objects", "models", "animations", "blueprints", "images", "music", "library"],
  });

  pageRegistry.registerDynamic(
    (url) => DETAIL_URL_PATTERN.test(url),
    (url) => assetDetailPage(url, deps)
  );
  pageRegistry.registerDynamic(
    (url) => ASSET_SCHEME_DETAIL_PATTERN.test(url),
    (url) => assetDetailPage(rewriteAssetSchemeUrl(url), deps)
  );
}

/** `asset://object/42` is the same page as `workshop://asset/object/42`,
 *  just spelled under the new canonical scheme — rewritten to the
 *  `workshop://asset/...` form internally so `assetDetailPage()` only
 *  ever needs to understand one URL shape. */
function rewriteAssetSchemeUrl(url) {
  return url.replace(/^asset:\/\//, "workshop://asset/");
}

function assetsOverviewPage({ assetService, worldObjectsStore }) {
  const summary = assetService?.summary() ?? [];
  const favourites = assetService?.favourites() ?? [];
  const recent = assetService?.recent() ?? [];

  const sections = summary
    .map((kind) => {
      const segment = KIND_TO_URL_SEGMENT[kind.id];
      const descriptors = segment ? assetService.allDescriptors(kind.id) : [];
      const body = descriptors.length
        ? assetGrid(descriptors.map((d) => ({ url: `asset://${segment}/${d.assetId.slice(d.assetId.indexOf(":") + 1)}`, title: d.name, meta: d.categories.join(", ") })))
        : kind.count > 0
          ? kindSummaryNote(kind, worldObjectsStore)
          : emptyNote(EMPTY_NOTES[kind.id] ?? "Nothing here yet.");
      return `<div class="workshop-home-section"><h2>${escapeHtml(kind.label)} <span class="workshop-page-badge">${kind.count}</span></h2>${body}</div>`;
    })
    .join("");

  const html = `
    <h1>Shared Asset Library</h1>
    <p class="workshop-page-subtitle">Everything the Workshop knows how to reuse \u2014 built, not downloaded. Search for any of it from <a href="workshop://search">workshop://search</a>.</p>

    <div class="workshop-home-section">
      <h2>Favourites <span class="workshop-page-badge">${favourites.length}</span></h2>
      ${favourites.length ? assetGrid(favourites.map(descriptorToTile)) : emptyNote("Star an asset from its own page to keep it here.")}
    </div>

    <div class="workshop-home-section">
      <h2>Recently Viewed <span class="workshop-page-badge">${recent.length}</span></h2>
      ${recent.length ? assetGrid(recent.map(descriptorToTile)) : emptyNote("Open an asset's own page and it'll show up here.")}
    </div>

    ${sections}
  `;
  return { title: "Shared Asset Library", html: wrapPage("Shared Asset Library", html) };
}

const EMPTY_NOTES = {
  objects: "No objects designed yet \u2014 start one in the Builder.",
  blueprints: "No blueprints saved yet \u2014 capture one from Build Mode.",
  animations: "No custom animations yet \u2014 create one in the Animation Editor.",
};

/** Models/Images/Music (and any future kind without its own detail page —
 *  a plugin-provided one, say) don't get a grid of dead links; a short,
 *  honest note instead. Kinds without a specific note of their own still
 *  get a generic, accurate one rather than rendering nothing. */
function kindSummaryNote(kind, worldObjectsStore) {
  void worldObjectsStore;
  const notes = {
    models: "Imported <code>.glb</code>/<code>.gltf</code> files, shared between Beings, the Builder, and future systems. Browsable in detail from the Computer's own library pickers \u2014 individual model pages are a future extension point.",
    images: "Uploaded images available to Display Surfaces and other picture-frame-like objects.",
    music: "See the Music app for full browsing by artist and album.",
  };
  return `<p class="workshop-page-subtitle" style="margin-bottom:8px;">${notes[kind.id] ?? `${kind.count} asset${kind.count === 1 ? "" : "s"} registered \u2014 searchable from <a href="workshop://search">workshop://search</a>; individual pages aren't available for this kind yet.`}</p>`;
}

function descriptorToTile(d) {
  const segment = KIND_TO_URL_SEGMENT[d.type];
  const url = segment ? `asset://${segment}/${d.assetId.slice(d.assetId.indexOf(":") + 1)}` : "asset://";
  return { url, title: d.name, meta: d.categories.join(", ") };
}

function assetDetailPage(url, deps) {
  const { assetService } = deps;
  const match = DETAIL_URL_PATTERN.exec(url);
  if (!match) return notFoundPage(url);
  const [, segment, id] = match;
  const kindId = URL_SEGMENT_TO_KIND[segment];
  const assetId = assetService.assetId(kindId, id);
  const descriptor = assetService.describe(assetId);
  if (!descriptor) return notFoundPage(url);

  assetService.touch(assetId); // "Recent Assets" reflects what's genuinely been looked at — see AssetService.js's own comment

  if (kindId === "objects") return objectDetailPage(descriptor, deps);
  if (kindId === "blueprints") return blueprintDetailPage(descriptor, deps);
  if (kindId === "animations") return animationDetailPage(descriptor, deps);
  if (kindId === "beings") return beingDetailPage(descriptor, deps);
  return notFoundPage(url);
}

/** Every detail page shares this — the common envelope
 *  (`WorkshopAssetSchema.js`), the favourite star, dependencies, and
 *  used-by, so a kind-specific page function only has to build its own
 *  preview and the fields unique to it. */
function commonAssetSections(descriptor, assetService) {
  const deps = descriptor.dependencies;
  const usedBy = assetService.getUsedBy(descriptor.assetId);
  const linkList = (assetIds, emptyText) =>
    assetIds.length
      ? `<ul>${assetIds
          .map((id) => {
            const d = assetService.describe(id);
            if (!d) return `<li>${escapeHtml(id)} (missing)</li>`;
            const segment = KIND_TO_URL_SEGMENT[d.type];
            const href = segment ? `asset://${segment}/${id.slice(id.indexOf(":") + 1)}` : null;
            return `<li>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(d.name)}</a>` : escapeHtml(d.name)}</li>`;
          })
          .join("")}</ul>`
      : `<p class="workshop-page-empty">${emptyText}</p>`;

  return `
    <div class="workshop-asset-meta-grid">
      ${metaRow("Author", descriptor.author)}
      ${metaRow("Version", String(descriptor.version))}
      ${metaRow("Categories", descriptor.categories.length ? descriptor.categories.join(", ") : "None")}
      ${metaRow("Tags", descriptor.tags.length ? descriptor.tags.join(", ") : "None")}
      ${metaRow("Created", formatDate(descriptor.createdAt))}
      ${metaRow("Last updated", formatDate(descriptor.updatedAt))}
    </div>

    <h2>Validation</h2>
    ${
      descriptor.validationStatus.valid
        ? `<p class="workshop-page-subtitle">No issues found.</p>`
        : `<ul class="workshop-page-subtitle">${descriptor.validationStatus.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`
    }

    <h2>Dependencies</h2>
    ${linkList(deps, "This asset doesn't depend on anything else the Workshop currently tracks.")}

    <h2>Used By</h2>
    ${linkList(usedBy, "Nothing else the Workshop currently tracks depends on this asset.")}
  `;
}

function favouriteButton(assetId, isFavourite) {
  return `
    <button type="button" class="workshop-favourite-button${isFavourite ? " workshop-favourite-active" : ""}" data-favourite-asset="${escapeHtml(assetId)}">
      ${isFavourite ? "\u2605 Favourited" : "\u2606 Add to Favourites"}
    </button>
    <script>
      document.querySelector("[data-favourite-asset]").addEventListener("click", (event) => {
        window.parent.postMessage({ type: "workshop-browser-toggle-favourite", assetId: event.target.dataset.favouriteAsset }, "*");
      });
    </script>
  `;
}

function objectDetailPage(descriptor, { objectLibraryStore, worldObjectsStore, assetService }) {
  const id = descriptor.assetId.slice(descriptor.assetId.indexOf(":") + 1);
  const def = objectLibraryStore?.get(Number(id)) ?? objectLibraryStore?.get(id);
  if (!def) return notFoundPage(`asset://object/${id}`);

  const placedCount = (worldObjectsStore?.all() ?? []).filter((instance) => instance.definitionId === def.id).length;
  const swatches = (def.parts ?? []).map((p) => `<div class="workshop-asset-swatch" style="background:${escapeHtml(p.color ?? "#999")}" title="${escapeHtml(p.type ?? "part")}"></div>`).join("");

  const html = `
    <span class="workshop-page-badge">Object</span>
    <h1>${escapeHtml(descriptor.name)}</h1>
    <p class="workshop-page-subtitle">${escapeHtml(descriptor.description || "No description given.")}</p>
    ${favouriteButton(descriptor.assetId, descriptor.isFavourite)}

    <div class="workshop-asset-preview">${swatches || "<span class=\"workshop-page-empty\">No parts</span>"}</div>

    ${commonAssetSections(descriptor, assetService)}

    <h2>Placement</h2>
    <p>Currently placed <strong>${placedCount}</strong> time${placedCount === 1 ? "" : "s"} in the Workshop.</p>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Open the Builder from the Computer's rail to edit this object \u2014 editing it there updates every placed instance automatically.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: descriptor.name, html: wrapPage(descriptor.name, html) };
}

function blueprintDetailPage(descriptor, { assetService }) {
  const html = `
    <span class="workshop-page-badge">Blueprint</span>
    <h1>${escapeHtml(descriptor.name)}</h1>
    <p class="workshop-page-subtitle">A reusable cluster of ${descriptor.dependencies.length} independent World Object${descriptor.dependencies.length === 1 ? "" : "s"}.</p>
    ${favouriteButton(descriptor.assetId, descriptor.isFavourite)}

    ${commonAssetSections(descriptor, assetService)}

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Place this blueprint from the Builder's own Blueprints tab \u2014 every piece places as its own independent, separately-editable object.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: descriptor.name, html: wrapPage(descriptor.name, html) };
}

/** A real bug, found and fixed here: `AnimationLibraryStore.get(id)`
 *  deliberately only searches *user* clips (see its own comment) —
 *  `getClip(id)` is the one that resolves either kind. Using the wrong
 *  one meant clicking through to any of the eight seeded default clips
 *  (Walk, Wave, Jump, and so on) from the Shared Asset Library incorrectly
 *  showed "Asset not found," even though `AssetService`'s own overview
 *  correctly listed them (via `AnimationLibraryStore.all()`, which does
 *  include defaults) — the list and the page it linked to had quietly
 *  disagreed about what existed. */
function animationDetailPage(descriptor, { animationLibraryStore, assetService }) {
  const id = descriptor.assetId.slice(descriptor.assetId.indexOf(":") + 1);
  const clip = animationLibraryStore?.getClip(id);
  if (!clip) return notFoundPage(`asset://animation/${id}`);
  const totalDuration = (clip.frames ?? []).reduce((sum, f) => sum + (f.duration ?? 0), 0);

  const html = `
    <span class="workshop-page-badge">Animation</span>
    <h1>${escapeHtml(descriptor.name)}</h1>
    <p class="workshop-page-subtitle">${escapeHtml(descriptor.description || "No description given.")}</p>
    ${favouriteButton(descriptor.assetId, descriptor.isFavourite)}

    ${commonAssetSections(descriptor, assetService)}

    <h2>Playback</h2>
    <div class="workshop-asset-meta-grid">
      ${metaRow("Frames", String((clip.frames ?? []).length))}
      ${metaRow("Total duration", `${totalDuration.toFixed(1)}s`)}
      ${metaRow("Loops", clip.loop ? "Yes" : "No")}
      ${metaRow("Speed", `${clip.speed}\u00d7`)}
    </div>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Open the Animation Editor from the Computer's rail to preview or edit this clip.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: descriptor.name, html: wrapPage(descriptor.name, html) };
}

/** "Being Creator should now fully integrate with the Workshop Asset
 *  System... completed beings should become Workshop Assets." Shows a
 *  real swatch preview for a primitive-built body (the same real part
 *  colours `AssetService`'s own `toDescriptor()` already built the
 *  descriptor's own thumbnail from), or an honest note for an
 *  imported-model one — there's no live 3D preview inside a `srcdoc`
 *  page for either, the identical "genuine but simplified" standard
 *  Objects/Blueprints already hold to (see this file's own module
 *  comment). */
function beingDetailPage(descriptor, { beingLibrary, assetService }) {
  const id = descriptor.assetId.slice(descriptor.assetId.indexOf(":") + 1);
  const being = beingLibrary?.get(id);
  if (!being) return notFoundPage(`asset://being/${id}`);

  const rigJointCount = being.bodyParts.filter((p) => p.jointName).length;
  const preview =
    being.bodySource === "primitives"
      ? `<div class="workshop-asset-preview">${being.bodyParts.map((p) => `<div class="workshop-asset-swatch" style="background:${escapeHtml(p.color)}" title="${escapeHtml(p.name)}"></div>`).join("") || '<span class="workshop-page-empty">No parts</span>'}</div>`
      : `<p class="workshop-page-subtitle">Built from an imported model \u2014 preview it from the Being Creator.</p>`;

  const html = `
    <span class="workshop-page-badge">Being</span>
    <h1>${escapeHtml(descriptor.name)}</h1>
    <p class="workshop-page-subtitle">${escapeHtml(descriptor.description || "No description given.")}</p>
    ${favouriteButton(descriptor.assetId, descriptor.isFavourite)}

    ${preview}

    ${commonAssetSections(descriptor, assetService)}

    <h2>Body</h2>
    <div class="workshop-asset-meta-grid">
      ${metaRow("Source", being.bodySource === "primitives" ? "Built from Primitives" : "Imported Model")}
      ${being.bodySource === "primitives" ? metaRow("Body Parts", String(being.bodyParts.length)) : ""}
      ${being.bodySource === "primitives" ? metaRow("Rig Joints Assigned", `${rigJointCount} of ${WORKSHOP_JOINTS.length}`) : ""}
      ${metaRow("Movement Style", being.movementStyle)}
      ${metaRow("Idle Behaviour", being.idleBehaviour)}
    </div>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Open the Being Creator from the Computer's rail to keep building this Being, or the Being Spawner to place it in the Workshop.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: descriptor.name, html: wrapPage(descriptor.name, html) };
}

function assetGrid(items) {
  return `<div class="workshop-home-grid">${items.map((i) => `<a class="workshop-home-tile" href="${escapeHtml(i.url)}"><span class="workshop-home-tile-title">${escapeHtml(i.title)}</span><span class="workshop-home-tile-meta">${escapeHtml(i.meta ?? "")}</span></a>`).join("")}</div>`;
}

function metaRow(label, value) {
  return `<div class="workshop-diagnostics-row"><span class="workshop-diagnostics-label">${escapeHtml(label)}</span><span class="workshop-diagnostics-value">${escapeHtml(value)}</span></div>`;
}

function emptyNote(text) {
  return `<p class="workshop-page-empty">${escapeHtml(text)}</p>`;
}

function notFoundPage(url) {
  const html = `<h1>Asset not found</h1><p>Nothing is registered for <code>${escapeHtml(url)}</code> \u2014 it may have been deleted.</p><p><a href="asset://">\u2190 Back to the Asset Library</a></p>`;
  return { title: "Asset not found", html: wrapPage("Asset not found", html) };
}

function formatDate(iso) {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "Unknown";
  }
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
