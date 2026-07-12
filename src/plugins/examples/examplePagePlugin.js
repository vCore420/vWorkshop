import { wrapPage } from "../../browser/PageShell.js";

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
 * Deliberately does almost nothing beyond existing — its own page
 * *is* the documentation, explaining exactly how it got there, so anyone
 * curious about writing a real plugin page can read this file and its
 * own rendered output side by side.
 */
export function examplePagePlugin() {
  return {
    id: "example.page-plugin",
    name: "Example Page Plugin",
    pages: ["plugin://example-plugin"],

    providePages(pageRegistry) {
      pageRegistry.register("plugin://example-plugin", () => examplePage());
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

    <h2>See also</h2>
    <ul>
      <li><a href="plugin://calculator">plugin://calculator</a> — a second example plugin, a genuinely working calculator</li>
      <li><a href="host://plugins">host://plugins</a> — every plugin currently contributing pages</li>
      <li><a href="workshop://documentation">workshop://documentation</a> — the Workshop's own documentation, including <code>docs/PLUGIN_GUIDE.md</code></li>
    </ul>
  `;
  return { title: "Example Page Plugin", html: wrapPage("Example Page Plugin", html) };
}
