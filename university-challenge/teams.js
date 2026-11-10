"use strict";
const roster = Array.isArray(globalThis.teamRosters) ? globalThis.teamRosters : [];
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
function render() {
  list.replaceChildren();
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
    list.append(section);
  }
}
function updateTeams(preferred) {
  const teams = [...new Set(roster.filter(p => p.competition === competition.value).map(p => p.team))].sort();
  options(team, teams, preferred);
  render();
}
const competitions = [...new Set(roster.map(p => p.competition))].sort((a,b)=>b.localeCompare(a, "en", {numeric:true}));
options(competition, competitions, params.get("competition") || "Series 56");
updateTeams(params.get("team") || "St John's, Cambridge");
if (params.get("q")) { query.value = params.get("q"); render(); }
field("roster-count").textContent = new Intl.NumberFormat("en-GB").format(roster.length) + " player records across " + competitions.length + " competitions";
query.addEventListener("input", render);
competition.addEventListener("change", () => updateTeams(""));
team.addEventListener("change", render);
document.querySelector("form").addEventListener("submit", event => event.preventDefault());
