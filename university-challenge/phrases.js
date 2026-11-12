"use strict";
const bank = globalThis.questionBank;
const data = bank.catchphrases || { phrases: [], hits: {} };
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const HOSTS = ["Jeremy Paxman", "Amol Rajan"];
const phrases = data.phrases;

// One broadcast per entry, oldest first.
const episodes = bank.episodes.filter(e => data.hits[e.id]).sort((a, b) => (a.air_date || "").localeCompare(b.air_date || ""));
const counts = new Map(episodes.map(e => {
  const c = new Array(phrases.length).fill(0);
  for (const [p] of data.hits[e.id]) c[p]++;
  return [e.id, c];
}));
const competitions = [...new Set(episodes.map(e => e.competition))];
const hostOf = c => episodes.find(e => e.competition === c)?.host;

// Sequential single-hue ramp from the empty-cell grey to the studio navy.
const LO = [228, 232, 246], HI = [15, 28, 107];
function shade(td, t) {
  if (!(t > 0)) { td.style.background = ""; td.classList.remove("dark"); return; }
  const k = 0.12 + 0.88 * Math.min(1, t);
  td.style.background = "rgb(" + LO.map((v, i) => Math.round(v + (HI[i] - v) * k)).join(",") + ")";
  td.classList.toggle("dark", k > 0.55);
}
function episodeLabel(e) { return [e.competition, e.episode != null ? "Episode " + e.episode : "", (e.teams || []).join(" v ")].filter(Boolean).join(" · "); }
function questionsUrl(e) { const u = new URL("index.html", location.href); u.searchParams.set("competition", e.competition); u.searchParams.set("video", e.id); return u.href; }

// Tooltip shared by every heatmap cell that carries data-tip.
const tip = get("tip");
function showTip(target, x, y) {
  tip.textContent = target.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 12)) + "px";
  tip.style.top = (y + h + 20 > innerHeight ? y - h - 12 : y + 14) + "px";
}
document.addEventListener("pointerover", ev => { const t = ev.target.closest("[data-tip]"); if (t) showTip(t, ev.clientX, ev.clientY); else tip.hidden = true; });
document.addEventListener("pointermove", ev => { const t = ev.target.closest("[data-tip]"); if (t) showTip(t, ev.clientX, ev.clientY); });
document.addEventListener("focusin", ev => { const t = ev.target.closest("[data-tip]"); if (t) { const r = t.getBoundingClientRect(); showTip(t, r.left, r.bottom); } else tip.hidden = true; });
document.addEventListener("scroll", () => { tip.hidden = true; }, true);

function hostHeaderRow(table, cols, lead) {
  const row = el("tr", null, "host-row");
  row.append(el("th", lead));
  let i = 0;
  while (i < cols.length) {
    const h = cols[i].host; let span = 0;
    while (i < cols.length && cols[i].host === h) { span++; i++; }
    const th = el("th", h || "Unknown"); th.colSpan = span; th.scope = "colgroup"; row.append(th);
  }
  table.createTHead().append(row);
}

// Header: one card per host with their most distinctive phrases.
const byHost = Object.fromEntries(HOSTS.map(h => [h, episodes.filter(e => e.host === h)]));
const rate = (list, p) => list.length ? list.reduce((s, e) => s + counts.get(e.id)[p], 0) / list.length : 0;
for (const h of HOSTS) {
  const list = byHost[h], other = byHost[HOSTS.find(x => x !== h)];
  const comps = [...new Set(list.map(e => e.competition))];
  const card = el("article", null, "host-card");
  const series = comps.filter(c => c.startsWith("Series ")).map(c => +c.slice(7)).sort((a, b) => a - b);
  const xmas = comps.filter(c => c.startsWith("Christmas")).length;
  const span = series.length ? "Series " + series[0] + "–" + series[series.length - 1] + (series.length < series[series.length - 1] - series[0] + 1 ? " (" + series.length + " in the bank)" : "") : "";
  card.append(el("h2", h), el("p", [fmt(list.length) + " broadcasts", span, xmas ? xmas + (xmas === 1 ? " Christmas series" : " Christmas series") : ""].filter(Boolean).join(" · ")));
  const ol = el("ol");
  const ranked = phrases.map((ph, p) => ({ ph, mine: rate(list, p), theirs: rate(other, p) }))
    .filter(x => x.mine >= 0.5).sort((a, b) => (b.mine + 0.3) / (b.theirs + 0.3) - (a.mine + 0.3) / (a.theirs + 0.3)).slice(0, 4);
  for (const x of ranked) { const li = el("li"); li.append(el("span", "“" + x.ph.label + "”"), el("span", fmt(x.mine) + " per broadcast")); ol.append(li); }
  card.append(ol);
  get("hosts").append(card);
}
get("phrase-scope").textContent = fmt(episodes.length) + " broadcasts · " + fmt(Object.values(data.hits).reduce((s, h) => s + h.length, 0)) + " phrases counted";

// The "bad luck" headline numbers.
const BL = phrases.findIndex(p => p.key === "bad-luck");
if (BL >= 0) {
  const total = episodes.reduce((s, e) => s + counts.get(e.id)[BL], 0);
  const rajan = byHost["Amol Rajan"], top = [...episodes].sort((a, b) => counts.get(b.id)[BL] - counts.get(a.id)[BL])[0];
  const box = get("badluck");
  const stat = (n, label, href) => { const d = el("div"), s = el("strong", n); d.append(s); if (href) { const a = el("a", label); a.href = href; d.append(a); } else d.append(el("span", label)); box.append(d); };
  stat(fmt(total), "times in total");
  stat(fmt(rate(rajan, BL)), "per Amol Rajan broadcast");
  stat(fmt(rate(byHost["Jeremy Paxman"], BL)), "per Jeremy Paxman broadcast");
  if (top) stat(fmt(counts.get(top.id)[BL]), "in one match: " + episodeLabel(top), questionsUrl(top));
}

// Phrase × competition matrix, each row on its own scale.
(function matrix() {
  const table = get("matrix");
  const cols = competitions.map(c => ({ c, host: hostOf(c), list: episodes.filter(e => e.competition === c) }));
  hostHeaderRow(table, cols, "");
  const head = el("tr"); head.append(el("th", "Phrase"));
  cols.forEach((col, i) => { const th = el("th", col.c.replace("Series ", "S").replace("Christmas ", "Xmas ")); th.scope = "col"; th.title = col.c; if (i && col.host !== cols[i - 1].host) th.className = "era-start"; head.append(th); });
  table.tHead.append(head);
  const body = table.createTBody();
  phrases.forEach((ph, p) => {
    const tr = el("tr"), th = el("th", "“" + ph.label + "”"); th.scope = "row"; tr.append(th);
    const rates = cols.map(col => rate(col.list, p)), max = Math.max(...rates);
    cols.forEach((col, i) => {
      const td = el("td", rates[i] >= 10 ? fmt(Math.round(rates[i])) : fmt(rates[i]));
      shade(td, max ? rates[i] / max : 0);
      if (i && col.host !== cols[i - 1].host) td.classList.add("era-start");
      td.dataset.tip = "“" + ph.label + "” · " + col.c + " (" + col.host + "): " + fmt(rates[i]) + " per broadcast across " + col.list.length + " broadcasts";
      tr.append(td);
    });
    body.append(tr);
  });
})();

// Episode heatmap for one chosen phrase: rows are competitions, columns episode numbers.
const pick = get("episode-phrase");
phrases.forEach((ph, p) => pick.add(new Option(ph.label, String(p))));
pick.value = String(Math.max(0, BL));
function episodeGrid() {
  const p = Number(pick.value), table = get("episode-grid"); table.replaceChildren();
  const width = Math.max(...episodes.map(e => e.episode || 0));
  const head = el("tr"); head.append(el("th", "Episode"));
  for (let n = 1; n <= width; n++) head.append(el("th", n % 5 === 0 || n === 1 ? String(n) : ""));
  table.createTHead().append(head);
  const max = Math.max(1, ...episodes.map(e => counts.get(e.id)[p]));
  const body = table.createTBody();
  for (const c of competitions) {
    const tr = el("tr"), th = el("th", c); th.scope = "row";
    th.append(el("span", (hostOf(c) || "").split(" ").pop(), "host-tag"));
    tr.append(th);
    const byNumber = new Map(episodes.filter(e => e.competition === c).map(e => [e.episode, e]));
    for (let n = 1; n <= width; n++) {
      const e = byNumber.get(n), td = el("td");
      if (e) {
        const v = counts.get(e.id)[p], a = el("a", String(v));
        a.href = questionsUrl(e);
        a.dataset.tip = episodeLabel(e) + (e.air_date ? " · " + e.air_date : "") + " · “" + phrases[p].label + "” ×" + v;
        a.setAttribute("aria-label", episodeLabel(e) + ": " + v);
        td.append(a); shade(td, v / max);
      } else td.style.background = "transparent";
      tr.append(td);
    }
    body.append(tr);
  }
  get("episode-max").textContent = String(max);
  const top = [...episodes].sort((a, b) => counts.get(b.id)[p] - counts.get(a.id)[p])[0];
  get("episode-peak").textContent = top && counts.get(top.id)[p] ? "Most in one broadcast: " + counts.get(top.id)[p] + ", " + episodeLabel(top) : "";
}
pick.addEventListener("change", episodeGrid); episodeGrid();

// Minute-of-match heatmap, rows normalised to their own peak.
const hostPick = get("minute-host");
function minuteGrid() {
  const host = hostPick.value, table = get("minute-grid"); table.replaceChildren();
  const list = episodes.filter(e => !host || e.host === host), MIN = 31;
  const head = el("tr"); head.append(el("th", "Minute"));
  for (let m = 0; m < MIN; m++) head.append(el("th", m % 5 === 0 ? String(m) : ""));
  table.createTHead().append(head);
  const grid = phrases.map(() => new Array(MIN).fill(0));
  for (const e of list) for (const [p, s] of data.hits[e.id]) grid[p][Math.min(MIN - 1, Math.floor(s / 60))]++;
  const body = table.createTBody();
  phrases.forEach((ph, p) => {
    const row = grid[p], max = Math.max(...row), total = row.reduce((a, b) => a + b, 0);
    if (!total) return;
    const tr = el("tr"), th = el("th", "“" + ph.label + "”"); th.scope = "row"; tr.append(th);
    row.forEach((v, m) => {
      const td = el("td", String(v)); shade(td, v / max);
      td.dataset.tip = "“" + ph.label + "” · minute " + m + (m === MIN - 1 ? "+" : "") + ": " + v + " of " + total + " (" + fmt(100 * v / total) + "%)";
      tr.append(td);
    });
    body.append(tr);
  });
}
hostPick.addEventListener("change", minuteGrid); minuteGrid();

// Captains' nominations during their own bonuses.
const captains = data.captains || [];
const capPick = get("captain-competition");
for (const c of [...new Set(captains.map(r => r.competition))].sort((a, b) => b.localeCompare(a, "en", { numeric: true }))) capPick.add(new Option(c, c));
function captainTable() {
  const rows = captains.filter(r => (!capPick.value || r.competition === capPick.value) && r.nominations > 0).slice(0, 15);
  const table = get("captains"); table.replaceChildren();
  const head = el("tr");
  for (const [t, cls] of [["Captain", ""], ["Nominations", "num"], ["Bonuses played", "num"], ["Per bonus", "num"]]) { const th = el("th", t, cls); th.scope = "col"; head.append(th); }
  table.createTHead().append(head);
  const body = table.createTBody();
  for (const r of rows) {
    const tr = el("tr"), who = el("td"), a = el("a", r.name);
    a.href = "player.html?" + new URLSearchParams({ competition: r.competition, team: r.team, name: r.name });
    who.append(a, el("small", r.team + " · " + r.competition + " · " + r.broadcasts + (r.broadcasts === 1 ? " match" : " matches")));
    tr.append(who, el("td", fmt(r.nominations), "num"), el("td", fmt(r.bonuses), "num"), el("td", fmt(r.nominations / r.bonuses), "num"));
    body.append(tr);
  }
  if (!rows.length) { const tr = el("tr"), td = el("td", "No nominations were heard in this competition's captions."); td.colSpan = 4; tr.append(td); body.append(tr); }
}
capPick.addEventListener("change", captainTable); captainTable();
