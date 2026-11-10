/* Google Analytics with a small opt-out notice, shown only to visitors whose browser timezone is in Europe
   (UK and EU). Location comes from the browser's own timezone setting, so no lookup service is called.
   Visitors who opt out never load the GA script. Any element with data-analytics-settings reopens the notice. */
(function () {
  "use strict";
  var ID = "G-E5LTPBQ30R";
  var KEY = "analytics-choice"; // "out" | "ok"
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts for this page only */ } }

  var loaded = false;
  function load() {
    if (loaded || read() === "out") return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ID, { anonymize_ip: true });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    document.head.appendChild(s);
  }
  function optOut() {
    write("out");
    window["ga-disable-" + ID] = true;
    // Remove cookies GA may already have set on this domain.
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (/^_ga/.test(name)) {
        var host = location.hostname.replace(/^www\./, "");
        document.cookie = name + "=; Max-Age=0; path=/";
        document.cookie = name + "=; Max-Age=0; path=/; domain=." + host;
      }
    });
  }

  var css = ".ga-note{position:fixed;right:12px;bottom:12px;z-index:50;max-width:min(330px,calc(100vw - 24px));padding:10px 12px;"
    + "border:1px solid #d6d9e1;border-radius:8px;background:#fff;color:#333;box-shadow:0 4px 18px rgba(20,20,40,.12);"
    + "font:13px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}"
    + ".ga-note p{margin:0 0 8px}.ga-note div{display:flex;gap:8px;justify-content:flex-end}"
    + ".ga-note button{font:inherit;cursor:pointer;border-radius:5px;padding:4px 10px;border:1px solid #bfc4cf;background:#fff;color:#333}"
    + ".ga-note button.ga-ok{background:#302f61;border-color:#302f61;color:#fff}"
    + ".ga-note button:focus-visible{outline:2px solid #966117;outline-offset:2px}"
    + "@media print{.ga-note{display:none}}";

  function notice() {
    if (document.querySelector(".ga-note")) return;
    if (!document.getElementById("ga-note-style")) {
      var st = document.createElement("style"); st.id = "ga-note-style"; st.textContent = css; document.head.appendChild(st);
    }
    var box = document.createElement("div");
    box.className = "ga-note"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Analytics");
    var out = read() === "out";
    box.innerHTML = "<p>" + (out ? "You've opted out of Google Analytics on this site."
      : "This site uses Google Analytics cookies to count visits.") + "</p><div>"
      + (out ? "<button type='button' class='ga-in'>Allow analytics</button><button type='button' class='ga-ok'>Close</button>"
             : "<button type='button' class='ga-out'>Opt out</button><button type='button' class='ga-ok'>OK</button>") + "</div>";
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("ga-out")) optOut();
      else if (b.classList.contains("ga-in")) { write("ok"); window["ga-disable-" + ID] = false; load(); }
      else if (!read()) write("ok");
      box.remove();
    });
    document.body.appendChild(box);
  }

  function inEurope() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      return /^Europe\//.test(tz) || /^Atlantic\/(Canary|Madeira|Azores|Reykjavik|Faroe|Faeroe)$/.test(tz);
    } catch (e) { return true; } // unknown: err on the side of telling the visitor
  }

  if (read() === "out") window["ga-disable-" + ID] = true; else load();
  function ready() {
    if (!read() && inEurope()) notice();
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-analytics-settings]");
      if (t) { e.preventDefault(); notice(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
