/**
 * debounce
 * --------
 * Version 3 wrap-up cleanup — this exact "clear the pending timer, start
 * a new one" pattern had been hand-rolled independently three times
 * (`PlayerCharacterSystem._scheduleRebuild()`, `PersistenceSystem._scheduleSave()`,
 * `BuildingDetectionSystem._scheduleDetection()`), each with its own timer
 * field and its own identical five lines. `debounced.cancel()` clears any
 * pending call without firing it — the same thing each site's own
 * `dispose()`/cleanup already wanted `clearTimeout` for.
 */
export function debounce(fn, delayMs) {
  let timer = null;
  function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
