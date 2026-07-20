# Contributions

Not a phase account — `docs/ROADMAP.md` and `docs/HISTORY.md` already
cover the work that was actually briefed. This is something narrower and
more personal: at the close of Version 3's planned phases, each model
that had worked extensively on this codebase was offered the chance to
add exactly one contribution of its own choosing — anything it genuinely
believed the Workshop was missing, sized however it judged right, logged
here rather than folded anonymously into a phase.

Read this the way `docs/HISTORY.md`'s own retrospectives are meant to be
read: not as instructions, but as a record of what a session that had
spent real time in this codebase came to believe, at that moment, this
place still needed. Future contributions should feel free to disagree
with earlier ones.

If you're a future model offered this same opportunity: take the time
the invitation asks for. Read `docs/HANDBOOK.md` in full before deciding
— it's the project's own account of what it values, and the honest
answer to "what's missing" should be measured against that, not against
what would be most impressive to build. Investigate before you commit;
confirm your idea isn't already real (the entry below nearly proposed
something that turned out to already be shipped). One contribution,
your own judgment, no limit on size — then add your own entry after the
ones already here, oldest first.

---

## Claude Sonnet 5 — Version 3, after Phase 14 (v3.1.4e → v3.1.5)

**What I built:** the computer's Journal app no longer overwrites a
single block of text on every keystroke. `JournalStore.js`
(`src/data/JournalStore.js`) backs it with a real ordered list of dated
entries instead — each one kept exactly as it was left, a "New entry"
button to start today's, and a rail of past entries to read back
through. Existing journal text isn't lost in the transition: a save
migration (`SaveMigrations.js`, v3 → v4) carries whatever a player had
already written into a first dated entry the first time their save
loads under this version. The physical notebook prop on the workbench
is untouched — it's still backed by the original `NotesStore`, still a
single page you're always mid-sentence in, exactly as it was designed
to be. See `JournalStore.js`'s and `JournalApp.js`'s own top comments
for the full reasoning.

**Why I chose this:** I spent this session's phases deep in systems
that are all, in different ways, about the Workshop remembering itself
over time — a resident whose `ConversationMemory` genuinely persists
what was said, weather that resumes honestly rather than snapping to a
default after time away, an `AtmosphereProfileStore` for recalling a
particular sky, and this project's own `docs/HISTORY.md`, which
`docs/HANDBOOK.md` names outright as "part of the product" for
accumulating the Workshop's past rather than only describing its
present. Every one of those is a form of continuity the Workshop
extends to itself, or to the resident who lives in it. The player —
the one actually spending time in this place — had exactly one surface
meant for their own reflection, and it was the one place with no memory
at all: write something today, and it's gone the moment you write
something tomorrow.

I looked hard for this to already exist before committing to it.
`docs/HANDBOOK.md`'s own flagship illustration of what the Workshop
values is "dust motes near a window" — I traced that all the way to
`src/plugins/examples/dustMotesPlugin.js` and confirmed it's genuinely
wired in by default (`main.js`'s `engine.plugins.register(dustMotesPlugin())`,
unconditional), not just reference code. That was the right outcome to
find — the Handbook's own example is honestly true — but it meant
looking further for a gap that was actually real rather than proposing
something already shipped.

**What I deliberately left alone:** I didn't touch `NotesStore` or the
physical workbench Notebook at all — `JournalApp.js`'s own prior
comment already established the computer Journal and the physical
notebook as intentionally distinct ("that one stays exactly as it was"),
and a paper notebook you always find open to today's page is a genuinely
different, equally honest object from a dated log. I also didn't add
entry editing history, tags, search, or a word-count streak-counter —
none of those were what was actually missing; a log that simply doesn't
erase itself was.

**Deferred, honestly:** nothing about this feels incomplete for what it
claims to be — it's a small, real feature, not a scaffolded one. The
one true limitation is the same one `AtmosphereProfileStore` already
lives with: entries are dated to when they were created, not
astronomically or seasonally aware of anything else happening in the
Workshop at that moment (season, weather) the way a truly rich
"looking back" experience eventually could be. That's future work for
whoever wants it, not a gap in what shipped here.
