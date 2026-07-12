import { wrapPage } from "./PageShell.js";

const DETAIL_URL_PATTERN = /^workshop:\/\/asset\/(object|blueprint|animation)\/(.+)$/;
const ASSET_SCHEME_DETAIL_PATTERN = /^asset:\/\/(object|blueprint|animation)\/(.+)$/;

/**
 * AssetPages
 * ------------
 * "Please begin introducing file-aware pages... whenever practical,
 * opening a Workshop asset should display an informative page rather
 * than simply downloading the file... preview, metadata, categories,
 * creation date, actions, relationships."
 *
 * `asset://` is the canonical scheme as of the Workshop Platform phase
 * (`workshop://assets`/`workshop://asset/<category>/<id>` keep resolving
 * as aliases — see `registerAssetPages()`'s own comment). `asset://` is
 * the overview — one page, every asset category the Workshop actually
 * has a library for (Objects, Blueprints, Animations, Models, Images, Music), each a live count read straight
 * from its own store. Three of those six (Objects, Blueprints,
 * Animations) get real per-item detail pages this phase, registered as a
 * single dynamic resolver (`workshop://asset/<category>/<id>`) rather
 * than one exact registration per item — see `PageRegistry.
 * registerDynamic()`'s own comment for why that's the right shape for
 * something that grows and shrinks as the player creates and deletes
 * things. Models, Images, and Music are listed with real counts but no
 * deep per-item page yet — an honest scope boundary, not an oversight;
 * see docs/BROWSER.md's own "File Pages" section for why those three
 * specifically were left for a future phase (each already has its own
 * dedicated computer app for deep browsing today).
 *
 * **Preview, honestly.** There's no way to render an actual live 3D
 * preview of an object definition inside a `srcdoc` iframe without
 * embedding a second Three.js scene per page view — real, but out of
 * proportion for this phase. Instead, each object/blueprint's own part
 * colours become a small row of swatches — a genuine, if simplified,
 * visual preview built from the definition's own real data, not a
 * placeholder image.
 */
export function registerAssetPages(pageRegistry, searchIndex, deps) {
  pageRegistry.register("workshop://assets", () => assetsOverviewPage(deps));
  // "Local Protocols... asset://... ensure future services can naturally
  // expose functionality through these protocols" (Workshop Platform
  // phase) — `asset://` is the new canonical scheme for this whole
  // category; `workshop://assets`/`workshop://asset/...` are kept
  // resolving as aliases, the same pattern `host://` established for
  // what used to be `workshop://host` and friends.
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

function assetsOverviewPage({ objectLibraryStore, blueprintStore, animationLibraryStore, modelLibrary, imageLibraryStore, musicLibraryStore }) {
  const objects = objectLibraryStore?.all() ?? [];
  const blueprints = blueprintStore?.all() ?? [];
  const animations = animationLibraryStore?.all().filter((a) => !a.isDefault) ?? [];
  const models = modelLibrary?.all() ?? [];
  const images = imageLibraryStore?.all() ?? [];
  const songCount = musicLibraryStore ? Object.keys(musicLibraryStore.songs ?? {}).length : 0;
  const artistCount = musicLibraryStore ? Object.keys(musicLibraryStore.artists ?? {}).length : 0;

  const html = `
    <h1>Shared Asset Library</h1>
    <p class="workshop-page-subtitle">Everything the Workshop knows how to reuse \u2014 built, not downloaded.</p>

    <div class="workshop-home-section">
      <h2>Objects <span class="workshop-page-badge">${objects.length}</span></h2>
      ${objects.length ? assetGrid(objects.map((o) => ({ url: `asset://object/${o.id}`, title: o.name, meta: o.category }))) : emptyNote("No objects designed yet \u2014 start one in the Builder.")}
    </div>

    <div class="workshop-home-section">
      <h2>Blueprints <span class="workshop-page-badge">${blueprints.length}</span></h2>
      ${blueprints.length ? assetGrid(blueprints.map((b) => ({ url: `asset://blueprint/${b.id}`, title: b.name, meta: `${b.objects.length} piece${b.objects.length === 1 ? "" : "s"}` }))) : emptyNote("No blueprints saved yet \u2014 capture one from Build Mode.")}
    </div>

    <div class="workshop-home-section">
      <h2>Animations <span class="workshop-page-badge">${animations.length}</span></h2>
      ${animations.length ? assetGrid(animations.map((a) => ({ url: `asset://animation/${a.id}`, title: a.name, meta: a.category }))) : emptyNote("No custom animations yet \u2014 create one in the Animation Editor.")}
    </div>

    <div class="workshop-home-section">
      <h2>Models <span class="workshop-page-badge">${models.length}</span></h2>
      <p class="workshop-page-subtitle" style="margin-bottom:8px;">Imported <code>.glb</code>/<code>.gltf</code> files, shared between Beings, the Builder, and future systems. Browsable in detail from the Computer's own library pickers \u2014 individual model pages are a future extension point (see <a href="workshop://documentation">Workshop Documentation</a>).</p>
    </div>

    <div class="workshop-home-section">
      <h2>Images <span class="workshop-page-badge">${images.length}</span></h2>
      <p class="workshop-page-subtitle" style="margin-bottom:8px;">Uploaded images available to Display Surfaces and other picture-frame-like objects.</p>
    </div>

    <div class="workshop-home-section">
      <h2>Music <span class="workshop-page-badge">${songCount}</span></h2>
      <p class="workshop-page-subtitle" style="margin-bottom:8px;">${artistCount} artist${artistCount === 1 ? "" : "s"} across your scanned library roots \u2014 see the Music app for full browsing.</p>
    </div>
  `;
  return { title: "Shared Asset Library", html: wrapPage("Shared Asset Library", html) };
}

function assetDetailPage(url, { objectLibraryStore, blueprintStore, animationLibraryStore, worldObjectsStore }) {
  const match = DETAIL_URL_PATTERN.exec(url);
  if (!match) return notFoundPage(url);
  const [, category, id] = match;

  if (category === "object") return objectDetailPage(id, objectLibraryStore, worldObjectsStore);
  if (category === "blueprint") return blueprintDetailPage(id, blueprintStore, objectLibraryStore);
  if (category === "animation") return animationDetailPage(id, animationLibraryStore);
  return notFoundPage(url);
}

function objectDetailPage(id, objectLibraryStore, worldObjectsStore) {
  const def = objectLibraryStore?.get(Number(id)) ?? objectLibraryStore?.get(id);
  if (!def) return notFoundPage(`workshop://asset/object/${id}`);

  const placedCount = (worldObjectsStore?.all() ?? []).filter((instance) => instance.definitionId === def.id).length;
  const swatches = def.parts.map((p) => `<div class="workshop-asset-swatch" style="background:${escapeHtml(p.color ?? "#999")}" title="${escapeHtml(p.type ?? "part")}"></div>`).join("");

  const html = `
    <span class="workshop-page-badge">Object</span>
    <h1>${escapeHtml(def.name)}</h1>
    <p class="workshop-page-subtitle">${escapeHtml(def.description || "No description given.")}</p>

    <div class="workshop-asset-preview">${swatches || "<span class=\"workshop-page-empty\">No parts</span>"}</div>

    <div class="workshop-asset-meta-grid">
      ${metaRow("Category", def.category)}
      ${metaRow("Tags", def.tags?.length ? def.tags.join(", ") : "None")}
      ${metaRow("Parts", String(def.parts.length))}
      ${metaRow("Behaviours", def.behaviours?.length ? def.behaviours.map((b) => b.type).join(", ") : "None")}
      ${metaRow("Created", formatDate(def.createdAt))}
      ${metaRow("Last updated", formatDate(def.updatedAt))}
    </div>

    <h2>Relationships</h2>
    <p>Currently placed <strong>${placedCount}</strong> time${placedCount === 1 ? "" : "s"} in the Workshop.</p>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Open the Builder from the Computer's rail to edit this object \u2014 editing it there updates every placed instance automatically.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: def.name, html: wrapPage(def.name, html) };
}

function blueprintDetailPage(id, blueprintStore, objectLibraryStore) {
  const blueprint = blueprintStore?.get(id);
  if (!blueprint) return notFoundPage(`workshop://asset/blueprint/${id}`);

  const pieceNames = blueprint.objects
    .map((o) => objectLibraryStore?.get(o.definitionId)?.name ?? "Construction piece")
    .reduce((counts, name) => counts.set(name, (counts.get(name) ?? 0) + 1), new Map());
  const pieceList = [...pieceNames.entries()].map(([name, count]) => `<li>${escapeHtml(name)}${count > 1 ? ` \u00d7 ${count}` : ""}</li>`).join("");

  const html = `
    <span class="workshop-page-badge">Blueprint</span>
    <h1>${escapeHtml(blueprint.name)}</h1>
    <p class="workshop-page-subtitle">A reusable cluster of ${blueprint.objects.length} independent World Object${blueprint.objects.length === 1 ? "" : "s"}.</p>

    <div class="workshop-asset-meta-grid">
      ${metaRow("Pieces", String(blueprint.objects.length))}
      ${metaRow("Created", formatDate(blueprint.createdAt))}
    </div>

    <h2>Relationships</h2>
    <p>Made up of:</p>
    <ul>${pieceList || "<li>No pieces recorded</li>"}</ul>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Place this blueprint from the Builder's own Blueprints tab \u2014 every piece places as its own independent, separately-editable object.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: blueprint.name, html: wrapPage(blueprint.name, html) };
}

function animationDetailPage(id, animationLibraryStore) {
  const clip = animationLibraryStore?.getClip?.(id) ?? animationLibraryStore?.all().find((c) => c.id === id);
  if (!clip) return notFoundPage(`workshop://asset/animation/${id}`);

  const totalDuration = (clip.frames ?? []).reduce((sum, f) => sum + (f.duration ?? 0), 0);

  const html = `
    <span class="workshop-page-badge">Animation</span>
    <h1>${escapeHtml(clip.name)}</h1>
    <p class="workshop-page-subtitle">${escapeHtml(clip.description || "No description given.")}</p>

    <div class="workshop-asset-meta-grid">
      ${metaRow("Category", clip.category)}
      ${metaRow("Frames", String((clip.frames ?? []).length))}
      ${metaRow("Total duration", `${totalDuration.toFixed(1)}s`)}
      ${metaRow("Loops", clip.loop ? "Yes" : "No")}
      ${metaRow("Speed", `${clip.speed}\u00d7`)}
      ${metaRow("Created", clip.createdAt ? formatDate(clip.createdAt) : "Built in")}
    </div>

    <h2>Actions</h2>
    <div class="workshop-page-actions">
      <p>Open the Animation Editor from the Computer's rail to preview or edit this clip.</p>
    </div>

    <p><a href="asset://">\u2190 Back to the Asset Library</a></p>
  `;
  return { title: clip.name, html: wrapPage(clip.name, html) };
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
