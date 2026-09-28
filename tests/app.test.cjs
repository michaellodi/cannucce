/* Copyright (C) 2026 Michael Lodi
 * SPDX-License-Identifier: AGPL-3.0-or-later */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

// Exercise the real application and its timers without waiting for animations.
// Browser layout, pointer input and rendering are checked separately.
function makeApp() {
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const document = { activeElement: null };
  class Element {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.style = { setProperty(key, value) { this[key] = value; } };
      this.classes = new Set();
      this.classList = {
        add: (value) => this.classes.add(value),
        remove: (value) => this.classes.delete(value),
        toggle: (value, enabled) => enabled ? this.classes.add(value) : this.classes.delete(value),
      };
      this.listeners = {};
      this._disabled = false;
    }
    set disabled(value) {
      this._disabled = value;
      if (value && document.activeElement === this) document.activeElement = document.body;
    }
    get disabled() { return this._disabled; }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
    replaceChildren(...children) {
      if (this.children.some((child) => child.contains(document.activeElement))) document.activeElement = document.body;
      this.children = children;
    }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    querySelector(selector) {
      const match = selector.match(/^\[data-id="(\d+)"\]$/);
      return this.children.find((child) => child.dataset.id === match?.[1]) ?? null;
    }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    focus() { if (!this.disabled) document.activeElement = this; }
    click() { if (!this.disabled) this.listeners.click?.(); }
    getBoundingClientRect() { return { left: elements.board.children.indexOf(this) * 100 }; }
  }
  const elements = Object.fromEntries([
    "board", "paper", "celebrationLayer", "preset", "resetButton", "resetCoveredButton",
    "checkButton", "checkLabel", "coveredHelp", "instruction", "comparisonCount", "swapCount",
  ].map((id) => [id, new Element()]));
  elements.preset.value = "random";
  document.body = new Element();
  document.activeElement = document.body;
  document.querySelector = (selector) => elements[selector.slice(1)];
  document.createElement = () => new Element();
  const context = vm.createContext({
    document,
    window: {
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
      clearTimeout(id) { timers.delete(id); },
      requestAnimationFrame(callback) { callback(); },
    },
  });
  const run = (code) => vm.runInContext(code, context);
  function advance(duration = 2000) {
    const end = now + duration;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  }
  run(`let testRandomSeed = 123456789;
    Math.random = () => {
      testRandomSeed = (Math.imul(1664525, testRandomSeed) + 1013904223) >>> 0;
      return testRandomSeed / 4294967296;
    };`);
  run(source);
  return {
    elements, document, run, advance,
    get state() { return JSON.parse(run("JSON.stringify(state)")); },
    setOrder(order, covered = false) {
      run(`resetGame(${covered}); state.order = ${JSON.stringify(order)}.map((rank) => ({
        id: rank, height: STRAW_LENGTHS[rank - 1], ...STRAW_COLORS[rank - 1]
      })); render();`);
    },
    choose(left, right) {
      elements.board.children[left].click();
      elements.board.children[right].click();
    },
    compare(left, right) { this.choose(left, right); advance(); },
  };
}

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map((rest) => [value, ...rest]));
}
const allOrders = permutations([1, 2, 3, 4, 5]);
const ranks = (app) => app.state.order.map((straw) => straw.id);

test("all 120 orders, all 10 pairs, both selection directions and modes obey compare-and-swap", () => {
  const app = makeApp();
  for (const covered of [false, true]) {
    for (const order of allOrders) {
      for (let left = 0; left < 4; left += 1) {
        for (let right = left + 1; right < 5; right += 1) {
          for (const backwards of [false, true]) {
            app.setOrder(order, covered);
            app.compare(backwards ? right : left, backwards ? left : right);
            const expected = [...order];
            const swapped = order[left] > order[right];
            if (swapped) [expected[left], expected[right]] = [expected[right], expected[left]];
            assert.deepEqual(ranks(app), expected);
            assert.equal(app.state.comparisons, 1);
            assert.equal(app.state.swaps, Number(swapped));
            assert.equal(app.state.isComparing, false);
            assert.deepEqual(app.state.selectedIds, []);
            assert.equal(app.state.isCovered, covered);
          }
        }
      }
    }
  }
});

test("both guide strategies sort every permutation in both modes", () => {
  const app = makeApp();
  for (const strategy of ["bubble", "fixed-position"]) {
    for (const covered of [false, true]) {
      for (const order of allOrders) {
        app.setOrder(order, covered);
        if (strategy === "bubble") {
          let changed;
          do {
            const before = app.state.swaps;
            for (let index = 0; index < 4; index += 1) app.compare(index, index + 1);
            changed = before !== app.state.swaps;
            assert.ok(app.state.comparisons <= 20, "bubble strategy must terminate within 5 full passes");
          } while (changed);
        } else {
          for (let left = 0; left < 4; left += 1) {
            for (let right = left + 1; right < 5; right += 1) app.compare(left, right);
          }
          assert.equal(app.state.comparisons, 10);
        }
        assert.deepEqual(ranks(app), [1, 2, 3, 4, 5]);
        app.elements.checkButton.click();
        assert.equal(app.elements.checkButton.dataset.state, "success");
        assert.equal(app.state.isFinished, covered);
      }
    }
  }
});

test("revealing a covered attempt always reveals all lengths and ends it", () => {
  const app = makeApp();
  for (const order of [[1, 2, 3, 4, 5], [5, 4, 3, 2, 1]]) {
    app.setOrder(order, true);
    app.elements.board.children[0].click();
    app.elements.checkButton.click();
    const ended = app.state;
    assert.equal(ended.isFinished, true);
    assert.equal(ended.isCovered, false);
    assert.equal(ended.isCoveredGame, true);
    assert.deepEqual(ended.selectedIds, []);
    assert.equal(app.elements.paper.classes.has("visible"), false);
    assert.equal(app.elements.checkButton.disabled, true);
    assert.ok(app.elements.board.children.every((button) => button.disabled));
    assert.equal(new Set(app.elements.board.children.map((button) => button.children[0].children[0].style["--straw-height"])).size, 5);
    // Neither clicks nor stale/direct action handlers can continue this attempt.
    app.choose(0, 4);
    app.run("handleSelection(state.order[0].id); handleSelection(state.order[4].id); checkOrder(); compareSelectedPair();");
    app.advance();
    assert.deepEqual(app.state, ended);
    app.elements.resetCoveredButton.click();
    assert.equal(app.state.isCovered, true);
    assert.equal(app.state.isFinished, false);
    assert.equal(app.state.comparisons, 0);
    assert.equal(app.state.swaps, 0);
    assert.equal(app.elements.checkButton.disabled, false);
  }
});

test("hidden rendering exposes no length through heights, patterns or accessible names", () => {
  const app = makeApp();
  app.setOrder([5, 2, 4, 1, 3], true);
  const buttons = app.elements.board.children;
  assert.equal(new Set(buttons.map((button) => button.children[0].children[0].style["--straw-height"])).size, 1);
  assert.ok(buttons.every((button) => button.attributes["aria-label"].endsWith("lunghezza nascosta")));
  assert.equal(app.elements.checkLabel.textContent, "Scopri e termina");
  assert.equal(app.elements.coveredHelp.hidden, false);
});

test("checking and selecting cannot interrupt a pending comparison or swap", () => {
  const app = makeApp();
  app.setOrder([5, 4, 3, 2, 1], true);
  app.choose(0, 4);
  for (const elapsed of [0, 420]) {
    app.advance(elapsed);
    assert.equal(app.elements.checkButton.disabled, true);
    assert.ok(app.elements.board.children.every((button) => button.disabled));
    app.run("checkOrder(); handleSelection(state.order[2].id);");
    assert.equal(app.state.isCovered, true);
    assert.equal(app.state.isFinished, false);
  }
  app.advance();
  assert.equal(app.state.comparisons, 1);
  assert.equal(app.state.swaps, 1);
  assert.equal(app.elements.checkButton.disabled, false);
});

test("reset cancels old comparisons, animation completions and celebrations", () => {
  const app = makeApp();
  for (const elapsed of [100, 500]) {
    app.setOrder([5, 4, 3, 2, 1], true);
    app.choose(0, 4);
    app.advance(elapsed);
    app.setOrder([5, 4, 3, 2, 1], true);
    app.advance(50);
    app.choose(0, 4);
    app.advance(369);
    assert.equal(app.state.comparisons, 0, "old comparison must not act on new selection");
    assert.equal(app.state.isComparing, true);
    app.advance(51);
    assert.equal(app.state.comparisons, 1);
    app.advance(400);
    assert.equal(app.state.isComparing, true, "old animation must not unlock a new comparison");
    app.advance(350);
    assert.equal(app.state.isComparing, false);
    assert.deepEqual(ranks(app), [1, 4, 3, 2, 5]);
  }
  app.setOrder([1, 2, 3, 4, 5], true);
  app.elements.checkButton.click();
  app.advance(200);
  app.elements.resetCoveredButton.click();
  assert.equal(app.elements.celebrationLayer.children.length, 0);
  assert.equal(app.run("pendingTimers.size"), 0);
});

test("new attempts regenerate all straws and colour associations; presets remain valid", () => {
  const app = makeApp();
  const associations = new Set();
  for (const preset of ["random", "almost", "reversed"]) {
    app.elements.preset.value = preset;
    for (let count = 0; count < 100; count += 1) {
      app.run("globalThis.oldStraws = [...state.order]; resetGame(true);");
      assert.equal(app.run("state.order.some((straw) => oldStraws.includes(straw))"), false);
      const straws = app.state.order;
      assert.equal(new Set(straws.map((straw) => straw.color)).size, 5);
      assert.equal(new Set(straws.map((straw) => straw.height)).size, 5);
      associations.add([...straws].sort((a, b) => a.height - b.height).map((straw) => straw.color).join());
      assert.equal(app.run("isSorted()"), false, `The ${preset} preset must always start unsorted`);
      if (preset === "reversed") assert.deepEqual(ranks(app), [5, 4, 3, 2, 1]);
      if (preset === "almost") {
        const inversions = straws.flatMap((left, index) => straws.slice(index + 1).filter((right) => left.height > right.height)).length;
        assert.equal(inversions, 1);
      }
    }
  }
  assert.ok(associations.size > 20);
  app.elements.checkButton.click();
  app.elements.preset.listeners.change();
  assert.equal(app.state.isCovered, true, "changing preset after reveal starts a fresh covered attempt");
  assert.equal(app.state.isFinished, false);
});

test("repeating a visible success check restarts its celebration without an old timeout cutting it off", () => {
  const app = makeApp();
  app.setOrder([1, 2, 3, 4, 5]);
  app.elements.checkButton.click();
  app.advance(1000);
  app.elements.checkButton.click();
  app.advance(300);
  assert.equal(app.elements.celebrationLayer.classes.has("active"), true);
  app.advance(1000);
  assert.equal(app.elements.celebrationLayer.classes.has("active"), false);
  assert.equal(app.elements.celebrationLayer.children.length, 0);
});

test("selection can be undone and keyboard focus survives rendering and comparison", () => {
  const app = makeApp();
  app.setOrder([5, 4, 3, 2, 1]);
  app.elements.board.children[0].focus();
  app.elements.board.children[0].click();
  assert.equal(app.document.activeElement.dataset.id, "5");
  assert.equal(app.document.activeElement.attributes["aria-pressed"], "true");
  app.document.activeElement.click();
  assert.deepEqual(app.state.selectedIds, []);
  assert.equal(app.document.activeElement.dataset.id, "5");
  app.document.activeElement.click();
  app.elements.board.children[4].focus();
  app.elements.board.children[4].click();
  app.advance();
  assert.equal(app.document.activeElement.dataset.id, "1");
  assert.equal(app.document.activeElement.attributes["aria-pressed"], "false");
  assert.equal(app.state.comparisons, 1);

  app.setOrder([5, 4, 3, 2, 1]);
  app.elements.board.children[0].focus();
  app.choose(0, 4);
  app.elements.resetButton.focus();
  app.advance();
  assert.equal(app.document.activeElement, app.elements.resetButton, "comparison must not steal focus from another control");
});

test("uncovered checks preserve visible practice and covered/visible resets choose the requested mode", () => {
  const app = makeApp();
  app.setOrder([5, 4, 3, 2, 1]);
  app.elements.checkButton.click();
  assert.equal(app.elements.checkButton.dataset.state, "failure");
  assert.equal(app.state.isFinished, false);
  app.compare(0, 4);
  assert.equal(app.state.comparisons, 1);
  app.elements.resetCoveredButton.click();
  assert.equal(app.state.isCovered, true);
  app.elements.resetButton.click();
  assert.equal(app.state.isCovered, false);
  assert.equal(app.state.isCoveredGame, false);
  assert.equal(app.elements.coveredHelp.hidden, true);
  assert.equal(app.elements.checkLabel.textContent, "Controlla");
});
