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
      frames: frames.length > 0 ? frames : [{ duration: 1, pose: {} }],
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
      frames: JSON.parse(JSON.stringify(source.frames)),
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
    }));
    const maxId = this.clips.reduce((m, c) => {
      const match = /^clip-(\d+)$/.exec(c.id ?? "");
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    _nextId = maxId + 1;
    this.events.emit("library:changed", this.all());
  }
}
