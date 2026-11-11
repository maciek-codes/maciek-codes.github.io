"use strict";
const bank = globalThis.questionBank || { episodes: [], questions: [], brackets: {} };
const roster = Array.isArray(globalThis.teamRosters) ? globalThis.teamRosters : [];
const get = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const params = new URLSearchParams(location.search);
const episodes = new Map(bank.episodes.map(e => [e.id, e]));
const LABELS = { from: "From", originally_from: "Originally from", grew_up: "Grew up in", born_in: "Born in", based_in: "Based in", lives_in: "Lives in" };

function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function href(page, data) { return page + "?" + new URLSearchParams(Object.entries(data).filter(([, v]) => v != null && v !== "")); }
function link(label, page, data) { const a = el("a", label); a.href = href(page, data); return a; }
function external(label, url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return null;
  const a = el("a", label); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; return a;
}
function date(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? day.format(new Date(value + "T12:00:00Z")) : ""; }
function stageOf(e) {
  for (const stage of bank.brackets?.[e.competition]?.stages || []) {
    const match = stage.matches.find(m => m.match_id === e.match_id);
    if (match) return { stage, match };
  }
  return {};
}

const person = roster.find(p => p.competition === params.get("competition") && p.team === params.get("team") && p.name === params.get("name"))
  || roster.find(p => String(p.id) === params.get("id"));

function render(p) {
  document.title = p.name + " · University Challenge";
  get("team-link").textContent = "← " + p.team + " / " + p.competition;
  get("team-link").href = href("teams.html", { competition: p.competition, team: p.team });
  get("player-name").textContent = p.name;
  get("player-team").textContent = [p.team, p.competition, p.captain ? "Captain" : ""].filter(Boolean).join(" · ");
  const portrait = get("portrait");
  if (p.image) {
    const img = document.createElement("img"); img.src = p.image; img.alt = p.name + " representing " + p.team; portrait.append(img);
  } else portrait.append(el("p", "Photo unavailable", "missing-photo"));

  const bio = get("player-profile");
  const places = p.origins?.length ? p.origins : p.hometown ? [{ kind: p.origin_kind, place: p.hometown }] : [];
  for (const o of places) bio.append(el("dt", LABELS[o.kind] || "From"), el("dd", o.place));
  if (p.subject) bio.append(el("dt", "Subject"), el("dd", p.subject));
  if (p.degree) bio.append(el("dt", "Studying for"), el("dd", p.degree === "Undergraduate" ? "An undergraduate degree" : p.degree === "Research" ? "A research degree" : "A " + p.degree.toLowerCase().replace("master's", "master's degree")));
  if (!bio.children.length) bio.append(el("dt", "Profile"), el("dd", "No hometown or subject was recorded from the introduction."));
  if (p.stats) {
    const s = p.stats, n = x => new Intl.NumberFormat("en-GB").format(x);
    bio.append(el("dt", "On the buzzer"), el("dd", n(s.starters) + " starters won from " + n(s.buzzes) + " named buzzes" +
      (s.wrong ? ", " + n(s.wrong) + " wrong" : "") + (s.penalties ? ", lost 5 points " + n(s.penalties) + (s.penalties === 1 ? " time" : " times") : "")));
  }
  const evidence = [p.origin_evidence, p.subject_evidence].filter((v, i, all) => v?.evidence && all.findIndex(x => x?.evidence === v.evidence) === i);
  const links = el("div", "", "player-links");
  for (const source of evidence) {
    const details = el("details", "", "intro-evidence");
    details.append(el("summary", "Introduction transcript"), el("p", "“" + source.evidence + "”"));
    const watch = external(source.confidence === "asr" ? "Watch · automatic transcript" : "Watch introduction", source.url);
    if (watch) details.append(watch);
    get("player-evidence").append(details);
  }
  for (const a of [external("Introduction", p.intro_url), external("Photo source", p.source_page || p.source_url)]) if (a) links.append(a);
  get("player-evidence").append(links);

  // Attempts carry the player id assigned in the same build as rosters.js.
  const mine = [];
  for (const q of bank.questions) for (const a of q.attempts || []) if (a.player_id === p.id) mine.push({ q, a });
  const starters = mine.filter(x => x.q.kind === "starter");
  const right = starters.filter(x => x.a.outcome === "correct").length;
  const wrong = starters.filter(x => x.a.outcome === "incorrect").length;
  const bonus = mine.filter(x => x.q.kind === "bonus" && x.a.outcome === "correct").length;
  // Team record in this player's matches is always available, even when the
  // transcript never names who buzzed.
  const played = new Set(p.episodes || []);
  let teamStarters = 0, teamBonus = 0, teamBonusRight = 0;
  for (const q of bank.questions) {
    if (!played.has(q.video_id)) continue;
    for (const a of q.attempts || []) {
      if (a.team !== p.team) continue;
      if (q.kind === "starter" && a.outcome === "correct") teamStarters++;
      if (q.kind === "bonus" && ["correct", "incorrect", "pass"].includes(a.outcome)) { teamBonus++; if (a.outcome === "correct") teamBonusRight++; }
    }
  }
  const figures = right + wrong ? [
    [fmt(right), "correct starters"], [fmt(wrong), "incorrect buzzes"],
    [Math.round(100 * right / (right + wrong)) + "%", "starter accuracy"],
  ] : [];
  if (bonus) figures.push([fmt(bonus), "bonuses credited by name"]);
  figures.push([fmt(teamStarters), "team starters in their matches"]);
  if (teamBonus) figures.push([Math.round(100 * teamBonusRight / teamBonus) + "%", "team bonus conversion"]);
  for (const [value, label] of figures) { const f = el("div", "", "figure"); f.append(el("strong", value), el("span", label)); get("numbers").append(f); }
  get("numbers-note").textContent = (right + wrong ? "" : "Neither caption track names who buzzed on this player's starters, so only the team's record is shown. ")
    + "Personal counts cover retained text-playable questions where the buzzer call names this player. Picture and music rounds and interruption penalties are not included.";
  const cats = new Map();
  for (const x of starters) if (x.a.outcome === "correct") cats.set(x.q.category, (cats.get(x.q.category) || 0) + 1);
  const top = [...cats].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [name, count] of top.slice(0, 8)) {
    const li = el("li"), bar = el("div", "", "bar-track"), fill = el("i");
    fill.style.width = (100 * count / top[0][1]) + "%"; bar.append(fill);
    li.append(el("span", name), el("span", fmt(count)), bar); get("player-categories").append(li);
  }
  if (top.length) get("player-categories").before(el("h3", "Correct starters by subject", "minor-title"));

  const list = get("matches");
  for (const id of p.episodes || []) {
    const e = episodes.get(id); if (!e) continue;
    const { stage, match } = stageOf(e);
    const li = el("li", "", "match-row");
    const side = match ? match.teams.indexOf(p.team) : -1;
    const opponent = (e.teams || []).find(t => t !== p.team) || "";
    let result = "";
    if (match?.scores && side >= 0) {
      const won = match.winner === side;
      result = (won ? "Won " : "Lost ") + match.scores[side] + "–" + match.scores[1 - side];
      li.classList.add(won ? "won" : "lost");
    }
    const what = el("div");
    what.append(el("strong", "v " + opponent), el("small", [stage?.name, e.episode != null ? "Episode " + e.episode : "", date(e.air_date)].filter(Boolean).join(" · ")));
    const count = mine.filter(x => x.q.video_id === id).length;
    li.append(what, el("span", result, "result"), link(count ? fmt(count) + " answered" : "Questions", "index.html", { competition: e.competition, video: id }));
    list.append(li);
  }
  if (!list.children.length) list.append(el("li", "No broadcasts are linked to this player."));

  const groups = get("attempt-groups");
  const byEpisode = new Map();
  for (const x of mine) { if (!byEpisode.has(x.q.video_id)) byEpisode.set(x.q.video_id, []); byEpisode.get(x.q.video_id).push(x); }
  for (const [id, items] of byEpisode) {
    const e = episodes.get(id);
    const box = el("section", "", "attempt-group");
    box.append(el("h3", (e?.teams || []).join(" v ") + (e?.episode != null ? " · Episode " + e.episode : ""), "minor-title"));
    const ol = el("ol", "", "attempt-list");
    for (const { q, a } of items.sort((x, y) => x.q.start - y.q.start)) {
      const li = el("li", "", a.outcome);
      const mark = a.outcome === "correct" ? "✓" : a.outcome === "incorrect" ? "✗" : "–";
      li.append(el("span", mark, "mark-sign"), el("span", q.kind === "starter" ? "Starter" : "Bonus", "kind"),
        link(q.question, "index.html", { competition: e?.competition, video: q.video_id, at: String(q.start) }));
      ol.append(li);
    }
    box.append(ol); groups.append(box);
  }
  if (!mine.length) groups.append(el("p", "No named attempts are recorded for this player.", "panel-note"));

  const mates = roster.filter(x => x.competition === p.competition && x.team === p.team && x.id !== p.id);
  for (const m of mates) { const li = el("li"); li.append(link(m.name, "player.html", { competition: m.competition, team: m.team, name: m.name })); get("teammates").append(li); }
  if (!mates.length) get("teammates").append(el("li", "No teammates recorded."));
  get("player").hidden = false;
}

if (person) render(person); else get("missing").hidden = false;
