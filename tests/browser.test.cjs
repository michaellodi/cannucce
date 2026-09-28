/* Copyright (C) 2026 Michael Lodi
 * SPDX-License-Identifier: AGPL-3.0-or-later */
// Run: node tests/browser.test.cjs [--engine=firefox|--engine=webkit]
// Defaults to installed Chrome, like the companion gruccia browser tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(path.join(path.dirname(process.execPath), "../node_modules/playwright"));
}

const url = pathToFileURL(path.join(__dirname, "../index.html")).href;

test("real browser layout, comparisons, keyboard and touch", async (t) => {
  const engine = process.argv.find((arg) => arg.startsWith("--engine="))?.split("=")[1] || "chromium";
  assert.ok(["chromium", "firefox", "webkit"].includes(engine), `Unsupported engine: ${engine}`);
  const browser = await playwright[engine].launch({
    headless: true,
    ...(engine === "chromium" ? { channel: process.env.BROWSER_CHANNEL || "chrome" } : {}),
  });
  const errors = [];
  const watchErrors = (page) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  };
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  watchErrors(page);
  const reset = async (covered = true) => {
    await page.goto(url);
    await page.locator("#preset").selectOption("reversed");
    if (covered) await page.locator("#resetCoveredButton").click();
  };

  try {
    await t.test("open and covered layouts fit 320–1440 px and hide every length", async () => {
      await reset(false);
      for (const covered of [false, true]) {
        if (covered) await page.locator("#resetCoveredButton").click();
        for (const width of [1440, 768, 360, 320]) {
          await page.setViewportSize({ width, height: 1000 });
          const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
          assert.ok(dimensions.document <= dimensions.viewport + 1, `Overflow at ${width}px, covered=${covered}`);
          if (covered) {
            const drawings = await page.evaluate(() => {
              const cover = document.querySelector("#paper").getBoundingClientRect();
              return [...document.querySelectorAll(".straw")].map((element) => {
                const rect = element.getBoundingClientRect();
                return { height: rect.height, endHidden: rect.top >= cover.top && rect.top < cover.bottom, tipVisible: rect.bottom > cover.bottom };
              });
            });
            assert.equal(new Set(drawings.map((drawing) => drawing.height)).size, 1);
            assert.ok(drawings.every((drawing) => drawing.endHidden && drawing.tipVisible), `Paper coverage at ${width}px`);
            for (const name of await page.locator(".strawButton").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))) {
              assert.match(name, /lunghezza nascosta$/);
            }
          }
        }
      }
      await page.setViewportSize({ width: 1280, height: 1000 });
    });

    await t.test("pointer selection follows left-to-right positions and failed reveal ends the attempt", async () => {
      await reset();
      await page.locator(".strawButton").nth(4).click();
      await page.locator(".strawButton").nth(0).click();
      assert.equal(await page.locator("#checkButton").isDisabled(), true);
      await page.waitForFunction(() => !state.isComparing);
      assert.equal(await page.locator("#comparisonCount").textContent(), "Confronti: 1");
      assert.equal(await page.locator("#swapCount").textContent(), "Scambi: 1");
      assert.deepEqual(await page.evaluate(() => state.order.map((straw) => straw.height)), [205, 310, 275, 240, 345]);
      await page.locator("#checkButton").click();
      assert.equal(await page.locator(".strawButton:disabled").count(), 5);
      assert.equal(await page.locator("#checkButton").isDisabled(), true);
      assert.equal(await page.locator("#paper").isVisible(), false);
      assert.match(await page.locator("#instruction").textContent(), /non sono ancora in ordine.*Tentativo concluso/);
    });

    await t.test("new game cancels pending actions and keyboard focus survives selection and swapping", async () => {
      await reset();
      await page.locator(".strawButton").nth(0).click();
      await page.locator(".strawButton").nth(1).click();
      await page.locator("#resetCoveredButton").click();
      await page.waitForTimeout(1300);
      assert.equal(await page.locator("#comparisonCount").textContent(), "Confronti: 0");
      assert.equal(await page.locator(".strawButton:disabled").count(), 0);
      const first = page.locator(".strawButton").nth(0);
      await first.focus();
      const firstId = await first.getAttribute("data-id");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement.dataset.id), firstId);
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".strawButton.selected").count(), 0);
      await page.keyboard.press("Enter");
      const last = page.locator(".strawButton").nth(4);
      await last.focus();
      const lastId = await last.getAttribute("data-id");
      await page.keyboard.press("Space");
      await page.waitForFunction(() => !state.isComparing);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.id), lastId);
      assert.equal(await page.locator("#comparisonCount").textContent(), "Confronti: 1");
    });

    await t.test("the guide's ten-comparison strategy succeeds and changing preset starts a fresh covered attempt", async () => {
      await reset();
      for (let left = 0; left < 4; left += 1) {
        for (let right = left + 1; right < 5; right += 1) {
          await page.locator(".strawButton").nth(left).click();
          await page.locator(".strawButton").nth(right).click();
          await page.waitForFunction(() => !state.isComparing);
        }
      }
      assert.equal(await page.locator("#comparisonCount").textContent(), "Confronti: 10");
      await page.locator("#checkButton").click();
      assert.match(await page.locator("#instruction").textContent(), /Bravissimi.*Tentativo concluso/);
      assert.equal(await page.locator(".strawButton:disabled").count(), 5);
      await page.locator("#preset").selectOption("almost");
      assert.equal(await page.locator("#paper").isVisible(), true);
      assert.equal(await page.locator("#comparisonCount").textContent(), "Confronti: 0");
    });

    await t.test("390 px touch taps compare a pair and revealing ends the attempt", async () => {
      // hasTouch works in all three engines; Firefox does not support isMobile.
      const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      watchErrors(touchPage);
      try {
        await touchPage.goto(url);
        await touchPage.locator("#preset").selectOption("reversed");
        await touchPage.locator("#resetCoveredButton").tap();
        await touchPage.locator(".strawButton").nth(4).tap();
        await touchPage.locator(".strawButton").nth(0).tap();
        await touchPage.waitForFunction(() => !state.isComparing);
        assert.equal(await touchPage.locator("#comparisonCount").textContent(), "Confronti: 1");
        assert.equal(await touchPage.locator("#swapCount").textContent(), "Scambi: 1");
        assert.deepEqual(await touchPage.evaluate(() => state.order.map((straw) => straw.height)), [205, 310, 275, 240, 345]);
        await touchPage.locator("#checkButton").tap();
        assert.equal(await touchPage.locator("#paper").isVisible(), false);
        assert.equal(await touchPage.locator(".strawButton:disabled").count(), 5);
        assert.equal(await touchPage.locator("#checkButton").isDisabled(), true);
        assert.match(await touchPage.locator("#instruction").textContent(), /Tentativo concluso/);
      } finally {
        await touchPage.close();
      }
    });

    assert.deepEqual(errors, [], "No uncaught errors or console errors");
  } finally {
    await browser.close();
  }
});
