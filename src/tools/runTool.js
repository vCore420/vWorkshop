import { evaluateFormula } from "./ToolFormula.js";

/**
 * runTool / valuesFromSnapshot
 * ----------------------------
 * The one place a tool actually gets run, for both halves of the
 * Workshop's tool library: a native calculator's own `calculate(values)`
 * function (real, hand-written JavaScript — see `NativeCalculators.js`),
 * or a custom calculator's `outputs`, each one a formula evaluated
 * through `ToolFormula.js`. `ToolsPanelView.js` calls this one function
 * either way and never needs to know which kind of tool it's holding.
 */

/** Converts a raw form snapshot (whatever the input elements currently
 *  hold — strings, booleans, row arrays) into typed values keyed by
 *  input id, the same shape either kind of calculator's own logic
 *  expects: numbers are real numbers, checkboxes are booleans, rows stay
 *  arrays, everything else stays a string. */
export function valuesFromSnapshot(inputs, snapshot) {
  const values = {};
  for (const input of inputs) {
    const raw = snapshot[input.id];
    if (input.type === "checkbox") {
      values[input.id] = Boolean(raw);
    } else if (input.type === "number") {
      values[input.id] = raw === "" || raw === undefined ? NaN : parseFloat(raw);
    } else if (input.type === "rows") {
      values[input.id] = Array.isArray(raw) ? raw : [];
    } else {
      values[input.id] = raw ?? "";
    }
  }
  return values;
}

/** Runs `tool` against `values`, returning a "<br>"-joined result string
 *  either kind of calculator can produce — the same shape
 *  `ToolsPanelView.js`'s result renderer already expects from the native
 *  calculators ported this phase. */
export function runTool(tool, values) {
  if (tool.custom) {
    const lines = [];
    for (const output of tool.outputs) {
      try {
        const result = evaluateFormula(output.formula, values);
        const rounded = Math.round(result * 100) / 100; // two decimal places — enough precision without float noise like 3.0000000000000004
        lines.push(`${output.label} = ${rounded}${output.unit ? " " + output.unit : ""}`);
      } catch (err) {
        lines.push(`${output.label}: could not calculate (${err.message})`);
      }
    }
    return lines.join("<br>");
  }
  return tool.calculate(values);
}
