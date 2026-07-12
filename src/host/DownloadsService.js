/**
 * DownloadsService
 * ------------------
 * "host://downloads... use sensible placeholder data so the interface is
 * ready for future integration." Identical shape and identical
 * reasoning to `DocumentsService.js` — see its own comment for the full
 * account of why real state stays honestly empty while `previewItems()`
 * offers clearly-labelled illustrative rows instead of either an empty
 * page or a convincing fake.
 */
export class DownloadsService {
  constructor() {
    this.recent = []; // genuinely empty — see DocumentsService.js's own comment
  }

  getStatus() {
    return { available: false, summary: "Download management isn't implemented yet — this is prepared architecture, not a working feature." };
  }

  previewItems() {
    return [
      { name: "workshop-export.json", kind: "JSON", modified: "4 hours ago", isExample: true },
      { name: "reference-model.glb", kind: "3D Model", modified: "2 days ago", isExample: true },
      { name: "screenshot.png", kind: "Image", modified: "5 days ago", isExample: true },
    ];
  }

  openDownloadsFolder() {
    throw new Error("DownloadsService.openDownloadsFolder() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }

  clearDownloadHistory() {
    throw new Error("DownloadsService.clearDownloadHistory() isn't implemented yet — the Workshop Host doesn't have a bridge to the local machine.");
  }
}
