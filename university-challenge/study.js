"use strict";
// Study guide: which answers recur, per subject, how much of the subject they cover, and the clues behind them.
const bank = globalThis.questionBank;
const books = globalThis.studyBooks || {};
const themes = globalThis.studyTopics || {};
const byMoment = new Map(bank.questions.map(q => [q.video_id + "|" + q.start, q]));
let view = Object.keys(themes).length ? "themes" : "answers";
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const pct = x => Math.round(100 * x) + "%";
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const href = (page, data) => page + "?" + new URLSearchParams(Object.entries(data).filter(([, v]) => v));
const episodes = new Map(bank.episodes.map(e => [e.id, e]));
// Same loose comparison as the stats page: drop brackets, alternatives, leading articles, accents and punctuation.
function answerKey(a) {
  return a.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").split(/\s+(?:or|accept)\s+|\/|;/)[0]
    .normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9 ]+/g, " ").trim().replace(/^(?:the|a|an) /, "").replace(/\s+/g, " ");
}
// In subjects made mostly of people, "Kant" and "Immanuel Kant" are one topic.
const SURNAME_SUBJECTS = new Set(["Philosophy", "Mathematics", "Arts", "Music", "Social science"]);

const subjects = new Map();
for (const q of bank.questions) {
  const key = answerKey(q.answer);
  if (!key) continue;
  if (!subjects.has(q.category)) subjects.set(q.category, { name: q.category, total: 0, topics: new Map() });
  const s = subjects.get(q.category); s.total++;
  if (!s.topics.has(key)) s.topics.set(key, { key, questions: [], labels: new Map() });
  const t = s.topics.get(key); t.questions.push(q);
  const label = q.answer.replace(/\s*[([].*?[)\]]/g, "").split(/\s+(?:or|accept)\s+|\/|;/i)[0].trim();
  t.labels.set(label, (t.labels.get(label) || 0) + 1);
}
for (const s of subjects.values()) {
  if (SURNAME_SUBJECTS.has(s.name)) {
    const full = new Map();
    for (const key of s.topics.keys()) { const last = key.split(" ").pop(); if (key.includes(" ") && last.length > 3 && s.topics.has(last)) { if (!full.has(last)) full.set(last, []); full.get(last).push(key); } }
    for (const [last, keys] of full) {
      // Several full names share the surname (Richard and Johann Strauss): merge only when one clearly dominates.
      keys.sort((a, b) => s.topics.get(b).questions.length - s.topics.get(a).questions.length);
      if (keys.length > 1 && s.topics.get(keys[0]).questions.length < 3 * s.topics.get(keys[1]).questions.length) continue;
      const short = s.topics.get(last), long = s.topics.get(keys[0]);
      long.questions.push(...short.questions); s.topics.delete(last);
      // Keep whichever spelling is more usual, so "x equals zero" doesn't rename "Zero".
      for (const [label, count] of short.labels) long.labels.set(label, (long.labels.get(label) || 0) + count);
    }
  }
  s.ranked = [...s.topics.values()].map(t => ({ ...t, n: t.questions.length, label: [...t.labels].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0] }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  s.listable = s.ranked.filter(t => t.n > 1 && !/^\d+$/.test(t.key) && t.key.length > 2);
  s.cover = n => s.listable.slice(0, n).reduce((sum, t) => sum + t.n, 0) / s.total;
  s.once = s.ranked.filter(t => t.n === 1).length;
}
const order = [...subjects.values()].filter(s => s.total >= 300 && s.name !== "Other").sort((a, b) => b.cover(100) - a.cover(100));
const select = get("study-subject"), size = get("study-size");
for (const s of [...order].sort((a, b) => a.name.localeCompare(b.name))) select.add(new Option(s.name, s.name));

function bar(share, deep) {
  const track = el("div", "", "bar-track"), fill = el("i"); fill.style.width = 100 * share + "%"; track.append(fill);
  if (deep != null) { const d = el("i", "", "deep"); d.style.width = 100 * deep + "%"; track.append(d); }
  return track;
}
function overview() {
  const all = bank.questions.length, keys = new Map();
  for (const q of bank.questions) { const k = answerKey(q.answer); if (k) keys.set(k, (keys.get(k) || 0) + 1); }
  const counts = [...keys.values()].sort((a, b) => b - a);
  const top = n => counts.slice(0, n).reduce((s, v) => s + v, 0) / all;
  get("study-scope").textContent = fmt(keys.size) + " different answers in " + fmt(all) + " questions";
  const intro = get("study-intro"); intro.replaceChildren();
  intro.append("The show's knowledge is broad, with a small core it keeps coming back to. ", el("strong", fmt(counts.filter(v => v === 1).length) + " answers have come up only once"),
    ", the 100 most common answers cover " + pct(top(100)) + " of all questions, and the top 1,000 cover " + pct(top(1000)) + ". No reading list covers most of it, but some subjects are far more concentrated than others, and the recurring core is worth knowing cold.");

  // Past papers: answers already seen in earlier broadcasts.
  const dated = bank.questions.map(q => ({ k: answerKey(q.answer), e: episodes.get(q.video_id) })).filter(x => x.k && x.e?.air_date)
    .sort((a, b) => a.e.air_date.localeCompare(b.e.air_date));
  const comps = [...new Set(dated.map(x => x.e.competition))].filter(c => c.startsWith("Series")).sort((a, b) => b.localeCompare(a, "en", { numeric: true })).slice(0, 8);
  const list = get("study-past"); list.replaceChildren();
  for (const c of comps) {
    const mine = dated.filter(x => x.e.competition === c), first = mine[0].e.air_date, seen = new Map();
    for (const x of dated) { if (x.e.air_date >= first) break; seen.set(x.k, (seen.get(x.k) || 0) + 1); }
    if (!seen.size) continue;
    const once = mine.filter(x => seen.has(x.k)).length / mine.length, thrice = mine.filter(x => (seen.get(x.k) || 0) >= 3).length / mine.length;
    const li = el("li"); li.append(el("span", c), el("span", pct(once) + " seen before · " + pct(thrice) + " three times or more"), bar(once, thrice)); list.append(li);
  }
}
function renderSubjects() {
  const list = get("study-subjects"); list.replaceChildren();
  for (const s of order) {
    const li = el("li"), b = el("button", s.name, "pick"); b.type = "button";
    if (s.name === select.value) li.className = "current";
    b.addEventListener("click", () => { select.value = s.name; render(); get("subject").scrollIntoView(); });
    const themed = themeCover(s.name, 100), track = bar(s.cover(100));
    if (themed != null) { const tick = el("b"); tick.style.left = 100 * themed + "%"; track.append(tick); }
    li.append(b, el("span", pct(s.cover(100)) + " by answer" + (themed != null ? " · " + pct(themed) + " by theme" : "")), track); list.append(li);
  }
}
function themeCover(subject, n) {
  const t = themes[subject];
  return t ? t.topics.slice(0, n).reduce((sum, x) => sum + x.n, 0) / t.questions : null;
}
function clueLinks(questions) {
  const ul = el("ul");
  for (const q of questions) { const item = el("li"), a = el("a", q.question); a.href = href("index.html", { video: q.video_id, at: String(q.start) }); item.append(a); ul.append(item); }
  return ul;
}
function renderThemes(s, n) {
  const canon = get("study-canon"); canon.replaceChildren();
  const shown = (themes[s.name]?.topics || []).slice(0, n);
  for (const t of shown) {
    const li = el("li"), d = el("details"), sum = el("summary"), name = el("b", t.answers.slice(0, 3).map(a => a[0]).join(", ") + (t.answers.length > 3 ? "…" : ""));
    if (t.words.length) name.append(el("small", "about: " + t.words.join(", ")));
    sum.append(name, el("span", fmt(t.n) + " questions")); d.append(sum);
    d.addEventListener("toggle", () => {
      if (!d.open || d.querySelector(".clues")) return;
      const box = el("div", "", "clues"), also = el("p", "Commonest answers: " + t.answers.map(a => a[0] + (a[1] > 1 ? " (" + a[1] + ")" : "")).join(", "), "also");
      const qs = t.questions.map(k => byMoment.get(k[0] + "|" + k[1])).filter(Boolean);
      // A spread across the theme rather than its first few, which are often one bonus set.
      const step = Math.max(1, Math.floor(qs.length / 6));
      box.append(also, clueLinks(qs.filter((_, i) => i % step === 0).slice(0, 6))); d.append(box);
    });
    li.append(d); canon.append(li);
  }
  return shown;
}
function render() {
  const s = subjects.get(select.value), n = Number(size.value), themed = view === "themes";
  for (const b of document.querySelectorAll(".study-switch button")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  get("canon-note").textContent = themed ? "Groups of questions about the same kind of thing, biggest first. Open one to see its commonest answers and some of its clues."
    : "Single answers, most-asked first. Open one to see the clues that led to it. Answers given as bare numbers or single letters are left out.";
  const shown = themed ? renderThemes(s, n) : s.listable.slice(0, n);
  const covered = themed ? themeCover(s.name, n) : s.cover(n);
  const here = new URL(location.href); here.search = new URLSearchParams(n === 100 ? { subject: s.name } : { subject: s.name, size: String(n) });
  if (here.href !== location.href) history.replaceState(null, "", here);
  renderSubjects();
  get("subject-heading").textContent = s.name;
  const figures = get("study-figures"); figures.replaceChildren();
  for (const [value, label] of [
    [pct(covered), "of " + s.name.toLowerCase() + " questions " + (themed ? "fall in these " + fmt(shown.length) + " themes" : "are answered by these " + fmt(shown.length) + " topics")],
    [fmt(s.total), "questions in the bank"], [fmt(s.ranked.length), "different answers"],
    [pct(s.once / s.total), "of questions have an answer that never came up again"],
  ]) { const f = el("div", "", "figure"); f.append(el("strong", value), el("span", label)); figures.append(f); }

  const canon = get("study-canon"); if (!themed) canon.replaceChildren();
  for (const t of themed ? [] : shown) {
    const li = el("li"), d = el("details"), sum = el("summary");
    sum.append(el("b", t.label), el("span", fmt(t.n) + " times")); d.append(sum);
    // Clues are built when the topic is first opened.
    d.addEventListener("toggle", () => {
      if (!d.open || d.querySelector(".clues")) return;
      const box = el("div", "", "clues"), ul = clueLinks(t.questions.slice(0, 6));
      const links = el("p"), wiki = el("a", "Wikipedia"), more = el("a", "All " + fmt(t.n) + " questions");
      wiki.href = "https://en.wikipedia.org/wiki/Special:Search?" + new URLSearchParams({ search: t.label, go: "Go" }); wiki.target = "_blank"; wiki.rel = "noopener noreferrer";
      more.href = href("index.html", { q: t.label, category: s.name });
      links.append(wiki); if (t.n > 6) links.append(more);
      box.append(ul, links); d.append(box);
    });
    li.append(d); canon.append(li);
  }
  const list = get("study-books"); list.replaceChildren();
  const mine = books[s.name] || [];
  get("books-note").textContent = mine.length ? "General introductions that cover the kind of material above. A starting point, not a syllabus."
    : "No reading list for this subject yet.";
  for (const b of mine) {
    const li = el("li"), a = el("a", b.title); a.href = b.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    li.append(a, el("small", [b.author, b.year].filter(Boolean).join(", ")), el("p", b.why)); list.append(li);
  }
}
const params = new URLSearchParams(location.search);
select.value = subjects.has(params.get("subject")) && [...select.options].some(o => o.value === params.get("subject")) ? params.get("subject") : order[0].name;
if ([...size.options].some(o => o.value === params.get("size"))) size.value = params.get("size");
select.addEventListener("change", render); size.addEventListener("change", render);
for (const b of document.querySelectorAll(".study-switch button")) b.addEventListener("click", () => { view = b.dataset.view; render(); });
if (!Object.keys(themes).length) document.querySelector(".study-switch").hidden = true;
overview(); render();
