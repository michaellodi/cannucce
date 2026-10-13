/* Copyright (C) 2026 Michael Lodi
 * SPDX-License-Identifier: AGPL-3.0-or-later */

const translations = {
  "it": {
    "language": "Lingua",
    "translations": "Traduzioni",
    "credits": "App creata da Michael Lodi con il pesante aiuto di ChatGPT e Claude.",
    "license": "Licenza: GNU AGPL v3 o successive. Questo programma è fornito senza garanzia.",
    "version": "Versione 0.3 del 28 settembre 2026",
    "fullLicense": "Licenza completa",
    "title": "Il barista ordinato",
    "intro": "Scegli due cannucce. Se sono fuori ordine, il sistema le scambia.",
    "chooseTwo": "Scegli due cannucce.",
    "comparisons": "Confronti: {count}",
    "swaps": "Scambi: {count}",
    "sortHint": "Metti in ordine dalla più corta alla più lunga.",
    "shortest": "più corta",
    "longest": "più lunga",
    "straws": "Cannucce",
    "paper": "foglio",
    "newGame": "Nuova partita",
    "newCoveredGame": "Nuova partita coperta",
    "check": "Controlla",
    "coveredHelp": "Quando pensi di aver finito, spiega perché le cannucce dovrebbero essere ordinate. «Scopri e termina» toglie il foglio e conclude il tentativo, anche se non sono ordinate. Per riprovare, avvia una nuova partita coperta con nuove associazioni tra colori e lunghezze.",
    "settings": "Impostazioni",
    "startOrder": "Disposizione iniziale",
    "random": "Casuale",
    "almost": "Quasi ordinata",
    "reversed": "Al contrario",
    "red": "rossa",
    "blue": "azzurra",
    "green": "verde",
    "purple": "viola",
    "yellow": "gialla",
    "finished": "Tentativo concluso",
    "reveal": "Scopri e termina",
    "hiddenLength": "lunghezza nascosta",
    "length": "lunghezza {rank} su {total}, dalla più corta alla più lunga",
    "strawLabel": "Cannuccia {color}, posizione {position}, {length}",
    "swapped": "Scambio fatto tra la cannuccia {left} e la cannuccia {right}.",
    "noSwap": "Nessuno scambio: le due cannucce erano già nell'ordine giusto.",
    "chooseAnother": "Hai scelto una cannuccia. Scegline ancora una.",
    "wonFinished": "Bravissimi: le cannucce sono in ordine. Tentativo concluso!",
    "won": "Bravissimi: le cannucce sono in ordine.",
    "unsortedFinished": "Le cannucce non sono ancora in ordine. Tentativo concluso: discuti come migliorare la strategia, poi avvia una nuova partita coperta.",
    "unsorted": "Non ancora. Prova con un altro confronto."
  },
  "en": {
    "language": "Language",
    "translations": "Translations",
    "credits": "App by Michael Lodi, with substantial help from ChatGPT and Claude.",
    "license": "License: GNU AGPL v3 or later. This program comes without warranty.",
    "version": "Version 0.3 · 28 September 2026",
    "fullLicense": "Full license",
    "title": "The tidy barista",
    "intro": "Choose two straws. If they are out of order, they swap.",
    "chooseTwo": "Choose two straws.",
    "comparisons": "Comparisons: {count}",
    "swaps": "Swaps: {count}",
    "sortHint": "Sort from shortest to longest.",
    "shortest": "shortest",
    "longest": "longest",
    "straws": "Straws",
    "paper": "paper",
    "newGame": "New game",
    "newCoveredGame": "New covered game",
    "check": "Check",
    "coveredHelp": "When you think you’re done, explain why the straws should be sorted. “Reveal and finish” removes the paper and ends the attempt, even if unsorted. Try again with a new covered game: colors and lengths are reshuffled.",
    "settings": "Settings",
    "startOrder": "Starting order",
    "random": "Random",
    "almost": "Almost sorted",
    "reversed": "Reversed",
    "red": "red",
    "blue": "light blue",
    "green": "green",
    "purple": "purple",
    "yellow": "yellow",
    "finished": "Attempt finished",
    "reveal": "Reveal and finish",
    "hiddenLength": "length hidden",
    "length": "length {rank} of {total}, shortest to longest",
    "strawLabel": "{color} straw, position {position}, {length}",
    "swapped": "Swapped straws {left} and {right}.",
    "noSwap": "No swap: the two straws were already in order.",
    "chooseAnother": "One straw selected. Choose another.",
    "wonFinished": "Well done! The straws are sorted. Attempt finished!",
    "won": "Well done! The straws are sorted.",
    "unsortedFinished": "The straws are not sorted. Attempt finished: discuss how to improve your strategy, then start a new covered game.",
    "unsorted": "Not yet. Try another comparison."
  }
};

const i18n = (() => {
  // Keep the explicit choice across both demos on the same origin.
  const storageKey = "lodi-demo-language";
  let language = "it";
  let onChange = () => {};

  function translate(key, params = {}) {
    const template = translations[language][key] ?? translations.it[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      const value = params[name];
      return value && typeof value === "object" && value.key
        ? translate(value.key, value.params)
        : value == null ? match : String(value);
    });
  }

  function apply() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-content]").forEach((element) => {
      element.setAttribute("content", translate(element.dataset.i18nContent));
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === language));
    });
  }

  function setLanguage(next) {
    if (next !== "it" && next !== "en") return;
    language = next;
    // Storage can be unavailable in private browsing or when opening a local file.
    try { localStorage.setItem(storageKey, language); } catch {}
    apply();
    onChange();
  }

  function init(callback) {
    let saved;
    try { saved = localStorage.getItem(storageKey); } catch {}
    const preferred = navigator.languages?.[0] || navigator.language || "";
    language = saved === "it" || saved === "en"
      ? saved
      : /^it(?:-|$)/i.test(preferred) ? "it" : "en";
    onChange = callback;
    apply();
    document.querySelectorAll("[data-language]").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.language));
    });
  }

  return { init, translate };
})();

function t(key, params) {
  return i18n.translate(key, params);
}
