"use strict";
const roster = Array.isArray(globalThis.teamRosters) ? globalThis.teamRosters : [];
const teamStats = globalThis.teamStats || {};
const fmt = n => new Intl.NumberFormat("en-GB").format(n);
const field = id => document.getElementById(id);
const query = field("player-query");
const competition = field("competition");
const team = field("team");
const list = field("roster-results");
const params = new URLSearchParams(location.search);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function options(select, values, chosen) {
  select.replaceChildren(...values.map(value => new Option(value, value)));
  if (values.includes(chosen)) select.value = chosen;
}
function searchKey(text) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}
function sourceLink(label, url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return null;
  const link = element("a", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
function playerCard(player) {
  const card = element("article", "", "player-card");
  if (player.image) {
    const image = document.createElement("img");
    image.src = player.image;
    image.alt = player.name + " representing " + player.team;
    image.loading = "lazy";
    card.append(image);
  } else {
    card.append(element("p", "Photo unavailable", "missing-photo"));
  }
  const heading = element("h3");
  const profileLink = element("a", player.name);
  profileLink.href = "player.html?" + new URLSearchParams({competition: player.competition, team: player.team, name: player.name});
  heading.append(profileLink);
  card.append(heading);
  if (player.captain) card.append(element("p", "Captain", "player-role"));
  const places=player.origins?.length ? player.origins : player.hometown ? [{kind:player.origin_kind,place:player.hometown}] : [];
  const labels={from:"From", originally_from:"Originally from", grew_up:"Grew up in", born_in:"Born in", based_in:"Based in", lives_in:"Lives in"};
  const bio=element("dl","","player-profile");
  for(const origin of places) bio.append(element("dt",labels[origin.kind] || "From"),element("dd",origin.place));
  if(player.subject) bio.append(element("dt","Subject"),element("dd",player.subject+(player.degree ? " · "+player.degree : "")));
  if(bio.children.length) card.append(bio);
  const evidence=[player.origin_evidence,player.subject_evidence].filter((v,i,items)=>v?.evidence && items.findIndex(x=>x?.evidence===v.evidence && x?.url===v.url)===i);
  if(evidence.length){
    const details=element("details","","intro-evidence");
    details.append(element("summary","Introduction evidence"));
    for(const source of evidence){
      details.append(element("p","“"+source.evidence+"”"));
      const watch=sourceLink(source.confidence==="asr" ? "Watch introduction · automatic transcript" : "Watch introduction",source.url);
      if(watch)details.append(watch);
    }
    card.append(details);
  }
  const sources = element("div", "", "player-links");
  for (const link of [sourceLink("Introduction", player.intro_url), sourceLink("Photo source", player.source_page || player.source_url)]) {
    if (link) sources.append(link);
  }
  card.append(sources);
  return card;
}
// Buzzer table for one team: named players first, then the whole team including buzzes nobody was named for.
function statsTable(players, key) {
  const t = teamStats[key];
  if (!t || !t.buzzes) return null;
  const cols = [["starters", "Starters won"], ["buzzes", "Buzzes"], ["wrong", "Wrong buzzes"], ["penalties", "Lost 5 points"]];
  const rows = players.map(p => ({ p, s: p.stats || { buzzes: 0, starters: 0, wrong: 0, penalties: 0 } }));
  const best = Object.fromEntries(cols.map(([k]) => [k, Math.max(0, ...rows.map(r => r.s[k]))]));
  const box = element("div", "", "team-stats");
  box.append(element("h3", "Buzzer stats"));
  const scroll = element("div", "", "stats-scroll"), table = element("table");
  const head = element("tr"); head.append(element("th", "Player"));
  for (const [, label] of cols) { const th = element("th", label); th.scope = "col"; head.append(th); }
  table.createTHead().append(head);
  const body = table.createTBody();
  for (const { p, s } of rows.sort((a, b) => b.s.starters - a.s.starters || b.s.buzzes - a.s.buzzes)) {
    const tr = element("tr"), name = element("th"); name.scope = "row";
    const a = element("a", p.name); a.href = "player.html?" + new URLSearchParams({ competition: p.competition, team: p.team, name: p.name });
    name.append(a); if (p.captain) name.append(element("span", " (captain)", "muted"));
    tr.append(name);
    for (const [k] of cols) {
      const td = element("td", fmt(s[k]));
      if (best[k] > 0 && s[k] === best[k]) { td.className = "lead"; td.title = k === "penalties" ? "Most interruptions in the team" : "Most in the team"; }
      tr.append(td);
    }
    body.append(tr);
  }
  const total = element("tr", "", "total"), label = element("th", "Whole team"); label.scope = "row"; total.append(label);
  for (const [k] of cols) total.append(element("td", fmt(t[k] || 0)));
  body.append(total);
  scroll.append(table); box.append(scroll);
  const notes = [fmt(t.matches || 0) + (t.matches === 1 ? " match" : " matches") + " in the bank",
    fmt(t.named) + " of " + fmt(t.buzzes) + " buzzes name the player, so individual figures are minimums"];
  if (t.bonuses) notes.push("bonuses " + fmt(t.bonuses_correct) + " of " + fmt(t.bonuses) + " (" + Math.round(100 * t.bonuses_correct / t.bonuses) + "%)");
  box.append(element("p", notes.join(" · ") + ". Lost 5 points counts wrong buzzes before the question was finished.", "panel-note"));
  return box;
}
// The team's matches in broadcast order, with scores and outcome from the results archive.
function fixturesTable(competitionName, teamName) {
  const fixtures = teamStats[competitionName + "|" + teamName]?.fixtures;
  if (!fixtures?.length) return null;
  const box = element("div", "", "team-stats team-fixtures");
  box.append(element("h3", "Appearances and results"));
  const scroll = element("div", "", "stats-scroll"), table = element("table");
  const head = element("tr");
  for (const label of ["Round", "Date", "Opponent", "Score", "Result", ""]) { const th = element("th", label); th.scope = "col"; head.append(th); }
  table.createTHead().append(head);
  const body = table.createTBody();
  const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  for (const f of fixtures) {
    const tr = element("tr");
    const round = element("th", f.stage + (f.episode ? " · ep. " + f.episode : "")); round.scope = "row";
    const opponent = element("td");
    const link = element("a", f.opponent);
    link.href = "teams.html?" + new URLSearchParams({ competition: competitionName, team: f.opponent });
    opponent.append(link);
    const scored = f.score != null;
    let result = scored ? (f.won ? "Won" : "Lost") : "Awaiting result";
    if (f.tie_break) result += " (tie-break)";
    if (f.highest_loser) result += " · highest loser, through";
    const outcome = element("td", result, scored ? (f.won ? "won" : "lost") : "muted");
    const watch = element("td");
    if (f.video) { const a = element("a", "Questions"); a.href = "index.html?" + new URLSearchParams({ competition: competitionName, video: f.video }); watch.append(a); }
    tr.append(round, element("td", f.date ? dateFmt.format(new Date(f.date + "T00:00:00Z")) : "–"), opponent,
      element("td", scored ? fmt(f.score) + "–" + fmt(f.opponent_score) : "–"), outcome, watch);
    body.append(tr);
  }
  scroll.append(table); box.append(scroll);
  return box;
}

// Keep the address bar pointing at what is shown, so it can be shared.
function syncUrl() {
  const u = new URL(location.href);
  const text = query.value.trim();
  u.search = "?" + new URLSearchParams(text ? { q: text } : missing ? { competition: competition.value, team: missing } : { competition: competition.value, team: team.value });
  if (u.href !== location.href) history.replaceState(null, "", u);
}

// A linked team with no roster in the bank. Shown as a message rather than silently swapping in another team.
let missing = "";

function render() {
  list.replaceChildren();
  syncUrl();
  if (missing && !query.value.trim()) {
    list.append(element("p", "No roster is available for " + missing + " in " + competition.value + "."));
    return;
  }
  const text = searchKey(query.value.trim());
  const matches = text ? roster.filter(p => searchKey([p.name,p.team,p.subject,p.hometown,...(p.origins||[]).map(o=>o.place)].filter(Boolean).join(" ")).includes(text))
    : roster.filter(p => p.competition === competition.value && p.team === team.value);
  competition.disabled = team.disabled = Boolean(text);
  if (!matches.length) {
    list.append(element("p", text ? "No players match this search." : "No roster is available for this team."));
    return;
  }
  const groups = new Map();
  for (const player of matches) {
    const key = player.team + " / " + player.competition;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(player);
  }
  for (const [label, players] of groups) {
    const section = element("section", "", "roster-section");
    const heading = element("h2", label);
    const grid = element("div", "", "portrait-grid");
    for (const player of players) grid.append(playerCard(player));
    section.append(heading, grid);
    if (!text) {
      const fixtures = fixturesTable(players[0].competition, players[0].team);
      if (fixtures) section.append(fixtures);
      const stats = statsTable(players, players[0].competition + "|" + players[0].team);
      if (stats) section.append(stats);
    }
    list.append(section);
  }
}
function updateTeams(preferred) {
  const teams = [...new Set(roster.filter(p => p.competition === competition.value).map(p => p.team))].sort();
  options(team, teams, preferred);
  missing = preferred && !teams.includes(preferred) ? preferred : "";
  render();
}
const competitions = [...new Set(roster.map(p => p.competition))].sort((a,b)=>b.localeCompare(a, "en", {numeric:true}));
// ?team= alone opens that team's most recent competition.
const linkedTeam = params.get("team");
const linkedCompetition = params.get("competition") || (linkedTeam && competitions.find(c => roster.some(p => p.competition === c && p.team === linkedTeam)));
options(competition, competitions, linkedCompetition || competitions[0]);
updateTeams(linkedTeam || (params.has("competition") ? "" : "St John's, Cambridge"));
if (params.get("q")) { query.value = params.get("q"); render(); }
field("roster-count").textContent = new Intl.NumberFormat("en-GB").format(roster.length) + " player records across " + competitions.length + " competitions";
query.addEventListener("input", render);
competition.addEventListener("change", () => updateTeams(""));
team.addEventListener("change", () => { missing = ""; render(); });
document.querySelector("form").addEventListener("submit", event => event.preventDefault());
