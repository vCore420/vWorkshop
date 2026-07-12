const MAX_NOTES = 16;

/**
 * ConversationMemory
 * --------------------
 * "Continue improving conversation memory. Please focus on remembering
 * meaningful things rather than everything... avoid remembering
 * insignificant small talk indefinitely." `ResidentConversation.js`'s own
 * `history` array already keeps the full back-and-forth for as long as
 * one conversation stays open — this is a deliberately different, much
 * smaller thing: a bounded list of short notes (project mentions, stated
 * preferences, stated goals, finished-project milestones), each one
 * reinforced rather than duplicated if it comes up again, oldest evicted
 * once the list is full.
 *
 * "This does not require advanced AI. Simple continuity is sufficient" is
 * `docs/PERSISTENCE.md`'s own standard for Bubble's movement; the same
 * standard applies here — `extractFromMessage()` is a handful of cheap
 * regex checks and a scan against real project titles, not a second
 * model call to summarise anything.
 *
 * Deliberately never registered with `PersistenceSystem` — this makes
 * `MemoryConfiguration.js`'s own "Session Only" mode true by construction
 * (nothing here ever reaches `localStorage`) rather than by a mode check
 * scattered through save/load. "Persistent" is treated identically for
 * now (see `MemoryConfiguration.js`'s own updated description) — genuine
 * cross-session memory is still honest future work, not this phase's.
 */
export class ConversationMemory {
  constructor() {
    this.notes = []; // [{key, category, text, createdAt, lastMentionedAt, timesReinforced}]
    this._knownDoneProjectIds = new Set();
    this._projectsInitialized = false;
  }

  _upsert(key, category, text) {
    const existing = this.notes.find((n) => n.key === key);
    if (existing) {
      existing.timesReinforced += 1;
      existing.lastMentionedAt = Date.now();
      return;
    }
    this.notes.push({ key, category, text, createdAt: Date.now(), lastMentionedAt: Date.now(), timesReinforced: 1 });
    if (this.notes.length > MAX_NOTES) this.notes.shift(); // oldest goes first — see module comment on why a bounded FIFO is enough
  }

  /** Called once per user message, only when the active profile's
   *  `memory.mode !== "disabled"` (that check lives in
   *  `ResidentConversation.js`, the one place that already knows which
   *  profile is active) — three cheap, independent checks, any or none of
   *  which may match a given message:
   *   - does it name a real project (from `ProjectsStore`)?
   *   - does it read as a stated preference ("I love...", "my favourite
   *     X is...")?
   *   - does it read as a stated goal ("I want to...", "I'm going to...")?
   */
  extractFromMessage(text, { projectsStore } = {}) {
    if (!text) return;
    const lower = text.toLowerCase();

    for (const project of projectsStore?.all() ?? []) {
      if (project.title && project.title.length > 2 && lower.includes(project.title.toLowerCase())) {
        this._upsert(`project:${project.id}`, "project", `Talked about the "${project.title}" project.`);
      }
    }

    const preferenceMatch = text.match(/\b(?:i love|i really like|i enjoy|my favou?rite\s+\w+\s+is)\b[^.!?\n]{0,60}/i);
    if (preferenceMatch) {
      const excerpt = cleanExcerpt(preferenceMatch[0]);
      this._upsert(`preference:${excerpt.toLowerCase()}`, "preference", `The player mentioned a preference: "${excerpt}"`);
    }

    const goalMatch = text.match(/\b(?:i want to|i'm going to|i plan to|i'd like to|someday i)\b[^.!?\n]{0,60}/i);
    if (goalMatch) {
      const excerpt = cleanExcerpt(goalMatch[0]);
      this._upsert(`goal:${excerpt.toLowerCase()}`, "goal", `The player mentioned a goal: "${excerpt}"`);
    }
  }

  /** "Major milestones" — the one category this class populates from the
   *  Workshop itself rather than from message text. Call once, at wiring
   *  time (see `main.js`); internally diffs `ProjectsStore` against its
   *  own last-known "done" set, so a project already finished before this
   *  ever started listening is treated as the honest baseline, not a
   *  fresh milestone the moment the Workshop next loads. */
  watchProjects(projectsStore) {
    projectsStore.events.on("projects:changed", (projects) => {
      if (!this._projectsInitialized) {
        this._projectsInitialized = true;
        for (const p of projects) if (p.status === "done") this._knownDoneProjectIds.add(p.id);
        return;
      }
      for (const p of projects) {
        if (p.status === "done" && !this._knownDoneProjectIds.has(p.id)) {
          this._knownDoneProjectIds.add(p.id);
          this._upsert(`milestone:${p.id}`, "milestone", `The player recently finished the "${p.title}" project.`);
        }
      }
    });
  }

  /** The most relevant notes for `PromptComposer`'s own context section —
   *  most recently reinforced first, capped short (`n`) since this is
   *  meant to read as "a few things you remember," not a transcript. */
  mostRelevant(n = 5) {
    return [...this.notes].sort((a, b) => b.lastMentionedAt - a.lastMentionedAt).slice(0, n).map((note) => note.text);
  }
}

function cleanExcerpt(raw) {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}\u2026` : trimmed;
}
