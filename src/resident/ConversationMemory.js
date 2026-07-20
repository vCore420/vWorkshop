import { CATEGORY_LIFETIMES, lifetimeTtlMs } from "../ai/MemoryConfiguration.js";

const MAX_NOTES = 16;

/**
 * ConversationMemory
 * --------------------
 * "Continue improving conversation memory... focus on remembering
 * meaningful things rather than everything... avoid remembering
 * insignificant small talk indefinitely." `ResidentConversation.js`'s own
 * `history` array already keeps the full back-and-forth for as long as
 * one conversation stays open — this is a deliberately different, much
 * smaller thing: a bounded list of short notes (project mentions, stated
 * preferences, stated goals, finished-project milestones), each one
 * reinforced rather than duplicated if it comes up again, oldest evicted
 * once the list is full.
 *
 * **AI Intelligence phase**: two things that were previously either
 * absent or fixed are now genuinely configurable, both read from the
 * active profile's `memory` config (`MemoryConfiguration.js`):
 *   - **Categories** — "allow the player to configure what Bubble
 *     remembers." `extractFromMessage()`/`watchProjects()` both check
 *     `categories` before populating anything of a given kind at all;
 *     turning off "Player Preferences," say, means the preference regex
 *     below simply never runs, not that its results are hidden after the
 *     fact.
 *   - **Lifetimes** — "configurable memory lifetimes... temporary,
 *     medium-term, permanent." Every note is stamped with the lifetime
 *     tier its own category defaults to (`CATEGORY_LIFETIMES`), and
 *     `mostRelevant()` purges anything whose tier has a real `ttlMs` and
 *     hasn't been reinforced within it — "remember meaningful experiences
 *     without becoming overwhelmed by insignificant details" is this
 *     purge, concretely, not just the bounded capacity below it.
 *
 * "This does not require advanced AI. Simple continuity is sufficient"
 * (`docs/PERSISTENCE.md`'s own standard for Bubble's movement) applies
 * just as well here — three cheap regex checks, no second model call.
 *
 * **Version 3, Phase 11 ("Workshop Character")** — "Session Only" and
 * "Persistent" used to be identical: this class was never registered
 * with `PersistenceSystem` at all, so nothing here ever reached
 * `localStorage` regardless of which mode a profile claimed. Now
 * registered like any other plain store (`save()`/`load(data)`), but the
 * mode check happens inside `save()` itself rather than at the
 * registration site: `configurePersistence()` is given a small callback
 * (mirroring `watchProjects()`'s own `getCategories` pattern) that reads
 * whichever profile is active *at save time*, and `save()` only actually
 * writes `notes` out when that profile's `memory.mode === "persistent"`
 * — otherwise it writes an empty snapshot, so a "Session Only" resident's
 * memory genuinely doesn't survive a reload, true to its own label,
 * without a separate mode check anywhere else. Since this store is
 * shared across every profile rather than segmented per-resident (same
 * simplification `ResidentPreferences`/`PlayerPatternMemory` already
 * make), "persistent" is decided by whichever profile happens to be
 * active each time a save actually runs.
 */
export class ConversationMemory {
  constructor() {
    this.notes = []; // [{key, category, lifetime, text, createdAt, lastMentionedAt, timesReinforced}]
    this._knownDoneProjectIds = new Set();
    this._projectsInitialized = false;
    this._getMode = null;
  }

  /** Called once at wiring time (see `main.js`, alongside `watchProjects()`
   *  just below) — `getMode()` should return the active profile's own
   *  `memory.mode`. Kept as a callback rather than a snapshot for the
   *  same reason `watchProjects()`'s `getCategories` is: the active
   *  profile, and its mode, can change over the life of a session. */
  configurePersistence(getMode) {
    this._getMode = getMode;
  }

  _upsert(key, category, text) {
    const lifetime = CATEGORY_LIFETIMES[category] ?? "mediumTerm";
    const existing = this.notes.find((n) => n.key === key);
    if (existing) {
      existing.timesReinforced += 1;
      existing.lastMentionedAt = Date.now();
      return;
    }
    this.notes.push({ key, category, lifetime, text, createdAt: Date.now(), lastMentionedAt: Date.now(), timesReinforced: 1 });
    if (this.notes.length > MAX_NOTES) this.notes.shift(); // oldest goes first — see module comment on why a bounded FIFO is enough
  }

  /** Removes any note whose own lifetime tier has a real `ttlMs` and
   *  hasn't been reinforced within it — "permanent" notes (`ttlMs: null`)
   *  are never touched here. Called at the start of both
   *  `extractFromMessage()` and `mostRelevant()`, so an expired note never
   *  lingers just because nothing happened to ask for the list in a
   *  while. */
  _purgeExpired() {
    const now = Date.now();
    this.notes = this.notes.filter((note) => {
      const ttl = lifetimeTtlMs(note.lifetime);
      return ttl === null || now - note.lastMentionedAt <= ttl;
    });
  }

  /** Called once per user message, only when the active profile's
   *  `memory.mode !== "disabled"` (that check lives in
   *  `ResidentConversation.js`, the one place that already knows which
   *  profile is active). `categories` is the active profile's own
   *  `memory.categories` — three cheap, independent checks, each gated by
   *  its own category flag (and all of them, in turn, by the
   *  `categories.conversations` parent switch):
   *   - does it name a real project (from `ProjectsStore`)?
   *   - does it read as a stated preference ("I love...", "my favourite
   *     X is...")?
   *   - does it read as a stated goal ("I want to...", "I'm going to...")?
   */
  extractFromMessage(text, { projectsStore, categories } = {}) {
    if (!text || categories?.conversations === false) return;
    this._purgeExpired();
    const lower = text.toLowerCase();

    if (categories?.projects !== false) {
      for (const project of projectsStore?.all() ?? []) {
        if (project.title && project.title.length > 2 && lower.includes(project.title.toLowerCase())) {
          this._upsert(`project:${project.id}`, "projects", `Talked about the "${project.title}" project.`);
        }
      }
    }

    if (categories?.preferences !== false) {
      const preferenceMatch = text.match(/\b(?:i love|i really like|i enjoy|my favou?rite\s+\w+\s+is)\b[^.!?\n]{0,60}/i);
      if (preferenceMatch) {
        const excerpt = cleanExcerpt(preferenceMatch[0]);
        this._upsert(`preference:${excerpt.toLowerCase()}`, "preferences", `The player mentioned a preference: "${excerpt}"`);
      }
    }

    if (categories?.goals !== false) {
      const goalMatch = text.match(/\b(?:i want to|i'm going to|i plan to|i'd like to|someday i)\b[^.!?\n]{0,60}/i);
      if (goalMatch) {
        const excerpt = cleanExcerpt(goalMatch[0]);
        this._upsert(`goal:${excerpt.toLowerCase()}`, "goals", `The player mentioned a goal: "${excerpt}"`);
      }
    }
  }

  /** "Major milestones" — the one category this class populates from the
   *  Workshop itself rather than from message text. Call once, at wiring
   *  time (see `main.js`); internally diffs `ProjectsStore` against its
   *  own last-known "done" set, so a project already finished before this
   *  ever started listening is treated as the honest baseline, not a
   *  fresh milestone the moment the Workshop next loads. `getCategories`
   *  is a small function (not a static snapshot) so this always checks
   *  whichever profile is active *at the moment* a project finishes,
   *  since the active profile — and its own "Workshop History" toggle —
   *  can change over the life of a session. */
  watchProjects(projectsStore, getCategories = () => null) {
    projectsStore.events.on("projects:changed", (projects) => {
      if (!this._projectsInitialized) {
        this._projectsInitialized = true;
        for (const p of projects) if (p.status === "done") this._knownDoneProjectIds.add(p.id);
        return;
      }
      const categories = getCategories();
      if (categories?.workshopHistory === false) return;
      for (const p of projects) {
        if (p.status === "done" && !this._knownDoneProjectIds.has(p.id)) {
          this._knownDoneProjectIds.add(p.id);
          this._upsert(`milestone:${p.id}`, "workshopHistory", `The player recently finished the "${p.title}" project.`);
        }
      }
    });
  }

  /** The most relevant notes for `PromptComposer`'s own context section —
   *  most recently reinforced first, capped short (`n`) since this is
   *  meant to read as "a few things you remember," not a transcript.
   *  Purges expired notes first, so a stale "temporary" note is never
   *  handed to the model just because it hadn't been asked for yet. */
  mostRelevant(n = 5) {
    this._purgeExpired();
    return [...this.notes].sort((a, b) => b.lastMentionedAt - a.lastMentionedAt).slice(0, n).map((note) => note.text);
  }

  // ---- persistence contract, read by PersistenceSystem ----
  /** Only writes real notes out when the active profile's memory mode is
   *  `"persistent"` — see the module comment above for why this check
   *  lives here rather than at the registration site. Every other mode
   *  (including "disabled", which shouldn't be accumulating notes at all)
   *  persists an empty snapshot, overwriting whatever a previous,
   *  since-changed "persistent" session may have left behind. */
  save() {
    if (this._getMode?.() !== "persistent") return { notes: [], knownDoneProjectIds: [] };
    return { notes: this.notes, knownDoneProjectIds: [...this._knownDoneProjectIds] };
  }

  load(data) {
    if (!data) return;
    this.notes = data.notes ?? [];
    this._knownDoneProjectIds = new Set(data.knownDoneProjectIds ?? []);
  }
}

function cleanExcerpt(raw) {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}\u2026` : trimmed;
}
