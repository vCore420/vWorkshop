import { createProjectsApp } from "./ProjectsApp.js";
import { createJournalApp } from "./JournalApp.js";
import { createBrowserApp } from "./BrowserApp.js";
import { createAIApp } from "./AIApp.js";
import { createMediaApp } from "./MediaApp.js";
import { createSettingsApp } from "./SettingsApp.js";
import { createBuilderApp } from "./builder/BuilderApp.js";
import { createWardrobeApp } from "./WardrobeApp.js";
import { createAnimationEditorApp } from "./AnimationEditorApp.js";
import { createBeingCreatorApp } from "./beings/BeingCreatorApp.js";
import { createBeingSpawnerApp } from "./beings/BeingSpawnerApp.js";
import { createBeingManagerApp } from "./beings/BeingManagerApp.js";

/**
 * apps/registry.js
 * -----------------
 * Same idea as `src/entities/furniture/registry.js`: a list of factories,
 * built once with the dependencies each app needs, plus a
 * `registerAppFactory` escape hatch for a future plugin to add its own tab
 * (see docs/PLUGIN_GUIDE.md). An app factory is `(deps) => AppDefinition`,
 * where `AppDefinition` is `{ id, label, glyph, mount(container, ctx) }`.
 */
const factories = [
  createProjectsApp,
  createJournalApp,
  createBrowserApp,
  createAIApp,
  createMediaApp,
  createBuilderApp,
  createWardrobeApp,
  createAnimationEditorApp,
  createBeingCreatorApp,
  createBeingSpawnerApp,
  createBeingManagerApp,
  createSettingsApp,
];

export function registerAppFactory(factory) {
  factories.push(factory);
}

export function buildApps(deps) {
  return factories.map((factory) => factory(deps));
}
