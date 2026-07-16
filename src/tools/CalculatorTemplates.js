/**
 * CalculatorTemplates
 * -------------------
 * Workshop Tools phase — "Templates... users should not need to begin
 * from an empty page." Each template is a starting point for the
 * Calculator Builder: a couple of inputs, one or two outputs with a real
 * working formula already filled in (see `ToolFormula.js`), ready to run
 * as-is or adjust. Picking one *fills in* the Builder's own form —
 * it doesn't hand back a special "templated" calculator type; the
 * result is a completely ordinary custom calculator, indistinguishable
 * from one built from a blank form.
 */
export const CALCULATOR_TEMPLATES = [
  {
    id: "basicFormula",
    label: "Basic formula",
    description: "One or two numbers in, one formula out.",
    icon: "\u{1F9EE}",
    build: () => ({
      title: "New Calculator",
      description: "",
      icon: "\u{1F9EE}",
      inputs: [
        { id: "a", label: "Value A", type: "number", default: 0 },
        { id: "b", label: "Value B", type: "number", default: 0 },
      ],
      outputs: [{ id: "result", label: "Result", formula: "a + b", unit: "" }],
    }),
  },
  {
    id: "materialCalculator",
    label: "Material calculator",
    description: "How much material to order, including wastage.",
    icon: "\u{1F9F1}",
    build: () => ({
      title: "Material Needed",
      description: "How much material to order for a job, with a wastage allowance.",
      icon: "\u{1F9F1}",
      inputs: [
        { id: "length", label: "Length", type: "number", default: 0, unit: "m" },
        { id: "width", label: "Width", type: "number", default: 0, unit: "m" },
        { id: "wastagePercent", label: "Wastage Allowance", type: "number", default: 10, unit: "%" },
      ],
      outputs: [
        { id: "baseArea", label: "Base Area", formula: "length * width", unit: "m\u00B2" },
        { id: "withWastage", label: "Order This Much", formula: "(length * width) * (1 + wastagePercent / 100)", unit: "m\u00B2" },
      ],
    }),
  },
  {
    id: "areaCalculator",
    label: "Area calculator",
    description: "Width x height, and the same in a bigger unit.",
    icon: "\u25FB\uFE0F",
    build: () => ({
      title: "Area Calculator",
      description: "Area from a width and height.",
      icon: "\u25FB\uFE0F",
      inputs: [
        { id: "width", label: "Width", type: "number", default: 0, unit: "mm" },
        { id: "height", label: "Height", type: "number", default: 0, unit: "mm" },
      ],
      outputs: [
        { id: "areaMm", label: "Area", formula: "width * height", unit: "mm\u00B2" },
        { id: "areaM", label: "Area", formula: "(width * height) / 1000000", unit: "m\u00B2" },
      ],
    }),
  },
  {
    id: "percentageCalculator",
    label: "Percentage calculator",
    description: "A percentage of a value, and the value plus or minus it.",
    icon: "\u{1F4CA}",
    build: () => ({
      title: "Percentage Calculator",
      description: "A percentage of a value, and the value adjusted by it.",
      icon: "\u{1F4CA}",
      inputs: [
        { id: "value", label: "Value", type: "number", default: 0 },
        { id: "percent", label: "Percentage", type: "number", default: 10, unit: "%" },
      ],
      outputs: [
        { id: "portion", label: "Portion", formula: "value * (percent / 100)", unit: "" },
        { id: "plus", label: "Value Plus Percentage", formula: "value * (1 + percent / 100)", unit: "" },
        { id: "minus", label: "Value Minus Percentage", formula: "value * (1 - percent / 100)", unit: "" },
      ],
    }),
  },
  {
    id: "conversionCalculator",
    label: "Conversion calculator",
    description: "Convert a value using a fixed factor (e.g. mm to inches).",
    icon: "\u{1F504}",
    build: () => ({
      title: "Unit Conversion",
      description: "Convert millimetres to inches (edit the formula for a different conversion).",
      icon: "\u{1F504}",
      inputs: [{ id: "value", label: "Value (mm)", type: "number", default: 0 }],
      outputs: [{ id: "converted", label: "Value (inches)", formula: "value / 25.4", unit: "in" }],
    }),
  },
  {
    id: "timeCalculator",
    label: "Time calculator",
    description: "Hours and a rate, turned into a total.",
    icon: "\u23F1\uFE0F",
    build: () => ({
      title: "Time & Cost Calculator",
      description: "Hours worked at a given rate, turned into a total cost.",
      icon: "\u23F1\uFE0F",
      inputs: [
        { id: "hours", label: "Hours", type: "number", default: 0 },
        { id: "minutes", label: "Minutes", type: "number", default: 0 },
        { id: "rate", label: "Rate per Hour", type: "number", default: 0 },
      ],
      outputs: [
        { id: "totalHours", label: "Total Hours", formula: "hours + minutes / 60", unit: "hr" },
        { id: "totalCost", label: "Total Cost", formula: "(hours + minutes / 60) * rate", unit: "" },
      ],
    }),
  },
];
