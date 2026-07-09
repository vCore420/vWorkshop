import { createWardrobeApp } from "../../computer/apps/WardrobeApp.js";

/**
 * createWardrobeOverlay
 * -----------------------
 * "Please avoid creating a second wardrobe system... the wardrobe
 * furniture should simply become another way of accessing the existing
 * functionality." This file is deliberately almost nothing: it builds
 * the exact same app object `src/computer/apps/registry.js` builds for
 * the computer, once, and mounts it into an overlay panel instead of a
 * computer screen. Every field, every outfit, every texture — all of it
 * is `WardrobeApp.js`'s own code, completely unmodified. Physically
 * opening the wardrobe and opening it from the computer show the same
 * live state, because it *is* the same state, edited through the same
 * one implementation either way.
 */
export function createWardrobeOverlay({ appearanceStore, outfitStore, textureStore }) {
  const wardrobeApp = createWardrobeApp({ appearanceStore, outfitStore, textureStore });
  return {
    materialClass: "wardrobe",
    mount(panelEl) {
      panelEl.classList.add("wardrobe-overlay-panel");
      return wardrobeApp.mount(panelEl);
    },
  };
}
