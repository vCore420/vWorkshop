/**
 * tabListTargetIndex
 * ---------------------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass"), Wave 3. The
 * WAI-ARIA Tabs pattern expects Left/Right/Home/End to move (and, in
 * this codebase's own "click already both focuses and activates" model,
 * also activate) between tabs — every custom tab bar here already
 * activates on click, so there's no separate "focused but not yet
 * selected" state worth inventing just for the keyboard. This is the one
 * piece actually shared between the Browser's tab strip and the Tools
 * panel's tab bars: the pure index arithmetic. Every call site fully
 * rebuilds its own tab bar's DOM on activation already (the same
 * `render()` pattern used throughout this project), so *moving* focus
 * to the result is each call site's own job, done once its own
 * synchronous re-render has finished.
 */
export function tabListTargetIndex(key, currentIndex, count) {
  if (count <= 0) return null;
  if (key === "ArrowRight") return (currentIndex + 1) % count;
  if (key === "ArrowLeft") return (currentIndex - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
