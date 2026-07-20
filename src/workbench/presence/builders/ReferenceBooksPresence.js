import { box, group, Materials } from "../../../utils/PlaceholderFactory.js";
import { clamp } from "../../../utils/MathUtils.js";

/**
 * Reference books
 * ---------------
 * `{ type: "referenceBooks", count?: number }`. A stack of 1-4 books,
 * slightly askew — `count` lets a project describe "I've been reading a
 * lot for this one" versus just one dog-eared reference.
 */
const BOOK_COLORS = ["#6b4a34", "#3c5a53", "#8d6a45", "#5a3d29", "#2a4a52"];

export function buildReferenceBooks(item) {
  const count = clamp(item.count ?? 2, 1, 4);
  const g = group();

  let y = 0;
  for (let i = 0; i < count; i++) {
    const h = 0.03;
    const book = box(0.16 - i * 0.006, h, 0.21 - i * 0.004, Materials.matte(BOOK_COLORS[i % BOOK_COLORS.length]));
    book.position.set((Math.random() - 0.5) * 0.015, y + h / 2, (Math.random() - 0.5) * 0.015);
    book.rotation.y = (i - count / 2) * 0.06;
    g.add(book);
    y += h;
  }

  return { object3D: g, size: "medium" };
}
