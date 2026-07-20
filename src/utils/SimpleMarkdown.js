/**
 * SimpleMarkdown
 * ----------------
 * Renders exactly the markdown the Workshop's own docs/*.md files
 * actually use — headers, paragraphs, bold/italic, inline code, fenced
 * code blocks, (nested) bullet lists, links, horizontal rules, and a
 * three-tag `<details>`/`<summary>` whitelist (the one HTML construct
 * any Workshop doc actually uses — HISTORY.md's collapsed changelog) —
 * not a general-purpose CommonMark implementation. The `workshop://`
 * documentation pages (`documentation`, `builder`, `animation`,
 * `plugin-sdk`, and `history` — see WorkshopPages.js) are the only
 * callers, and they're rendering trusted, Workshop-authored files, not
 * arbitrary user content, so this doesn't need to defend against
 * malicious markdown either. (The caller list above was itself found
 * stale in the v2.2.3d review — it had said three pages for two phases
 * after plugin-sdk became a fourth.)
 */
import { escapeHtml } from "./domSafety.js";

export function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let listStack = []; // stack of open <ul> indent levels, innermost last

  function closeLists(toLevel = -1) {
    while (listStack.length > 0 && listStack[listStack.length - 1] > toLevel) {
      htmlParts.push("</ul>");
      listStack.pop();
    }
  }

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith("```")) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        closeLists();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const line = rawLine;
    if (line.trim() === "") {
      closeLists();
      continue;
    }
    // A three-tag whitelist, not general HTML support: docs/HISTORY.md
    // wraps its full changelog in <details>/<summary> (the one HTML
    // construct any Workshop doc actually uses), and without this the
    // tags would render as escaped literal text. The summary's own inner
    // text still goes through inline() like anything else; every other
    // HTML-looking line in a doc stays escaped, exactly as before.
    // Added for workshop://history (v2.2.3d's One Contribution).
    const trimmed = line.trim();
    if (trimmed === "<details>" || trimmed === "</details>") {
      closeLists();
      htmlParts.push(trimmed);
      continue;
    }
    const summaryMatch = trimmed.match(/^<summary>(.*)<\/summary>$/);
    if (summaryMatch) {
      closeLists();
      htmlParts.push(`<summary>${inline(summaryMatch[1])}</summary>`);
      continue;
    }
    if (/^---+\s*$/.test(line.trim())) {
      closeLists();
      htmlParts.push("<hr>");
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (listMatch) {
      const indentLevel = Math.floor(listMatch[1].length / 2);
      while (listStack.length > 0 && listStack[listStack.length - 1] > indentLevel) {
        htmlParts.push("</ul>");
        listStack.pop();
      }
      if (listStack.length === 0 || listStack[listStack.length - 1] < indentLevel) {
        htmlParts.push("<ul>");
        listStack.push(indentLevel);
      }
      htmlParts.push(`<li>${inline(listMatch[2])}</li>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  if (inCodeBlock && codeBlockLines.length) htmlParts.push(`<pre><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`);

  return htmlParts.join("\n");
}

/** Bold, italic, inline code, and links — applied to already-HTML-escaped
 *  text (escaping happens first, so `<`/`>`/`&` in the source markdown
 *  itself can never break the surrounding page). */
function inline(text) {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = /^https?:\/\//.test(url) ? url : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener">${label}</a>`;
  });
  return escaped;
}

