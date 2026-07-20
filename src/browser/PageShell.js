/**
 * PageShell
 * -----------
 * Every internal-scheme page (`workshop://`, `host://`, `plugin://`) is
 * rendered into an iframe via `srcdoc`, which needs a complete HTML
 * document, not a bare content fragment — this is the one place that
 * wraps whatever a page provider returns with a `<head>` (linking
 * `css/browser-pages.css`, the same wood/brass/paper material language
 * the rest of the Workshop's interfaces already use) and a `<body>`.
 * Every internal page shares this shell, so none of them need to
 * remember to look like the Workshop themselves.
 *
 * `srcdoc` content's own base URL matches the embedding page's — a
 * relative stylesheet path (the same `./css/...` convention index.html
 * itself already uses throughout, rather than a root-relative `/css/...`
 * one) resolves correctly against wherever the Workshop is actually
 * deployed, including a GitHub Pages project site living at a subpath
 * rather than a domain root.
 */
import { INTERNAL_SCHEMES } from "./PageRegistry.js";
import { escapeHtml } from "../utils/domSafety.js";

const LINK_SELECTOR = INTERNAL_SCHEMES.map((scheme) => `a[href^='${scheme}://']`).join(", ");

export function wrapPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="./css/browser-pages.css">
</head>
<body>
<div class="workshop-page">
${bodyHtml}
</div>
<script>
  // Internal schemes (workshop://, host://, plugin://) aren't protocols
  // real browsers understand, so a plain <a href="host://..."> would
  // otherwise just do nothing when clicked. Intercepted here, once, for
  // every internal page, rather than each page needing its own copy of
  // this same handler — the exact reason this lives in the one shared
  // shell every page goes through. Ordinary http(s):// links (external
  // doc references, say) are left alone entirely; they already carry
  // target="_blank" where it matters and open as real, separate browser
  // tabs outside the Workshop.
  document.addEventListener("click", (event) => {
    const link = event.target.closest(${JSON.stringify(LINK_SELECTOR)});
    if (!link) return;
    event.preventDefault();
    window.parent.postMessage({ type: "workshop-browser-navigate", url: link.getAttribute("href") }, "*");
  });
</script>
</body>
</html>`;
}
