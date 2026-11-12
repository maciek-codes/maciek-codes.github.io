"use strict";
// One institution across every competition in the bank: results from the brackets, squads from the rosters.
const bank = globalThis.questionBank || { brackets: {} };
const roster = Array.isArray(globalThis.teamRosters) ? globalThis.teamRosters : [];
const teamStats = globalThis.teamStats || {};
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const href = (page, data) => page + "?" + new URLSearchParams(Object.entries(data).filter(([, v]) => v));
const link = (text, page, data) => { const a = el("a", text); a.href = href(page, data); return a; };
const order = (a, b) => a.localeCompare(b, "en", { numeric: true });
const isXmas = c => c.startsWith("Christmas");
// Titles awarded differently from the result on the night (see the league page).
const CHAMPION_OVERRIDE = { "Series 38": "Manchester" };
const DISQUALIFIED = { "Series 38|Corpus Christi, Oxford": "Won the final, disqualified" };
const STAGE_RANK = { "Final": 6, "Semi-finals": 5, "Quarter-finals": 4, "Second round": 3, "Repechage": 2, "First round": 1, "Heats": 1 };
const FINISH = { 7: "Champions", 6: "Runners-up", 5: "Semi-finals", 4: "Quarter-finals", 3: "Second round", 2: "Repechage", 1: "First round" };

const name = new URLSearchParams(location.search).get("team") || "";
// This side's matches, grouped by competition, each seen from its own point of view.
const seasons = new Map();
for (const [competition, record] of Object.entries(bank.brackets || {})) {
  const stages = record.stages || [];
  const final = stages.find(s => s.name === "Final")?.matches?.[0];
  const complete = final?.scores && final.winner != null;
  for (const stage of stages) for (const m of stage.matches || []) {
    const i = m.teams.indexOf(name);
    if (i < 0) continue;
    if (!seasons.has(competition)) seasons.set(competition, { competition, complete, champion: complete && (CHAMPION_OVERRIDE[competition] || final.teams[final.winner]) === name, matches: [] });
    const scored = Array.isArray(m.scores) && m.winner != null;
    seasons.get(competition).matches.push({ competition, stage: stage.name, opponent: m.teams[1 - i], scored, won: scored && m.winner === i,
      score: scored ? m.scores[i] : null, against: scored ? m.scores[1 - i] : null, tieBreak: m.tie_break, date: m.date, video: m.video, episode: m.episode });
  }
}
for (const p of roster) if (p.team === name && !seasons.has(p.competition)) seasons.set(p.competition, { competition: p.competition, complete: false, champion: false, matches: [] });
for (const s of seasons.values()) {
  const played = s.matches.filter(m => m.scored);
  s.w = played.filter(m => m.won).length; s.l = played.length - s.w; s.p = played.length;
  s.pf = played.reduce((n, m) => n + m.score, 0); s.pa = played.reduce((n, m) => n + m.against, 0);
  s.best = s.champion ? 7 : Math.max(0, ...played.map(m => STAGE_RANK[m.stage] || 0));
  s.finish = DISQUALIFIED[s.competition + "|" + name] || (s.complete || s.best === 0 ? (s.best === 1 && isXmas(s.competition) ? "Heats" : FINISH[s.best] || "") : "In progress");
  s.squad = roster.filter(p => p.team === name && p.competition === s.competition).sort((a, b) => (a.seat || 9) - (b.seat || 9));
}
const ordered = [...seasons.values()].sort((a, b) => isXmas(a.competition) - isXmas(b.competition) || order(b.competition, a.competition));

function describe(m) { return m.score + "–" + m.against + " v " + m.opponent + " · " + m.competition + ", " + m.stage.toLowerCase(); }
function matchLink(m, text) { return m.video ? link(text, "index.html", { competition: m.competition, video: m.video }) : el("span", text); }

function render() {
  document.title = name + " · University Challenge";
  get("uni-name").textContent = name;
  const series = ordered.filter(s => !isXmas(s.competition)), xmas = ordered.filter(s => isXmas(s.competition));
  const counted = series.length ? series : ordered;
  const sum = k => counted.reduce((n, s) => n + s[k], 0);
  const p = sum("p"), w = sum("w"), titles = counted.filter(s => s.champion).length;
  const best = Math.max(0, ...counted.map(s => s.best));
  get("uni-scope").textContent = [series.length ? fmt(series.length) + (series.length === 1 ? " series" : " series") : "", xmas.length ? fmt(xmas.length) + (xmas.length === 1 ? " Christmas special" : " Christmas specials") : ""].filter(Boolean).join(" · ") + " in the bank";
  const figures = [[fmt(counted.length), counted.length === 1 ? "competition" : "competitions"], [w + "–" + (p - w), "won and lost"]];
  if (p) figures.push([Math.round(100 * w / p) + "%", "of matches won"], [fmt(Math.round(sum("pf") / p)), "points a match"]);
  figures.push(titles ? [fmt(titles), titles === 1 ? "title" : "titles"] : [FINISH[best] || "–", "best finish"]);
  const players = roster.filter(x => x.team === name).length;
  if (players) figures.push([fmt(players), "players on record"]);
  for (const [value, label] of figures) { const f = el("div", "", "figure"); f.append(el("strong", value), el("span", label)); get("uni-figures").append(f); }
  get("uni-note").textContent = (series.length && xmas.length ? "The figures above cover the student series. Christmas specials are played by alumni and are listed separately below. " : "")
    + "Results come from the results archive, so they include matches that have no questions in the bank.";

  // Season table
  const table = get("uni-seasons");
  const head = el("tr");
  for (const [label, cls] of [["Competition", ""], ["Finish", ""], ["P", "num"], ["W", "num"], ["L", "num"], ["For", "num"], ["Against", "num"], ["Avg score", "num"], ["Bonuses", "num"], ["Squad", ""]]) { const th = el("th", label, cls); th.scope = "col"; head.append(th); }
  table.createTHead().append(head);
  const body = table.createTBody();
  for (const s of ordered) {
    const tr = el("tr"); if (s.champion) tr.className = "champion";
    const th = el("th"); th.scope = "row"; const a = el("a", s.competition); a.href = "#" + slug(s.competition); th.append(a);
    const t = teamStats[s.competition + "|" + name];
    const squad = el("td"); squad.append(s.squad.length ? s.squad.map(x => x.surname || x.name.split(" ").pop()).join(", ") : "–");
    tr.append(th, el("td", s.finish || "–"), ...[s.p, s.w, s.l, s.pf, s.pa].map(v => el("td", s.p ? fmt(v) : "–", "num")),
      el("td", s.p ? fmt(Math.round(s.pf / s.p)) : "–", "num"), el("td", t?.bonuses ? Math.round(100 * t.bonuses_correct / t.bonuses) + "%" : "–", "num"), squad);
    body.append(tr);
  }

  // Records and rivals
  const all = ordered.flatMap(s => s.matches).filter(m => m.scored);
  const rec = get("uni-records");
  const pick = (list, f) => list.length ? [...list].sort((a, b) => f(b) - f(a))[0] : null;
  const wins = all.filter(m => m.won), losses = all.filter(m => !m.won);
  for (const [label, m, value] of [
    ["Highest score", pick(all, m => m.score), m => fmt(m.score)],
    ["Biggest win", pick(wins, m => m.score - m.against), m => fmt(m.score - m.against) + " points"],
    ["Narrowest win", pick(wins, m => -(m.score - m.against) + (m.tieBreak ? .5 : 0)), m => m.tieBreak ? "Tie-break" : fmt(m.score - m.against) + " points"],
    ["Heaviest defeat", pick(losses, m => m.against - m.score), m => fmt(m.against - m.score) + " points"],
    ["Lowest score", pick(all, m => -m.score), m => fmt(m.score)],
  ]) { if (!m) continue; const dd = el("dd"); dd.append(el("strong", value(m)), matchLink(m, describe(m))); rec.append(el("dt", label), dd); }
  if (!all.length) rec.append(el("dt", "Records"), el("dd", "No scored matches yet."));
  const rivals = new Map();
  for (const m of all) { if (!rivals.has(m.opponent)) rivals.set(m.opponent, { w: 0, l: 0 }); rivals.get(m.opponent)[m.won ? "w" : "l"]++; }
  const top = [...rivals].sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l) || a[0].localeCompare(b[0])).slice(0, 8);
  for (const [opponent, r] of top) {
    const li = el("li"), bar = el("div", "", "bar-track"), fill = el("i"); fill.style.width = (100 * r.w / (r.w + r.l)) + "%"; bar.append(fill);
    li.append(link(opponent, "university.html", { team: opponent }), el("span", "won " + r.w + ", lost " + r.l), bar); get("uni-rivals").append(li);
  }
  if (!top.length) get("uni-rivals").append(el("li", "No scored matches yet."));

  // Squads and matches, one block per competition
  const blocks = get("uni-squads");
  for (const s of ordered) {
    const block = el("section", "", "season-block"); block.id = slug(s.competition);
    const header = el("header"), h = el("h3");
    h.append(link(s.competition, "teams.html", { competition: s.competition, team: name }));
    header.append(h);
    if (s.finish) header.append(el("span", s.finish, "finish" + (s.champion ? " champion" : "")));
    if (s.p) header.append(el("span", "Won " + s.w + ", lost " + s.l, "muted"));
    header.append(link("Bracket", "bracket.html", { competition: s.competition }));
    const squad = el("div", "", "squad");
    for (const x of s.squad) {
      const a = link("", "player.html", { competition: x.competition, team: x.team, name: x.name });
      if (x.image) { const img = document.createElement("img"); img.src = x.image; img.alt = ""; img.loading = "lazy"; a.append(img); }
      else a.append(el("span", "No photo", "missing-photo"));
      a.append(x.name);
      if (x.captain || x.subject) a.append(el("small", [x.captain ? "Captain" : "", x.subject].filter(Boolean).join(" · ")));
      squad.append(a);
    }
    if (!s.squad.length) squad.append(el("p", "No squad recorded for this competition.", "panel-note"));
    const list = el("ol", "", "match-list");
    for (const m of s.matches) {
      const li = el("li", "", "match-row" + (m.scored ? (m.won ? " won" : " lost") : ""));
      const what = el("div"), opp = el("strong"); opp.append("v ", link(m.opponent, "university.html", { team: m.opponent }));
      what.append(opp, el("small", [m.scored ? m.stage : "", m.episode ? "Episode " + m.episode : "", m.date ? day.format(new Date(m.date + "T12:00:00Z")) : ""].filter(Boolean).join(" · ")));
      li.append(what, el("span", m.scored ? (m.won ? "Won " : "Lost ") + m.score + "–" + m.against + (m.tieBreak ? " (tie-break)" : "") : "Awaiting result", "result"),
        m.video ? link("Questions", "index.html", { competition: m.competition, video: m.video }) : el("span", ""));
      list.append(li);
    }
    if (!s.matches.length) list.append(el("li", "No results recorded."));
    block.append(header, squad, list); blocks.append(block);
  }
  get("uni").hidden = false;
}
function slug(c) { return c.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
if (seasons.size) render(); else get("missing").hidden = false;
