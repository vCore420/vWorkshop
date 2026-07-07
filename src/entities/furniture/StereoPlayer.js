import { box, cylinder, group, Materials } from "../../utils/PlaceholderFactory.js";

/**
 * StereoPlayer
 * ------------
 * A small cabinet unit with two speaker-ish shapes and a dial. Physically
 * unchanged since it was first built — what changed is what interacting
 * with it opens: the real music library (`overlayId: "music"`, see
 * `docs/MUSIC.md`), through the exact same generic
 * `interaction:trigger`/`OverlayManager` path every other piece of
 * furniture already uses. There's no stereo-specific code anywhere in the
 * music system — a future Builder object with a `musicPlayer` behaviour
 * opens the identical overlay the identical way.
 */
export const StereoPlayerDefinition = {
  id: "stereoPlayer",
  label: "Stereo",
  footprint: { width: 0.5, depth: 0.3 },

  build() {
    const g = group();

    const body = box(0.42, 0.16, 0.24, Materials.wood("#4a3120"));
    body.position.set(0, 0.55, 0);
    g.add(body);

    const dial = cylinder(0.045, 0.045, 0.02, Materials.brass(), 20);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(-0.13, 0.55, 0.13);
    g.add(dial);
    g.userData.dialMesh = dial;

    for (const x of [-0.24, 0.24]) {
      const speaker = box(0.14, 0.14, 0.02, Materials.matte("#232323"));
      speaker.position.set(x, 0.55, 0.13);
      g.add(speaker);
      const cone = cylinder(0.045, 0.045, 0.02, Materials.matte("#333"), 16);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(x, 0.55, 0.145);
      g.add(cone);
    }

    const standTop = box(0.5, 0.02, 0.3, Materials.wood("#6b4a34"));
    standTop.position.set(0, 0.46, 0);
    g.add(standTop);
    for (const [x, z] of [[-0.2, -0.11], [0.2, -0.11], [-0.2, 0.11], [0.2, 0.11]]) {
      const leg = cylinder(0.02, 0.02, 0.46, Materials.wood("#3d2a1c"));
      leg.position.set(x, 0.23, z);
      g.add(leg);
    }

    return g;
  },

  interaction: {
    prompt: "Play some music",
    radius: 2.0, // small object — see docs/WORLD.md's interaction-distance pass
    overlayId: "music",
  },
};
