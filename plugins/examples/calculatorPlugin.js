import { wrapPage } from "../../browser/PageShell.js";

/**
 * calculatorPlugin
 * ------------------
 * "plugin://calculator... plugins should naturally integrate into
 * Browser navigation without requiring hardcoded support." A second
 * example plugin, deliberately more than a reference stub — a genuinely
 * working four-function calculator, entirely self-contained inside the
 * page's own `<script>` tag (the same technique `workshop://settings`'s
 * own "Clear Browsing Data" button already uses for its one line of
 * interactivity, just more of it). No network request, no dependency on
 * anything outside this one file — a `srcdoc` page can be a real, small
 * application, not only a document to read.
 *
 * Chosen specifically over the brief's other example names
 * (`plugin://weather`, `plugin://inventory`) because it's the one that
 * can be genuinely real without either faking a live data source
 * (weather) or inventing a backing store with no natural owner yet
 * (inventory) — see `docs/BROWSER.md`'s own "Plugin Pages" section for
 * that reasoning spelled out in full.
 */
export function calculatorPlugin() {
  return {
    id: "example.calculator",
    name: "Calculator",
    pages: ["plugin://calculator"],

    providePages(pageRegistry) {
      pageRegistry.register("plugin://calculator", () => calculatorPage());
    },
  };
}

function calculatorPage() {
  const buttons = ["7", "8", "9", "\u00f7", "4", "5", "6", "\u00d7", "1", "2", "3", "\u2212", "0", ".", "=", "+"];
  const buttonHtml = buttons
    .map((label) => `<button class="calc-btn${"+\u2212\u00d7\u00f7=".includes(label) ? " calc-btn-op" : ""}" data-key="${escapeHtml(label)}">${escapeHtml(label)}</button>`)
    .join("");

  const html = `
    <span class="workshop-page-badge">Plugin Page</span>
    <h1>Calculator</h1>
    <p class="workshop-page-subtitle">A real, working plugin page \u2014 not a mockup. Try it.</p>

    <div class="calc-widget">
      <div class="calc-display" id="calc-display">0</div>
      <div class="calc-grid">
        <button class="calc-btn calc-btn-clear" data-key="C">C</button>
        ${buttonHtml}
      </div>
    </div>

    <p style="margin-top:24px;"><a href="plugin://example-plugin">See how this page got here \u2192</a></p>

    <script>
      (function () {
        const display = document.getElementById("calc-display");
        let expression = "";

        function render() {
          display.textContent = expression || "0";
        }

        function toEvaluable(expr) {
          return expr.replace(/\\u00f7/g, "/").replace(/\\u00d7/g, "*").replace(/\\u2212/g, "-");
        }

        document.querySelectorAll(".calc-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.key;
            if (key === "C") {
              expression = "";
            } else if (key === "=") {
              try {
                // A plugin page's own srcdoc content is Workshop-authored
                // (this exact file), not third-party or player-supplied
                // text \u2014 the same trust level every other workshop://
                // page's inline <script> already runs at, not a general
                // eval sandbox for arbitrary input.
                const result = Function('"use strict"; return (' + toEvaluable(expression) + ")")();
                expression = Number.isFinite(result) ? String(result) : "Error";
              } catch {
                expression = "Error";
              }
            } else {
              expression = expression === "Error" ? key : expression + key;
            }
            render();
          });
        });

        render();
      })();
    </script>
  `;
  return { title: "Calculator", html: wrapPage("Calculator", html) };
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
