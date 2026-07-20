/**
 * motionPreference
 * ------------------
 * Version 3, Phase 12 ("Accessibility & Comfort Pass") — the CSS-only
 * `prefers-reduced-motion` handling in `tokens.css` only ever reached CSS
 * transitions/animations. Every JS-driven camera/UI tween in the codebase
 * — `CameraSystem`'s shared focus-pose easing (the one mechanism every
 * "sit down" interaction, Computer/Workbench/Reading Chair alike, already
 * routes through via `enterFocus()`/`exitFocus()`), its zoom and
 * first/third-person blends, and `ComputerSystem`/`WorkbenchSystem`'s own
 * screen/panel reveal fades — kept animating at full length regardless,
 * since none of them ever actually asked the browser. This is that one
 * shared read, rather than each system independently calling
 * `matchMedia` (and independently forgetting to, which is exactly what
 * happened here). `MediaQueryList.matches` is always current, so this
 * needs no caching or change-listener to react if the OS-level setting
 * changes mid-session.
 *
 * Deliberately not applied to core movement physics (walking
 * acceleration, crouch height, landing) — those are how the player moves,
 * not gratuitous motion layered on top of it, and snapping them instead
 * of smoothing would make movement feel broken rather than more
 * comfortable. "Reduce motion" means the camera/UI transitions building
 * on top of that movement, not movement itself.
 */
const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export function prefersReducedMotion() {
  return query?.matches ?? false;
}
