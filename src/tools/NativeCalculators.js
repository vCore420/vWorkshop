import { Piece, packPieces } from "./maxRects.js";

/**
 * NativeCalculators
 * -----------------
 * Workshop Tools phase — "the first generation of native Workshop Tools."
 * Every `calculate()` function below is ported from a real external
 * application (a security/screen-door manufacturer's own production
 * tool) with its actual business logic preserved exactly — these are
 * genuine calculations a real workshop depends on, not samples invented
 * for this project. What changed in the port is everything *around* the
 * math: no IndexedDB history store, no hand-built form DOM, no floating
 * quick-calculator bubble — those were the original application's own
 * interface, and the brief was explicit that a calculator here "should
 * feel like something sitting on the Workbench waiting to be used," not
 * an imported application. The surrounding shell is `ToolsPanelView.js`;
 * this file is only the tools themselves.
 *
 * Each entry is a plain, serialisable-shape definition:
 *   { id, title, description, category, icon,
 *     inputs: [{ id, label, type, ... }],
 *     calculate(values) -> string (may contain "<br>" line breaks) }
 *
 * `category` groups tools the same way the original source file's own
 * comments already did (Sales / Manufacturing / Installer) — that
 * grouping came from how an actual workshop's staff actually divide this
 * work, so it was worth keeping rather than inventing a new one.
 *
 * One thing was *not* carried forward: `getBuildoutSideDeductions()`, a
 * helper defined in the source file with no caller anywhere in it — dead
 * code in the original, not something this phase's own port should
 * quietly perpetuate. See docs/TOOLS.md's own "Architectural review" for
 * the rest of what changed and why.
 */

// ---- Crimsafe mesh-sizing helpers, shared by several calculators below ----
// (ported unchanged — the actual measurements a real Crimsafe installer
// or fabricator depends on)

function getCrimsafeParams(type) {
  if (type === "classic") {
    return { meshOffset: 114, frameDeduction: 57, meshGap: 10 };
  } else if (type === "ultimate") {
    return { meshOffset: 122, frameDeduction: 61, meshGap: 10 };
  } else if (type === "window") {
    return { meshOffset: 40, frameDeduction: 20, meshGap: 10 };
  }
}

function getCrimsafeMeshSplit(doorWidth, doorHeight, meshWidth, midRailHeight, crimsafeType) {
  const { meshOffset, frameDeduction, meshGap } = getCrimsafeParams(crimsafeType);
  const fullMeshHeight = doorHeight - meshOffset;

  if (!Number.isFinite(midRailHeight)) {
    return {
      hasMidRail: false,
      doorWidth: doorWidth,
      meshWidth: meshWidth,
      fullMeshHeight: fullMeshHeight,
    };
  }

  const bottomMeshHeight = midRailHeight - frameDeduction - meshGap;
  const topMeshHeight = (doorHeight - midRailHeight) - frameDeduction - meshGap;

  if (bottomMeshHeight <= 0 || topMeshHeight <= 0) {
    return { error: "Mid Rail Centre is too close to the top or bottom of the door." };
  }

  return {
    hasMidRail: true,
    doorWidth: doorWidth,
    meshWidth: meshWidth,
    midRailHeight: midRailHeight,
    bottomMeshHeight: bottomMeshHeight,
    topMeshHeight: topMeshHeight,
  };
}

function buildCrimsafeMeshOnlyLines(doorWidth, doorHeight, midRailHeight, crimsafeType) {
  const { meshOffset } = getCrimsafeParams(crimsafeType);
  const meshWidth = doorWidth - meshOffset;
  const meshData = getCrimsafeMeshSplit(doorWidth, doorHeight, meshWidth, midRailHeight, crimsafeType);

  if (meshData.error) return meshData.error + "<br>";

  if (!meshData.hasMidRail) {
    return "Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.fullMeshHeight.toFixed(0) + "mm<br>";
  }

  return (
    "Bottom Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.bottomMeshHeight.toFixed(0) + "mm<br>" +
    "Top Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.topMeshHeight.toFixed(0) + "mm<br>"
  );
}

function buildCrimsafeDoorLines(doorWidth, doorHeight, midRailHeight, crimsafeType) {
  const { meshOffset } = getCrimsafeParams(crimsafeType);
  const meshWidth = doorWidth - meshOffset;
  const meshData = getCrimsafeMeshSplit(doorWidth, doorHeight, meshWidth, midRailHeight, crimsafeType);

  if (meshData.error) return meshData.error + "<br>";

  let output = "";

  if (!meshData.hasMidRail) {
    output = "Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.fullMeshHeight.toFixed(0) + "mm<br>";
  } else {
    output = (
      "Mid Rail Centre = " + meshData.midRailHeight.toFixed(0) + "mm up from bottom of door<br>" +
      "Bottom Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.bottomMeshHeight.toFixed(0) + "mm<br>" +
      "Top Mesh Cut at " + meshData.meshWidth.toFixed(0) + "mm x " + meshData.topMeshHeight.toFixed(0) + "mm<br>" +
      "Mid Rail = " + meshData.doorWidth.toFixed(0) + "mm (+ 100 for P/C)<br>" +
      "Mid Rail Cover = " + meshData.doorWidth.toFixed(0) + "mm (+ 100 for P/C)<br>" +
      "Overall Mid Rail = " + (meshData.doorWidth + 100).toFixed(0) + "mm<br>" +
      "Overall Mid Rail Cover = " + (meshData.doorWidth + 100).toFixed(0) + "mm<br>"
    );
  }

  if (crimsafeType === "ultimate") {
    output += "Clamp Width = " + (meshData.doorWidth - 120).toFixed(0) + "mm<br>" +
              "Clamp Height = " + (doorHeight - 160).toFixed(0) + "mm<br>";
  }

  return output;
}

export const TOOL_CATEGORIES = [
  { id: "sales", label: "Sales", icon: "\u{1F4B0}" },
  { id: "manufacturing", label: "Manufacturing", icon: "\u{1F527}" },
  { id: "installer", label: "Installer", icon: "\u{1F3E0}" },
  { id: "custom", label: "Custom", icon: "\u2728" },
];

export const NATIVE_CALCULATORS = [
  {
    id: "buildOut",
    native: true,
    category: "sales",
    icon: "\u{1F4D0}",
    title: "B/O Door Calculator",
    description: "Determine the size a B/O door needs to be based on the house daylight sizes (for first measure).",
    inputs: [
      { id: "jobName", label: "Job Name:", type: "text" },
      { id: "doorWidth", label: "Daylight Width (mm):", type: "number", min: 0 },
      { id: "doorHeight", label: "Daylight Height (mm):", type: "number", min: 0 },
    ],
    calculate(values) {
      const buildOutWidth = values.doorWidth + 50;
      const buildOutHeight = values.doorHeight + 50;
      return `Build Out Dimensions: ${buildOutWidth.toFixed(0)}mm Wide by ${buildOutHeight.toFixed(0)}mm High. Double check this will work!`;
    },
  },

  {
    id: "internalDoor",
    native: true,
    category: "sales",
    icon: "\u{1F6AA}",
    title: "Internal Door Calculator",
    description: "Determine the size an internal door needs to be based on the house daylight sizes (for first measure).",
    inputs: [
      { id: "jobName", label: "Job Name:", type: "text" },
      { id: "houseWidth", label: "Daylight Width (mm):", type: "number", min: 0 },
      { id: "houseHeight", label: "Daylight Height (mm):", type: "number", min: 0 },
    ],
    calculate(values) {
      const doorWidth = values.houseWidth - 6;
      const doorHeight = values.houseHeight - 6;
      return `Internal Door Dimensions: ${doorWidth.toFixed(0)}mm Wide by ${doorHeight.toFixed(0)}mm High. Double check this will work!`;
    },
  },

  {
    id: "crimMeshSize",
    native: true,
    category: "manufacturing",
    icon: "\u{1FA9F}",
    title: "Crim Mesh Size Calculator",
    description: "Calculate mesh sizes for Crimsafe doors.",
    inputs: [
      { id: "crimWidth", label: "Door Width (mm):", type: "number", min: 0 },
      { id: "crimHeight", label: "Door Height (mm):", type: "number", min: 0 },
      { id: "midRailHeight", label: "Mid Rail (mm) if applicable:", type: "number", min: 0 },
      {
        id: "crimsafeType", label: "Crimsafe Type:", type: "radio", default: "ultimate",
        options: [
          { value: "classic", label: "Classic" },
          { value: "ultimate", label: "Ultimate" },
          { value: "window", label: "Window Frame" },
        ],
      },
    ],
    calculate(values) {
      const crimsafeType = values.crimsafeType || "ultimate";
      return buildCrimsafeMeshOnlyLines(values.crimWidth, values.crimHeight, values.midRailHeight, crimsafeType).replace(/<br>$/, "");
    },
  },

  {
    id: "screenDoorCutting",
    native: true,
    category: "manufacturing",
    icon: "\u2702\uFE0F",
    title: "Main Door Cutting/Making Calculator",
    description: "Calculate cutting and making sizes for Lifestyle or Crimsafe doors.",
    inputs: [
      { id: "jobName", label: "Job Name:", type: "text" },
      { id: "screenDoorWidth", label: "Door Width (mm):", type: "number", min: 0 },
      { id: "screenDoorHeight", label: "Door Height (mm):", type: "number", min: 0 },
      { id: "handleHeight", label: "Handle Height (mm):", type: "number", min: 0 },
      { id: "midRailHeight", label: "Mid Rail (mm) if applicable:", type: "number", min: 0 },
      {
        id: "frameType", label: "Frame Type:", type: "radio",
        options: [
          { value: "hinged", label: "Hinged" },
          { value: "buildout", label: "BuildOut" },
          { value: "adapter", label: "Adapter Frame" },
        ],
      },
      { id: "buildoutAllSides", label: "All 4 Sides", type: "checkbox" },
      { id: "buildoutLeft", label: "Left", type: "checkbox" },
      { id: "buildoutRight", label: "Right", type: "checkbox" },
      { id: "buildoutTop", label: "Top", type: "checkbox" },
      { id: "buildoutBottom", label: "Bottom", type: "checkbox" },
      {
        id: "doorType", label: "Door Type:", type: "radio",
        options: [
          { value: "lifestyle", label: "Lifestyle" },
          { value: "crimsafe", label: "Crimsafe Classic" },
          { value: "crimsafeUltimate", label: "Crimsafe Ultimate" },
        ],
      },
      {
        id: "doorOrientation", label: "Hinged on:", type: "radio",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
    ],
    calculate(values) {
      const width = values.screenDoorWidth;
      const height = values.screenDoorHeight;
      const handle = values.handleHeight;
      const midRailHeight = values.midRailHeight;
      const frameType = values.frameType;
      const doorType = values.doorType;
      const orientation = values.doorOrientation;

      let output = "";
      const crimsafeType = doorType === "crimsafe" ? "classic" : doorType === "crimsafeUltimate" ? "ultimate" : null;

      if (frameType === "hinged") {
        output +=
          `Door Width = ${width}mm (+ 100 for P/C)<br>` +
          `Door Height = ${height}mm (+ 100 for P/C)<br>` +
          `Hinged on = ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}<br>` +
          `Handle Height = ${handle}mm<br>` +
          `Bug Strip = 2 X ${height + 100}mm, 1 X ${width + 100}mm<br>`;
        if (doorType === "lifestyle") {
          output +=
            `Grill Cut at ${width - 120}mm x ${height - 120}mm<br>` +
            `Overall Door Frame Cut Length = ${(width * 2) + (height * 2)}mm<br>` +
            `Overall BugStrip Cut Length = ${(height + 100) * 2 + (width + 100)}mm<br>`;
        } else if (crimsafeType) {
          output +=
            buildCrimsafeDoorLines(width, height, midRailHeight, crimsafeType) +
            `Overall Door Frame Cut Length = ${(width + 100) * 2 + (height + 100) * 2}mm (Same Length for Covers)<br>` +
            `Overall BugStrip Cut Length = ${(height + 100) * 2 + (width + 100)}mm<br>`;
        }
      } else if (frameType === "buildout") {
        const selectedSides = {
          left: Boolean(values.buildoutAllSides || values.buildoutLeft),
          right: Boolean(values.buildoutAllSides || values.buildoutRight),
          top: Boolean(values.buildoutAllSides || values.buildoutTop),
          bottom: Boolean(values.buildoutAllSides || values.buildoutBottom),
        };

        if (!selectedSides.left && !selectedSides.right && !selectedSides.top && !selectedSides.bottom) {
          return "Select at least one Build Out side.";
        }

        const buildoutDoorWidth = width - (selectedSides.left ? 24 : 3) - (selectedSides.right ? 24 : 3);
        const buildoutDoorHeight = height - (selectedSides.top ? 24 : 3) - (selectedSides.bottom ? 24 : 3);
        const buildoutSides = [
          selectedSides.left ? "Left" : "",
          selectedSides.right ? "Right" : "",
          selectedSides.top ? "Top" : "",
          selectedSides.bottom ? "Bottom" : "",
        ].filter(Boolean).join(", ");

        const overallBuildoutFrameCutLength =
          (selectedSides.left ? height + 100 : 0) +
          (selectedSides.right ? height + 100 : 0) +
          (selectedSides.top ? width + 100 : 0) +
          (selectedSides.bottom ? width + 100 : 0);

        output +=
          `B/O Frame Width = ${width}mm (+ 100 for P/C)<br>` +
          `B/O Frame Height = ${height}mm (+ 100 for P/C)<br>` +
          `B/O Sides = ${buildoutSides}<br>` +
          `Door Width = ${buildoutDoorWidth}mm (+ 100 for P/C)<br>` +
          `Door Height = ${buildoutDoorHeight}mm (+ 100 for P/C)<br>` +
          `Hinged on = ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}<br>` +
          `Handle Height = ${handle}mm<br>`;

        if (doorType === "lifestyle") {
          output +=
            `Grill Cut at ${buildoutDoorWidth - 120}mm x ${buildoutDoorHeight - 120}mm<br>` +
            `Overall B/O Frame Cut Length = ${overallBuildoutFrameCutLength}mm<br>` +
            `Overall Door Frame Cut Length = ${((buildoutDoorWidth + 100) * 2) + ((buildoutDoorHeight + 100) * 2)}mm<br>`;
        } else if (crimsafeType) {
          output +=
            buildCrimsafeDoorLines(buildoutDoorWidth, buildoutDoorHeight, midRailHeight, crimsafeType) +
            `Overall B/O Frame Cut Length = ${overallBuildoutFrameCutLength}mm<br>` +
            `Overall Door Frame Cut Length = ${((buildoutDoorWidth + 100) * 2) + ((buildoutDoorHeight + 100) * 2)}mm (Same Length for Covers)<br>`;
        }
      } else if (frameType === "adapter") {
        const adapterDoorWidth = width - 13;
        const adapterDoorHeight = height - 8;

        output +=
          `Apt Frame Width = ${width}mm (+ 100 for P/C)<br>` +
          `Apt Frame Height = ${height}mm (+ 100 for P/C)<br>` +
          `Door Width = ${adapterDoorWidth}mm (+ 100 for P/C)<br>` +
          `Door Height = ${adapterDoorHeight}mm (+ 100 for P/C)<br>` +
          `Hinged on = ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}<br>` +
          `Handle Height = ${handle}mm<br>`;
        if (doorType === "lifestyle") {
          output +=
            `Grill Cut at ${width - 133}mm x ${height - 128}mm<br>` +
            `Overall Apt Frame Cut Length = ${(width + 100) + (height + 100) * 2}mm (Same Length for Covers)<br>` +
            `Overall Door Frame Cut Length = ${(height + 92) * 2 + (width + 87) * 2}mm<br>`;
        } else if (crimsafeType) {
          output +=
            buildCrimsafeDoorLines(adapterDoorWidth, adapterDoorHeight, midRailHeight, crimsafeType) +
            `Overall Apt Frame Cut Length = ${(width + 100) + (height + 100) * 2}mm (Same Length for Covers)<br>` +
            `Overall Door Frame Cut Length = ${(height + 92) * 2 + (width + 87) * 2}mm (Same Length for Covers)<br>`;
        }
      }
      return output;
    },
  },

  {
    id: "sliderDoorCutting",
    native: true,
    category: "manufacturing",
    icon: "\u{1FA9F}",
    title: "Main Slider Cutting/Making Calculator",
    description: "Calculate cutting and making sizes for Lifestyle or Crimsafe slider doors.",
    inputs: [
      { id: "jobName", label: "Job Name:", type: "text" },
      { id: "zFrameWidth", label: "Z Frame Width (mm):", type: "number", min: 0 },
      { id: "zFrameHeight", label: "Z Frame Height (mm):", type: "number", min: 0 },
      { id: "doorPanelWidth", label: "Door Panel Width (mm):", type: "number", min: 0 },
      { id: "mullionWidth", label: "Mullion Width (mm):", type: "number", min: 0 },
      { id: "sliderhandleHeight", label: "Handle Height (mm):", type: "number", min: 0 },
      { id: "midRailHeight", label: "Mid Rail (mm) if applicable:", type: "number", min: 0 },
      { id: "boxSection", label: "Box Section", type: "checkbox" },
      { id: "internalFit", label: "Internal Fit", type: "checkbox" },
      {
        id: "doorType", label: "Door Type:", type: "radio",
        options: [
          { value: "lifestyle", label: "Lifestyle" },
          { value: "crimsafe", label: "Crimsafe Classic" },
          { value: "crimsafeUltimate", label: "Crimsafe Ultimate" },
        ],
      },
      {
        id: "doorOrientation", label: "Closes to the:", type: "radio",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
    ],
    calculate(values) {
      const zWidth = values.zFrameWidth;
      const zHeight = values.zFrameHeight;
      const width = values.doorPanelWidth;
      const mullion = values.mullionWidth;
      const handle = values.sliderhandleHeight;
      const midRailHeight = values.midRailHeight;
      const doorType = values.doorType;
      const orientation = values.doorOrientation;
      const boxSection = values.boxSection;
      const internalFit = values.internalFit;

      const crimsafeType = doorType === "crimsafe" ? "classic" : doorType === "crimsafeUltimate" ? "ultimate" : null;

      const doorHeight = zHeight - (internalFit ? 36 : 74);
      const lifestyleDoorWidth = (width + mullion) - (internalFit ? 19 : 36);
      const crimsafeDoorWidth = (width + 50) - (internalFit ? 19 : 36);

      const grillWidth = lifestyleDoorWidth - 120;
      const grillHeight = doorHeight - 120;

      const draftStrip = doorHeight + 74;
      const interlockerFlatBar = doorHeight + 19;
      const interlockerZ = doorHeight + 19;
      const interlockerL = doorHeight - 26;

      let output =
        `Z Frame Width = ${zWidth}mm (+ 100 for P/C)<br>` +
        `Z Frame Height = ${zHeight}mm (+ 100 for P/C)<br>`;

      if (boxSection) {
        output +=
          `Box Section Width = ${zWidth}mm (+ 100 for P/C)<br>` +
          `Box Section Height = ${zHeight}mm (+ 100 for P/C)<br>`;
      }

      output +=
        `Roller Track = ${zWidth}mm (+ 100 for P/C)<br>` +
        `Closes to the = ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}<br>` +
        `Handle Height = ${handle}mm<br>`;

      if (doorType === "lifestyle") {
        output +=
          `Door Width = ${lifestyleDoorWidth}mm<br>` +
          `Door Height = ${doorHeight}mm<br>` +
          `Draft Strip = ${draftStrip}mm (+ 100 for P/C)<br>` +
          `Grill Cut at ${grillWidth}mm x ${grillHeight}mm<br>` +
          `Overall Door Frame Cut Length = ${((lifestyleDoorWidth + 100) * 2) + ((doorHeight + 100) * 2)}mm<br>` +
          `Overall Z Frame Cut Length = ${((zWidth + 100) * 2) + ((zHeight + 100) * 2)}mm<br>`;
        if (boxSection) {
          output += `Overall Box Section Cut Length = ${((zWidth + 100) * 2) + ((zHeight + 100) * 2)}mm<br>`;
        }
        output +=
          `Overall Roller Track = ${zWidth + 100}mm<br>` +
          `Overall Draft Strip = ${draftStrip + 100}mm<br>`;
      } else if (crimsafeType) {
        output +=
          `Door Width = ${crimsafeDoorWidth}mm (+ 100 for P/C)<br>` +
          `Door Height = ${doorHeight}mm (+ 100 for P/C)<br>` +
          `Interlocker Flat Bar = ${interlockerFlatBar}mm (+ 100 for P/C)<br>` +
          `Interlocker Z = ${interlockerZ}mm (+ 100 for P/C)<br>` +
          `Interlocker L = ${interlockerL}mm (+ 100 for P/C)<br>` +
          buildCrimsafeDoorLines(crimsafeDoorWidth, doorHeight, midRailHeight, crimsafeType) +
          `Overall Door Frame Cut Length = ${((crimsafeDoorWidth + 100) * 2) + ((doorHeight + 100) * 2)}mm<br>` +
          `Overall Z Frame Cut Length = ${((zWidth + 100) * 2) + ((zHeight + 100) * 2)}mm<br>`;
        if (boxSection) {
          output += `Overall Box Section Cut Length = ${((zWidth + 100) * 2) + ((zHeight + 100) * 2)}mm<br>`;
        }
        output +=
          `Overall Roller Track = ${zWidth + 100}mm<br>` +
          `Overall Interlocker Flat Bar = ${interlockerFlatBar + 100}mm<br>` +
          `Overall Interlocker Z = ${interlockerZ + 100}mm<br>` +
          `Overall Interlocker L = ${interlockerL + 100}mm<br>`;
      }

      return output;
    },
  },

  {
    id: "holeSpacing",
    native: true,
    category: "installer",
    icon: "\u26AB",
    title: "Even Hole Spacing",
    description: "Evenly spaced holes along a length, using the closest spacing to 400mm, 600mm, or 900mm, while keeping the same inset from each end.",
    inputs: [
      { id: "lengthInput", label: "Enter length in mm:", type: "number", min: 401 },
      { id: "spacingOption", label: "Amount in from Each End (mm):", type: "number", min: 0, default: 50 },
      {
        id: "targetSpacing", label: "Target Spacing:", type: "radio",
        options: [
          { value: "400", label: "Closest to 400mm" },
          { value: "600", label: "Closest to 600mm" },
          { value: "900", label: "Closest to 900mm" },
        ],
      },
    ],
    calculate(values) {
      const length = values.lengthInput;
      const spacingOption = values.spacingOption;
      const targetSpacing = values.targetSpacing ? Number(values.targetSpacing) : 400;
      const effectiveLength = length - spacingOption * 2;

      if (effectiveLength <= 0) {
        return "Length must be greater than the two end insets combined.";
      }

      let bestSpacing = 0;
      let minDifference = Infinity;
      let bestDivisions = 1;

      for (let divisions = 1; divisions <= effectiveLength; divisions++) {
        const spacing = effectiveLength / divisions;
        const difference = Math.abs(spacing - targetSpacing);
        if (difference < minDifference) {
          minDifference = difference;
          bestSpacing = spacing;
          bestDivisions = divisions;
        }
      }

      return `${spacingOption}mm in from each end, then spaced out by ${bestSpacing.toFixed(0)}mm (${bestDivisions + 1} holes)`;
    },
  },

  {
    id: "boNesting",
    native: true,
    category: "installer",
    icon: "\u{1F4CF}",
    title: "B/O Nesting Channel Spacing",
    description: "Calculate the spacing needed for B/O nesting channel based on the door sizes.",
    inputs: [
      { id: "boDoorSize", label: "B/O Door Size in mm:", type: "number", min: 0 },
      { id: "houseDoorSize", label: "House Door Size in mm:", type: "number", min: 0 },
    ],
    calculate(values) {
      const difference = values.boDoorSize - values.houseDoorSize;
      const finalResult = difference / 2;
      return `${finalResult.toFixed(1)} mm in from each side`;
    },
  },

  {
    id: "pleatedScreen",
    native: true,
    category: "installer",
    icon: "\u{1FA9F}",
    title: "Pleated Screen Fixings",
    description: "Calculate the hole spacing for a face-fix pleated screen based on width and height.",
    inputs: [
      { id: "pleatedWidth", label: "Overall Width of Screen in mm:", type: "number", min: 0 },
      { id: "pleatedHeight", label: "Overall Height of Screen in mm:", type: "number", min: 0 },
    ],
    calculate(values) {
      const finalWidth = values.pleatedWidth > 1500 ? values.pleatedWidth / 3 : values.pleatedWidth / 2;
      const finalHeight = values.pleatedHeight > 2400 ? values.pleatedHeight / 3 : values.pleatedHeight / 2;
      return `8mm Holes Needed for Face Fixing every ${finalWidth.toFixed(0)}mm for Width and every ${finalHeight.toFixed(0)}mm for Height`;
    },
  },

  {
    id: "zipTrack",
    native: true,
    category: "installer",
    icon: "\u26A1",
    title: "Ziptrak Spring Tension/Turns",
    description: "Find out how much tension (in 'turns') a Ziptrak spring needs. Use as a guide — favour the higher number for exposed areas.",
    inputs: [
      { id: "zipTrackWidth", label: "Width (mm):", type: "number", min: 0, step: 1 },
      { id: "zipTrackHeight", label: "Height (mm):", type: "number", min: 0, step: 1 },
      { id: "secondSpring", label: "2nd Spring?", type: "checkbox" },
      { id: "heavyDutyBar", label: "Heavy Duty Bar?", type: "checkbox" },
    ],
    calculate(values) {
      const widthMeters = values.zipTrackWidth / 1000;
      const heightMeters = values.zipTrackHeight / 1000;
      const width = Math.min(8, Math.round(widthMeters * 2) / 2);
      const height = Math.min(8, Math.round(heightMeters * 2) / 2);

      const turnsTable = {
        "0.5": { "0.5": "8 - 10", "1": "9 - 11", "1.5": "10 - 12", "2": "11 - 13", "2.5": "12 - 14", "3": "13 - 15", "3.5": "14 - 16", "4": "15 - 17", "4.5": "16 - 18", "5": "17 - 19", "5.5": "18 - 20", "6": "19 - 21", "6.5": "20 - 22", "7": "21 - 23", "7.5": "22 - 24", "8": "23 - 25" },
        "1": { "0.5": "9 - 11", "1": "10 - 12", "1.5": "11 - 13", "2": "12 - 14", "2.5": "12 - 14", "3": "13 - 15", "3.5": "14 - 16", "4": "15 - 17", "4.5": "16 - 18", "5": "17 - 19", "5.5": "18 - 20", "6": "19 - 21", "6.5": "20 - 22", "7": "21 - 23", "7.5": "22 - 24", "8": "23 - 25" },
        "1.5": { "0.5": "10 - 12", "1": "11 - 13", "1.5": "12 - 14", "2": "14 - 16", "2.5": "13 - 15", "3": "14 - 16", "3.5": "15 - 17", "4": "16 - 18", "4.5": "17 - 19", "5": "18 - 20", "5.5": "19 - 21", "6": "20 - 22", "6.5": "21 - 23", "7": "22 - 24", "7.5": "23 - 25", "8": "24 - 26" },
        "2": { "0.5": "11 - 13", "1": "12 - 14", "1.5": "13 - 15", "2": "15 - 17", "2.5": "16 - 18", "3": "17 - 19", "3.5": "18 - 20", "4": "19 - 21", "4.5": "20 - 22", "5": "21 - 23", "5.5": "22 - 24", "6": "23 - 25", "6.5": "24 - 26", "7": "25 - 27", "7.5": "26 - 28", "8": "27 - 29" },
        "2.5": { "0.5": "12 - 14", "1": "13 - 15", "1.5": "14 - 16", "2": "16 - 18", "2.5": "19 - 21", "3": "18 - 20", "3.5": "20 - 22", "4": "21 - 23", "4.5": "22 - 24", "5": "23 - 25", "5.5": "24 - 26", "6": "25 - 27", "6.5": "26 - 28", "7": "27 - 29", "7.5": "28 - 30", "8": "29 - 31" },
        "3": { "0.5": "13 - 15", "1": "14 - 16", "1.5": "15 - 17", "2": "17 - 19", "2.5": "18 - 20", "3": "19 - 21", "3.5": "20 - 22", "4": "21 - 23", "4.5": "22 - 24", "5": "23 - 25", "5.5": "24 - 26", "6": "25 - 27", "6.5": "26 - 28", "7": "27 - 29", "7.5": "28 - 30", "8": "29 - 31" },
        "3.5": { "0.5": "14 - 16", "1": "15 - 17", "1.5": "16 - 18", "2": "18 - 20", "2.5": "19 - 21", "3": "20 - 22", "3.5": "21 - 23", "4": "22 - 24", "4.5": "23 - 25", "5": "24 - 26", "5.5": "25 - 27", "6": "26 - 28", "6.5": "27 - 29", "7": "28 - 30", "7.5": "29 - 31", "8": "30 - 32" },
        "4": { "0.5": "15 - 17", "1": "16 - 18", "1.5": "17 - 19", "2": "19 - 21", "2.5": "20 - 22", "3": "21 - 23", "3.5": "22 - 24", "4": "23 - 25", "4.5": "24 - 26", "5": "25 - 27", "5.5": "26 - 28", "6": "27 - 29", "6.5": "28 - 30", "7": "29 - 31", "7.5": "30 - 32", "8": "31 - 33" },
        "4.5": { "0.5": "16 - 18", "1": "17 - 19", "1.5": "18 - 20", "2": "20 - 22", "2.5": "21 - 23", "3": "22 - 24", "3.5": "23 - 25", "4": "24 - 26", "4.5": "25 - 27", "5": "26 - 28", "5.5": "27 - 29", "6": "28 - 30", "6.5": "29 - 31", "7": "30 - 32", "7.5": "31 - 33", "8": "32 - 34" },
        "5": { "0.5": "17 - 19", "1": "18 - 20", "1.5": "19 - 21", "2": "21 - 23", "2.5": "22 - 24", "3": "23 - 25", "3.5": "24 - 26", "4": "25 - 27", "4.5": "26 - 28", "5": "27 - 29", "5.5": "28 - 30", "6": "29 - 31", "6.5": "30 - 32", "7": "31 - 33", "7.5": "32 - 34", "8": "32 - 34" },
        "5.5": { "0.5": "18 - 20", "1": "19 - 21", "1.5": "20 - 22", "2": "22 - 24", "2.5": "23 - 25", "3": "24 - 26", "3.5": "25 - 27", "4": "26 - 28", "4.5": "27 - 29", "5": "28 - 30", "5.5": "29 - 31", "6": "30 - 32", "6.5": "31 - 33", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
        "6": { "0.5": "19 - 21", "1": "20 - 22", "1.5": "21 - 23", "2": "23 - 25", "2.5": "24 - 26", "3": "25 - 27", "3.5": "26 - 28", "4": "27 - 29", "4.5": "28 - 30", "5": "29 - 31", "5.5": "30 - 32", "6": "31 - 33", "6.5": "32 - 34", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
        "6.5": { "0.5": "20 - 22", "1": "21 - 23", "1.5": "22 - 24", "2": "24 - 26", "2.5": "25 - 27", "3": "26 - 28", "3.5": "27 - 29", "4": "28 - 30", "4.5": "29 - 31", "5": "30 - 32", "5.5": "31 - 33", "6": "32 - 34", "6.5": "32 - 34", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
        "7": { "0.5": "21 - 23", "1": "22 - 24", "1.5": "23 - 25", "2": "25 - 27", "2.5": "26 - 28", "3": "27 - 29", "3.5": "28 - 30", "4": "29 - 31", "4.5": "30 - 32", "5": "31 - 33", "5.5": "32 - 34", "6": "32 - 34", "6.5": "32 - 34", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
        "7.5": { "0.5": "22 - 24", "1": "23 - 25", "1.5": "24 - 26", "2": "26 - 28", "2.5": "27 - 29", "3": "28 - 30", "3.5": "29 - 31", "4": "30 - 32", "4.5": "31 - 33", "5": "32 - 34", "5.5": "32 - 34", "6": "32 - 34", "6.5": "32 - 34", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
        "8": { "0.5": "23 - 25", "1": "24 - 26", "1.5": "25 - 27", "2": "27 - 29", "2.5": "28 - 30", "3": "29 - 31", "3.5": "30 - 32", "4": "31 - 33", "4.5": "32 - 34", "5": "32 - 34", "5.5": "32 - 34", "6": "32 - 34", "6.5": "32 - 34", "7": "32 - 34", "7.5": "32 - 34", "8": "32 - 34" },
      };

      const turns = turnsTable[width]?.[height];
      if (!turns) {
        return "Invalid dimensions. Please enter values to the nearest 0.1m.";
      }

      let min, max;
      if (turns.includes("-")) {
        [min, max] = turns.split(" - ").map(Number);
      } else {
        min = max = Number(turns);
      }

      if (values.heavyDutyBar) {
        min += 3;
        max += 3;
      }

      const mainTurns = min === max ? `${min}` : `${min} - ${max}`;
      let output = `ZipTrack Needs ${mainTurns} Turns on the Spring`;

      if (values.secondSpring) {
        const avg = (min + max) / 2;
        const second = Math.round(avg / 2);
        const secondRangeMin = second - 1;
        const secondRangeMax = second + 1;
        const secondTurns = secondRangeMin === secondRangeMax ? `${secondRangeMin}` : `${secondRangeMin} - ${secondRangeMax}`;
        output = `ZipTrack Needs ${mainTurns} Turns on the main Spring and ${secondTurns} on the 2nd Spring`;
      }

      return output;
    },
  },

  {
    id: "stockOptimiser",
    native: true,
    category: "manufacturing",
    icon: "\u{1F4E6}",
    title: "Stock Optimiser",
    description: "Optimise how to cut required lengths from multiple stock lengths. Enter stock sources with max quantities and the required cuts.",
    inputs: [
      { id: "stockSourcesInput", label: "Stock sources (rows of length + max qty):", type: "rows", rowFields: ["length", "qty", "preferred"] },
      { id: "cutsInput", label: "Cuts (rows of length + qty):", type: "rows", rowFields: ["length", "qty"] },
    ],
    calculate(values) {
      const stockSources = [];
      if (Array.isArray(values.stockSourcesInput)) {
        for (const row of values.stockSourcesInput) {
          const length = Number(row.width);
          const qty = row.qty !== undefined ? Number(row.qty) : 1;
          const preferred = row.preferred === true || row.preferred === "true" || row.preferred === 1;
          if (!Number.isFinite(length) || !Number.isFinite(qty) || length <= 0 || qty <= 0) {
            return `Invalid stock source row: ${JSON.stringify(row)}`;
          }
          stockSources.push({ length, qty, preferred });
        }
      }
      if (stockSources.length === 0) return "Enter at least one stock source.";

      const cuts = [];
      if (Array.isArray(values.cutsInput)) {
        for (const row of values.cutsInput) {
          const length = Number(row.width);
          const qty = row.qty !== undefined ? Number(row.qty) : 1;
          if (!Number.isFinite(length) || !Number.isFinite(qty) || length <= 0 || qty <= 0) {
            return `Invalid cut row: ${JSON.stringify(row)}`;
          }
          cuts.push({ length, qty });
        }
      }

      const pieces = [];
      for (const row of cuts) {
        for (let i = 0; i < row.qty; i++) pieces.push(row.length);
      }
      if (pieces.length === 0) return "No pieces parsed.";

      const stockInventory = stockSources
        .map((source) => ({ length: source.length, maxQty: source.qty, usedQty: 0, preferred: !!source.preferred }))
        .sort((a, b) => a.length - b.length);

      const sortedPieces = pieces.slice().sort((a, b) => b - a);
      const bins = [];

      for (const piece of sortedPieces) {
        let bestIndex = -1;
        let bestRem = Infinity;
        for (let i = 0; i < bins.length; i++) {
          const rem = bins[i].remaining;
          if (rem >= piece && rem - piece < bestRem) {
            bestRem = rem - piece;
            bestIndex = i;
          }
        }

        if (bestIndex >= 0) {
          bins[bestIndex].items.push(piece);
          bins[bestIndex].remaining -= piece;
          continue;
        }

        const candidateStock = stockInventory
          .filter((stock) => stock.usedQty < stock.maxQty && stock.length >= piece)
          .sort((a, b) => {
            const pa = a.preferred ? 0 : 1;
            const pb = b.preferred ? 0 : 1;
            if (pa !== pb) return pa - pb;
            const ra = a.length - piece;
            const rb = b.length - piece;
            if (ra !== rb) return ra - rb;
            return a.length - b.length;
          })[0];

        if (!candidateStock) {
          return "Not enough stock available to cut all requested pieces with the given stock sources.";
        }

        candidateStock.usedQty += 1;
        bins.push({ stockLength: candidateStock.length, remaining: candidateStock.length - piece, items: [piece] });
      }

      const totalPiecesLength = pieces.reduce((sum, len) => sum + len, 0);
      let totalWaste = 0;
      const summaryLines = [];

      bins.forEach((bin) => {
        const counts = {};
        let used = 0;
        bin.items.forEach((item) => {
          counts[item] = (counts[item] || 0) + 1;
          used += item;
        });
        const parts = Object.keys(counts).sort((a, b) => b - a).map((k) => `${k} x ${counts[k]}`).join(", ");
        totalWaste += bin.remaining;
        summaryLines.push(`Stock ${bin.stockLength}mm: ${parts}, used ${used}mm, waste ${bin.remaining}mm`);
      });

      const unusedStockLines = stockInventory
        .filter((stock) => stock.usedQty < stock.maxQty)
        .map((stock) => `${stock.length}mm x ${stock.maxQty - stock.usedQty}`);

      let out = "Stock sources used: " + stockInventory.map((stock) => `${stock.length}mm x ${stock.maxQty}`).join(", ") + "\n\n";
      out += "Cuts required: " + pieces.length + " pieces (" + totalPiecesLength + "mm total)\n\n";
      out += "Pieces allocation:\n";
      summaryLines.forEach((line) => { out += line + "\n"; });
      out += "\nTotal Waste: " + totalWaste + "mm\n";
      if (unusedStockLines.length) out += "Unused stock available: " + unusedStockLines.join(", ") + "\n";

      return out.replace(/\n/g, "<br>");
    },
  },

  {
    id: "meshOptimiser",
    native: true,
    category: "manufacturing",
    icon: "\u{1F9E9}",
    title: "Mesh Sheet Optimiser",
    description: "Optimise which stock mesh sheets to use to cut required mesh pieces. Tick available sheet sizes and list required pieces.",
    inputs: [
      { id: "sheet1200x2000", label: "Use 1200 x 2000", type: "checkbox" },
      { id: "sheet1200x2400", label: "Use 1200 x 2400", type: "checkbox" },
      { id: "sheet1500x2000", label: "Use 1500 x 2000", type: "checkbox" },
      { id: "piecesInput", label: "Pieces (rows of width + height + qty):", type: "rows", rowFields: ["width", "height", "qty"] },
    ],
    calculate(values) {
      const sheetSizes = [];
      if (values.sheet1200x2000) sheetSizes.push({ w: 1200, h: 2000 });
      if (values.sheet1200x2400) sheetSizes.push({ w: 1200, h: 2400 });
      if (values.sheet1500x2000) sheetSizes.push({ w: 1500, h: 2000 });
      if (sheetSizes.length === 0) return "Select at least one stock sheet size.";

      const pieces = [];
      if (Array.isArray(values.piecesInput)) {
        for (const row of values.piecesInput) {
          const w = Number(row.width);
          const h = Number(row.height);
          const qty = row.qty !== undefined ? Number(row.qty) : 1;
          if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(qty) || w <= 0 || h <= 0 || qty <= 0) {
            return `Invalid row: ${JSON.stringify(row)}`;
          }
          for (let i = 0; i < qty; i++) pieces.push(new Piece(w, h, `${w} x ${h}`));
        }
      }
      if (pieces.length === 0) return "Enter at least one piece.";

      for (const piece of pieces) {
        const fits = sheetSizes.some((size) => (piece.w <= size.w && piece.h <= size.h) || (piece.h <= size.w && piece.w <= size.h));
        if (!fits) return `Piece ${piece.label} will not fit any selected stock sheet.`;
      }

      let sheets;
      try {
        sheets = packPieces(pieces, sheetSizes);
      } catch (err) {
        return err.message;
      }

      let output = "";
      output += `Sheets used: ${sheets.length}<br><br>`;
      sheets.forEach((sheet, index) => {
        output += `Sheet ${index + 1}: ${sheet.width} x ${sheet.height}<br>`;
        const counts = {};
        sheet.items.forEach((item) => { counts[item.label] = (counts[item.label] || 0) + 1; });
        Object.keys(counts).forEach((label) => { output += `${label} x ${counts[label]}<br>`; });
        output += "<br>";
      });

      return output;
    },
  },
];
