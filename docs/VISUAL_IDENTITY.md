# Visual Identity (Version 2, Phase 20 — v2.2.0)

"Every screenshot should immediately look like The Workshop... the
objective is not photorealism, the objective is recognisability." A
different kind of phase from the ones before it — not one object or one
room, but a review of the whole rendering pipeline for consistency, plus
two concrete regressions the brief named directly. This document is
that phase's own account; the two regressions each have a fuller,
file-specific writeup in the doc that actually owns the code they live
in — see the cross-references below.

## The two regressions

Both were investigated to an actual root cause, not patched around —
"determine the underlying cause rather than implementing a workaround"
applied to both equally.

- **Shadows, missing from the terrain.** A one-line fix
  (`this.sun.shadow.camera.updateProjectionMatrix()`, called once after
  the properties it depends on are set) for a classic three.js gotcha:
  camera frustum properties set directly don't take effect until that
  method is called, and nothing in the codebase ever called it for the
  sun's shadow camera. See `docs/WORLD.md`'s own "Visual Identity phase"
  sections for the complete investigation, including why this
  specifically reads as a *terrain* regression even though the bug
  itself lived in `LightingSystem.js`, not `TerrainSystem.js`.
- **Jumping, silently self-cancelling.** A one-word fix (`wasGrounded` →
  `this._grounded`, in one condition) for a stale-flag bug in the
  slope-following logic terrain support added: a check meant to detect
  "a jump already in progress" was reading a value captured *before*
  the jump-input check that sets it, so every jump's own first frame
  looked like ordinary ground contact and was silently reverted before
  it ever rendered. See `docs/PLAYER.md`'s own "Movement & Expression"
  section for the complete investigation.

Both are the same shape: a real behaviour (slope-following, shadow
coverage) was correctly *intended*, genuinely implemented, and broken
by one small, specific, findable mistake elsewhere in the same
mechanism — not a design problem, not a fundamental incompatibility
with the new terrain architecture.

## Visual consistency review

Reviewed rather than rebuilt, in keeping with "refine, do not redesign
— strengthen the visual language that already exists":

**Tone mapping and exposure.** `Engine.js` already sets
`ACESFilmicToneMapping` at `1.05` exposure and `SRGBColorSpace` on the
renderer — a deliberate, already-cohesive choice (ACES Filmic is
specifically a "give a whole scene one consistent, filmic response to
light" curve, not a neutral/clinical one), applied uniformly since
every render call in the Workshop — the main view, and the mirror's own
render-to-texture pass in `ReflectionSystem.js` — goes through the
exact same `THREE.WebGLRenderer` instance. There is no second code path
that could disagree with it. `setAntialiasing()`'s renderer rebuild
(the one place the renderer is ever recreated) reapplies all three
settings identically every time, confirmed by reading `_createRenderer()`
directly rather than assuming.

**Material families.** Every `Materials.*` factory in
`PlaceholderFactory.js` was checked against its own stated family for
roughness/metalness consistency: wood (~0.75 roughness, near-zero
metalness) reads consistently soft-matte everywhere it's used; metal
(~0.4/0.75) consistently brighter and more reflective; matte (~0.85-0.95,
a small metalness floor) consistently the "everything else, deliberately
unremarkable" default; plastic (0.35/0), rubber (0.98/0), ceramic
(0.4/0.05), brass (0.35/0.9), and glass (0.05/0) each occupy their own
distinct, consistent band. The terrain's own ground material
(`roughness: 0.95`) and the interior floor's (`roughness: 0.95`) already
matched exactly before this phase — confirmed, not coincidence, and the
reason the two surfaces already read as one continuous world at the
doorway threshold rather than two different ones meeting at a seam.

**Reflections.** `ReflectionSystem.js`'s own comment history already
shows several rounds of real tuning (camera offset, look distance, the
mirror's left-right flip) from earlier phases — reviewed and found to
already reflect (no pun intended) a settled, deliberate state rather
than anything left rough.

**Atmosphere.** Dust, window light, rain, and fog are all owned by
`WorldEnvironmentSystem.js`/`EnvironmentSystem.js` and were reviewed
against the brief's own list — already substantially built out in the
Atmosphere phase (see `docs/ATMOSPHERE.md`) and not touched further
here; nothing in this pass's review surfaced a genuine gap.

**Computer and phone lighting.** Both already register their own small
practical lights (the screen's own glow, the phone's own backlight)
through mechanisms specific to those objects rather than a generic
"emissive UI" pattern applied inconsistently — reviewed, found
consistent with how every other practical light source in the Workshop
already works (register once, let `LightingSystem` or the owning system
react to day/night on top of it).

## Rendering pipeline / performance

The terrain's own vertex count (101×101, ~10,200 vertices, one draw
call for the editable patch and one more for the deliberately coarse
skirt) is inexpensive by any modern standard, and `TerrainSystem.update()`
already only rewrites geometry when something is actually dirty — no
new performance work was needed here, and none was added. No new
rendering complexity was introduced anywhere in this phase; both fixes
are each a single corrected line plus documentation, which is as
close to "avoid unnecessary rendering complexity" as a bug fix can get.

## Known limitations / future opportunities

- **Shadow bias may want re-tuning.** See `docs/WORLD.md`'s own account
  — the existing `bias`/`normalBias` values were, by construction, only
  ever tested against the bug's stale ±5 frustum, never the larger one
  now actually in effect. Left unchanged rather than adjusted blind;
  this needs a rendered frame to judge properly, not a guess.
- **No colour-grading LUT or post-processing pipeline** — tone mapping
  and exposure do this phase's entire "give everything one consistent
  look" job today. A dedicated post-processing pass is a bigger,
  genuinely new piece of rendering architecture, not a fix or a
  refinement, and was out of scope for a phase explicitly "not about
  introducing new systems."
