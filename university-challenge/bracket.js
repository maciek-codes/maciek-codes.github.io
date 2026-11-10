"use strict";
const bank = globalThis.questionBank || { brackets: {} };
const brackets = bank.brackets || {};
const get = id => document.getElementById(id);
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const params = new URLSearchParams(location.search);
const SVG = "http://www.w3.org/2000/svg";
let active = null;

function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function href(page, data) { return page + "?" + new URLSearchParams(Object.entries(data).filter(([, v]) => v != null && v !== "")); }

// The quarter-finals are a double-elimination group: two wins advance, two
// losses eliminate. Split them by how many quarter-finals each side has played.
function columns(record) {
  const out = [];
  for (const stage of record.stages) {
    if (stage.name !== "Quarter-finals") { out.push({ title: stage.name, subtitle: stage.label !== stage.name ? stage.label : "", matches: stage.matches }); continue; }
    const played = new Map(), parts = [];
    for (const m of stage.matches) {
      const round = Math.max(...m.teams.map(t => played.get(t) || 0));
      for (const t of m.teams) played.set(t, (played.get(t) || 0) + 1);
      (parts[round] ||= []).push(m);
    }
    const names = ["First matches", "Winners v winners · losers v losers", "Deciders"];
    parts.forEach((matches, i) => out.push({ title: "Quarter-finals", subtitle: names[i] || "Round " + (i + 1), matches }));
  }
  return out.filter(c => c.matches.length);
}

// Order each column near the matches its teams came from and go to, so the
// connecting lines cross as little as possible.
function arrange(cols) {
  const where = () => {
    const map = new Map();
    cols.forEach((c, ci) => c.matches.forEach((m, mi) => m.teams.forEach(t => (map.get(t) || map.set(t, []).get(t)).push([ci, (mi + .5) / c.matches.length]))));
    return map;
  };
  const sortBy = (c, key) => {
    const keyed = c.matches.map((m, i) => [key(m, (i + .5) / c.matches.length), i, m]);
    keyed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    c.matches = keyed.map(x => x[2]);
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let ci = cols.length - 2; ci >= 0; ci--) {
      const map = where();
      sortBy(cols[ci], (m, own) => {
        const next = m.teams.map(t => (map.get(t) || []).find(([c]) => c > ci)).filter(Boolean);
        return next.length ? next.reduce((s, [, p]) => s + p, 0) / next.length : own;
      });
    }
    for (let ci = 1; ci < cols.length; ci++) {
      const map = where();
      sortBy(cols[ci], (m, own) => {
        const prev = m.teams.map(t => (map.get(t) || []).filter(([c]) => c < ci).pop()).filter(Boolean);
        return prev.length ? prev.reduce((s, [, p]) => s + p, 0) / prev.length : own;
      });
    }
  }
}

function card(m, competition) {
  const box = el("article", "", "match");
  m.teams.forEach((team, i) => {
    const row = el("div", "", "side");
    row.dataset.team = team;
    if (m.winner === i) row.classList.add("winner");
    const name = el("button", team, "team-name");
    name.type = "button";
    name.addEventListener("click", () => highlight(active === team ? null : team));
    row.append(name);
    if (m.highest_loser?.[i]) row.append(el("span", "HSL", "tag hsl"));
    if (competition.startsWith("Christmas") && m.advanced?.[i] && !/semi|final/i.test(m.stage || "")) row.append(el("span", "Q", "tag q"));
    row.append(el("span", m.scores ? String(m.scores[i]) : "–", "score"));
    box.append(row);
  });
  const foot = el("div", "", "match-foot");
  const bits = [m.episode != null ? "E" + m.episode : "", m.date ? day.format(new Date(m.date + "T12:00:00Z")) : ""].filter(Boolean).join(" · ");
  foot.append(el("span", bits));
  if (m.tie_break) foot.append(el("span", "TB", "tag tb"));
  if (m.video) { const a = el("a", "Questions"); a.href = href("index.html", { competition, video: m.video }); foot.append(a); }
  box.append(foot);
  return box;
}

function highlight(team) {
  active = team;
  const root = get("bracket");
  root.classList.toggle("focused", Boolean(team));
  for (const n of root.querySelectorAll("[data-team]")) n.classList.toggle("on", n.dataset.team === team);
}

function connect() {
  const root = get("bracket");
  root.querySelector("svg")?.remove();
  const box = root.getBoundingClientRect();
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", root.scrollWidth); svg.setAttribute("height", root.scrollHeight);
  svg.setAttribute("aria-hidden", "true");
  const seen = new Map();
  root.querySelectorAll(".round").forEach((round, ci) => round.querySelectorAll(".side").forEach(side => {
    const list = seen.get(side.dataset.team) || seen.set(side.dataset.team, []).get(side.dataset.team);
    list.push({ ci, side });
  }));
  for (const [team, steps] of seen) for (let i = 1; i < steps.length; i++) {
    if (steps[i].ci === steps[i - 1].ci) continue;
    const a = steps[i - 1].side.getBoundingClientRect(), b = steps[i].side.getBoundingClientRect();
    const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top;
    const mid = (x1 + x2) / 2;
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`);
    path.setAttribute("class", steps[i - 1].side.classList.contains("winner") ? "line" : "line loser");
    path.dataset.team = team;
    svg.append(path);
  }
  root.prepend(svg);
  highlight(active);
}

function render() {
  const competition = get("bracket-competition").value;
  const record = brackets[competition];
  const root = get("bracket");
  root.replaceChildren();
  active = null;
  if (!record) { root.append(el("p", "No results are available for this competition.")); return; }
  const cols = columns(record);
  arrange(cols);
  const tallest = Math.max(...cols.map(c => c.matches.length));
  root.style.setProperty("--rows", tallest);
  for (const c of cols) {
    const round = el("section", "", "round");
    const head = el("header", "", "round-head");
    head.append(el("h2", c.title));
    if (c.subtitle) head.append(el("small", c.subtitle));
    const body = el("div", "", "round-body");
    for (const m of c.matches) body.append(card({ ...m, stage: c.title }, competition));
    round.append(head, body);
    root.append(round);
  }
  const matches = record.stages.flatMap(s => s.matches);
  const linked = matches.filter(m => m.video).length;
  const final = record.stages.find(s => s.name === "Final")?.matches[0];
  get("bracket-scope").textContent = (hostOf.get(competition) ? "Hosted by " + hostOf.get(competition) + " · " : "") + matches.length + " matches · " + linked + " with questions in the bank" + (final?.scores ? " · Champions: " + final.teams[final.winner] : "");
  document.body.classList.toggle("christmas", competition.startsWith("Christmas"));
  get("bracket-note").textContent = competition.startsWith("Christmas")
    ? "Heat winners with the highest scores go through to the semi-finals."
    : "The four highest-scoring first-round losers meet in two repechage play-offs for the last second-round places. Quarter-finalists need two wins to reach the semi-finals; two defeats eliminate a team. Select a team name to trace its path.";
  const source = get("bracket-source");
  source.replaceChildren();
  if (record.source) {
    const a = el("a", "Sean Blanchflower's results archive"); a.href = record.source; a.target = "_blank"; a.rel = "noopener noreferrer";
    source.append("Scores and qualifiers: ", a, ". Matches aired since the archive's last update are listed without scores.");
  }
  requestAnimationFrame(connect);
}

const select = get("bracket-competition");
const names = Object.keys(brackets).sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
const hostOf = new Map((bank.episodes || []).map(e => [e.competition, e.host]));
for (const name of names) select.add(new Option(hostOf.get(name) ? name + " · " + hostOf.get(name) : name, name));
const preferred = params.get("competition");
select.value = names.includes(preferred) ? preferred : names.find(n => brackets[n].stages.some(s => s.name === "Final")) || names[0];
select.addEventListener("change", () => { history.replaceState(null, "", href("bracket.html", { competition: select.value })); render(); });
let timer;
addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(connect, 120); });
render();
