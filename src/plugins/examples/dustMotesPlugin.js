import * as THREE from "three";

/**
 * dustMotesPlugin
 * ----------------
 * "The Workshop has included a particle system for some time as a proof
 * of concept. Please evolve this into a subtle environmental effect...
 * dust visible in sunlight... slight atmospheric particles near
 * windows... avoid making the room feel smoky or busy." Two small
 * clusters, one at each actual window (`layoutDefault.js`'s own
 * `WINDOWS` positions — [-2.0, 1.55, -3] and [1.4, 1.55, -3] — rather
 * than a single cluster vaguely "between" them), each brighter in
 * daylight and nearly invisible at night, exactly as before.
 *
 * **Organic drift, not a mechanical bounce.** The original simply
 * reversed a mote's velocity outright the instant it reached the edge of
 * its own bounding volume — correct, but visibly regular over a long
 * session, since every mote in a cluster reverses at exactly the same
 * moment along exactly the same axis. Now each mote gently curves back
 * inward instead (a small pull-back force added to its own velocity,
 * proportional to how far past the edge it's drifted, rather than an
 * instant flip), and picks up a tiny random nudge on every frame — no
 * two motes ever move identically, and nothing about the motion reads as
 * a repeating loop.
 *
 * It still exists to demonstrate the plugin contract end-to-end —
 * reading engine events, adding/removing its own Three.js objects, and
 * registering save/load — without editing a single core file. See
 * docs/PLUGIN_GUIDE.md for the contract this implements.
 */
export function dustMotesPlugin() {
  let points = null;
  let velocities = null;
  let origins = null; // per-mote home volume centre — see CLUSTERS below
  let unsubscribe = null;
  const CLUSTERS = [
    { origin: new THREE.Vector3(-2.0, 1.9, -2.6), bounds: { x: 1.1, y: 1.2, z: 0.6 } },
    { origin: new THREE.Vector3(1.4, 1.9, -2.6), bounds: { x: 1.1, y: 1.2, z: 0.6 } },
  ];
  const MOTES_PER_CLUSTER = 16; // fewer per cluster than the original single 40 — two clusters reading as "near each window," never as one busy patch

  return {
    id: "example.dust-motes",

    init(engine) {
      const count = CLUSTERS.length * MOTES_PER_CLUSTER;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      velocities = new Float32Array(count * 3);
      origins = new Float32Array(count * 3);
      let i = 0;
      for (const cluster of CLUSTERS) {
        for (let m = 0; m < MOTES_PER_CLUSTER; m++, i++) {
          positions[i * 3 + 0] = cluster.origin.x + (Math.random() - 0.5) * cluster.bounds.x;
          positions[i * 3 + 1] = cluster.origin.y + (Math.random() - 0.5) * cluster.bounds.y;
          positions[i * 3 + 2] = cluster.origin.z + (Math.random() - 0.5) * cluster.bounds.z;
          origins[i * 3 + 0] = cluster.origin.x;
          origins[i * 3 + 1] = cluster.origin.y;
          origins[i * 3 + 2] = cluster.origin.z;
          velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.025;
          velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.018;
          velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.025;
        }
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: "#ffe9c2",
        size: 0.011,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      points = new THREE.Points(geometry, material);
      engine.scene.add(points);

      unsubscribe = engine.events.on("timeofday:changed", ({ dayFactor }) => {
        material.opacity = 0.04 + dayFactor * 0.3;
      });
    },

    update(dt) {
      if (!points) return;
      const positions = points.geometry.attributes.position.array;
      const boundsHalf = { x: 0.55, y: 0.6, z: 0.3 }; // half of CLUSTERS' own shared bounds — same box size for every cluster, so one constant works for all of them
      for (let i = 0; i < positions.length; i += 3) {
        // A tiny random nudge every frame, plus a gentle pull back toward
        // home once a mote has drifted far enough — never an instant
        // reversal, so nothing about the motion repeats in a way the eye
        // would catch over a long session.
        velocities[i + 0] += (Math.random() - 0.5) * 0.004;
        velocities[i + 1] += (Math.random() - 0.5) * 0.003;
        velocities[i + 2] += (Math.random() - 0.5) * 0.004;

        const offsetX = positions[i + 0] - origins[i + 0];
        const offsetY = positions[i + 1] - origins[i + 1];
        const offsetZ = positions[i + 2] - origins[i + 2];
        if (Math.abs(offsetX) > boundsHalf.x) velocities[i + 0] -= Math.sign(offsetX) * 0.01;
        if (Math.abs(offsetY) > boundsHalf.y) velocities[i + 1] -= Math.sign(offsetY) * 0.01;
        if (Math.abs(offsetZ) > boundsHalf.z) velocities[i + 2] -= Math.sign(offsetZ) * 0.01;

        // A soft speed cap keeps the pull-back gentle rather than letting
        // repeated nudges accumulate into a visible dart.
        const speed = Math.hypot(velocities[i + 0], velocities[i + 1], velocities[i + 2]);
        const maxSpeed = 0.035;
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          velocities[i + 0] *= scale;
          velocities[i + 1] *= scale;
          velocities[i + 2] *= scale;
        }

        positions[i + 0] += velocities[i + 0] * dt;
        positions[i + 1] += velocities[i + 1] * dt;
        positions[i + 2] += velocities[i + 2] * dt;
      }
      points.geometry.attributes.position.needsUpdate = true;
    },

    dispose() {
      unsubscribe?.();
      points?.geometry.dispose();
      points?.material.dispose();
      points?.parent?.remove(points);
    },

    // This plugin has nothing meaningful to persist, but implements the
    // hooks anyway so it's a complete reference example.
    save() {
      return { note: "dust motes carry no state worth saving" };
    },
    load(_data) {},
  };
}
