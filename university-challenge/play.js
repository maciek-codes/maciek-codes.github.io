"use strict";
// A round of real starters, read out a word at a time, each followed by the bonuses it earned on air.
const bank = globalThis.questionBank;
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const episodes = new Map(bank.episodes.map(e => [e.id, e]));
const memory = {
  read(key) { try { return localStorage.getItem("uc-play-" + key); } catch { return null; } },
  write(key, value) { try { localStorage.setItem("uc-play-" + key, value); } catch { /* private window: scores just aren't kept */ } },
};

// Starters that led to bonuses in the same broadcast, with what the teams did on the night.
const pool = [];
{
  let current = null;
  for (const q of bank.questions) {
    if (q.kind === "starter") {
      current = { q, bonuses: [] };
      if (q.attempts?.length && q.question.split(/\s+/).length >= 8) pool.push(current);
    } else if (current && current.q.video_id === q.video_id && current.bonuses.length < 3) current.bonuses.push(q);
  }
}
const playable = pool.filter(s => s.bonuses.length);

const category = get("play-category");
for (const c of [...new Set(playable.map(s => s.q.category))].sort()) {
  const n = playable.filter(s => s.q.category === c).length;
  if (n >= 40) category.add(new Option(c, c));
}
const nameInput = get("play-name");
nameInput.value = memory.read("name") || "";
function showName() { get("nameplate").textContent = nameInput.value.trim() || "You"; }
nameInput.addEventListener("input", () => { memory.write("name", nameInput.value.trim()); showName(); });
showName();

const game = { phase: "idle", list: [], at: 0, score: 0, log: [], timer: 0, words: [], shown: 0, bonusAt: 0, entry: null };
const actions = get("stage-actions");

function button(label, cls, key, run) {
  const b = el("button", label, cls); b.type = "button"; b.dataset.key = key;
  if (key) b.append(" ", el("kbd", key === " " ? "space" : key.toUpperCase()));
  b.querySelector("kbd")?.setAttribute("aria-hidden", "true");
  b.addEventListener("click", run);
  return b;
}
function setActions(...buttons) { actions.replaceChildren(...buttons); buttons[0]?.focus({ preventScroll: true }); }
function setScore(delta) {
  game.score += delta;
  const box = get("score"); box.textContent = String(game.score);
  if (delta) { box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump"); }
}
function light(on) { get("nameplate").classList.toggle("lit", on); }
function bestKey() { return "best-" + get("play-length").value + "-" + (category.value || "all"); }
function showBest() {
  const best = memory.read(bestKey());
  get("play-best").textContent = best == null ? "" : "Your best over " + get("play-length").value + " starters" + (category.value ? " of " + category.value : "") + ": " + best;
}
function onTheNight(q) {
  const right = q.attempts.find(a => a.outcome === "correct");
  const wrong = q.attempts.filter(a => a.outcome === "incorrect").length;
  const e = episodes.get(q.video_id);
  const where = [e?.competition, (e?.teams || []).join(" v ")].filter(Boolean).join(", ");
  const who = right ? [right.player, right.team].filter(Boolean).join(" of ") : "";
  return (right ? "On the night: " + (who || "one of the teams") + " got it" + (wrong ? " after " + (wrong === 1 ? "a wrong answer" : wrong + " wrong answers") : "")
    : "On the night: nobody got it") + (where ? " (" + where + ")." : ".");
}
function paint() {
  const h = get("stage-question"); h.replaceChildren();
  h.append(game.words.slice(0, game.shown).join(" "));
  if (game.phase !== "reading" && game.phase !== "buzzed" && game.shown < game.words.length) h.append(" ", el("span", game.words.slice(game.shown).join(" "), "unread"));
}

function start() {
  const wanted = Number(get("play-length").value);
  const source = playable.filter(s => !category.value || s.q.category === category.value);
  const list = [];
  const seen = new Set();
  while (list.length < Math.min(wanted, source.length)) {
    const s = source[Math.floor(Math.random() * source.length)];
    if (!seen.has(s)) { seen.add(s); list.push(s); }
  }
  Object.assign(game, { list, at: 0, score: 0, log: [] });
  get("score").textContent = "0";
  get("stage-results").hidden = true;
  get("setup").hidden = true;
  nextStarter();
}
function nextStarter() {
  if (game.at >= game.list.length) return finish();
  const s = game.list[game.at];
  game.entry = { s, starter: 0, bonus: 0, bonusRight: 0, bonusAsked: 0, early: false, result: "" };
  game.words = s.q.question.split(/\s+/); game.shown = 0; game.phase = "reading";
  get("stage-question").parentElement.classList.remove("settled");
  light(false);
  get("progress").textContent = "Starter " + (game.at + 1) + " of " + game.list.length;
  get("stage-kicker").textContent = "Starter for ten / " + s.q.category;
  get("stage-intro").hidden = true; get("stage-reveal").hidden = true;
  paint();
  setActions(button("Buzz", "buzz-big", " ", buzz));
  clearInterval(game.timer);
  game.timer = setInterval(() => {
    game.shown++; paint();
    if (game.shown >= game.words.length) {
      clearInterval(game.timer);
      if (game.phase === "reading") actions.append(button("Pass", "btn", "p", pass));
    }
  }, Number(get("play-speed").value));
}
function buzz() {
  if (game.phase !== "reading") return;
  clearInterval(game.timer);
  game.entry.early = game.shown < game.words.length;
  game.phase = "buzzed"; light(true);
  get("stage-kicker").textContent = (nameInput.value.trim() || "You") + (game.entry.early ? ", interrupting" : "") + " / say your answer";
  setActions(button("Show answer", "btn primary", " ", () => reveal(false)));
}
function pass() { if (game.phase === "reading") { clearInterval(game.timer); reveal(true); } }
function reveal(passed) {
  const { s } = game.entry;
  game.phase = "marking"; paint();
  get("stage-answer").textContent = s.q.answer;
  get("stage-night").textContent = onTheNight(s.q);
  get("stage-reveal").hidden = false;
  if (passed) { game.entry.result = "passed"; return afterStarter(false); }
  setActions(button("I had it", "btn yes", "y", () => markStarter(true)), button("Not quite", "btn no", "n", () => markStarter(false)));
}
function markStarter(right) {
  const e = game.entry;
  e.starter = right ? 10 : e.early ? -5 : 0;
  e.result = right ? "correct" : e.early ? "wrong, interrupted" : "wrong";
  setScore(e.starter);
  afterStarter(right);
}
function afterStarter(right) {
  light(false);
  game.phase = "between"; game.bonusAt = 0;
  const more = game.at + 1 < game.list.length;
  setActions(right ? button("Take the bonuses", "btn primary", " ", nextBonus)
    : button(more ? "Next starter" : "See your score", "btn primary", " ", endStarter));
}
function nextBonus() {
  const { s } = game.entry;
  if (game.bonusAt >= s.bonuses.length) return endStarter();
  const b = s.bonuses[game.bonusAt];
  game.phase = "bonus";
  game.words = b.question.split(/\s+/); game.shown = game.words.length; paint();
  get("stage-kicker").textContent = "Bonus " + (game.bonusAt + 1) + " of " + s.bonuses.length + " for five / " + b.category;
  get("stage-intro").hidden = !b.set_intro; get("stage-intro").textContent = b.set_intro || "";
  get("stage-reveal").hidden = true;
  setActions(button("Show answer", "btn primary", " ", () => {
    game.phase = "bonus-marking";
    get("stage-answer").textContent = b.answer;
    const tried = b.attempts.find(a => ["correct", "incorrect", "pass"].includes(a.outcome));
    get("stage-night").textContent = tried ? "On the night: " + (tried.team || "the team") + (tried.outcome === "correct" ? " got it." : tried.outcome === "pass" ? " passed." : " got it wrong.") : "";
    get("stage-reveal").hidden = false;
    setActions(button("Got it", "btn yes", "y", () => markBonus(true)), button("Missed", "btn no", "n", () => markBonus(false)));
  }));
}
function markBonus(right) {
  const e = game.entry;
  e.bonusAsked++; if (right) { e.bonusRight++; e.bonus += 5; setScore(5); }
  game.bonusAt++; nextBonus();
}
function endStarter() { game.log.push(game.entry); game.at++; nextStarter(); }

function finish() {
  game.phase = "done"; get("stage-question").parentElement.classList.add("settled");
  const log = game.log;
  const right = log.filter(e => e.starter === 10).length;
  const lost = log.filter(e => e.starter < 0).length;
  const asked = log.reduce((n, e) => n + e.bonusAsked, 0), got = log.reduce((n, e) => n + e.bonusRight, 0);
  const night = log.filter(e => e.s.q.attempts.some(a => a.outcome === "correct")).length;
  const previous = memory.read(bestKey());
  const record = previous == null || game.score > Number(previous);
  if (record) memory.write(bestKey(), String(game.score));
  showBest();
  get("progress").textContent = "Full time";
  get("stage-kicker").textContent = record && previous != null ? "Full time / a new best" : "Full time";
  get("stage-intro").hidden = true; get("stage-reveal").hidden = true;
  get("stage-question").textContent = (nameInput.value.trim() || "You") + " finished on " + fmt(game.score) + " points.";
  const box = get("stage-results"); box.replaceChildren(); box.hidden = false;
  const tally = el("div", "", "tally");
  for (const [value, label] of [
    [right + " of " + log.length, "starters answered"],
    [asked ? Math.round(100 * got / asked) + "%" : "–", asked ? "of bonuses converted (" + got + " of " + asked + ")" : "no bonuses earned"],
    [String(lost), lost === 1 ? "five-point penalty" : "five-point penalties"],
    [night + " of " + log.length, "of these starters were answered on the night"],
  ]) { const f = el("div", "", "figure"); f.append(el("strong", value), el("span", label)); tally.append(f); }
  const list = el("ol", "", "card-list");
  for (const e of log) {
    const li = el("li"), points = e.starter + e.bonus, body = el("div"), a = el("a", e.s.q.question);
    a.href = "index.html?" + new URLSearchParams({ video: e.s.q.video_id, at: String(e.s.q.start) });
    body.append(a, el("small", e.s.q.answer + " · " + e.result + (e.bonusAsked ? ", " + e.bonusRight + " of " + e.bonusAsked + " bonuses" : "")));
    li.append(el("b", (points > 0 ? "+" : points < 0 ? "−" : "") + Math.abs(points), points < 0 ? "neg" : ""), body);
    list.append(li);
  }
  box.append(tally, list);
  setActions(button("Play again", "btn primary", " ", start), button("Change the settings", "btn", "", idle));
}
function idle() {
  clearInterval(game.timer);
  game.phase = "idle"; light(false);
  get("setup").hidden = false;
  get("score").textContent = "0";
  get("progress").textContent = fmt(playable.length) + " starters to draw from";
  get("stage-kicker").textContent = "Fingers on buzzers";
  get("stage-intro").hidden = true; get("stage-reveal").hidden = true; get("stage-results").hidden = true;
  get("stage-question").textContent = "Ten points for a starter, five for each bonus, and five off for a wrong interruption.";
  showBest();
  setActions(button("Start the round", "btn primary", " ", start));
}
document.addEventListener("keydown", event => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest("input, select, a")) return;
  const key = event.key.toLowerCase();
  // A focused button already answers to space and enter by itself.
  if (event.target.closest("button") && (key === " " || key === "enter")) return;
  const target = [...actions.querySelectorAll("button")].find(b => b.dataset.key === key);
  if (target) { event.preventDefault(); target.click(); }
});
get("setup").addEventListener("submit", event => event.preventDefault());
category.addEventListener("change", showBest);
get("play-length").addEventListener("change", showBest);
idle();
