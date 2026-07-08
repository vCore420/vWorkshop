import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { AudioSystem } from "../../systems/AudioSystem.js";
import { getTrackList } from "../../utils/AudioSynth.js";
import { registerBehaviour } from "./registry.js";

/**
 * Audio Source
 * ------------
 * A simple "this custom object plays one ambient tune" behaviour, through
 * the single shared `AudioSystem` channel — distinct from, and much
 * simpler than, the real personal music library the music cabinet opens
 * (`musicPlayer` behaviour, `src/music/`, see docs/MUSIC.md). Neither
 * MediaApp nor the music cabinet route through `AudioSystem` at all
 * anymore; this behaviour is the one remaining thing that does, alongside
 * weather ambience.
 */
registerBehaviour("audioSource", {
  label: "Audio source",
  ownsInteractable: true,
  propsSchema: [{ key: "trackId", label: "Track", type: "select", options: getTrackList().map((t) => [t.id, t.title]), default: getTrackList()[0]?.id }],
  apply({ entity, properties, engine }) {
    entity.addComponent(
      new InteractableComponent({
        prompt: "Play this track",
        radius: 1.3,
        onInteract: () => {
          const audioSystem = engine.getSystem(AudioSystem);
          audioSystem?.resumeContext();
          audioSystem?.playTrack(properties.trackId);
        },
      })
    );
  },
});
