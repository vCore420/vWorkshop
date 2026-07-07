import { box, group, Materials } from "../../../utils/PlaceholderFactory.js";

/**
 * Notebook (presence)
 * -------------------
 * `{ type: "notebook", variant: "open" | "closed" }`. This is pure visual
 * storytelling — a notebook lying on the bench, suggesting the project has
 * one — and is deliberately unrelated to the standalone notebook prop
 * elsewhere in the room that powers the personal-notes feature. Different
 * purpose, so it stays a different object.
 */
export function buildNotebook(item) {
  const variant = item.variant ?? "closed";
  const g = group();
  const coverColor = item.color ?? "#3c5a53";

  if (variant === "open") {
    for (const side of [-1, 1]) {
      const page = box(0.16, 0.006, 0.22, Materials.sketchPaper());
      page.position.set(side * 0.085, 0.006, 0);
      page.rotation.y = side * 0.12;
      page.rotation.z = side * -0.02;
      g.add(page);
    }
    const spine = box(0.02, 0.012, 0.22, Materials.matte(coverColor));
    spine.position.set(0, 0.008, 0);
    g.add(spine);
    return { object3D: g, size: "medium" };
  }

  const cover = box(0.18, 0.02, 0.24, Materials.matte(coverColor));
  cover.position.set(0, 0.01, 0);
  g.add(cover);
  const pages = box(0.17, 0.015, 0.23, Materials.paper());
  pages.position.set(0, 0.0225, 0);
  g.add(pages);
  return { object3D: g, size: "small" };
}
