import * as THREE from "three";

/**
 * dustMotesPlugin
 * ----------------
 * A small, purely decorative example plugin: a handful of slowly drifting
 * particles near the windows, brighter in daylight and nearly invisible at
 * night. It exists to demonstrate the plugin contract end-to-end —
 * reading engine events, adding/removing its own Three.js objects, and
 * registering save/load — without editing a single core file.
 *
 * See docs/PLUGIN_GUIDE.md for the contract this implements.
 */
export function dustMotesPlugin() {
  let points = null;
  let velocities = null;
  let unsubscribe = null;
  const bounds = { x: 1.6, y: 1.4, z: 0.6 };
  const origin = new THREE.Vector3(-0.3, 1.9, -2.6); // roughly between the two windows

  return {
    id: "example.dust-motes",

    init(engine) {
      const count = 40;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      velocities = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 0] = origin.x + (Math.random() - 0.5) * bounds.x;
        positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * bounds.y;
        positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * bounds.z;
        velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.03;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: "#ffe9c2",
        size: 0.012,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      points = new THREE.Points(geometry, material);
      engine.scene.add(points);

      unsubscribe = engine.events.on("timeofday:changed", ({ dayFactor }) => {
        material.opacity = 0.05 + dayFactor * 0.35;
      });
    },

    update(dt) {
      if (!points) return;
      const positions = points.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 0] += velocities[i + 0] * dt;
        positions[i + 1] += velocities[i + 1] * dt;
        positions[i + 2] += velocities[i + 2] * dt;
        // Gently wrap back toward the sunbeam volume instead of drifting away forever.
        if (Math.abs(positions[i + 0] - origin.x) > bounds.x / 2) velocities[i + 0] *= -1;
        if (Math.abs(positions[i + 1] - origin.y) > bounds.y / 2) velocities[i + 1] *= -1;
        if (Math.abs(positions[i + 2] - origin.z) > bounds.z / 2) velocities[i + 2] *= -1;
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
