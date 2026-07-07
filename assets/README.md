# Assets

There are no binary asset files in this project yet — no images, no audio
files, no 3D models. That's a deliberate choice for this phase, not an
oversight:

- The brief asked for effort to go into architecture, not artwork.
- Every visual is primitive Three.js geometry (boxes, cylinders) styled
  through `src/utils/PlaceholderFactory.js`, with surface detail from
  runtime-generated `<canvas>` textures in `src/utils/ProceduralTexture.js`
  (wood grain, paper fibre, concrete speckle, brushed metal, rain streaks).
- Every sound is generated at runtime with the Web Audio API in
  `src/utils/AudioSynth.js` — ambient pads for the stereo, filtered noise
  for weather.

This means the project has **zero external asset dependencies** and works
completely offline (aside from loading Three.js itself and two Google
Fonts, both from a CDN — see `index.html`'s comment on vendoring Three.js
locally if fully offline use matters later).

## Replacing a placeholder later

Every placeholder call site is isolated on purpose:

| Want to replace...          | Change only...                                   |
|------------------------------|---------------------------------------------------|
| A piece of furniture's look  | That furniture's `build()` in `src/entities/furniture/*.js` — swap primitive geometry for a loaded `GLTFLoader` model. Nothing else references the mesh construction. |
| A surface texture             | The relevant function in `ProceduralTexture.js`, or add a new `Materials.*` entry in `PlaceholderFactory.js` that uses `THREE.TextureLoader` instead. |
| The stereo's music            | `AudioSynth.js`'s track list + `playAmbientTrack` → real `<audio>`/`AudioBufferSourceNode` playback of licensed/recorded files. `AudioSystem` and `StereoOverlay` only know about `{id, title}` and don't change. |
| Weather ambience               | Same file, `createNoiseSource` → real recorded rain/wind loops. |

## If/when real assets are added

Suggested structure (not created yet, since there's nothing to put in it):

```
assets/
  models/       .glb/.gltf files, CC0 or explicitly licensed, one file per furniture piece
  textures/     source images for anything ProceduralTexture.js currently fakes
  audio/        licensed or recorded tracks + ambience loops
  LICENSES.md   attribution for every third-party asset, required before any
                asset with a non-CC0 license is added
```

Keep attribution requirements in mind for anything not CC0 — track the
license and required credit line per asset in `LICENSES.md` from the first
asset added, not retroactively.
