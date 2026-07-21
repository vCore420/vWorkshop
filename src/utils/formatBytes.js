/**
 * formatBytes
 * -------------
 * Version 4, Phase 1 — `AIApp.js` already had its own three-tier
 * (B/MB/GB) byte formatter for model sizes; `host://files`' new file
 * browser needed the identical idea but with a KB tier too (most text
 * files land well under 1 MB, where the old version would have shown a
 * raw byte count like "438044 B"). Rather than a second hand-rolled
 * copy with a slightly different contract, this is the one shared
 * version — `AIApp.js` now imports it instead of keeping its own.
 */
export function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}
