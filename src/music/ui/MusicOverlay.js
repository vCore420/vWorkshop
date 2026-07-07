import { buildPlaybackBar } from "./PlaybackBar.js";
import { renderLibraryManagerView } from "./LibraryManager.js";
import {
  renderArtistsView,
  renderArtistDetailView,
  renderAlbumsView,
  renderAlbumDetailView,
  renderSongsView,
  renderRecentlyAddedView,
  renderRecentlyPlayedView,
  renderMostPlayedView,
  renderFavouritesView,
  renderSearchResultsView,
} from "./libraryViews.js";
import { renderPlaylistsView, renderPlaylistDetailView } from "./playlistViews.js";

const NAV_SECTIONS = [
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
  { id: "songs", label: "Songs" },
  { id: "recentlyAdded", label: "Recently Added" },
  { id: "recentlyPlayed", label: "Recently Played" },
  { id: "mostPlayed", label: "Most Played" },
  { id: "favourites", label: "Favourites" },
];

/**
 * createMusicOverlay
 * ---------------------
 * "Calm, comfortable, welcoming... belongs inside this world rather than
 * sitting on top of it" — concretely, that meant reusing the workshop's
 * existing overlay material system (the same warm, bounded, centred panel
 * every other diegetic surface uses — see `css/overlays.css`) rather than
 * inventing a Spotify-style full-bleed app shell. A new `music` material
 * (`css/music.css`) keeps the same bones, just sized roomier than a
 * pinboard or notebook, because browsing a real library needs the space.
 *
 * This overlay is a *view* onto `MusicSystem`, never the source of truth —
 * closing it (Esc, or the corner button every overlay already has) doesn't
 * pause anything. Playback is a permanent Engine system; see MusicSystem.js.
 *
 * The content area deliberately does *not* re-render on every play/pause/
 * track change — only on things that actually change what a view should
 * show (the library being rescanned, a playlist being edited, the queue
 * changing). A play-state glyph on a song row going briefly stale while
 * you keep browsing is a fair trade for never resetting your scroll
 * position just because a track finished — "calm" was the explicit brief
 * here, and constant re-rendering works against that. The always-visible
 * playback bar (never torn down while the overlay is open) is the one
 * place "what's playing right now" needs to be perfectly live, and it is.
 *
 * Registered exactly like every other overlay
 * (`overlayManager.register("music", ...)`), and opened exactly like every
 * other one too: any interactable that emits `interaction:trigger` with
 * `overlayId: "music"` opens this — the stereo today, a future Builder
 * object with a `musicPlayer` behaviour tomorrow, with no object-specific
 * code anywhere in this file.
 */
export function createMusicOverlay({ musicSystem, libraryStore, playlistStore }) {
  return {
    materialClass: "music",
    mount(panelEl) {
      const deps = { musicSystem, libraryStore, playlistStore, navigate: (view) => setView(view) };

      const root = document.createElement("div");
      root.className = "music-root";

      const sidebar = document.createElement("div");
      sidebar.className = "music-sidebar";

      const searchInput = document.createElement("input");
      searchInput.type = "search";
      searchInput.placeholder = "Search your library\u2026";
      searchInput.className = "music-search-input";
      sidebar.appendChild(searchInput);

      const navList = document.createElement("ul");
      navList.className = "music-nav-list";
      const navButtons = new Map();
      for (const section of NAV_SECTIONS) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = section.label;
        btn.addEventListener("click", () => setView({ type: section.id }));
        navButtons.set(section.id, btn);
        li.appendChild(btn);
        navList.appendChild(li);
      }
      sidebar.appendChild(navList);

      const playlistsHeading = document.createElement("div");
      playlistsHeading.className = "music-sidebar-subheading";
      playlistsHeading.textContent = "Playlists";
      sidebar.appendChild(playlistsHeading);

      const playlistNavList = document.createElement("ul");
      playlistNavList.className = "music-nav-list music-playlist-nav-list";
      sidebar.appendChild(playlistNavList);

      const renderPlaylistNav = () => {
        playlistNavList.innerHTML = "";
        for (const playlist of playlistStore.all()) {
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = playlist.name;
          btn.addEventListener("click", () => setView({ type: "playlist", id: playlist.id }));
          li.appendChild(btn);
          playlistNavList.appendChild(li);
        }
        const allLi = document.createElement("li");
        const allBtn = document.createElement("button");
        allBtn.type = "button";
        allBtn.className = "music-nav-manage-playlists";
        allBtn.textContent = "Manage playlists\u2026";
        allBtn.addEventListener("click", () => setView({ type: "playlists" }));
        allLi.appendChild(allBtn);
        playlistNavList.appendChild(allLi);
      };
      renderPlaylistNav();

      const manageBtn = document.createElement("button");
      manageBtn.type = "button";
      manageBtn.className = "music-nav-manage-library";
      manageBtn.textContent = "\u{1F4C1} Manage Library";
      manageBtn.addEventListener("click", () => setView({ type: "library" }));
      sidebar.appendChild(manageBtn);

      root.appendChild(sidebar);

      const main = document.createElement("div");
      main.className = "music-main";
      const content = document.createElement("div");
      content.className = "music-content";
      main.appendChild(content);
      const playbackBar = buildPlaybackBar({ musicSystem, libraryStore });
      main.appendChild(playbackBar);
      root.appendChild(main);

      panelEl.appendChild(root);

      let currentView = libraryStore.roots.length === 0 ? { type: "library" } : { type: "artists" };
      let currentManagerCleanup = null;

      function setView(view) {
        currentView = view;
        render();
      }

      function defaultView() {
        return libraryStore.roots.length === 0 ? { type: "library" } : { type: "artists" };
      }

      function render() {
        content.innerHTML = "";
        currentManagerCleanup?.();
        currentManagerCleanup = null;

        for (const [id, btn] of navButtons) btn.classList.toggle("active", currentView.type === id);

        switch (currentView.type) {
          case "artists":
            renderArtistsView(content, deps);
            break;
          case "artist":
            renderArtistDetailView(content, currentView.name, deps);
            break;
          case "albums":
            renderAlbumsView(content, deps);
            break;
          case "album":
            renderAlbumDetailView(content, currentView.id, deps);
            break;
          case "songs":
            renderSongsView(content, deps);
            break;
          case "recentlyAdded":
            renderRecentlyAddedView(content, deps);
            break;
          case "recentlyPlayed":
            renderRecentlyPlayedView(content, deps);
            break;
          case "mostPlayed":
            renderMostPlayedView(content, deps);
            break;
          case "favourites":
            renderFavouritesView(content, deps);
            break;
          case "playlists":
            renderPlaylistsView(content, deps);
            break;
          case "playlist":
            renderPlaylistDetailView(content, currentView.id, deps);
            break;
          case "search":
            renderSearchResultsView(content, currentView.query, deps);
            break;
          case "library":
            renderLibraryManagerView(content, deps);
            currentManagerCleanup = content.dispose ?? null;
            break;
          default:
            renderArtistsView(content, deps);
        }
      }

      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim();
        setView(q ? { type: "search", query: q } : defaultView());
      });

      render();

      // Re-render only for changes that actually affect what a view should
      // show: the library being (re)scanned, a playlist being edited, or
      // the queue changing. Deliberately *not* on every play/pause/track
      // change — see this function's own doc comment above for why.
      const offLibrary = musicSystem.engine.events.on("library:changed", render);
      const offPlaylists = musicSystem.engine.events.on("playlists:changed", () => {
        renderPlaylistNav();
        render();
      });
      const offQueue = musicSystem.engine.events.on("music:queueChanged", render);

      return () => {
        currentManagerCleanup?.();
        playbackBar.dispose?.();
        offLibrary();
        offPlaylists();
        offQueue();
      };
    },
  };
}
