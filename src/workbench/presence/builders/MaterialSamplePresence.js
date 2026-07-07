import { box, cylinder, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Material sample
 * ----------------
 * `{ type: "materialSample", variant: "wood" | "metal" | "fabric" | "components" }`.
 * A small physical swatch or offcut — the kind of thing that ends up on a
 * bench just because you were holding it while thinking. `variant`
 * chooses the shape/material; unrecognized variants fall back to a plain
 * wood offcut rather than failing.
 */
export function buildMaterialSample(item) {
  const variant = item.variant ?? "wood";
  const g = group();

  if (variant === "fabric") {
    const swatch = box(0.1, 0.01, 0.1, Materials.fabric(item.color ?? "#7a4a3a"));
    swatch.rotation.y = 0.3;
    swatch.position.set(0, 0.005, 0);
    g.add(swatch);
    return { object3D: g, size: "small" };
  }

  if (variant === "components") {
    for (let i = 0; i < 4; i++) {
      const chip = box(0.02, 0.008, 0.014, Materials.matte(["#2a231d", "#3c5a53", "#b8863b"][i % 3]));
      chip.position.set((i % 2) * 0.03 - 0.015, 0.004, Math.floor(i / 2) * 0.03 - 0.015);
      g.add(chip);
    }
    const trayFloor = box(0.09, 0.004, 0.09, Materials.matte("#232323"));
    trayFloor.position.set(0, 0.001, 0);
    g.add(trayFloor);
    return { object3D: g, size: "small" };
  }

  if (variant === "metal") {
    const scrap = cylinder(0.03, 0.03, 0.08, Materials.metal("#9a978f"), 10);
    scrap.rotation.z = Math.PI / 2;
    scrap.position.set(0, 0.03, 0);
    g.add(scrap);
    return { object3D: g, size: "small" };
  }

  // default: a wood offcut
  const offcut = box(0.12, 0.03, 0.07, Materials.wood(item.color ?? "#8d6a45"));
  offcut.rotation.y = 0.25;
  offcut.position.set(0, 0.015, 0);
  g.add(offcut);
  return { object3D: g, size: "small" };
}
