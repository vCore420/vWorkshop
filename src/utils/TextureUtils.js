import * as THREE from "three";

/**
 * configureFlatTexture
 * ----------------------
 * "Investigate the recurring warning: 'generateMipmap: Tex image
 * TEXTURE_2D level 0 is incurring lazy initialization.' Determine
 * whether this indicates a genuine issue or expected browser behaviour."
 *
 * A genuine, fixable issue, not just browser noise: every
 * `THREE.CanvasTexture` in the Workshop (the resident's own face, player
 * clothing/skin textures, procedural wood/paper/fabric textures, display
 * surfaces) was being created with Three.js's own default filtering —
 * `LinearMipmapLinearFilter`, which requires a full mipmap chain — with
 * mipmap generation never explicitly configured either way. The browser
 * only actually builds that chain the first time the texture is drawn
 * (not when it's created), which is exactly what "lazy initialization"
 * describes, and repeatedly warns about it every time a texture is drawn
 * before that first, deferred build has happened.
 *
 * None of these textures need mipmapping at all — every one is flat,
 * either genuinely 2D (a face, a UI-style panel) or viewed at a roughly
 * fixed distance/scale (clothing, procedural materials on furniture a
 * player walks past rather than views from a wide range of distances).
 * Mipmapping exists to fight aliasing on a texture viewed at a *wide*
 * range of distances and grazing angles — none of which applies here.
 * Turning it off entirely (rather than, say, resizing every canvas to a
 * power of two) removes the lazy build this warning describes
 * altogether, and costs nothing visually for content that was never
 * relying on it.
 */
export function configureFlatTexture(texture) {
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
