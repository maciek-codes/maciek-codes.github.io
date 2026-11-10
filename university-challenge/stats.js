"use strict";
const bank = globalThis.questionBank;
const people = globalThis.teamRosters || [];
const episodes = new Map(bank.episodes.map(e => [e.id,e]));
const get = id=>document.getElementById(id);
const fmt = n=>new Intl.NumberFormat("en-GB").format(n);
const store = new Map();
function add(map,key,count=1) { map.set(key,(map.get(key)||0)+count); }
function sorted(map) { return [...map].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])); }
function el(tag,text,cls) { const n=document.createElement(tag); if(text)n.textContent=text;if(cls)n.className=cls;return n; }
function url(page,data) {
  const u=new URL(page,location.href);
  for(const [k,v] of Object.entries(data))if(v)u.searchParams.set(k,v);
  return u.href;
}
function link(label,page,data) { const node=el("a",label);node.href=url(page,data);return node; }
function external(label,href) { const node=el("a",label);node.href=href;node.target="_blank";node.rel="noopener noreferrer";return node; }
function playerLink(p) { return link(p.name,"player.html",{competition:p.competition,team:p.team,name:p.name}); }
const byId=new Map(people.map(p=>[p.id,p]));
const clips=Array.isArray(bank.clips)?bank.clips:[];
function titleKey(kind,name){ const k=name.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); return kind==="composer"?k:k.replace(/^the /,""); }
function episodeLabel(e){ return [e.competition, e.episode!=null?"Episode "+e.episode:"", (e.teams||[]).join(" v ")].filter(Boolean).join(" · "); }
function clipLink(c){
  const e=episodes.get(c.video_id), u=new URL("https://www.youtube.com/watch");
  const part=[...(e?.parts||[])].reverse().find(p=>c.start>=p.offset);
  u.searchParams.set("v",part?.id||e?.caption_video_id||c.video_id); u.searchParams.set("t",Math.floor(c.start-(part?.offset||0))+"s");
  return external("Heard in "+episodeLabel(e||{}),u.href);
}
function ranked(id,groups,limit,empty){
  const list=get(id);list.replaceChildren();
  const order=[...groups.values()].sort((a,b)=>b.items.length-a.items.length||a.name.localeCompare(b.name));
  for(const g of order.slice(0,limit)){
    const detail=el("details"),label=el("summary"),heard=g.items.filter(x=>x.clip).length;
    label.append(el("span",g.name));
    if(g.tag)label.append(el("em"," "+g.tag,"tag"));
    label.append(el("strong",fmt(g.items.length)+(heard?" · "+fmt(heard)+" heard":"")));
    detail.append(label);
    for(const item of g.items.slice(0,4)) detail.append(item.clip?clipLink(item.clip):link(item.q.question,"index.html",{video:item.q.video_id,at:String(item.q.start)}));
    list.append(detail);
  }
  if(!order.length)list.append(el("p",empty));
}
function addMention(groups,kind,name,item){
  const key=titleKey(kind,name);
  if(!groups.has(key))groups.set(key,{name,tag:kind==="musical"?"musical":"",items:[]});
  groups.get(key).items.push(item);
}
function placeGroup(place){ return /\blondon\b/i.test(place)?"London":place.replace(/^the /i,"The ").replace(/,.*$/,"").replace(/\s+in\s+.*/i,"").trim(); }
for(const p of people) {
  const key=p.competition+"|"+p.team;
  if(!store.has(key))store.set(key,[]);
  if(p.image)store.get(key).push(p);
}
const select=get("season");
select.add(new Option("All competitions",""));
for(const c of [...new Set(bank.episodes.map(e=>e.competition))].filter(Boolean).sort((a,b)=>b.localeCompare(a,"en",{numeric:true}))){const h=bank.episodes.find(e=>e.competition===c)?.host;select.add(new Option(h?c+" · "+h:c,c));}
function render(){
  const competition=select.value;
  const kind=get("stat-kind").value;
  const qs=bank.questions.filter(q=>!competition || episodes.get(q.video_id)?.competition===competition);
  get("scope").textContent=fmt(qs.length)+" questions in "+fmt(new Set(qs.map(q=>q.video_id)).size)+" broadcasts";
  const subjects=new Map(), composers=new Map(), operas=new Map(), artists=new Map(), bonuses=new Map(), rebounds=new Map(), matches=new Map();
  const cs=clips.filter(c=>!competition || episodes.get(c.video_id)?.competition===competition);
  for(const c of cs)for(const [k,name] of c.music||[]) addMention(k==="composer"?composers:k==="artist"?artists:operas,k,name,{clip:c});
  const winners=new Map();
  let total=0,attributed=0,reboundTotal=0;
  for(const q of qs){
    const season=episodes.get(q.video_id).competition;
    if(!kind || kind===q.kind)add(subjects,q.category);
    for(const [k,name] of q.music||[]) addMention(k==="composer"?composers:k==="artist"?artists:operas,k,name,{q});
    const attempts=q.attempts||[];
    for(const a of attempts){
      if(!["correct","incorrect","pass"].includes(a.outcome))continue;
      total++; if(!a.team)continue;attributed++;
      const key=season+"|"+a.team;
      matches.set(key,{team:a.team,season});
      if(q.kind==="starter" && a.outcome==="correct" && byId.has(a.player_id))add(winners,a.player_id);
      if(q.kind==="bonus"){
        if(!bonuses.has(key))bonuses.set(key,{correct:0,count:0});
        const b=bonuses.get(key);b.count++;if(a.outcome==="correct")b.correct++;
      }
    }
    if(q.kind==="starter"){
      const winner=attempts.findIndex(a=>a.outcome==="correct" && a.team);
      if(winner>0 && attempts.slice(0,winner).some(a=>a.outcome==="incorrect" && a.team && a.team!==attempts[winner].team)){
        add(rebounds,season+"|"+attempts[winner].team);reboundTotal++;
      }
    }
  }
  const bars=get("subjects");bars.replaceChildren();
  const counts=sorted(subjects);
  for(const [name,count] of counts){
    const li=el("li"),a=link(name,"index.html",{category:name,kind,competition});
    const value=el("span",fmt(count));
    const bar=el("div","","bar-track"),fill=el("i");fill.style.width=(100*count/counts[0][1])+"%";
    bar.append(fill);li.append(a,value,bar);bars.append(li);
  }
  const leaders=get("leaders");leaders.replaceChildren();
  const order=[...bonuses].filter(([,b])=>b.count>=15).sort((a,b)=>b[1].correct/b[1].count-a[1].correct/a[1].count || b[1].count-a[1].count);
  for(const [key,b] of order.slice(0,3)){
    const m=matches.get(key), box=el("article","","leader-card"), photos=el("div","","team-strip");
    for(const p of (store.get(key)||[]).slice(0,4)){
      const im=document.createElement("img");im.src=p.image;im.alt=p.name;im.title=p.name;im.loading="lazy";photos.append(im);
    }
    if(photos.children.length)box.append(photos);
    const pct=el("strong",Math.round(100*b.correct/b.count)+"%");
    box.append(pct,link(m.team,"teams.html",{competition:m.season,team:m.team}),el("small",m.season+" · "+b.correct+" of "+b.count+" bonuses"));
    leaders.append(box);
  }
  if(!order.length)leaders.append(el("p","No team meets the 15-attempt minimum."));
  ranked("composers",composers,14,"No catalogue matches in this selection.");
  get("composer-scope").textContent=fmt(cs.length)+" played music questions in this selection; the count after a dot shows how many of each composer's mentions were heard rather than read.";
  ranked("operas",operas,12,"No opera or musical titles in this selection.");
  ranked("artists",artists,12,"No band or artist answers in this selection.");
  const cohort=people.filter(p=>!competition || p.competition===competition);
  const study=new Map(), homes=new Map(); let postgrad=0, stated=0;
  for(const p of cohort){
    if(p.subject){ add(study,p.subject); stated++; if(p.degree==="Doctorate"||p.degree==="Master's"||p.degree==="Research")postgrad++; }
    if(p.hometown)add(homes,placeGroup(p.hometown));
  }
  get("degree-summary").textContent=stated?fmt(stated)+" of "+fmt(cohort.length)+" players named a subject; "+fmt(postgrad)+" said they were studying for a master's, doctorate or research degree.":"";
  for(const [id,map] of [["study",study],["hometowns",homes]]){
    const list=get(id);list.replaceChildren();
    const rows=sorted(map).slice(0,12);
    for(const [name,count] of rows){
      const li=el("li"),bar=el("div","","bar-track"),fill=el("i");fill.style.width=(100*count/rows[0][1])+"%";bar.append(fill);
      li.append(link(name,"teams.html",{q:name}),el("span",fmt(count)),bar);list.append(li);
    }
    if(!rows.length)list.append(el("li","No introductions recorded for this selection."));
  }
  const players=get("starter-players");players.replaceChildren();
  for(const [id,count] of [...winners].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,6)){
    const p=byId.get(id), row=el("article","","starter-person");
    if(p.image){const photo=document.createElement("img");photo.src=p.image;photo.alt=p.name;photo.loading="lazy";row.append(photo);}
    const meta=el("div");meta.append(playerLink(p),el("small",p.team+" / "+p.competition));
    row.append(meta,el("strong",fmt(count)));players.append(row);
  }
  if(!winners.size)players.append(el("p","No named starter wins are recorded for this selection."));
  get("rebound-summary").textContent=fmt(reboundTotal)+" starters were answered correctly after a recorded wrong answer by the opposing team.";
  const rlist=get("rebound-teams");rlist.replaceChildren();
  for(const [key,count] of sorted(rebounds).slice(0,5)){
    const m=matches.get(key),li=el("li");li.append(link(m.team+" / "+m.season,"teams.html",{competition:m.season,team:m.team}),el("strong",fmt(count)));rlist.append(li);
  }
  get("attribution").textContent=fmt(attributed)+" of "+fmt(total)+" scored attempts and passes have an identified team in this selection. Statistics cover retained text-playable questions. Duplicate uploads count once.";
}
select.addEventListener("change",render);get("stat-kind").addEventListener("change",render);render();
