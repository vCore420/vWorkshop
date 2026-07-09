/**
 * behaviours/registry.js
 * ------------------------
 * A behaviour is data (`{ type, properties }`, stored on a
 * WorkshopObjectDefinition) plus small pieces of code, registered
 * together here:
 *
 *   - `propsSchema`: what the Builder app should show as editable fields
 *     for this behaviour (label, input type, default value) — this is what
 *     makes "expose editable properties rather than requiring programming"
 *     literally true. No behaviour needs its own bespoke form; BuilderApp
 *     renders any schema generically.
 *   - `apply(ctx)`: what happens when an *instance* with this behaviour is
 *     actually spawned into the world — almost always "attach an
 *     InteractableComponent" using the existing, unmodified interaction
 *     pipeline (see docs/ARCHITECTURE.md). `ctx` is
 *     `{ entity, object3D, properties, engine, instance, definition }`.
 *   - `dispose(ctx)` (optional): what happens right before that same
 *     instance is destroyed or rebuilt. Most behaviours don't need this —
 *     a light or a decoration is just a scene-graph child of `object3D`,
 *     and removing `object3D` from the scene already takes it with it, no
 *     separate cleanup required. It exists specifically for behaviours
 *     that hold onto a resource *beyond* the scene graph (the `reflective`
 *     behaviour's render target being the first — see
 *     ReflectiveBehaviour.js), so those don't leak every time a placed
 *     instance is deleted or its colour override rebuilds it. `ctx` is the
 *     same shape `apply` received.
 *
 * `ownsInteractable: true` marks a behaviour that wants to attach its own
 * InteractableComponent. An Entity can only hold one, so the Builder UI
 * treats these as mutually exclusive with each other (but freely
 * combinable with non-owning behaviours like Light Source or Decoration) —
 * see BuilderApp.js's behaviour checkboxes.
 *
 * Adding a tenth behaviour later — from this codebase or a plugin, see
 * docs/PLUGIN_GUIDE.md — is one file here plus one `registerBehaviour`
 * call. Nothing about WorldObjectsSystem or BuilderApp changes.
 */
const behaviours = new Map();

export function registerBehaviour(type, config) {
  behaviours.set(type, { type, ownsInteractable: false, propsSchema: [], dispose: null, ...config });
}

export function getBehaviourTypes() {
  return [...behaviours.keys()];
}

export function getBehaviourConfig(type) {
  return behaviours.get(type) ?? null;
}

export function applyBehaviour(type, ctx) {
  const config = behaviours.get(type);
  config?.apply?.(ctx);
}

/** Called before an instance carrying this behaviour is destroyed or
 *  rebuilt — see `dispose(ctx)`'s own note above. A no-op for every
 *  behaviour that doesn't define one. */
export function disposeBehaviour(type, ctx) {
  const config = behaviours.get(type);
  config?.dispose?.(ctx);
}

/** Default `properties` object for a freshly-checked behaviour, from its own schema. */
export function defaultPropertiesFor(type) {
  const config = behaviours.get(type);
  if (!config) return {};
  const props = {};
  for (const field of config.propsSchema) props[field.key] = field.default;
  return props;
}
