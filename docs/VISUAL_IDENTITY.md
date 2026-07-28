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

## Surface materials — Version 4, Phase 10a ("The Visual Upgrade")

This document's original phase was about making the Workshop's *lighting*
consistent. Phase 10a is the equivalent pass for its *surfaces*, and the
finding that motivated it belongs here: until that wave, there was not one
`normalMap`, `roughnessMap`, `aoMap` or `bumpMap` anywhere in `src/` —
confirmed by grep across all 266 files, zero hits. Every material in the
Workshop was albedo-only. A `MeshStandardMaterial` with only a colour map
cannot express surface micro-relief at all, which is why carefully-drawn
wood grain still read as wood-*coloured paper*: the drawing was right, and
there was no mechanism for it to catch light.

**The house rule this establishes: relief is derived from the albedo, not
drawn twice.** `ProceduralTexture.js`'s `surfaceSetFrom()` reads a
generated texture's own canvas and infers normal and roughness maps from
its luminance. That is not an approximation standing in for "real"
authored maps — it is the correct reading of *these* textures, because
every generator in that file already draws its detail as relief: grain
lines are darker because they are grooves, siding's board seams are
shadow lines, cork's blotches are pits. Luminance already is the height
field. A future hand-authored texture should keep that property, so this
stays true.

**Two tuning lessons, measured rather than guessed** — worth reading
before changing any strength value:

- *Judge a normal map by its typical (mean) tilt, never its peak.* Peak
  is one pixel in 65,000. The initial guessed strengths produced ~1°
  typical tilt on wood and cork — a normal map costing a texture fetch to
  do nothing — while looking perfectly reasonable by peak.
- *Strength is not comparable between generators.* Brushed metal at a
  **lower** strength than wood produced nearly four times the tilt,
  because its hard-edged 1px alternating streaks are far higher-contrast
  and higher-frequency than wood's soft 35%-alpha grain. Source contrast
  and spatial frequency dominate the result; retune by measuring, not by
  reasoning from another material's number.

The full current set is in "The surface hierarchy" below, which is the
authority — this paragraph used to carry its own partial copy of those
numbers (missing plaster and concrete entirely) and has been reduced to
this pointer rather than left to drift out of step with it. Roughness
bands are declared per material and, since the normalisation fix in the
same wave, are delivered to within 0.001 of what they declare.

**One caveat on all of these figures: every generator in
`ProceduralTexture.js` uses `Math.random()`, so a texture is not
byte-identical between two runs and a measured tilt moves by a tenth of a
degree or so each time.** Wood has been measured at both 4.1° and 3.8° in
different sessions, and neither reading is wrong. Treat every number here
as accurate to roughly ±0.3°, and don't go hunting for a regression when
a re-measurement disagrees in the last digit. What matters is the
*ordering* in the table below, which is robust — not the exact value.

**Flat-colour materials remain deliberately untouched.** `fabric`,
`matte`, `plastic`, `rubber`, `ceramic`, `brass` and `emissive` carry no
`map`, so there is no luminance to derive relief from — a generated
normal map there would be a flat sheet of `(0.5, 0.5, 1)`. Giving those
surfaces real character means authoring detail they don't currently have.

**The surface hierarchy — a rule, not a coincidence.** When Phase 10b
gave the room's own walls, ceiling and floor real surfaces for the first
time, the first attempt set plaster's normal strength to a value that
measured **~4.7° typical tilt — *stronger* than the wood furniture
standing in front of it.** That is exactly backwards, and it is an easy
mistake to make because each material looks fine judged alone. The room
is the backdrop; the objects in it are the subject. Surfaces are tuned as
a *set*, and the ordering is deliberate and verified:

| surface | typical tilt | role |
|---|---|---|
| brushed metal | 15.2° | small, deliberately eye-catching |
| siding (exterior) | 5.2° | seen at a distance, needs to survive it |
| wood (furniture) | 3.8° | **the subject** |
| concrete (floor) | 2.0° | backdrop |
| paper | 0.8° | a whisper |
| plaster (walls, ceiling) | 0.57° | backdrop that must disappear |

Before changing any one of these, check it against the others. A value
that reads well in isolation can still be wrong for its place in this
list.

**And measurement alone will not tell you when you have aimed at the
wrong target.** Plaster sits at the bottom of that table because of Phase
10e, not Phase 10b. After the measured retune to ~2.4°, Vi played the
room and said the walls were "a bit much and not the greatest looking,
we want a warm cozy room feel." Every number in the file was internally
consistent; the goal they were consistent *with* was wrong. `plaster`
went from an accurate rendering of plaster's real aggregate tooth to
something that recedes: contrast cut from 0.129 to 0.041 across the
1st–99th percentile, and relief to ~0.57°. **Being measurably right
about the wrong thing is still wrong** — this is the standing example.

## The material charter (Version 4, Phase 10)

The rules Phase 10 arrived at, gathered in one place so a later change
doesn't have to re-derive them.

**Warmth comes from colour and light, not from surface detail.** The
Workshop is meant to be somewhere you want to be. Every darkening tone in
a generated texture should be a warm brown, every lightening one a warm
cream — never pure black, never pure white. Neutral speckle over a warm
base desaturates toward grey, which is exactly how a surface reads as
grubby rather than cosy. `plasterTexture()` is the worked example.

**Relief is derived from the albedo, never drawn twice.**
`surfaceSetFrom()` reads a texture's own canvas and infers normal and
roughness from its luminance. This is correct rather than approximate for
these textures, because every generator already draws its detail *as*
relief — grain lines are darker because they are grooves. A future
hand-authored texture should preserve that property.

**Judge a normal map by typical (mean) tilt, never peak.** Peak is one
pixel in 65,000. Guessed strengths produced ~1° typical on wood and cork
— invisible, and costing a texture fetch to achieve nothing.

**Strength is not comparable between generators.** Brushed metal at a
*lower* strength than wood produces nearly four times the tilt, because
its hard-edged 1px streaks are far higher-contrast and higher-frequency
than wood's soft 35%-alpha grain. Retune by measuring, never by
reasoning from another material's number.

**A declared roughness band must be normalised to be real.** Mapping
absolute luminance into `[min, max]` collapsed a declared `[0.85, 1.0]`
to an actual 0.886–0.906, because none of these generators use the full
dynamic range. Normalise to each texture's own observed range first.

**Bevel by proximity, not by importance.** A chamfer catches a highlight
along its length and is the strongest "this is a real object" cue
available — but it costs 9-49× a plain box's triangles depending on tier.
Bevel what a player stands next to and handles: hero surfaces, moulded
plastic, case furniture, and above all upholstery, which has no sharp
edges at all in reality. Do not bevel what is placed in the hundreds.

**Envelope preservation is the default for anything a player can place.**
`bevelBox()` rounds *inward* from the box's own faces, so a 2m wall stays
exactly 2m at its widest point. See `docs/WORLDBUILDER.md` for why this
matters for construction pieces specifically, and for the one time it was
deliberately overridden.

**Flat-colour materials are honestly flat.** `fabric`, `matte`,
`plastic`, `rubber`, `ceramic` and `brass` carry no texture map, so
nothing can be derived for them. That is a missing texture, not a missed
assignment — and upholstery is the most visible case, with correctly soft
silhouettes but perfectly smooth surfaces. Giving them real character
means authoring textures that do not exist yet.

## Known limitations / future opportunities

- **Shadow bias, re-verified (Version 3, Phase 2 — "Living Spaces").**
  This section used to flag that `bias`/`normalBias` had only ever been
  tested against the bug's stale ±5 frustum, never the larger ±13 one
  now in effect, and that judging it needed a rendered frame, not a
  guess. This environment's own screenshot tooling proved unreliable for
  that, so verification used a documented substitute instead: real
  rendered frames, read back pixel-by-pixel from the actual WebGL canvas
  (`renderer.domElement`, copied to a 2D canvas and sampled directly)
  rather than a human-visible screenshot. Tested at a deliberately
  extreme ~3.4° grazing sun angle (the specific condition
  `DirectionalLightShadow.normalBias`'s own Three.js documentation names
  as the worst case for acne) across ten scanlines of open terrain, both
  horizontal and vertical: zero luminance reversals, sub-1-unit maximum
  frame-to-frame jump throughout — no acne. A real shadow-casting box,
  sampled via exact world-to-screen projection rather than eyeballed
  framing, showed a single clean, sharp lit-to-shadowed transition with
  no intermediate banding at the edge itself. The existing values
  (`bias: -0.0006`, `normalBias: 0.02`) hold up at the current ±13
  frustum — no change made, because none was found to be needed. What
  this pass didn't produce is a pixel-precise measurement of shadow
  offset distance (a synthetic test box and approximate geometry aren't
  precise enough for that); if a real, visible peter-panning complaint
  ever surfaces in actual play, that would be the reason to revisit this
  with a proper rendered screenshot rather than a pixel-readback proxy.
- **No colour-grading LUT or post-processing pipeline** — tone mapping
  and exposure do this phase's entire "give everything one consistent
  look" job today. A dedicated post-processing pass is a bigger,
  genuinely new piece of rendering architecture, not a fix or a
  refinement, and was out of scope for a phase explicitly "not about
  introducing new systems."
