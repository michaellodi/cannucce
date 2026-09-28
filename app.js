/*
 * Copyright (C) 2026 Michael Lodi
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * See the LICENSE file for the full license text.
 */

const STRAW_LENGTHS = [205, 240, 275, 310, 345];

const STRAW_COLORS = [
  { color: "#e1262f", label: "rossa" },
  { color: "#54b9eb", label: "azzurra" },
  { color: "#70bf44", label: "verde" },
  { color: "#7053a6", label: "viola" },
  { color: "#ffd52f", label: "gialla" },
];

const board = document.querySelector("#board");
const paper = document.querySelector("#paper");
const celebrationLayer = document.querySelector("#celebrationLayer");
const presetSelect = document.querySelector("#preset");
const resetButton = document.querySelector("#resetButton");
const resetCoveredButton = document.querySelector("#resetCoveredButton");
const checkButton = document.querySelector("#checkButton");
const checkLabel = document.querySelector("#checkLabel");
const coveredHelp = document.querySelector("#coveredHelp");
const instruction = document.querySelector("#instruction");
const comparisonCount = document.querySelector("#comparisonCount");
const swapCount = document.querySelector("#swapCount");

const state = {
  order: [],
  selectedIds: [],
  comparisons: 0,
  swaps: 0,
  isComparing: false,
  isCovered: false,
  isCoveredGame: false,
  isFinished: false,
};

const COMPARE_DELAY_MS = 420;
const SWAP_ANIMATION_MS = 700;
const pendingTimers = new Set();
let comparisonFocusId = null;
let celebrationTimer = null;

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    pendingTimers.delete(timer);
    callback();
  }, delay);
  pendingTimers.add(timer);
  return timer;
}

function cancelPendingActions() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer));
  pendingTimers.clear();
  comparisonFocusId = null;
}

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function createStraws() {
  const colors = shuffle(STRAW_COLORS);

  return STRAW_LENGTHS.map((height, index) => ({
    id: index + 1,
    height,
    color: colors[index].color,
    label: colors[index].label,
  }));
}

function buildStartOrder() {
  const base = createStraws().sort((a, b) => a.height - b.height);

  if (presetSelect.value === "almost") {
    const almost = [...base];
    const index = Math.floor(Math.random() * (almost.length - 1));
    [almost[index], almost[index + 1]] = [almost[index + 1], almost[index]];
    return almost;
  }

  if (presetSelect.value === "reversed") {
    return [...base].reverse();
  }

  const random = shuffle(base);

  return isSorted(random) ? [...random].reverse() : random;
}

function updateStats() {
  comparisonCount.textContent = `Confronti: ${state.comparisons}`;
  swapCount.textContent = `Scambi: ${state.swaps}`;
}

function setCheckState(nextState) {
  if (nextState !== "neutral") {
    checkButton.dataset.state = "neutral";
    void checkButton.offsetWidth;
  }

  checkButton.dataset.state = nextState;
}

function updatePaper() {
  paper.classList.toggle("visible", state.isCovered);
  resetButton.classList.toggle("modeActive", !state.isCoveredGame);
  resetCoveredButton.classList.toggle("modeActive", state.isCoveredGame);
  resetButton.setAttribute("aria-pressed", String(!state.isCoveredGame));
  resetCoveredButton.setAttribute("aria-pressed", String(state.isCoveredGame));
  coveredHelp.hidden = !state.isCoveredGame;
  checkButton.disabled = state.isComparing || state.isFinished;
  checkLabel.textContent = state.isFinished
    ? "Tentativo concluso"
    : state.isCoveredGame ? "Scopri e termina" : "Controlla";
}

function setInstruction(text) {
  instruction.textContent = text;
}

function render() {
  const focusedId = document.activeElement?.dataset.id;
  board.replaceChildren();
  board.setAttribute("aria-busy", String(state.isComparing));

  state.order.forEach((straw, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "strawButton";
    button.dataset.id = String(straw.id);
    const lengthLabel = state.isCovered
      ? "lunghezza nascosta"
      : `lunghezza ${STRAW_LENGTHS.indexOf(straw.height) + 1} su ${STRAW_LENGTHS.length}, dalla più corta alla più lunga`;
    button.setAttribute("aria-label", `Cannuccia ${straw.label}, posizione ${index + 1}, ${lengthLabel}`);
    button.disabled = state.isComparing || state.isFinished;
    button.setAttribute("aria-pressed", String(state.selectedIds.includes(straw.id)));

    if (state.selectedIds.includes(straw.id)) {
      button.classList.add("selected");
    }

    const frame = document.createElement("div");
    frame.className = "strawFrame";

    const strawBody = document.createElement("div");
    strawBody.className = "straw";
    // A uniform drawing keeps decorative stripes and shadows from exposing
    // the hidden length. The real height is used for comparisons and reveal.
    strawBody.style.setProperty("--straw-height", `${state.isCovered ? STRAW_LENGTHS[0] : straw.height}px`);
    strawBody.style.setProperty("--straw-color", straw.color);
    frame.appendChild(strawBody);
    button.append(frame);
    button.addEventListener("click", () => handleSelection(straw.id));
    board.appendChild(button);
  });

  updateStats();
  updatePaper();

  if (focusedId && !state.isComparing && !state.isFinished) {
    board.querySelector(`[data-id="${focusedId}"]`)?.focus({ preventScroll: true });
  }
}

function finishComparison() {
  state.isComparing = false;
  render();
  // Restore keyboard focus after disabling the pair, unless the learner has
  // meanwhile moved to another control (for example, a new-game button).
  if (comparisonFocusId && document.activeElement === document.body) {
    board.querySelector(`[data-id="${comparisonFocusId}"]`)?.focus({ preventScroll: true });
  }
  comparisonFocusId = null;
}

function launchCelebration() {
  clearCelebration();

  for (let index = 0; index < 14; index += 1) {
    const burst = document.createElement("span");
    burst.className = "partyBurst";
    burst.textContent = "🎉";
    burst.style.left = `${10 + Math.random() * 80}%`;
    burst.style.top = `${18 + Math.random() * 24}%`;
    burst.style.animationDelay = `${Math.random() * 120}ms`;
    burst.style.setProperty("--drift-x", `${-28 + Math.random() * 56}px`);
    celebrationLayer.appendChild(burst);
  }

  celebrationLayer.classList.remove("active");
  void celebrationLayer.offsetWidth;
  celebrationLayer.classList.add("active");

  celebrationTimer = schedule(() => {
    celebrationTimer = null;
    celebrationLayer.classList.remove("active");
    celebrationLayer.replaceChildren();
  }, 1300);
}

function clearCelebration() {
  window.clearTimeout(celebrationTimer);
  pendingTimers.delete(celebrationTimer);
  celebrationTimer = null;
  celebrationLayer.classList.remove("active");
  celebrationLayer.replaceChildren();
}

function animateSwap(previousOrder) {
  const previousPositions = new Map();

  previousOrder.forEach((straw) => {
    const element = board.querySelector(`[data-id="${straw.id}"]`);

    if (element) {
      previousPositions.set(straw.id, element.getBoundingClientRect());
    }
  });

  render();

  state.order.forEach((straw) => {
    const element = board.querySelector(`[data-id="${straw.id}"]`);
    const previousRect = previousPositions.get(straw.id);

    if (!element || !previousRect) {
      return;
    }

    const nextRect = element.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;

    if (Math.abs(deltaX) < 1) {
      return;
    }

    element.style.transition = "none";
    element.style.transform = `translateX(${deltaX}px)`;

    window.requestAnimationFrame(() => {
      element.style.transition = `transform ${SWAP_ANIMATION_MS}ms ease`;
      element.style.transform = "translateX(0)";
    });

    schedule(() => {
      element.style.transition = "";
      element.style.transform = "";
    }, SWAP_ANIMATION_MS + 40);
  });
}

function isPairOutOfOrder(leftStraw, rightStraw) {
  return leftStraw.height > rightStraw.height;
}

function isSorted(order = state.order) {
  for (let index = 0; index < order.length - 1; index += 1) {
    if (isPairOutOfOrder(order[index], order[index + 1])) {
      return false;
    }
  }

  return true;
}

function compareSelectedPair() {
  if (state.isFinished) {
    return;
  }
  const selected = state.order
    .map((straw, index) => ({ straw, index }))
    .filter(({ straw }) => state.selectedIds.includes(straw.id))
    .sort((a, b) => a.index - b.index);

  if (selected.length !== 2) {
    finishComparison();
    return;
  }

  state.comparisons += 1;
  setCheckState("neutral");

  const [left, right] = selected;

  if (isPairOutOfOrder(left.straw, right.straw)) {
    const previousOrder = [...state.order];
    [state.order[left.index], state.order[right.index]] = [state.order[right.index], state.order[left.index]];
    state.swaps += 1;
    setInstruction(`Scambio fatto tra la cannuccia ${left.index + 1} e la cannuccia ${right.index + 1}.`);
    state.selectedIds = [];
    animateSwap(previousOrder);
    schedule(finishComparison, SWAP_ANIMATION_MS + 50);
    return;
  } else {
    setInstruction("Nessuno scambio: le due cannucce erano già nell'ordine giusto.");
  }

  state.selectedIds = [];
  finishComparison();
}

function handleSelection(id) {
  if (state.isComparing || state.isFinished) {
    return;
  }

  setCheckState("neutral");

  if (state.selectedIds.includes(id)) {
    state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
    setInstruction("Scegli due cannucce.");
    render();
    return;
  }

  if (state.selectedIds.length === 2) {
    state.selectedIds = [];
  }

  state.selectedIds = [...state.selectedIds, id];

  if (state.selectedIds.length === 2) {
    comparisonFocusId = document.activeElement?.dataset.id ?? null;
    state.isComparing = true;
    render();
    schedule(compareSelectedPair, COMPARE_DELAY_MS);
    return;
  }

  setInstruction("Hai scelto una cannuccia. Scegline ancora una.");
  render();
}

function resetGame(covered = state.isCoveredGame) {
  cancelPendingActions();
  state.isCoveredGame = covered;
  state.isCovered = covered;
  state.isFinished = false;
  state.order = buildStartOrder();
  state.selectedIds = [];
  state.comparisons = 0;
  state.swaps = 0;
  state.isComparing = false;
  clearCelebration();
  setCheckState("neutral");
  setInstruction("Scegli due cannucce.");
  render();
}

function checkOrder() {
  if (state.isComparing || state.isFinished) {
    return;
  }

  if (state.isCoveredGame) {
    state.isCovered = false;
    state.isFinished = true;
    state.selectedIds = [];
    render();
  }

  if (isSorted()) {
    setCheckState("success");
    setInstruction(state.isFinished
      ? "Bravissimi: le cannucce sono in ordine. Tentativo concluso!"
      : "Bravissimi: le cannucce sono in ordine.");
    launchCelebration();
  } else {
    setCheckState("failure");
    setInstruction(state.isFinished
      ? "Le cannucce non sono ancora in ordine. Tentativo concluso: discuti come migliorare la strategia, poi avvia una nuova partita coperta."
      : "Non ancora. Prova con un altro confronto.");
  }
}

resetButton.addEventListener("click", () => {
  resetGame(false);
});
resetCoveredButton.addEventListener("click", () => {
  resetGame(true);
});
checkButton.addEventListener("click", checkOrder);
presetSelect.addEventListener("change", () => {
  resetGame();
});

resetGame();
