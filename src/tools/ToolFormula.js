/**
 * ToolFormula
 * -----------
 * Workshop Tools phase — "Calculator Builder... formula editor... the
 * goal is not to build a programming environment." The Workshop's
 * *native* calculators (`NativeCalculators.js`, ported from a real
 * external application) each have a genuine, hand-written JavaScript
 * `calculate(values)` function — real branching logic a security-door
 * business actually depends on, which is exactly why those stay
 * hand-written code, not something a form could have produced.
 *
 * A calculator someone builds *from inside the Workshop*, through the
 * Calculator Builder, is a different, deliberately smaller thing: one
 * arithmetic expression per output, referencing input values by name.
 * This file is the whole of that arithmetic language — a small,
 * hand-rolled tokenizer and recursive-descent evaluator, never
 * `eval()` or `new Function()`. That's not a caution so much as a
 * consequence of the brief's own scope: a real expression language
 * would need variables, branching, and functions defined in terms of
 * each other to be worth calling "code," and none of that is what
 * "let a useful practical calculator become a Workshop asset" is
 * actually asking for. What's here is deliberately just enough for
 * "Basic formula," "Area," "Percentage," "Conversion," and "Time"
 * templates to be real, working calculators — see
 * `NativeCalculators.js`'s own `CALCULATOR_TEMPLATES` for those.
 *
 * Supported grammar, entirely arithmetic:
 *   expression := term (('+' | '-') term)*
 *   term       := power (('*' | '/') power)*
 *   power      := unary ('^' unary)*
 *   unary      := ('-' | '+')? primary
 *   primary    := number | identifier | identifier '(' args ')' | '(' expression ')'
 *   args       := expression (',' expression)*
 *
 * Identifiers resolve against the `variables` object passed to
 * `evaluateFormula()` (a calculator's own input values, by id) or one of
 * a small, fixed whitelist of functions — nothing else is reachable, so
 * a formula can't do anything but arithmetic on the numbers it was
 * given.
 */

const FUNCTIONS = {
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  abs: (x) => Math.abs(x),
  sqrt: (x) => Math.sqrt(x),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j++;
      const text = source.slice(i, j);
      if (!/^\d*\.?\d+$/.test(text) && !/^\d+\.?\d*$/.test(text)) {
        throw new Error(`Invalid number "${text}"`);
      }
      tokens.push({ type: "number", value: Number(text) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[a-zA-Z0-9_]/.test(source[j])) j++;
      tokens.push({ type: "identifier", value: source.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      tokens.push({ type: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in formula`);
  }
  return tokens;
}

/** A single, straightforward recursive-descent parser+evaluator in one
 *  pass — a formula is evaluated once per run, so there's no real
 *  benefit to building a separate AST just to walk it immediately
 *  afterward. */
class FormulaEvaluator {
  constructor(tokens, variables) {
    this.tokens = tokens;
    this.pos = 0;
    this.variables = variables;
  }

  peek() {
    return this.tokens[this.pos];
  }

  next() {
    return this.tokens[this.pos++];
  }

  expect(type) {
    const token = this.next();
    if (!token || token.type !== type) {
      throw new Error(`Expected "${type}" in formula`);
    }
    return token;
  }

  run() {
    const value = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected "${this.peek().type}" after end of formula`);
    }
    return value;
  }

  parseExpression() {
    let value = this.parseTerm();
    while (this.peek() && (this.peek().type === "+" || this.peek().type === "-")) {
      const op = this.next().type;
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  parseTerm() {
    let value = this.parsePower();
    while (this.peek() && (this.peek().type === "*" || this.peek().type === "/")) {
      const op = this.next().type;
      const rhs = this.parsePower();
      if (op === "/" && rhs === 0) throw new Error("Division by zero");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  parsePower() {
    let value = this.parseUnary();
    while (this.peek() && this.peek().type === "^") {
      this.next();
      const rhs = this.parseUnary();
      value = Math.pow(value, rhs);
    }
    return value;
  }

  parseUnary() {
    if (this.peek() && (this.peek().type === "-" || this.peek().type === "+")) {
      const op = this.next().type;
      const value = this.parseUnary();
      return op === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.next();
    if (!token) throw new Error("Unexpected end of formula");

    if (token.type === "number") return token.value;

    if (token.type === "(") {
      const value = this.parseExpression();
      this.expect(")");
      return value;
    }

    if (token.type === "identifier") {
      // A function call: identifier immediately followed by "(".
      if (this.peek() && this.peek().type === "(") {
        this.next();
        const args = [];
        if (this.peek() && this.peek().type !== ")") {
          args.push(this.parseExpression());
          while (this.peek() && this.peek().type === ",") {
            this.next();
            args.push(this.parseExpression());
          }
        }
        this.expect(")");
        const fn = FUNCTIONS[token.value];
        if (!fn) throw new Error(`Unknown function "${token.value}"`);
        return fn(...args);
      }
      if (!(token.value in this.variables)) {
        throw new Error(`Unknown input "${token.value}"`);
      }
      const value = Number(this.variables[token.value]);
      if (!Number.isFinite(value)) {
        throw new Error(`Input "${token.value}" is not a number`);
      }
      return value;
    }

    throw new Error(`Unexpected "${token.type}" in formula`);
  }
}

/**
 * Evaluates `formula` (a plain arithmetic expression string) against
 * `variables` (a plain object of input id -> numeric value). Throws a
 * plain `Error` with a message safe to show directly to whoever's
 * editing the calculator — every failure mode here is something a
 * formula author did (a typo, an unknown input, a stray character), not
 * an internal one.
 */
export function evaluateFormula(formula, variables) {
  const tokens = tokenize(String(formula ?? ""));
  if (tokens.length === 0) throw new Error("Formula is empty");
  return new FormulaEvaluator(tokens, variables).run();
}

/**
 * "Validation... Preview... Testing." Checks that `formula` is at least
 * syntactically sound and only references names in `knownInputIds`,
 * without needing real numbers to test it with — every declared input
 * is stood in for `1`, which is enough to catch a typo'd variable name,
 * an unknown function, or a stray operator without asking the calculator
 * author to fill in a real test case first. Returns `{ valid: true }` or
 * `{ valid: false, error: string }` — never throws.
 */
export function validateFormula(formula, knownInputIds) {
  const dummyValues = {};
  for (const id of knownInputIds) dummyValues[id] = 1;
  try {
    const result = evaluateFormula(formula, dummyValues);
    if (!Number.isFinite(result)) return { valid: false, error: "Formula does not produce a real number" };
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}
