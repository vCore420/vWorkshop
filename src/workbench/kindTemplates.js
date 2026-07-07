/**
 * kindTemplates.js
 * -----------------
 * A project's `presence` (its physical description) is resolved once —
 * see `WorkbenchSystem.resolvePresence()` — from either the project's own
 * explicit `presence` array (full author control) or, if it doesn't have
 * one yet, a default recipe looked up by `kind`. These templates exist so
 * a brand-new project shows up on the bench looking like *something*
 * immediately, without requiring anyone to hand-author a presence array
 * for the common cases.
 *
 * These are starting points, not a closed set of "project types" the
 * system understands — a project can always override `presence` directly
 * with any combination of registered presence types (see
 * `presence/registry.js`), including ones that don't exist yet.
 */
export const KIND_TEMPLATES = {
  woodworking: [
    { type: "blueprint", variant: "unfolded" },
    { type: "materialSample", variant: "wood" },
    { type: "measuringTools" },
    { type: "sketch" },
  ],
  electronics: [
    { type: "prototype", variant: "circuit" },
    { type: "notebook", variant: "open" },
    { type: "materialSample", variant: "components" },
    { type: "paperwork" },
  ],
  writing: [
    { type: "notebook", variant: "open" },
    { type: "paperwork" },
    { type: "referenceBooks", count: 2 },
    { type: "sketch" },
  ],
  software: [
    { type: "notebook", variant: "closed" },
    { type: "sketch" },
    { type: "paperwork" },
    { type: "projectBox" },
  ],
  general: [
    { type: "notebook", variant: "closed" },
    { type: "paperwork" },
  ],
};

/** Shown in the "start a new project" form — label first, matching `<select>` convention. */
export const KIND_OPTIONS = [
  ["woodworking", "Woodworking"],
  ["electronics", "Electronics"],
  ["writing", "Writing"],
  ["software", "Software"],
  ["general", "Something else"],
];

export function resolvePresenceTemplate(kind) {
  return KIND_TEMPLATES[kind] ?? KIND_TEMPLATES.general;
}
