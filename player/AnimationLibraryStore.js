import { EventBus } from "../core/EventBus.js";
import { DEFAULT_ANIMATION_CLIPS } from "./AnimationClips.js";

let _nextId = 1;
const CURRENT_VERSION = 1;

/**
 * AnimationLibraryStore
 * ------------------------
 * "Include: Default animations, Player-created animations, Imported
 * animations... organise this similarly to the Builder Object Library."
 * The default set (`AnimationClips.js`) is permanent, hand-authored data
 * — the same "the alphabet" role `ConstructionLibrary.js` plays for the
 * Builder — and never lives inside this store's own mutable
 * `clips` array; a Workshop with no player-created animations at all
 * still always has somewhere to fall back to for ordinary movement.
 * `getClip(id)` resolves either kind identically, and `all()` lists both
 * together for the Animation Library's own UI, marking which ones are
 * read-only via `isDefault()`.
 *
 * A clip's shape is `{ id, name, description, category, loop, speed,
 * frames: [...] }` — see AnimationClips.js's own comment for the full
 * frame/pose shape. This store has no opinion on what a pose *means*;
 * `PlayerAnimationSystem` and the Animation Editor are the only things
 * that interpret one.
 *
 * **Animation Events, new in the Advanced Animation phase.** A frame can
 * optionally carry `events: [{type, data}]` — "footstep sounds,
 * particles, interaction timing" (the brief's own examples) become
 * `{type: "footstep", data: {foot: "left"}}` and similar, fired by
 * whichever system is actually playing the clip (see
 * `AnimationPlayback.advanceFrame()`'s own `crossedEvents`) on its own
 * `EventBus` as `"animation:event"`. This store itself doesn't interpret
 * events any more than it interprets poses — it only ensures every
 * frame, old or new, always has a real (possibly empty) `events` array
 * to read, via `load()`'s own normalisation below.
 *
 * **Every clip is retargeting-compatible by construction.** Since every
 * pose is already authored against the shared Workshop skeleton's own
 * joint names (see `WorkshopSkeleton.js`), there's no separate
 * "compatible skeletons" field to maintain here — any rig with a usable
 * skeleton map (`WorkshopSkeleton.isSkeletonMapUsable()`) can play any
 * clip in this store, the Player rig included, with no per-clip
 * bookkeeping needed at all.
 */
export class AnimationLibraryStore {
  constructor() {
    this.events = new EventBus();
    /** @type {Array<object>} user-created/imported clips only — never the defaults */
    this.clips = [];
  }

  create({ name, description = "", category = "custom", loop = true, speed = 1, frames = [] } = {}) {
    const clip = {
      id: `clip-${_nextId++}`,
      name: name?.trim() || "Untitled animation",
      description,
      category,
      loop,
      speed,
      frames: frames.length > 0 ? frames.map(normalizeFrame) : [{ duration: 1, pose: {}, events: [] }],
      version: CURRENT_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.clips.push(clip);
    this._emitChanged();
    return clip;
  }

  /** Only ever affects a *user* clip — a default's own id here is
   *  silently a no-op, since defaults are code, not editable data. The
   *  Animation Editor's own UI is what actually prevents this from being
   *  attempted in the first place (see its own "read-only" treatment of
   *  defaults), this is just the store-level backstop. */
  update(id, patch) {
    const clip = this.get(id);
    if (!clip) return null;
    Object.assign(clip, patch, { updatedAt: new Date().toISOString() });
    this._emitChanged();
    return clip;
  }

  /** Works for either a default or a user clip — always produces a new,
   *  fully-editable user clip either way, which is what makes "start from
   *  Walk and adjust it" a one-click operation regardless of where Walk
   *  itself came from. */
  duplicate(id) {
    const source = this.getClip(id);
    if (!source) return null;
    return this.create({
      name: `${source.name} copy`,
      description: source.description,
      category: source.category,
      loop: source.loop,
      speed: source.speed,
      frames: JSON.parse(JSON.stringify(source.frames)).map(normalizeFrame),
    });
  }

  rename(id, name) {
    const clip = this.get(id);
    if (!clip) return;
    clip.name = name?.trim() || clip.name;
    clip.updatedAt = new Date().toISOString();
    this._emitChanged();
  }

  /** Only ever removes a user clip — a default's id is simply not found here. */
  remove(id) {
    this.clips = this.clips.filter((c) => c.id !== id);
    this._emitChanged();
  }

  /** User clips only — use `getClip()` to resolve either kind. */
  get(id) {
    return this.clips.find((c) => c.id === id) ?? null;
  }

  /** Resolves a clip id against user clips first, then the permanent
   *  default set — the one function anything that just wants "the clip
   *  for this id, whatever kind it is" should call. */
  getClip(id) {
    return this.get(id) ?? DEFAULT_ANIMATION_CLIPS.find((c) => c.id === id) ?? null;
  }

  isDefault(id) {
    return DEFAULT_ANIMATION_CLIPS.some((c) => c.id === id);
  }

  /** Defaults first, then user clips — for the Animation Library's own listing UI. */
  all() {
    return [...DEFAULT_ANIMATION_CLIPS, ...this.clips];
  }

  /** User clips only, for the Emote Wheel and the Library's "your own animations" section. */
  allUserClips() {
    return [...this.clips];
  }

  _emitChanged() {
    this.events.emit("library:changed", this.all());
    this.events.emit("persistence:saveRequested");
  }

  // ---- persistence contract, read by PersistenceSystem ----
  // Only ever the user's own clips — the defaults are code, not data, and
  // regenerate identically from AnimationClips.js on every load.
  save() {
    return { clips: this.clips };
  }

  load(data) {
    if (!data?.clips) return;
    this.clips = data.clips.map((c) => ({
      description: "",
      category: "custom",
      loop: true,
      speed: 1,
      frames: [],
      version: CURRENT_VERSION,
      ...c,
      frames: (c.frames ?? []).map(normalizeFrame),
    }));
    const maxId = this.clips.reduce((m, c) => {
      const match = /^clip-(\d+)$/.exec(c.id ?? "");
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    _nextId = maxId + 1;
    this.events.emit("library:changed", this.all());
  }
}

/** Every frame, old or new, always ends up with a real (possibly empty)
 *  `events` array — a clip saved before the Advanced Animation phase
 *  simply had no events at all, which normalises to exactly that, rather
 *  than `undefined` needing a null-check at every single call site that
 *  reads a frame's own events (`AnimationPlayback.advanceFrame()`
 *  included). */
function normalizeFrame(frame) {
  return { ...frame, events: Array.isArray(frame.events) ? frame.events : [] };
}
