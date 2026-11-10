"use strict";
(function () {
  const bank = globalThis.questionBank;
  if (!bank) return;
  const fmt = n => new Intl.NumberFormat("en-GB").format(n);
  const broadcasts = new Set(bank.episodes.map(e => e.match_id)).size;
  const comps = [...new Set(bank.episodes.map(e => e.competition).filter(Boolean))];
  const dates = bank.episodes.map(e => e.air_date).filter(Boolean).sort();
  const year = d => d.slice(0, 4);
  document.getElementById("about-counts").textContent =
    "It currently holds " + fmt(bank.questions.length) + " questions from " + fmt(broadcasts) + " broadcasts across " +
    comps.length + " competitions, aired between " + year(dates[0]) + " and " + year(dates[dates.length - 1]) + ".";
  document.getElementById("about-uploads").textContent = fmt(bank.episodes.length);
})();
