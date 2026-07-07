import { InteractableComponent } from "../../core/components/InteractableComponent.js";
import { AudioSystem } from "../../systems/AudioSystem.js";
import { getTrackList } from "../../utils/AudioSynth.js";
import { registerBehaviour } from "./registry.js";

/**
 * Audio Source
 * ------------
 * "There's only one 'what's playing' in the workshop" — the same
 * philosophy MediaApp documents for the stereo/computer. This behaviour
 * doesn't spin up independent spatial audio; it plays a track through the
 * one shared AudioSystem channel, same as the stereo and the computer's
 * Media app already do.
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
