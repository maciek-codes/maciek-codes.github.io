"use strict";
const bank = globalThis.questionBank || { brackets: {} };
const brackets = bank.brackets || {};
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(Math.round(n)));
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
function href(page, data) { const u = new URL(page, location.href); for (const [k, v] of Object.entries(data)) if (v) u.searchParams.set(k, v); return u.href; }
function link(text, page, data) { const a = el("a", text); a.href = href(page, data); return a; }

// Titles awarded differently from the result on the night.
const CHAMPION_OVERRIDE = { "Series 38": "Manchester" };
const DISQUALIFIED = { "Series 38|Corpus Christi, Oxford": "Disqualified" };
// How far a team got, best first.
const STAGE_RANK = { "Final": 6, "Semi-finals": 5, "Quarter-finals": 4, "Second round": 3, "Repechage": 2, "First round": 1, "Heats": 1 };
const FINISH = { 7: "Champions", 6: "Runners-up", 5: "Semi-finals", 4: "Quarter-finals", 3: "Second round", 2: "Repechage", 1: "First round" };

const isXmas = c => c.startsWith("Christmas");
const order = (a, b) => a.localeCompare(b, "en", { numeric: true });
// Every scored match, flattened.
const matches = [];
for (const [competition, record] of Object.entries(brackets)) {
  for (const stage of record.stages || []) for (const m of stage.matches || []) {
    if (!Array.isArray(m.scores) || m.scores.length !== 2 || m.winner == null) continue;
    matches.push({ competition, stage: stage.name, ...m });
  }
}
const champions = {};
for (const [competition, record] of Object.entries(brackets)) {
  const final = (record.stages || []).find(s => s.name === "Final")?.matches?.[0];
  if (final?.scores && final.winner != null) champions[competition] = CHAMPION_OVERRIDE[competition] || final.teams[final.winner];
}

function tally(list, keyOf) {
  const rows = new Map();
  for (const m of list) for (const i of [0, 1]) {
    const key = keyOf(m, i);
    if (!rows.has(key)) rows.set(key, { key, team: m.teams[i], comps: new Set(), p: 0, w: 0, l: 0, pf: 0, pa: 0, best: 0, titles: 0, finals: 0, tb: 0 });
    const r = rows.get(key);
    r.p++; r.comps.add(m.competition);
    r.pf += m.scores[i]; r.pa += m.scores[1 - i];
    if (m.winner === i) r.w++; else r.l++;
    if (m.tie_break) r.tb++;
    r.best = Math.max(r.best, STAGE_RANK[m.stage] || 0);
  }
  for (const r of rows.values()) {
    r.pd = r.pf - r.pa; r.avg = r.pd / r.p; r.pct = r.w / r.p;
    for (const c of r.comps) {
      if (champions[c] === r.team) r.titles++;
      const final = matches.find(m => m.competition === c && m.stage === "Final");
      if (final?.teams.includes(r.team)) r.finals++;
    }
    if (r.comps.size === 1) { const c = [...r.comps][0]; if (champions[c] === r.team) r.best = 7; r.note = DISQUALIFIED[c + "|" + r.team]; }
  }
  return [...rows.values()];
}

const view = get("league-view"), xmas = get("league-xmas");
const comps = [...new Set(matches.map(m => m.competition))];
view.add(new Option("All-time table", ""));
for (const c of comps.sort((a, b) => order(b, a))) view.add(new Option(c + (champions[c] ? " · won by " + champions[c] : ""), c));
const params = new URLSearchParams(location.search);
if (comps.includes(params.get("competition"))) view.value = params.get("competition");

let sortKey = null, sortDir = -1;
const COLUMNS_ALL = [
  ["team", "Team", r => r.team], ["seasons", "Seasons", r => r.comps.size], ["p", "P", r => r.p], ["w", "W", r => r.w], ["l", "L", r => r.l],
  ["pct", "Win %", r => r.pct, r => Math.round(100 * r.pct) + "%"], ["pf", "For", r => r.pf, r => fmt(r.pf)], ["pa", "Against", r => r.pa, r => fmt(r.pa)],
  ["pd", "Diff", r => r.pd, r => signed(r.pd)], ["avg", "Diff / match", r => r.avg, r => signed(r.avg)],
  ["titles", "Titles", r => r.titles], ["finals", "Finals", r => r.finals],
];
const COLUMNS_SEASON = [
  ["team", "Team", r => r.team], ["finish", "Finish", r => r.best, r => r.note || FINISH[r.best] || ""], ["p", "P", r => r.p], ["w", "W", r => r.w], ["l", "L", r => r.l],
  ["pf", "For", r => r.pf, r => fmt(r.pf)], ["pa", "Against", r => r.pa, r => fmt(r.pa)], ["pd", "Diff", r => r.pd, r => signed(r.pd)],
  ["avg", "Diff / match", r => r.avg, r => signed(r.avg)], ["mean", "Avg score", r => r.pf / r.p, r => fmt(Math.round(r.pf / r.p))],
];

function render() {
  const season = view.value;
  xmas.closest("label").hidden = Boolean(season);
  const pool = matches.filter(m => season ? m.competition === season : (xmas.checked || !isXmas(m.competition)));
  const rows = tally(pool, (m, i) => m.teams[i]);
  const cols = season ? COLUMNS_SEASON : COLUMNS_ALL;
  const defaultSort = season
    ? (a, b) => b.best - a.best || b.w - a.w || b.pd - a.pd
    : (a, b) => b.titles - a.titles || b.w - a.w || b.pd - a.pd;
  const col = cols.find(c => c[0] === sortKey);
  rows.sort(col ? (a, b) => { const x = col[2](a), y = col[2](b); return (typeof x === "string" ? order(x, y) : x - y) * sortDir || b.pd - a.pd; } : defaultSort);

  get("league-scope").textContent = fmt(pool.length) + " matches · " + fmt(rows.length) + " teams" + (season ? "" : " · " + fmt(new Set(pool.map(m => m.competition)).size) + " competitions");
  get("table-heading").textContent = season ? season + " standings" : "All-time table";
  get("table-blurb").textContent = season
    ? "Ordered by how far each team went, then wins, then point difference. Select a column to sort by it."
    : "Every institution's record across the competitions in the bank, ordered by titles, then wins, then point difference. Select a column to sort by it.";
  get("league-note").textContent = season ? "" : "Series from 2008–09 onwards that are in the bank" + (xmas.checked ? ", plus the Christmas specials." : ". Christmas specials, played by alumni teams, are left out unless you include them.");

  const table = get("league-table"); table.replaceChildren();
  const head = el("tr"); head.append(el("th", "#", "rank"));
  for (const [key, label] of cols) {
    const th = el("th"); th.scope = "col"; if (key !== "team") th.className = "num";
    const b = el("button", label + (sortKey === key ? (sortDir < 0 ? " ↓" : " ↑") : ""), "sort"); b.type = "button";
    b.setAttribute("aria-label", "Sort by " + label);
    b.addEventListener("click", () => { if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = key === "team" ? 1 : -1; } render(); });
    th.append(b); head.append(th);
  }
  table.createTHead().append(head);
  const body = table.createTBody();
  rows.slice(0, season ? rows.length : 150).forEach((r, i) => {
    const tr = el("tr"); if (season && r.best === 7) tr.className = "champion";
    tr.append(el("td", String(i + 1), "rank"));
    for (const [key, , value, show] of cols) {
      if (key === "team") {
        const th = el("th"); th.scope = "row";
        th.append(link(r.team, "university.html", { team: r.team }));
        if (season) { const squad = link("squad", "teams.html", { competition: season, team: r.team }); squad.className = "muted"; th.append(" ", squad); }
        if (!season && r.titles) th.append(el("span", " " + "★".repeat(r.titles), "stars"));
        tr.append(th); continue;
      }
      const td = el("td", show ? show(r) : fmt(value(r)), "num");
      if ((key === "pd" || key === "avg") && r.pd) td.classList.add(r.pd > 0 ? "pos" : "neg");
      tr.append(td);
    }
    body.append(tr);
  });

  // Best single-season sides (all-time view ignores the season picker).
  const sidePool = matches.filter(m => xmas.checked || !isXmas(m.competition));
  const sides = tally(sidePool, (m, i) => m.competition + "|" + m.teams[i]).filter(r => r.p >= 3)
    .map(r => ({ ...r, competition: [...r.comps][0] })).sort((a, b) => b.avg - a.avg).slice(0, 10);
  const bl = get("best-sides"); bl.replaceChildren();
  for (const s of sides) {
    const li = el("li"), bar = el("div", "", "bar-track"), fill = el("i"); fill.style.width = (100 * s.avg / sides[0].avg) + "%"; bar.append(fill);
    li.append(link(s.team + " / " + s.competition, "teams.html", { competition: s.competition, team: s.team }),
      el("span", signed(s.avg) + " a match · " + s.w + "–" + s.l + ((s.note || FINISH[s.best]) ? " · " + (s.note || FINISH[s.best]) : "")), bar);
    bl.append(li);
  }

  // Records for the table shown.
  const rec = get("records"); rec.replaceChildren();
  const describe = m => m.teams[0] + " " + m.scores[0] + "–" + m.scores[1] + " " + m.teams[1] + " · " + m.competition + ", " + m.stage.toLowerCase();
  const pick = (f, cmp) => pool.length ? [...pool].sort((a, b) => cmp(f(a), f(b)))[0] : null;
  const records = [
    ["Highest score", pick(m => Math.max(...m.scores), (a, b) => b - a), m => fmt(Math.max(...m.scores))],
    ["Biggest win", pick(m => Math.abs(m.scores[0] - m.scores[1]), (a, b) => b - a), m => fmt(Math.abs(m.scores[0] - m.scores[1])) + " points"],
    ["Highest combined", pick(m => m.scores[0] + m.scores[1], (a, b) => b - a), m => fmt(m.scores[0] + m.scores[1])],
    ["Closest match", pick(m => Math.abs(m.scores[0] - m.scores[1]) + (m.tie_break ? 0 : 0.5), (a, b) => a - b), m => m.tie_break ? "Tie-break" : Math.abs(m.scores[0] - m.scores[1]) + " points"],
    ["Lowest winning score", pick(m => m.scores[m.winner], (a, b) => a - b), m => fmt(m.scores[m.winner])],
    ["Lowest score", pick(m => Math.min(...m.scores), (a, b) => a - b), m => fmt(Math.min(...m.scores))],
  ];
  for (const [label, m, value] of records) {
    if (!m) continue;
    const dd = el("dd"); dd.append(el("strong", value(m)), " ");
    dd.append(m.video ? link(describe(m), "index.html", { competition: m.competition, video: m.video }) : el("span", describe(m)));
    rec.append(el("dt", label), dd);
  }
  const ties = pool.filter(m => m.tie_break).length;
  if (ties) rec.append(el("dt", "Tie-breaks"), el("dd", fmt(ties) + " matches went to a tie-break question"));
}
// Charts below the tables cover every series, whatever table is chosen.
function svg(tag, attrs, text) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}
function renderTrend() {
  const series = comps.filter(c => !isXmas(c)).sort(order).map(c => {
    const list = matches.filter(m => m.competition === c);
    const mean = f => Math.round(list.reduce((s, m) => s + f(m), 0) / list.length);
    return { c, n: list.length, win: mean(m => m.scores[m.winner]), lose: mean(m => m.scores[1 - m.winner]), rajan: Number(c.replace(/\D+/g, "")) >= 53 };
  }).filter(s => s.n >= 5);
  if (series.length < 2) return;
  const W = 560, H = 280, left = 46, right = 14, top = 14, base = H - 26, peak = 260;
  const x = i => left + (W - left - right) * i / (series.length - 1), y = v => base - (base - top) * v / peak;
  const chart = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Average winning and losing score by series" });
  for (let v = 0; v <= peak; v += 50) chart.append(svg("line", { class: "grid", x1: left - 12, x2: W - right, y1: y(v), y2: y(v) }), svg("text", { x: left - 18, y: y(v) + 4, "text-anchor": "end" }, v));
  const first = series.findIndex(s => s.rajan);
  if (first > 0) { const ex = (x(first) + x(first - 1)) / 2; chart.append(svg("line", { class: "era", x1: ex, x2: ex, y1: top, y2: base }), svg("text", { x: ex + 5, y: top + 8 }, "Rajan")); }
  series.forEach((s, i) => chart.append(svg("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, s.c.replace("Series ", "S"))));
  for (const [key, cls, label] of [["win", "s1", "Winning"], ["lose", "s2", "Losing"]]) {
    chart.append(svg("path", { class: "line " + cls, d: series.map((s, i) => (i ? "L" : "M") + x(i) + "," + y(s[key])).join("") }));
    series.forEach((s, i) => {
      const dot = svg("circle", { class: cls, cx: x(i), cy: y(s[key]), r: 4.5, tabindex: "0" });
      dot.append(svg("title", {}, s.c + ": " + label.toLowerCase() + " teams averaged " + s[key] + " across " + s.n + " matches"));
      chart.append(dot);
    });
    const last = series[series.length - 1], firstS = series[0];
    chart.append(svg("text", { x: x(0) + 8, y: y(firstS[key]) - 8 }, firstS[key]), svg("text", { x: x(series.length - 1), y: y(last[key]) - 10, "text-anchor": "end" }, last[key]));
  }
  get("score-trend").replaceChildren(chart);
}
function renderOxbridge() {
  const side = t => /, Oxford$/.test(t) ? "O" : /, Cambridge$/.test(t) ? "C" : "";
  const pool = matches.filter(m => !isXmas(m.competition));
  const varsity = pool.filter(m => { const s = m.teams.map(side); return s.includes("O") && s.includes("C"); });
  const ox = varsity.filter(m => side(m.teams[m.winner]) === "O").length, cam = varsity.length - ox;
  const box = get("varsity"); box.replaceChildren();
  const versus = el("div", "", "versus");
  const a = el("div"); a.append(el("strong", String(ox)), el("span", "wins for Oxford colleges"));
  const b = el("div"); b.append(el("strong", String(cam)), el("span", "wins for Cambridge colleges"));
  versus.append(a, el("em", "v"), b);
  const split = el("div", "", "split"); const i1 = el("i"), i2 = el("i"); i1.style.flex = String(ox); i2.style.flex = String(cam); split.append(i1, i2);
  box.append(versus, split);
  const record = keep => { let w = 0, n = 0; for (const m of pool) { const s = m.teams.map(side); if (Boolean(s[0]) === Boolean(s[1])) continue; const i = s[0] ? 0 : 1; if (!keep(s[i])) continue; n++; if (m.winner === i) w++; } return { w, n }; };
  const dl = get("oxbridge"); dl.replaceChildren();
  for (const [label, r] of [["Oxford v the rest", record(s => s === "O")], ["Cambridge v the rest", record(s => s === "C")]]) {
    const dd = el("dd"); dd.append(el("strong", Math.round(100 * r.w / r.n) + "%"), "won " + fmt(r.w) + " of " + fmt(r.n) + " matches against other institutions");
    dl.append(el("dt", label), dd);
  }
  const finals = pool.filter(m => m.stage === "Final");
  const oxbridgeFinals = finals.filter(m => m.teams.some(side)).length;
  const dd = el("dd"); dd.append(el("strong", oxbridgeFinals + " of " + finals.length), "finals featured at least one Oxford or Cambridge college");
  dl.append(el("dt", "Finals"), dd);
  const big = [...varsity].sort((p, q) => Math.abs(q.scores[0] - q.scores[1]) - Math.abs(p.scores[0] - p.scores[1]))[0];
  if (big) { const d2 = el("dd"); const text = big.teams[big.winner] + " " + big.scores[big.winner] + "–" + big.scores[1 - big.winner] + " " + big.teams[1 - big.winner] + " · " + big.competition;
    d2.append(big.video ? link(text, "index.html", { competition: big.competition, video: big.video }) : text); dl.append(el("dt", "Biggest varsity win"), d2); }
}
renderTrend(); renderOxbridge();
view.addEventListener("change", () => { sortKey = null; history.replaceState(null, "", href("league.html", { competition: view.value })); render(); });
xmas.addEventListener("change", render);
render();
