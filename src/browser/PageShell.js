/**
 * PageShell
 * -----------
 * Every `workshop://` page is rendered into an iframe via `srcdoc`, which
 * needs a complete HTML document, not a bare content fragment — this is
 * the one place that wraps whatever a page provider returns with a
 * `<head>` (linking `css/browser-pages.css`, the same wood/brass/paper
 * material language the rest of the Workshop's interfaces already use)
 * and a `<body>`. Every `workshop://` page shares this shell, so none of
 * them need to remember to look like the Workshop themselves.
 *
 * `srcdoc` content's own base URL matches the embedding page's — a
 * relative stylesheet path (the same `./css/...` convention index.html
 * itself already uses throughout, rather than a root-relative `/css/...`
 * one) resolves correctly against wherever the Workshop is actually
 * deployed, including a GitHub Pages project site living at a subpath
 * rather than a domain root.
 */
export function wrapPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
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
  // workshop:// isn't a protocol real browsers understand, so a plain
  // <a href="workshop://..."> would otherwise just do nothing when
  // clicked. Intercepted here, once, for every workshop:// page, rather
  // than each page needing its own copy of this same handler — the exact
  // reason this lives in the one shared shell every page goes through.
  // Ordinary http(s):// links (external doc references, say) are left
  // alone entirely; they already carry target="_blank" where it matters
  // and open as real, separate browser tabs outside the Workshop.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='workshop://']");
    if (!link) return;
    event.preventDefault();
    window.parent.postMessage({ type: "workshop-browser-navigate", url: link.getAttribute("href") }, "*");
  });
</script>
</body>
</html>`;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
