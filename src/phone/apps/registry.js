import { createBuilderPhoneApp } from "./BuilderPhoneApp.js";
import { createBeingsPhoneApp } from "./BeingsPhoneApp.js";
import { createWardrobePhoneApp } from "./WardrobePhoneApp.js";
import { createBrowserPhoneApp } from "./BrowserPhoneApp.js";
import { createBubblePhoneApp } from "./BubblePhoneApp.js";
import { createWorkshopPhoneApp } from "./WorkshopPhoneApp.js";
import { createEmotesPhoneApp } from "./EmotesPhoneApp.js";
import { createSettingsPhoneApp } from "./SettingsPhoneApp.js";

/**
 * phone/apps/registry.js
 * ------------------------
 * "Applications should register themselves with the phone rather than
 * being hardcoded. This should allow future Workshop systems and plugins
 * to add applications naturally." The exact same shape
 * `src/computer/apps/registry.js` already established for the Computer —
 * a list of factories, built once with the dependencies each app needs,
 * plus a `registerAppFactory` escape hatch for a future plugin (see
 * docs/PLUGIN_GUIDE.md). An app factory is `(deps) => AppDefinition`,
 * where `AppDefinition` is `{ id, label, glyph, mount(container) }` —
 * deliberately the same three-field shape a computer app already uses,
 * so a future plugin author who already knows one already knows both.
 */
const factories = [
  createBuilderPhoneApp,
  createBeingsPhoneApp,
  createWardrobePhoneApp,
  createBrowserPhoneApp,
  createBubblePhoneApp,
  createWorkshopPhoneApp,
  createEmotesPhoneApp,
  createSettingsPhoneApp,
];

export function registerPhoneAppFactory(factory) {
  factories.push(factory);
}

export function buildPhoneApps(deps) {
  return factories.map((factory) => factory(deps));
}
