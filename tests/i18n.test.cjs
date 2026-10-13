/* Copyright (C) 2026 Michael Lodi
 * SPDX-License-Identifier: AGPL-3.0-or-later */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(path.dirname(process.execPath), "../node_modules/playwright")); }
const url = pathToFileURL(path.join(__dirname, "../index.html")).href;

test("language detection, persistence, mobile layout and live switching", async (suite) => {
  const browser = await playwright.chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : { channel: process.env.BROWSER_CHANNEL || "chrome" }),
  });
  const errors = [];
  const open = async (locale = "en-GB", setup) => {
    const page = await browser.newPage({ locale, viewport: { width: 390, height: 844 }, hasTouch: true });
    page.on("pageerror", (error) => errors.push(error.message));
    if (setup) await page.addInitScript(setup);
    await page.goto(url);
    return page;
  };
  const language = (page) => page.locator("html").getAttribute("lang");
  const choose = (page, lang) => page.locator(`[data-language="${lang}"]`).tap();
  try {
    await suite.test("only a primary Italian locale selects Italian", async () => {
      for (const [locale, expected] of [["it-IT", "it"], ["it-CH", "it"], ["it", "it"], ["en-GB", "en"], ["fr-FR", "en"], ["ja-JP", "en"]]) {
        const page = await open(locale);
        assert.equal(await language(page), expected, locale);
        assert.equal(await page.locator(`[data-language="${expected}"]`).getAttribute("aria-pressed"), "true");
        await page.close();
      }
      const page = await open("fr-FR", () => Object.defineProperty(navigator, "languages", { get: () => ["fr-FR", "it-IT"] }));
      assert.equal(await language(page), "en");
      await page.close();
    });
    await suite.test("explicit language survives reload and overrides browser preference", async () => {
      const page = await open("en-GB");
      await choose(page, "it");
      await page.reload();
      assert.equal(await language(page), "it");
      await choose(page, "en");
      await page.reload();
      assert.equal(await language(page), "en");
      await page.close();
    });
    await suite.test("blocked storage and unavailable language still allow switching", async () => {
      const page = await open("it-IT", () => {
        Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage disabled"); } });
        Object.defineProperty(navigator, "languages", { get: () => [] });
        Object.defineProperty(navigator, "language", { get: () => "" });
      });
      assert.equal(await language(page), "en");
      await choose(page, "it");
      assert.equal(await language(page), "it");
      await page.close();
    });
    await suite.test("both languages fit mobile and desktop with reachable flags", async () => {
      const page = await open();
      for (const lang of ["en", "it"]) {
        await choose(page, lang);
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const alternate of [false, true]) {
            await page.evaluate((alternate) => {
              if (typeof setMode === "function") setMode(alternate ? "program" : "free");
              else resetGame(alternate);
            }, alternate);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} ${width}px alternate=${alternate}`);
          }
          await page.evaluate(() => scrollTo(0, 0));
          const bounds = await page.locator('[data-language="en"]').boundingBox();
          assert.ok(bounds.width >= 44 && bounds.height >= 44);
          assert.ok(bounds.x >= width / 2 && bounds.x + bounds.width <= width && bounds.y < 100);
        }
      }
      await page.close();
    });
    await suite.test("selection, comparison, hidden lengths and final feedback survive switching", async () => {
      const page = await open();
      await page.locator("#preset").selectOption("reversed");
      await page.locator("#resetCoveredButton").tap();
      assert.equal(await page.locator("#checkLabel").innerText(), "Reveal and finish");
      await page.locator(".strawButton").nth(0).tap();
      const before = await page.evaluate(() => JSON.stringify({ order: state.order, selectedIds: state.selectedIds }));
      await choose(page, "it");
      assert.equal(await page.evaluate(() => JSON.stringify({ order: state.order, selectedIds: state.selectedIds })), before);
      assert.match(await page.locator("#instruction").innerText(), /Scegline ancora una/);
      await choose(page, "en");
      assert.equal(await page.locator("#instruction").innerText(), "One straw selected. Choose another.");
      for (const name of await page.locator(".strawButton").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))) {
        assert.match(name, /straw, position \d, length hidden$/);
      }
      // Hold comparison completion until both language buttons have been used.
      await page.evaluate(() => { window.originalSchedule = schedule; schedule = (callback) => { window.pendingComparison = callback; }; });
      await page.locator(".strawButton").nth(4).tap();
      assert.equal(await page.evaluate(() => state.isComparing), true);
      await choose(page, "it");
      await choose(page, "en");
      await page.evaluate(() => { schedule = window.originalSchedule; window.pendingComparison(); });
      await page.waitForFunction(() => !state.isComparing);
      assert.equal(await page.locator("#comparisonCount").innerText(), "Comparisons: 1");
      assert.equal(await page.locator("#swapCount").innerText(), "Swaps: 1");
      assert.equal(await page.locator("#instruction").innerText(), "Swapped straws 1 and 5.");
      await choose(page, "it");
      assert.equal(await page.locator("#instruction").innerText(), "Scambio fatto tra la cannuccia 1 e la cannuccia 5.");
      await choose(page, "en");
      await page.locator("#checkButton").tap();
      assert.equal(await page.locator("#checkLabel").innerText(), "Attempt finished");
      assert.match(await page.locator("#instruction").innerText(), /The straws are not sorted. Attempt finished/);
      await choose(page, "it");
      assert.equal(await page.locator(".strawButton:disabled").count(), 5);
      assert.match(await page.locator("#instruction").innerText(), /Tentativo concluso/);
      await choose(page, "en");
      await page.locator("#resetButton").tap();
      await page.evaluate(() => { state.order.sort((a, b) => a.height - b.height); render(); });
      await page.locator("#checkButton").tap();
      assert.equal(await page.locator("#instruction").innerText(), "Well done! The straws are sorted.");
      await page.close();
    });

    assert.deepEqual(errors, [], "No uncaught browser errors");
  } finally { await browser.close(); }
});
