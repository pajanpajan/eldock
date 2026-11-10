// Fáze 87: vrstva nad stránkou pro natáčení video-návodů (vkládá ji `context.addInitScript`).
// Bezhlavý prohlížeč systémový kurzor nevykresluje – vrstva kreslí vlastní žlutočervený kurzor s plynulým
// pohybem (`transition: transform 0.35s ease`) a vlnou při kliknutí a spodní titulkovou lištu (lower third)
// se žlutým odznakem kroku a přepisem komentáře (mluvená slova se rozsvěcují podle časů hlasové syntézy).
// Stav lišty a pozice kurzoru jsou v sessionStorage, takže přežijí i plné načtení stránky.

/** Spouští se v prohlížeči před skripty stránky – funkce musí být samostatná (Playwright ji předá jako text). */
export function tutorialOverlay() {
  if (window.top !== window || window.__eldockTutorial) return;
  const KEY = "__eldockTutorial";
  const load = () => {
    try {
      return JSON.parse(window.sessionStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  };
  const state = load() || { cursor: { x: 960, y: 560 }, banner: null };
  const save = () => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // úložiště nedostupné – vrstva funguje i bez něj
    }
  };

  // Indikátor dev serveru Next.js a posuvník stránky do videa nepatří (styl se připojí, až dokument existuje)
  const pageStyle = document.createElement("style");
  pageStyle.textContent = "nextjs-portal{display:none!important}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}";

  const host = document.createElement("eldock-tutorial-overlay");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:block;contain:layout style;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    .cursor { position: fixed; left: 0; top: 0; width: 0; height: 0; transition: transform 0.35s ease; will-change: transform; }
    .ring { position: absolute; left: -17px; top: -17px; width: 34px; height: 34px; box-sizing: border-box; border-radius: 50%;
      background: rgba(250, 204, 21, 0.32); border: 3px solid #facc15; box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.9), 0 6px 16px rgba(0, 0, 0, 0.45);
      transition: transform 0.15s ease; }
    .dot { position: absolute; left: -3.5px; top: -3.5px; width: 7px; height: 7px; border-radius: 50%; background: #dc2626; box-shadow: 0 0 0 1.5px #fff; }
    .cursor.down .ring { transform: scale(0.72); }
    .ripple { position: fixed; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; box-sizing: border-box; border-radius: 50%;
      border: 3px solid #ef4444; background: rgba(250, 204, 21, 0.28); animation: ripple 0.8s ease-out forwards; }
    @keyframes ripple { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(3.8); opacity: 0; } }
    .banner { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%); width: min(1500px, calc(100vw - 96px)); box-sizing: border-box;
      padding: 14px 32px 18px; border-radius: 20px; background: rgba(9, 9, 11, 0.86); border: 1px solid rgba(250, 204, 21, 0.4);
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); text-align: center;
      font-family: "Segoe UI", "Inter", system-ui, -apple-system, sans-serif; color: #fafafa; }
    .banner[hidden] { display: none; }
    .banner.enter { animation: enter 0.45s ease-out; }
    @keyframes enter { from { opacity: 0; transform: translate(-50%, 18px); } to { opacity: 1; transform: translate(-50%, 0); } }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 5px 16px; border-radius: 999px; background: #facc15; color: #0a0a0a;
      font-size: 19px; font-weight: 800; letter-spacing: 0.03em; line-height: 1.25; }
    .brand { position: absolute; right: 20px; top: 12px; font-size: 13px; font-weight: 800; letter-spacing: 0.12em; color: rgba(250, 204, 21, 0.75); }
    .text { margin-top: 9px; min-height: 40px; font-size: 31px; line-height: 1.3; font-weight: 600; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
    .w { color: rgba(250, 250, 250, 0.46); transition: color 0.12s linear; }
    .w.on { color: #ffffff; }
  </style>
  <div class="banner" hidden><span class="brand">ELDOCK</span><div class="badge"></div><div class="text"></div></div>
  <div class="cursor"><div class="ring"></div><div class="dot"></div></div>`;
  const cursor = root.querySelector(".cursor");
  const banner = root.querySelector(".banner");
  const badge = root.querySelector(".badge");
  const text = root.querySelector(".text");

  let follow = true;
  let dragging = false;
  let shownBadge = null;
  let shownCue = null;
  let spans = [];

  const place = (x, y, ms) => {
    cursor.style.transitionDuration = `${ms ?? 350}ms`;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    state.cursor = { x, y };
    save();
  };
  // výchozí poloha bez animace (po načtení stránky kurzor zůstane, kde byl)
  cursor.style.transition = "none";
  cursor.style.transform = `translate(${state.cursor.x}px, ${state.cursor.y}px)`;
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => (cursor.style.transition = "")));

  const ripple = (x, y) => {
    const wave = document.createElement("div");
    wave.className = "ripple";
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;
    root.appendChild(wave);
    window.setTimeout(() => wave.remove(), 900);
    cursor.classList.add("down");
    window.setTimeout(() => cursor.classList.remove("down"), 170);
  };

  window.addEventListener("mousemove", (event) => follow && place(event.clientX, event.clientY, dragging ? 45 : undefined), true);
  window.addEventListener("mousedown", (event) => ripple(event.clientX, event.clientY), true);

  const render = () => {
    const current = state.banner;
    if (!current) {
      banner.hidden = true;
      shownBadge = null;
      return;
    }
    const now = Date.now();
    if (banner.hidden || shownBadge !== current.badge) {
      banner.hidden = false;
      badge.textContent = current.badge;
      shownBadge = current.badge;
      banner.classList.remove("enter");
      void banner.offsetWidth;
      banner.classList.add("enter");
      shownCue = null;
    }
    let index = 0;
    current.cues.forEach((cue, at) => {
      if (now >= cue.start) index = at;
    });
    const cue = current.cues[index];
    if (!cue) return;
    if (shownCue !== `${current.badge}#${index}`) {
      shownCue = `${current.badge}#${index}`;
      text.textContent = "";
      spans = cue.words.map((word, at) => {
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = at < cue.words.length - 1 ? `${word.w} ` : word.w;
        text.appendChild(span);
        return span;
      });
    }
    cue.words.forEach((word, at) => spans[at]?.classList.toggle("on", now >= word.t));
  };
  window.setInterval(render, 40);

  const mount = () => {
    const head = document.head || document.documentElement;
    if (head && !pageStyle.isConnected) head.appendChild(pageStyle);
    if (document.body && !host.isConnected) document.body.appendChild(host);
  };
  // React může při hydrataci přepsat <body> – vrstvu průběžně vracíme
  window.setInterval(mount, 250);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.__eldockTutorial = {
    /** Plynulý přesun kurzoru (generátor pak na stejné místo posune skutečnou myš). */
    move(x, y, ms) {
      follow = false;
      place(x, y, ms);
      window.setTimeout(() => (follow = true), ms + 30);
    },
    /** Vlna kliknutí bez skutečného kliknutí (nativní <select> – výběr hodnoty dělá generátor). */
    pulse(x, y) {
      ripple(x, y);
    },
    drag(on) {
      dragging = Boolean(on);
    },
    setBanner(next) {
      state.banner = next;
      save();
      render();
    },
  };
}
