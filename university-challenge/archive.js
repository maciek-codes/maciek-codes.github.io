"use strict";

const get = id => document.getElementById(id);
const PAGE_SIZE = 8;
const number = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const state = { episodes: new Map(), questions: [], byKey: new Map(), byRepeat: new Map(), matches: [], index: 0, page: 0, picked: false };
// URL parameter <-> filter control.
const FILTER_PARAMS = [["series", "competition"], ["episode", "video"], ["kind", "kind"], ["category", "category"], ["query", "q"]];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function searchable(value) {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

function timestamp(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

function episodeName(episode) {
  if (Array.isArray(episode?.teams) && episode.teams.length === 2) {
    return episode.teams.map(text).join(" v ");
  }
  return text(episode?.title).replace(/^university\s+challenge\s*[-–—:]?\s*/i, "")
    .replace(/^s\d+\s*e\d+\s*[-–—:]?\s*/i, "").trim() || "Transcript excerpt";
}

function competition(episode) {
  return text(episode?.competition) || (episode?.season != null ? "Series " + episode.season : "");
}

function seriesEpisode(episode) {
  const parts = [competition(episode)].filter(Boolean);
  if (episode?.episode != null) parts.push("Episode " + episode.episode);
  return parts.join(" / ");
}

function airDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const day = new Date(value + "T12:00:00Z");
  return Number.isNaN(day.getTime()) ? "" : date.format(day);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function fillSelect(id, first, items, previous = "") {
  const element = get(id);
  element.replaceChildren(new Option(first, ""));
  for (const [value, label] of items) element.add(new Option(label, value));
  if (items.some(([value]) => value === previous)) element.value = previous;
}

function episodesInBank() {
  return [...new Set(state.questions.map(q => q.video_id))]
    .map(id => state.episodes.get(id)).filter(Boolean);
}

function fillEpisodes() {
  const season = get("series").value;
  const episodes = episodesInBank()
    .filter(e => !season || competition(e) === season)
    .sort((a, b) => competition(b).localeCompare(competition(a), "en", { numeric: true }) || (a.episode || 0) - (b.episode || 0)
      || episodeName(a).localeCompare(episodeName(b)));
  const items = episodes.map(e => [e.id, [seriesEpisode(e), episodeName(e)].filter(Boolean).join(" — ")]);
  fillSelect("episode", "All", items, get("episode").value);
}

function showAnswer(show) {
  get("answer-panel").hidden = !show;
  get("reveal").setAttribute("aria-expanded", String(show));
  get("reveal-label").textContent = show ? "Hide answer" : "Reveal answer";
}

function showAttempts(attempts) {
  const list = get("attempts");
  list.replaceChildren();
  if (!Array.isArray(attempts)) return;
  for (const attempt of attempts) {
    if (!attempt || typeof attempt !== "object") continue;
    const person = [text(attempt.team), text(attempt.player)].filter(Boolean).join(", ");
    const outcome = typeof attempt.correct === "boolean" ? (attempt.correct ? "correct" : "incorrect")
      : text(attempt.outcome) === "pass" ? "pass" : "";
    const response = text(attempt.answer);
    const details = [response, outcome].filter(Boolean).join(" · ");
    if (!person && !response) continue;
    const item = document.createElement("li");
    item.textContent = [person, details].filter(Boolean).join(" — ");
    list.append(item);
  }
}

// Other broadcasts that asked for the same answer with closely matching clues (uc/similar.py).
function showRepeats(clue) {
  const box = get("repeats");
  box.replaceChildren();
  const others = clue.rep ? (state.byRepeat.get(clue.rep) || []).filter(q => q !== clue) : [];
  box.hidden = !others.length;
  if (!others.length) return;
  const head = document.createElement("p");
  head.textContent = "This or a very similar question came up " + (others.length + 1) + " times. Also in:";
  const list = document.createElement("ul");
  for (const q of others) {
    const e = state.episodes.get(q.video_id), li = document.createElement("li"), a = document.createElement("a");
    a.href = questionUrl(q);
    a.textContent = [seriesEpisode(e), airDate(e?.air_date)].filter(Boolean).join(" · ");
    a.title = q.question;
    li.append(a); list.append(li);
  }
  box.append(head, list);
}

// A link that opens exactly this question, whatever filters are in place.
function questionUrl(clue) {
  const u = new URL("index.html", location.href);
  u.search = "";
  u.searchParams.set("question", clue.key);
  return u.href;
}

// Keep the address bar shareable: current filters, plus the question once the reader has picked one.
function syncUrl() {
  const u = new URL(location.href);
  u.search = "";
  for (const [id, param] of FILTER_PARAMS) {
    const value = get(id).value.trim();
    if (value) u.searchParams.set(param, value);
  }
  const clue = state.matches[state.index];
  if (clue && state.picked) u.searchParams.set("question", clue.key);
  if (u.href !== location.href) history.replaceState(null, "", u);
}

function teamLinks(episode) {
  if (!Array.isArray(episode?.teams) || episode.teams.length !== 2 || !competition(episode)) return [episodeName(episode)];
  const parts = [];
  episode.teams.map(text).forEach((name, i) => {
    if (i) parts.push(" v ");
    const a = document.createElement("a");
    a.href = "teams.html?" + new URLSearchParams({ competition: competition(episode), team: name });
    a.textContent = name;
    parts.push(a);
  });
  return parts;
}

function renderQuestion() {
  const clue = state.matches[state.index];
  if (!clue) return;
  const episode = state.episodes.get(clue.video_id);
  get("active-question").textContent = clue.question;
  get("set-intro").hidden = !clue.set_intro;
  get("set-intro").textContent = clue.set_intro ? "From the set: " + clue.set_intro : "";
  get("answer").textContent = clue.answer;
  get("clue-info").textContent = [capitalize(text(clue.kind)), text(clue.category)].filter(Boolean).join(" / ");
  const info = get("episode-info");
  info.replaceChildren();
  if (seriesEpisode(episode)) info.append(seriesEpisode(episode), " · ");
  info.append(...teamLinks(episode));
  if (episode?.host) { const tag = document.createElement("span"); tag.className = "host-tag"; tag.textContent = "Hosted by " + episode.host; info.append(" ", tag); }
  const dateLabel = airDate(episode?.air_date);
  if (dateLabel) {
    info.append(" · ");
    const sourceUrl = text(episode?.air_date_source);
    if (/^https:\/\/(www\.)?(tvmaze\.com|blanchflower\.org)\//i.test(sourceUrl)) {
      const link = document.createElement("a");
      link.href = sourceUrl;
      link.textContent = dateLabel;
      link.setAttribute("aria-label", "Broadcast date source for " + dateLabel);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      info.append(link);
    } else {
      info.append(dateLabel);
    }
  }
  get("quality").textContent = clue.quality === "automatic" ? "Auto-extracted" :
    clue.quality === "reviewed" ? "Reviewed" : "";
  const source = get("source");
  source.hidden = !/^[\w-]{11}$/.test(clue.video_id);
  source.removeAttribute("href");
  if (!source.hidden) {
    const url = new URL("https://www.youtube.com/watch");
    const timed = Number.isFinite(clue.start) && clue.start >= 0;
    // Broadcasts uploaded in halves share one timeline; jump into the half that holds this moment.
    const part = timed ? [...(episode?.parts || [])].reverse().find(p => clue.start >= p.offset) : null;
    url.searchParams.set("v", part?.id || episode?.caption_video_id || clue.video_id);
    if (timed) url.searchParams.set("t", Math.floor(clue.start - (part?.offset || 0)) + "s");
    source.textContent = timed ? "Watch at " + timestamp(clue.start) + (part && episode.parts.length > 1 ? " (part " + (episode.parts.indexOf(part) + 1) + ")" : "") + " ↗" : "Watch episode ↗";
    source.href = url.href;
  }
  get("permalink").href = questionUrl(clue);
  get("permalink").textContent = "Copy link";
  showAttempts(clue.attempts);
  showRepeats(clue);
  showAnswer(false);
  get("next-question").disabled = state.matches.length < 2;
  get("shuffle").disabled = state.questions.length < 2;
}

function selectQuestion(index, focus = false, picked = true) {
  state.index = index;
  state.picked = picked;
  state.page = Math.floor(index / PAGE_SIZE);
  renderQuestion();
  renderPage();
  syncUrl();
  if (focus) {
    get("active-question").focus({ preventScroll: true });
    get("desk").scrollIntoView({ block: "start" });
  }
}

function renderPage() {
  const first = state.page * PAGE_SIZE;
  const matches = state.matches;
  const pageCount = Math.ceil(matches.length / PAGE_SIZE);
  get("range").textContent = number.format(matches.length) + (matches.length === 1 ? " question" : " questions");
  get("page").textContent = "Page " + number.format(state.page + 1) + " of " + number.format(pageCount);
  get("prev-page").disabled = state.page === 0;
  get("next-page").disabled = state.page + 1 >= pageCount;
  const list = get("question-list");
  list.replaceChildren();
  for (let i = first; i < Math.min(first + PAGE_SIZE, matches.length); i++) {
    const clue = matches[i];
    const episode = state.episodes.get(clue.video_id);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "index-row";
    if (i === state.index) row.setAttribute("aria-current", "true");
    const label = document.createElement("span");
    label.className = "index-episode";
    label.textContent = seriesEpisode(episode) || episodeName(episode);
    const question = document.createElement("span");
    question.className = "index-text";
    question.textContent = clue.question;
    const arrow = document.createElement("span");
    arrow.className = "row-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    row.append(label, question, arrow);
    row.addEventListener("click", () => selectQuestion(i, true));
    const item = document.createElement("li");
    item.append(row);
    list.append(item);
  }
}

function renderStats() {
  if (!get("stats").open) return;
  // Two uploads of one broadcast can carry separately extracted questions.
  // Count the most complete matching copy of each match once.
  const matches = new Map();
  for (const q of state.matches) {
    const id = state.episodes.get(q.video_id)?.match_id || q.video_id;
    if (!matches.has(id)) matches.set(id, new Map());
    const copies = matches.get(id);
    if (!copies.has(q.video_id)) copies.set(q.video_id, []);
    copies.get(q.video_id).push(q);
  }
  const teams = new Map();
  for (const copies of matches.values()) {
    const chosen = [...copies.values()].sort((a, b) => b.length - a.length)[0];
    for (const q of chosen) {
      for (const a of Array.isArray(q.attempts) ? q.attempts : []) {
        const teamName = text(a?.team);
        const name = teamName ? teamName + " / " + competition(state.episodes.get(q.video_id)) : "";
        const outcome = a?.correct === true ? "correct" : a?.correct === false ? "incorrect" : text(a?.outcome);
        if (!name || !["correct", "incorrect", "pass"].includes(outcome)) continue;
        if (!teams.has(name)) teams.set(name, { correct: 0, incorrect: 0, pass: 0 });
        teams.get(name)[outcome]++;
      }
    }
  }
  get("stats-table").hidden = teams.size === 0;
  get("stats-note").textContent = teams.size ? "Correct share is the percentage of recorded team attempts answered correctly, including passes in the total. Unattributed or unknown outcomes are excluded."
    : "No team-attributed outcomes are recorded for these questions.";
  const body = get("team-scores");
  body.replaceChildren();
  for (const [name, counts] of [...teams].sort(([a], [b]) => a.localeCompare(b))) {
    const row = document.createElement("tr");
    const header = document.createElement("th");
    header.scope = "row";
    header.textContent = name;
    row.append(header);
    const total = counts.correct + counts.incorrect + counts.pass;
    for (const value of [counts.correct, counts.incorrect, counts.pass, Math.round(100 * counts.correct / total) + "%"]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
}

function applyFilters() {
  const series = get("series").value;
  const episode = get("episode").value;
  const category = get("category").value;
  const kind = get("kind").value;
  const terms = searchable(get("query").value.trim()).split(/\s+/).filter(Boolean);
  state.matches = state.questions.filter(q => (
    (!series || competition(state.episodes.get(q.video_id)) === series)
    && (!episode || q.video_id === episode)
    && (!kind || q.kind === kind)
    && (!category || text(q.category) === category)
    && terms.every(term => q.search.includes(term))
  ));
  get("empty").hidden = Boolean(state.matches.length);
  get("results").hidden = !state.matches.length;
  if (state.matches.length) selectQuestion(0, false, false);
  else { state.picked = false; syncUrl(); }
  renderStats();
}

async function loadBank() {
  const bank = globalThis.questionBank;
  if (!Array.isArray(bank.episodes) || !Array.isArray(bank.questions)) throw new Error("Invalid bank");
  state.episodes = new Map(bank.episodes.filter(e => e && typeof e.id === "string").map(e => [e.id, e]));
  state.questions = bank.questions.filter(q => q && text(q.question) && text(q.answer)).map(q => {
    const e = state.episodes.get(q.video_id);
    const teams = Array.isArray(e?.teams) ? e.teams.map(text).join(" ") : "";
    const search = searchable([q.question, q.answer, q.category, q.kind, e?.title, seriesEpisode(e), teams].join(" "));
    return { ...q, search };
  });
  // Question keys survive rebuilds: video, cue start, and order among questions that share that start.
  state.byKey = new Map();
  for (const q of state.questions) {
    const base = q.video_id + "_" + q.start;
    let key = base;
    for (let n = 1; state.byKey.has(key); n++) key = base + "_" + n;
    q.key = key;
    state.byKey.set(key, q);
  }
  state.byRepeat = new Map();
  for (const q of state.questions) if (q.rep) {
    if (!state.byRepeat.has(q.rep)) state.byRepeat.set(q.rep, []);
    state.byRepeat.get(q.rep).push(q);
  }
  const episodes = episodesInBank();
  const series = [...new Set(episodes.map(competition).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
  const hostOf = new Map(episodes.map(e => [competition(e), e.host]));
  fillSelect("series", "All", series.map(s => [s, hostOf.get(s) ? s + " · " + hostOf.get(s) : s]));
  fillEpisodes();
  const categories = [...new Set(state.questions.map(q => text(q.category)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  fillSelect("category", "All", categories.map(c => [c, c]));
  get("total").textContent = number.format(state.questions.length) + (state.questions.length === 1 ? " question from " : " questions from ")
    + number.format(episodes.length) + (episodes.length === 1 ? " episode" : " episodes");
  const params=new URLSearchParams(location.search);
  for(const [key,param] of FILTER_PARAMS.filter(([id]) => get(id).tagName === "SELECT" && id !== "episode")) {
    const v=params.get(param);
    if(v && [...get(key).options].some(o=>o.value===v)) get(key).value=v;
  }
  fillEpisodes();
  if(state.episodes.has(params.get("video")))get("episode").value=params.get("video");
  if(params.get("q"))get("query").value=params.get("q");
  get("loading").hidden = true;
  get("workspace").hidden = false;
  applyFilters();
  // ?question=<key>, or the older ?video=<id>&at=<seconds>.
  const wanted = state.byKey.get(params.get("question"))
    || (params.has("at") ? state.questions.find(q => q.video_id === params.get("video") && q.start === Number(params.get("at"))) : null);
  if (wanted) {
    if (!state.matches.includes(wanted)) {
      // The other parameters exclude it: show it within its own episode instead.
      get("filters").reset();
      fillEpisodes();
      get("episode").value = wanted.video_id;
      applyFilters();
    }
    selectQuestion(state.matches.indexOf(wanted));
  }
}

get("filters").addEventListener("submit", event => event.preventDefault());
get("series").addEventListener("change", () => { fillEpisodes(); applyFilters(); });
get("episode").addEventListener("change", applyFilters);
get("category").addEventListener("change", applyFilters);
get("kind").addEventListener("change", applyFilters);
get("query").addEventListener("input", applyFilters);
get("stats").addEventListener("toggle", renderStats);
get("reset").addEventListener("click", () => {
  get("filters").reset();
  fillEpisodes();
  applyFilters();
  get("query").focus();
});
get("permalink").addEventListener("click", event => {
  const link = event.currentTarget;
  if (!navigator.clipboard || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  navigator.clipboard.writeText(link.href).then(() => { link.textContent = "Link copied"; },
    () => { location.href = link.href; });
});
get("reveal").addEventListener("click", () => showAnswer(get("answer-panel").hidden));
// Random question draws from the whole bank: clear any filters first, then pick a different question.
get("shuffle").addEventListener("click", () => {
  const current = state.matches[state.index];
  if (state.matches.length !== state.questions.length) {
    get("filters").reset();
    fillEpisodes();
    applyFilters();
  }
  if (state.matches.length < 2) return;
  let i;
  do { i = Math.floor(Math.random() * state.matches.length); } while (state.matches[i] === current);
  selectQuestion(i);
});
get("next-question").addEventListener("click", () => selectQuestion((state.index + 1) % state.matches.length));
get("prev-page").addEventListener("click", () => { state.page--; renderPage(); });
get("next-page").addEventListener("click", () => { state.page++; renderPage(); });
loadBank().catch(() => {
  get("loading").textContent = "Question data is missing. Keep bank.js beside index.html or open the hosted viewer.";
});
