import { wrapPage } from "../../browser/PageShell.js";
import { buildSwatchThumbnail } from "../../host/WorkshopAssetSchema.js";

/** Three tiny, genuinely real example assets — not fabricated preview
 *  data (see `DocumentsService.js`'s own distinction between the two):
 *  these actually exist, `all()`/`get()` actually return them, and they
 *  actually appear in the Shared Asset Library, `workshop://search`, and
 *  everywhere else a Workshop Asset shows up. They're simple on purpose
 *  — the point is proving the mechanism works end to end for a plugin,
 *  not building a real content pack. */
const STICKERS = [
  { id: "sticker-1", name: "Golden Star", color: "#d4af37" },
  { id: "sticker-2", name: "Little Cloud", color: "#bcd4e6" },
  { id: "sticker-3", name: "Tiny Leaf", color: "#7fae62" },
];

/**
 * examplePagePlugin
 * -------------------
 * "Plugins should be capable of registering Browser pages... plugin://
 * example-plugin... naturally integrate into Browser navigation without
 * requiring hardcoded support." The reference implementation of the
 * `src/host/PluginRegistry.js` contract — the same role
 * `src/plugins/examples/dustMotesPlugin.js` plays for the *other* plugin
 * contract (`src/core/PluginManager.js`'s own init/update/dispose/save/
 * load lifecycle). Registered once, in `main.js`, via
 * `hostManager.pluginRegistry.registerPlugin(examplePagePlugin())` —
 * three lines, no changes anywhere else in the Browser, Host, or
 * `PageRegistry.js` itself, which is the entire point being demonstrated.
 *
 * **Workshop Asset System phase: `provideAssets()` too.** "Plugins
 * should naturally register Workshop Assets... assets installed through
 * plugins should appear inside the Workshop Asset Library exactly like
 * native assets." `STICKERS` above are three tiny, real assets — this
 * plugin's own `registerKind("example-plugin-stickers", ...)` call is
 * exactly the same call `main.js` makes for Objects, Blueprints, and
 * every other built-in kind. Nothing in `AssetService.js`,
 * `AssetPages.js`, or `workshop://search` needed to change, or even
 * know, that this particular kind came from a plugin rather than a
 * built-in store.
 *
 * Deliberately does almost nothing beyond existing — its own page
 * *is* the documentation, explaining exactly how it got there, so anyone
 * curious about writing a real plugin page (or a real plugin asset kind)
 * can read this file and its own rendered output side by side.
 */
export function examplePagePlugin() {
  return {
    id: "example.page-plugin",
    name: "Example Page Plugin",
    pages: ["plugin://example-plugin"],
    assetKinds: ["example-plugin-stickers"],

    providePages(pageRegistry) {
      pageRegistry.register("plugin://example-plugin", () => examplePage());
    },

    provideAssets(assetService) {
      assetService.registerKind("example-plugin-stickers", {
        label: "Example Plugin Stickers",
        all: () => STICKERS,
        get: (id) => STICKERS.find((s) => s.id === id) ?? null,
        toDescriptor: (s) => ({
          name: s.name,
          author: "Example Page Plugin",
          categories: ["Effects"],
          tags: ["sticker", "plugin", "example"],
          thumbnail: buildSwatchThumbnail([s.color]),
        }),
      });
    },
  };
}

function examplePage() {
  const html = `
    <span class="workshop-page-badge">Plugin Page</span>
    <h1>Example Page Plugin</h1>
    <p class="workshop-page-subtitle">A real, working demonstration of a plugin contributing its own page to the Browser.</p>

    <p>This page didn't come from <code>WorkshopPages.js</code> or <code>HostPages.js</code> — it was registered by an ordinary plugin object, at Workshop startup, with three lines:</p>
    <pre><code>export function examplePagePlugin() {
  return {
    id: "example.page-plugin",
    name: "Example Page Plugin",
    pages: ["plugin://example-plugin"],
    providePages(pageRegistry) {
      pageRegistry.register("plugin://example-plugin", () =&gt; examplePage());
    },
  };
}</code></pre>
    <p>...and one line in <code>main.js</code>:</p>
    <pre><code>hostManager.pluginRegistry.registerPlugin(examplePagePlugin());</code></pre>

    <h2>Why this matters</h2>
    <p>Neither the Browser (<code>BrowserApp.js</code>) nor the page registry (<code>PageRegistry.js</code>) had to change at all for this page to exist. They already treat <code>plugin://</code> the same way they treat <code>workshop://</code> and <code>host://</code> — any registered URL under any of the three schemes just works, the moment something registers it.</p>

    <h2>This plugin also registers Workshop Assets</h2>
    <p>Alongside its own page, this plugin calls <code>assetService.registerKind("example-plugin-stickers", ...)</code> with three small, genuinely real assets — the same <code>registerKind()</code> call <code>main.js</code> makes for Objects, Blueprints, and every other built-in kind. They already show up in <a href="asset://">the Shared Asset Library</a> and <a href="workshop://search">workshop://search</a>, exactly like a native asset would.</p>

    <h2>See also</h2>
    <ul>
      <li><a href="plugin://calculator">plugin://calculator</a> — a second example plugin, a genuinely working calculator</li>
      <li><a href="host://plugins">host://plugins</a> — every plugin currently contributing pages or assets</li>
      <li><a href="asset://">asset://</a> — the Shared Asset Library, including this plugin's own three stickers</li>
      <li><a href="workshop://documentation">workshop://documentation</a> — the Workshop's own documentation, including <code>docs/PLUGIN_GUIDE.md</code></li>
    </ul>
  `;
  return { title: "Example Page Plugin", html: wrapPage("Example Page Plugin", html) };
}
