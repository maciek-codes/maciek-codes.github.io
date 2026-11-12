"use strict";
// Extra panels for the stats page. Shares stats.js's helpers (bank, people, episodes, byId, get, fmt, el, link, add, sorted, select).
const YEAR = /\b(1[5-9]\d\d|20[0-2]\d)\b/g;
const SCORED = ["correct", "incorrect", "pass"];
// A contestant's stated subject, mapped to the question category it most plainly belongs to.
const FIELDS = [
  ["Arts", "Art historians", /history of art|art history|fine art|architecture/i],
  ["History", "Historians", /\bhistory\b/i],
  ["Mathematics", "Mathematicians", /\bmath/i],
  ["Science", "Scientists and medics", /physics|chemis|biolog|biochem|medicine|natural science|genetic|neuro|geolog|zoolog|pharmac|astro/i],
  ["Literature", "English and literature students", /english|literature|creative writing/i],
  ["Philosophy", "Philosophers", /philosophy/i],
  ["Language", "Linguists", /linguist|languages|french|german|spanish|italian|russian/i],
  ["Music", "Musicians", /\bmusic/i],
  ["Geography", "Geographers", /geograph/i],
  ["Religion", "Theologians", /theolog|divinity|religio/i],
  ["Social science", "Social scientists", /econom|politic|sociolog|psycholog|anthropolog/i],
];
function fieldOf(subject) { return subject && !/\bPPE\b/.test(subject) ? FIELDS.find(f => f[2].test(subject)) : null; }
function barRow(label, value, share, tick) {
  const li = el("li"), bar = el("div", "", "bar-track"), fill = el("i");
  fill.style.width = Math.max(0, Math.min(100, 100 * share)) + "%"; bar.append(fill);
  if (tick != null) { const b = el("b"); b.style.left = Math.min(100, 100 * tick) + "%"; bar.append(b); }
  li.append(label, el("span", value), bar);
  return li;
}
function fillList(id, rows, empty) { const list = get(id); list.replaceChildren(...rows); if (!rows.length) list.append(el("li", empty)); }
const tip = el("div", "", "tip"); tip.hidden = true; document.body.append(tip);
function showTip(text, x, y) {
  tip.textContent = text; tip.hidden = false;
  tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x + 12)) + "px";
  tip.style.top = (y - tip.offsetHeight - 12 < 0 ? y + 16 : y - tip.offsetHeight - 12) + "px";
}
function svg(tag, attrs, text) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}

function renderInsights() {
  const competition = select.value;
  const qs = bank.questions.filter(q => !competition || episodes.get(q.video_id)?.competition === competition);

  // What stumps the teams
  const cats = new Map();
  for (const q of qs) {
    if (!cats.has(q.category)) cats.set(q.category, { right: 0, tried: 0, dead: 0, starters: 0 });
    const c = cats.get(q.category);
    if (q.kind === "bonus") { for (const a of q.attempts || []) if (SCORED.includes(a.outcome)) { c.tried++; if (a.outcome === "correct") c.right++; } }
    else if (q.attempts?.length) { c.starters++; if (!q.attempts.some(a => a.outcome === "correct")) c.dead++; }
  }
  const floor = competition ? 40 : 150;
  fillList("hardest", [...cats].filter(([, c]) => c.tried >= floor && c.starters).sort((a, b) => b[1].right / b[1].tried - a[1].right / a[1].tried)
    .map(([name, c]) => barRow(link(name, "index.html", { category: name, kind: "bonus", competition }),
      Math.round(100 * c.right / c.tried) + "% of bonuses · " + Math.round(100 * c.dead / c.starters) + "% of starters unanswered", c.right / c.tried)),
    "Too few recorded bonuses in this selection.");

  // Years asked about
  const years = new Map(), decades = new Map();
  for (const q of qs) for (const m of q.question.matchAll(YEAR)) { add(years, m[1]); add(decades, Math.floor(m[1] / 10) * 10); }
  const box = get("years"); box.replaceChildren();
  const W = 1000, H = 250, left = 34, base = H - 24, top = 12;
  const cols = []; for (let d = 1500; d <= 2020; d += 10) cols.push([d, decades.get(d) || 0]);
  const peak = Math.max(1, ...cols.map(c => c[1]));
  const step = 10 ** Math.floor(Math.log10(peak)), unit = peak / step >= 5 ? step * 2 : peak / step >= 2 ? step : step / 2;
  const chart = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Mentions of years in questions by decade, 1500s to 2020s" });
  const y = v => base - (base - top) * v / peak, bw = (W - left) / cols.length;
  for (let v = 0; v <= peak; v += unit) { chart.append(svg("line", { class: "grid", x1: left, x2: W, y1: y(v), y2: y(v) }), svg("text", { x: left - 6, y: y(v) + 4, "text-anchor": "end" }, fmt(v))); }
  cols.forEach(([d, n], i) => {
    const x = left + i * bw, h = base - y(n);
    const rect = svg("path", { class: "col", d: `M${x + 1},${base}V${base - h + Math.min(3, h)}q0,-${Math.min(3, h)} ${Math.min(3, h)},-${Math.min(3, h)}H${x + bw - 1 - Math.min(3, h)}q${Math.min(3, h)},0 ${Math.min(3, h)},${Math.min(3, h)}V${base}Z` });
    const hit = svg("rect", { class: "hit", x, y: top, width: bw, height: base - top, tabindex: "0", "aria-label": d + "s: " + fmt(n) + " mentions" });
    const on = e => { rect.classList.add("on"); const r = hit.getBoundingClientRect(); showTip(d + "s: " + fmt(n) + (n === 1 ? " mention" : " mentions"), e.clientX ?? r.left, e.clientY ?? r.top + 40); };
    const off = () => { rect.classList.remove("on"); tip.hidden = true; };
    hit.addEventListener("pointermove", on); hit.addEventListener("pointerleave", off); hit.addEventListener("focus", on); hit.addEventListener("blur", off);
    chart.append(rect, hit);
    if (d % 100 === 0) chart.append(svg("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle" }, d + "s"));
  });
  box.append(chart);
  const topYears = get("top-years"); topYears.replaceChildren();
  const best = sorted(years).slice(0, 6);
  if (best.length) {
    topYears.append("Most-mentioned years: ");
    best.forEach(([yr, n], i) => { if (i) topYears.append(", "); topYears.append(link(yr, "index.html", { q: yr, competition }), " (" + fmt(n) + ")"); });
    topYears.append(". Recent years lead because questions often turn on the news of the series they were set in.");
  }

  // One-match hauls and home turf, both from named correct starters
  const hauls = new Map(), own = new Map(), all = new Map(); let named = 0;
  for (const q of qs) {
    if (q.kind !== "starter") continue;
    for (const a of q.attempts || []) {
      const p = a.outcome === "correct" && byId.get(a.player_id);
      if (!p) continue;
      add(hauls, a.player_id + "|" + q.video_id);
      named++; add(all, q.category);
      const f = fieldOf(p.subject);
      if (f) { if (!own.has(f[0])) own.set(f[0], { label: f[1], total: 0, home: 0 }); const o = own.get(f[0]); o.total++; if (q.category === f[0]) o.home++; }
    }
  }
  fillList("hauls", sorted(hauls).slice(0, 8).map(([key, n], i, rows) => {
    const [id, video] = key.split("|"), p = byId.get(Number(id)), e = episodes.get(video);
    const label = el("span"); label.append(playerLink(p), " ", el("small", p.team + " v " + ((e.teams || []).find(t => t !== p.team) || "?") + ", " + e.competition, "muted"));
    return barRow(label, fmt(n) + " starters", n / rows[0][1]);
  }), "No named starters in this selection.");
  fillList("home-turf", [...own].filter(([, o]) => o.total >= (competition ? 12 : 40)).map(([cat, o]) => {
    const others = (all.get(cat) - o.home) / Math.max(1, named - o.total);
    return { cat, o, others, lift: (o.home / o.total) / Math.max(others, .001) };
  }).sort((a, b) => b.lift - a.lift).map(({ cat, o, others }) =>
    barRow(el("span", o.label + " on " + cat), Math.round(100 * o.home / o.total) + "% · everyone else " + Math.round(100 * others) + "%", o.home / o.total, others)),
    "Too few named starters in this selection to compare.");

  // First names
  const names = new Map();
  for (const p of people) if ((!competition || p.competition === competition) && p.name.includes(" ")) add(names, p.name.split(" ")[0]);
  const firsts = sorted(names).filter(([, n]) => n > 1).slice(0, 12);
  fillList("first-names", firsts.map(([name, n]) => barRow(link(name, "teams.html", { q: name + " " }), fmt(n), n / firsts[0][1])), "No name appears twice in this selection.");
}
select.addEventListener("change", renderInsights);
renderInsights();
