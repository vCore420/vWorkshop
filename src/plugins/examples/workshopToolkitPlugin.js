import { wrapPage } from "../../browser/PageShell.js";

/**
 * workshopToolkitPlugin
 * ------------------------
 * "Create one polished example plugin... this example should become the
 * reference implementation for future Workshop plugins. Developers
 * should be able to learn the Workshop SDK simply by reading this
 * example." Every capability the Plugin SDK phase added, in one small,
 * genuinely working plugin:
 *
 *   - A manifest (`MANIFEST`, below) — the single source of truth for
 *     this plugin's own id, version, and declared permissions.
 *   - `setup(Workshop)` — the one entry point; everything below happens
 *     through the `Workshop` object handed to it, never by reaching into
 *     `PageRegistry`/`AssetService`/etc. directly.
 *   - `Workshop.registerPage()` — `plugin://workshop-toolkit`, a real
 *     Browser page (this file *is* its own documentation, the same
 *     convention `examplePagePlugin.js` already established).
 *   - `Workshop.registerPhoneApp()` — a small "Toolkit" app with a
 *     genuinely persisted personal note, demonstrating `Workshop.storage`
 *     (a Phone app runs in the same real DOM/JS context the rest of the
 *     Workshop does, unlike a Browser page's own sandboxed `srcdoc` —
 *     see this file's own "Why the Phone app, not the page" note below
 *     for why storage is demonstrated there specifically).
 *   - `Workshop.registerBuilderAsset()` — a real Construction Library
 *     piece, placeable in Build Mode like any other.
 *   - `Workshop.registerService()` — a tiny Host service, showing up in
 *     `host://services`' own "Available Capabilities" automatically.
 *   - `Workshop.lifecycle()` — an optional `init`/`dispose` pair, logged
 *     clearly, so a reader can see the older `engine.plugins` contract
 *     is still reachable through the SDK, not replaced by it.
 *
 * Registered once, in `main.js`'s own Plugin SDK section, through
 * `loadWorkshopPlugin()` — one line, the same as any other SDK plugin.
 * The two original example plugins (`dustMotesPlugin.js`,
 * `examplePagePlugin.js` + `calculatorPlugin.js`) are untouched and
 * still fully working — they demonstrate the two contracts this SDK is
 * *built on top of*; this one demonstrates the SDK itself.
 */
const MANIFEST = {
  id: "example.workshop-toolkit",
  name: "Workshop Toolkit",
  version: "1.0.0",
  description: "A small reference plugin demonstrating the complete Workshop Plugin SDK — a page, a Phone app, a Builder asset, and a Host service.",
  author: "The Workshop",
  permissions: ["browser", "phone", "builder", "host", "storage"],
};

const TIPS = [
  "Shift-click in Build Mode to add to a selection; drag an empty area to select a whole rectangle at once.",
  "Ctrl+Z / Ctrl+Y undo and redo any Build Mode action, including moving furniture.",
  "A Blueprint captures exactly what's selected — select several pieces first, then \u201cSave as Blueprint.\u201d",
  "The Atmosphere tab's Profiles section can save the exact sky/weather/time you're looking at right now.",
  "Hold a direction key and look around \u2014 movement and camera look are independent, so strafing while turning feels natural.",
];

export function workshopToolkitPlugin() {
  return {
    manifest: MANIFEST,

    setup(Workshop) {
      Workshop.log("setting up \u2014 see plugin://workshop-toolkit for the full tour");

      Workshop.registerPage("plugin://workshop-toolkit", () => toolkitPage(Workshop));

      Workshop.registerBuilderAsset({
        id: "toolkitSignpost",
        name: "Toolkit Signpost",
        description: "A small wooden signpost \u2014 this plugin's own Builder asset, placeable in Build Mode exactly like any built-in Construction piece.",
        group: "Utilities",
        parts: [
          { id: "post", type: "cylinder", position: [0, 0.55, 0], rotationY: 0, scale: [0.04, 1.1, 0.04], color: "#6b4a34", segments: 8 },
          { id: "boardA", type: "box", position: [0.16, 0.95, 0], rotationY: 0.15, scale: [0.4, 0.12, 0.03], color: "#8a6a48" },
          { id: "boardB", type: "box", position: [-0.14, 0.78, 0], rotationY: -0.2, scale: [0.34, 0.12, 0.03], color: "#8a6a48" },
        ],
      });

      // A small Host service — "Workshop.registerService()." Shows up
      // in host://services' own "Available Capabilities" the moment
      // it's registered, no Dashboard change needed (ServiceRegistry.js
      // already treats every service this way).
      Workshop.registerService("toolkit", {
        getStatus() {
          return { available: true, summary: `${TIPS.length} workshop tips available.` };
        },
        tips: () => TIPS,
      });

      // "Workshop.registerPhoneApp()." The factory Workshop hands to
      // registerPhoneAppFactory() receives the Phone's own shared deps
      // object (the same one every built-in Phone app receives) — this
      // plugin doesn't need any of it, since createToolkitPhoneApp()
      // already has Workshop itself from this closure.
      Workshop.registerPhoneApp(() => createToolkitPhoneApp(Workshop));

      // "Workshop.lifecycle()." Optional — shown here purely so a
      // reader sees the older engine.plugins contract is still reachable
      // through the SDK, not replaced by it. Neither hook does anything
      // essential; both just log, honestly.
      Workshop.lifecycle({
        init() {
          Workshop.log("lifecycle.init() \u2014 this plugin is now fully active");
        },
        dispose() {
          Workshop.log("lifecycle.dispose() \u2014 disabled or unloaded");
        },
      });
    },
  };
}

/** "Why the Phone app, not the Browser page." A Browser page renders
 *  inside a sandboxed `srcdoc` document (see `PageRegistry.js`'s own
 *  comment) — it can `postMessage` to the parent for specific, already-
 *  wired actions (as `plugin://calculator`'s own buttons do), but it
 *  has no direct access to the `Workshop` object or its `storage`. A
 *  Phone app mounts real DOM nodes in the Workshop's own document, the
 *  same context every core system runs in — so `Workshop.storage` (a
 *  plain closure reference, no bridge needed) works exactly as
 *  straightforwardly as it would in any other plugin code. */
function createToolkitPhoneApp(Workshop) {
  return {
    id: "toolkit",
    label: "Toolkit",
    glyph: "\u{1F9F0}",
    mount(container) {
      const heading = document.createElement("h2");
      heading.textContent = "Toolkit";
      container.appendChild(heading);

      const subtitle = document.createElement("p");
      subtitle.className = "app-subtitle";
      subtitle.textContent = "An example Phone app, from the Workshop Toolkit plugin \u2014 see plugin://workshop-toolkit.";
      container.appendChild(subtitle);

      const tipSection = document.createElement("div");
      tipSection.className = "workshop-phone-section";
      const tipHeading = document.createElement("h3");
      tipHeading.textContent = "Tip";
      const tipText = document.createElement("p");
      tipText.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
      const nextTipBtn = document.createElement("button");
      nextTipBtn.type = "button";
      nextTipBtn.className = "workshop-phone-small-button";
      nextTipBtn.textContent = "Another tip";
      nextTipBtn.addEventListener("click", () => {
        tipText.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
      });
      tipSection.append(tipHeading, tipText, nextTipBtn);
      container.appendChild(tipSection);

      // "Workshop.storage()." A genuinely persisted personal note,
      // saved through the plugin's own isolated storage — reload the
      // Workshop and it's still here, the same as any other saved data,
      // with no plugin-specific persistence code written for it.
      const noteSection = document.createElement("div");
      noteSection.className = "workshop-phone-section";
      const noteHeading = document.createElement("h3");
      noteHeading.textContent = "Your note";
      const noteHint = document.createElement("p");
      noteHint.className = "app-subtitle";
      noteHint.textContent = "Saved with Workshop.storage \u2014 survives a reload, just like everything else.";
      const noteInput = document.createElement("textarea");
      noteInput.className = "workshop-phone-textarea";
      noteInput.value = Workshop.storage.get("note") ?? "";
      noteInput.rows = 3;
      noteInput.addEventListener("change", () => Workshop.storage.set("note", noteInput.value));
      noteSection.append(noteHeading, noteHint, noteInput);
      container.appendChild(noteSection);
    },
  };
}

function toolkitPage(Workshop) {
  const tipsList = TIPS.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  const html = `
    <span class="workshop-page-badge">Plugin Page</span>
    <h1>Workshop Toolkit</h1>
    <p class="workshop-page-subtitle">The reference implementation for the Workshop Plugin SDK \u2014 read this file's own source (<code>src/plugins/examples/workshopToolkitPlugin.js</code>) alongside this page.</p>

    <h2>What this plugin registers</h2>
    <ul>
      <li><strong>This page</strong> \u2014 <code>Workshop.registerPage("plugin://workshop-toolkit", ...)</code></li>
      <li><strong>A Builder asset</strong> \u2014 <code>Workshop.registerBuilderAsset(...)</code>, a "Toolkit Signpost" now in the Construction Library's Utilities group, placeable in Build Mode</li>
      <li><strong>A Phone app</strong> \u2014 <code>Workshop.registerPhoneApp(...)</code>, "Toolkit" on the Workshop Phone, with a genuinely persisted note (<code>Workshop.storage</code>)</li>
      <li><strong>A Host service</strong> \u2014 <code>Workshop.registerService("toolkit", ...)</code>, visible at <a href="host://services">host://services</a></li>
      <li><strong>Lifecycle hooks</strong> \u2014 <code>Workshop.lifecycle({init, dispose})</code>, logged to the console</li>
    </ul>

    <h2>The entire manifest</h2>
    <pre><code>{
  id: "example.workshop-toolkit",
  name: "Workshop Toolkit",
  version: "1.0.0",
  permissions: ["browser", "phone", "builder", "host", "storage"],
}</code></pre>
    <p>Every method above needed the matching capability declared here \u2014 <code>registerPage()</code> needs <code>"browser"</code>, <code>registerBuilderAsset()</code> needs <code>"builder"</code>, and so on. Leave one out and the SDK logs a clear console warning instead of silently doing nothing. See <a href="host://plugins">host://plugins</a> to view (and, if you like, revoke) exactly what this plugin was granted.</p>

    <h2>Tips this plugin knows about</h2>
    <ul>${tipsList}</ul>

    <h2>See also</h2>
    <ul>
      <li><a href="workshop://plugin-sdk">workshop://plugin-sdk</a> \u2014 the full developer guide this example is written to accompany</li>
      <li><a href="host://plugins">host://plugins</a> \u2014 the Plugin Manager: every loaded plugin, its status, and its permissions</li>
      <li><a href="plugin://example-plugin">plugin://example-plugin</a> and <a href="plugin://calculator">plugin://calculator</a> \u2014 the two original example plugins, still using the SDK's own underlying contracts directly</li>
      <li><a href="asset://">asset://</a> \u2014 the Shared Asset Library</li>
    </ul>
  `;
  return { title: "Workshop Toolkit", html: wrapPage("Workshop Toolkit", html) };
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
