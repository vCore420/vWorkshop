import * as THREE from "three";
import { registerBehaviour } from "./registry.js";

/**
 * Light Source
 * ------------
 * Attaches a real THREE.PointLight to the object, centred on it. Doesn't
 * own an InteractableComponent — a light can be combined with any other
 * behaviour (e.g. a lamp that's also a Seat).
 */
registerBehaviour("lightSource", {
  label: "Light source",
  ownsInteractable: false,
  propsSchema: [
    { key: "color", label: "Colour", type: "color", default: "#ffdca8" },
    { key: "intensity", label: "Intensity", type: "number", default: 0.8 },
    { key: "distance", label: "Reach (m)", type: "number", default: 3 },
  ],
  apply({ object3D, properties }) {
    const light = new THREE.PointLight(
      properties.color || "#ffdca8",
      properties.intensity ?? 0.8,
      properties.distance ?? 3,
      2
    );
    object3D.add(light);
  },
});
