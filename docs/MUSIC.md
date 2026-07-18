# Music

A real personal music library — not a placeholder, not a second attempt at
Spotify. This document covers how it's built; `docs/ARCHITECTURE.md` covers
how it fits into the rest of the workshop.

## Design philosophy, briefly

"Design it as though you were creating the music system for somebody's
home" showed up as three concrete decisions, each described in more depth
in its own section below:

1. **The folder structure is the library**, not a database of imported
   files. `Artist/Album/song.mp3`, with an optional `cover.png`. No ID3
   parsing, no metadata database to get out of sync with what's actually on
   disk — see "Library scanning".
2. **The UI reuses the workshop's own material system** — a warm, bounded,
   centred panel (the same technique the pinboard and notebook use), not a
   full-bleed app shell. See "The interface" below and `css/music.css`.
3. **Playback is a permanent citizen of the room**, not something tied to
   a panel being open. Closing the music overlay never pauses anything —
   see "Playback".

## Overall architecture

```
src/music/
  HandleStore.js        IndexedDB: rootId -> live FileSystemDirectoryHandle
  MusicLibraryStore.js   JSON: the library index + favourites/plays/recents
  PlaylistStore.js        JSON: user-curated playlists
  LibraryScanner.js       pure functions: folder tree -> plain scan result
  MusicSystem.js          the Engine system: playback, queue, root management
  ui/
    MusicOverlay.js        the shell: sidebar, search, view routing
    libraryViews.js         Artists/Albums/Songs/Recently.../Favourites/search
    playlistViews.js        playlist list + detail (rename/reorder/delete)
    PlaybackBar.js           the persistent bottom transport bar
    LibraryManager.js        add/rescan/remove/reconnect root folders
    domHelpers.js            shared song-row/album-card rendering
```

Four stores, one system, one overlay — the same shape as every other
subsystem in the workshop (compare `src/workbench/`). `MusicSystem` is the
only thing that touches actual audio; every UI file is a *view* onto it,
built fresh each time the overlay opens (see `OverlayManager`), never the
source of truth.

### Why two different persistence mechanisms

Everything else the workshop persists is plain JSON through
`PersistenceSystem` into `localStorage` (see `docs/ARCHITECTURE.md`). A
`FileSystemDirectoryHandle` — the browser's live handle to a real folder on
disk, from the File System Access API — can't be serialized to JSON at
all. It *can*, however, be stored directly in IndexedDB, which supports
structured-cloning these handles and later re-opening them without asking
the person to re-pick the folder (permissions allowing — see below).

So `HandleStore.js` is a small, deliberate exception living entirely on
its own: it stores exactly one thing, `rootId -> handle`, in IndexedDB.
Every other fact about the library — artist and album names, which songs
exist, favourites, play counts, playlists — is ordinary JSON in
`MusicLibraryStore`/`PlaylistStore`, following the exact same
`PersistenceSystem` path as `ProjectsStore` or `ObjectLibraryStore`. That
split means the library is fully *browsable* — every artist, album,
favourite, and playlist — even in a session where a root hasn't been
reconnected yet. Only actually reading a file's bytes (to play a song, or
show its cover) needs the live handle.

## Library scanning

The expected folder shape, exactly as specified:

```
Music/
  Artist/
    Album/
      cover.png
      song1.mp3
      song2.mp3
```

`LibraryScanner.js` recurses exactly two levels below a chosen root:
artist folders, then album folders inside those. Anything at the root
level that isn't a folder is ignored, not an error. Inside an album
folder, a recognised audio extension (`.mp3`, `.m4a`, `.aac`, `.ogg`,
`.wav`, `.flac`, ...) becomes a song; `cover.png`/`.jpg`/`.jpeg`/`.webp`
becomes that album's artwork; anything else is silently skipped — the
literal implementation of "ignoring unsupported files."

**There is no metadata parsing at all** — no ID3 tags, no embedded
artwork. A song's title is its filename with the extension stripped; an
album's cover is whatever image file sits next to it. This is a
deliberate reading of "the folder structure is the primary source of
organisation," not an oversight, and it's what keeps this phase's scope
sane — see "Known limitations" for what real tag support would add later.

### Ids are the folder paths themselves

An artist's id is its name (`"Artist"`); an album's id is
`"Artist/Album"`; a song's id is `"Artist/Album/song1.mp3"` — deterministic
strings, not auto-incrementing numbers. Three things fall out of that:

- **Idempotent rescans.** The same file on disk always produces the same
  id, so `MusicLibraryStore.mergeScan()` can tell "still here" from
  "genuinely new" or "gone" by simple set comparison, without maintaining
  a separate mapping between scans.
- **Favourites/play counts/recently-played survive a rescan untouched.**
  They're keyed by these same ids in entirely separate maps that a rescan
  never touches (only `artists`/`albums`/`songs` get rebuilt) — literally
  "rebuilding only what has changed."
- **An artist found under two different root folders merges automatically**
  into one entry, matching how a person's library is one library, however
  many folders it's spread across.

### Reconnecting a root

The File System Access API's permission grants don't necessarily survive
a browser restart. On startup (`MusicSystem.finalizeInitialState()`,
called after `engine.init()` resolves — see the comment there for why it
can't happen any earlier), every remembered root is silently checked via
`handle.queryPermission()` — no prompt, no user gesture needed for a
*check*. If a root still says "granted," it's ready to browse and play
immediately. If not, `LibraryManager`'s view shows "Needs reconnecting"
and a button that calls `handle.requestPermission()` — which, per the
browser's own security model, must run inside a real click handler, which
is exactly what that button is.

## Persistence

Everything the brief asked for, and where it lives:

| What | Where |
|---|---|
| Library locations (which folders) | `MusicLibraryStore.roots` (names) + `HandleStore` (the live handles, IndexedDB) |
| Current queue, current track, playback position | `MusicSystem`'s own `persistence:save`/`load` bag |
| Current playlist | Implicit — a playlist's songs become the queue when you press play on it; nothing separate to remember |
| Volume, shuffle, repeat | Same `MusicSystem` bag |
| Recently played, play counts, favourites | `MusicLibraryStore` |
| Playlists themselves | `PlaylistStore` |

"If I close the Workshop halfway through an album and return tomorrow,
everything should be exactly where I left it" — concretely: the queue and
your position within it are restored on load, but playback itself stays
*paused* until you press play. That's not a corner cut; it's the browser's
own autoplay policy (audio can't start without a real user gesture,
independent of anything this app does), so this is what "restored" can
honestly mean. See `MusicSystem.finalizeInitialState()`.

**Version 3, Phase 4 ("Workshop Rituals") — "turning on the radio."** A
restored, paused queue looks identical to a freshly-loaded one nobody's
pressed play on yet — nothing distinguished "you were listening to this"
from "here's whatever happened to load." `wasPlaying` had been captured
into every save since this system existed and never once read back until
this phase — `MusicSystem.wasPlayingLastSession` is that flag's first
real reader, true for exactly the gap between a session restoring and the
player's first real playback action. `PlaybackBar.js` shows a small
"Picking up where you left off" invitation for that one moment — a real,
one-click `resume()`, not autoplay, so the policy above still holds
honestly — and it retires the instant *any* real action happens
(resuming, choosing something else, skipping), including the edge case
where the root that had the song became unreachable between sessions and
resuming can't actually do anything: the invitation still goes away
rather than sitting there forever offering something it can't deliver.

## Playback

One real `HTMLAudioElement`, owned by `MusicSystem` for the lifetime of
the page — not created or destroyed with the overlay. That's what makes
"the player should never need to remain open once music has started" and
"music should continue while walking around" true by construction rather
than by special-casing: nothing about closing the overlay touches
playback at all.

- **Queue** (`MusicSystem.queue`) is the "natural" order a list was played
  from. **Play order** (`playOrder`) is a separate array of indices into
  the queue — identity when shuffle is off, a Fisher-Yates permutation
  when it's on — so toggling shuffle never loses the underlying order it
  shuffled *from*.
- **"Play next" / "add to queue"** insert into the natural queue and
  rebuild the play order around the currently-playing song's position, so
  queuing something doesn't interrupt what's already playing.
- **A play is "counted"** (toward play count, recently played, and
  Most Played) once you're roughly 20 seconds or halfway into a track,
  whichever comes first — a quick accidental skip doesn't inflate the
  count, matching how every real scrobbling system works.
- **Duration is resolved lazily**, not during scanning — a temporary
  `<audio preload="metadata">` element reads it the first time a song
  shows up in a rendered list or actually plays, then it's cached on the
  song's record permanently. Scanning a library of any size stays fast
  because it never has to open every file.
- **Cover art** is resolved the same lazy way, with a small in-memory
  object-URL cache (bounded at 60 entries, oldest evicted first) — real
  image bytes are only ever read for albums you've actually looked at.

## The interface

The music overlay is registered exactly like every other physical object's
panel (`overlayManager.register("music", ...)`) and opened the exact same
generic way: any interactable emitting `interaction:trigger` with
`overlayId: "music"` opens it. The music cabinet does this via an ordinary
`overlayId` on its furniture definition — no special code. See
"Architecture: reusable, not cabinet-specific" below.

Layout: a dark-wood sidebar (search, Artists/Albums/Songs/Recently
Added/Recently Played/Most Played/Favourites, your playlists, Manage
Library) and a warm paper content area — the same paper tone the notebook
and pinboard already use — with a persistent transport bar fixed to the
bottom. The content area deliberately does **not** re-render on every
play/pause/track change, only on things that actually change what a view
should show (a rescan, a playlist edit, the queue changing) — re-rendering
on every playback tick would reset your scroll position mid-browse, which
works directly against "calm." The transport bar, never torn down while
the overlay is open, is the one place "what's playing" needs to be
perfectly live, and it is.

Every song row, wherever it appears — an album, a playlist, search
results, Favourites — carries the same small "\u22EF" menu (play next, add
to queue, add to any playlist). This is deliberately *not* a floating
popover: it expands inline within the row instead, specifically to avoid
positioning/clipping logic inside a scrolling list that I have no way to
visually verify without a real browser to test in.

## Architecture: reusable, not cabinet-specific

"The current radio should simply become the first object using this
system... avoid hardcoding object-specific behaviour" is implemented
literally: `MusicCabinet.js`'s interaction is just
`overlayId: "music"` — the same generic mechanism the pinboard, notebook,
and every other piece of furniture already uses. There's no
cabinet-aware code anywhere in `src/music/`. (The physical object itself
was redesigned in a later pass, from a placeholder stereo into a proper
wooden cabinet with a turntable, amplifier, bookshelf speakers, and vinyl
storage — see `docs/ARCHITECTURE.md`'s furniture notes. Its interaction
config didn't change at all in that pass, which is exactly the point:
the furniture and the system it opens are genuinely independent.)

A new `musicPlayer` behaviour (`src/worldbuilder/behaviours/MusicPlayerBehaviour.js`)
gives any Builder-designed object the identical capability: its `apply()`
attaches an `InteractableComponent` whose `onInteract` emits the exact
same `interaction:trigger` event. Both paths converge on one registered
overlay; there is no second "world object" implementation to keep in sync.

This is distinct from the pre-existing `audioSource` behaviour on
purpose — that one plays a single generative ambient track directly
through `AudioSystem` (closer to a music box). `musicPlayer` opens the
real library. A custom object carries whichever matches what it's meant
to be.

**A related fix, found while wiring this up:** the Builder's
mutual-exclusivity rule for "owns an InteractableComponent" behaviours
used to be a hardcoded list in `BuilderApp.js` that every new such
behaviour needed remembering to update — including, invisibly, a future
plugin's own behaviour, which would have silently missed exclusivity
enforcement. It's now derived from the registry's own `ownsInteractable`
flags instead, so `musicPlayer` (and anything registered later) is
included automatically.

**The computer's Media app** now reflects `MusicSystem` instead of the old
placeholder `AudioSystem` track, for the same "one now-playing, not two"
reason `MediaApp.js`'s own comment already stated before this pass — with
two different systems now existing (`AudioSystem` for weather ambience,
`MusicSystem` for the real library), Media needed to point at whichever
one is actually "the music."

## Future extension points

- **Real metadata (ID3 tags, embedded artwork, track numbers)** — the
  natural next step the brief itself calls out ("metadata support can
  always be expanded later"). `LibraryScanner.scanRoot()` is the one place
  that would change: read tag frames from each file instead of trusting
  only the filename, while keeping the exact same output shape everything
  downstream already expects.
- **Additional audio backends** — everything here assumes local files via
  the File System Access API. A future streaming source (a self-hosted
  server, say) would slot in as an alternative to `LibraryScanner`/
  `HandleStore` producing the same `{artist, album, songs}` shape
  `MusicLibraryStore.mergeScan()` already consumes.
- **More behaviours in the same family** — `musicPlayer` shows the
  pattern: a behaviour whose `apply()` just emits a generic
  `interaction:trigger`. A future "Jukebox" behaviour (opens the library
  pre-filtered to one playlist, say) would be a small variation on the
  same idea.
- **Smarter "recently added"** — currently falls back to scan-discovery
  order rather than a real per-song timestamp (see below).

## Known limitations

- **Chromium-only library scanning.** The File System Access API
  (`window.showDirectoryPicker`) isn't available in Firefox or Safari as
  of this writing. `LibraryManager` detects this and shows an honest
  message rather than a broken button — no fallback import path was
  built for this phase (see the trade-off note in the code comment on
  `MusicSystem.isScanningSupported()`). Playlists, favourites, and
  browsing an *already*-scanned library don't depend on this API at all;
  only adding/rescanning folders does.
- **No embedded metadata** — see "Library scanning" above. A song is only
  ever as well-labelled as its filename.
- **"Recently Added" has no real timestamp per song** — it falls back to
  the order songs were discovered during scanning, which is a reasonable
  proxy but not a guarantee if a library gets rescanned in a different
  folder-traversal order.
- **No fuzzy artist-name matching.** "The Beatles" and "Beatles" merge only
  if they're spelled identically — exact, case-sensitive matching, by
  design, to keep the id scheme simple and predictable.
- **The play-count "counted" threshold (20s / halfway) is a fixed
  heuristic**, not configurable.
- **Drag-to-reorder in a playlist uses plain HTML5 drag-and-drop**, which
  can occasionally feel less forgiving on precise pointer placement than a
  dedicated drag library — a reasonable trade against pulling in a
  dependency for one interaction.
