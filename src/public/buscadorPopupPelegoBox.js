import { maisBuscadosHoje } from "backend/buscasProjetos.web";

(() => {
  const ROOT_ID = "pelego-search-flyout";
  const TARGET_PATHS = new Set(["/ranking", "/videos-dos-projetos-prontos"]);
  const SEARCH_PATH = "/videos-dos-projetos-prontos";
  const LEFT_IMAGE = "https://static.wixstatic.com/media/354683_1f33596da86e47a08bb651e97b4a4676~mv2.png";
  const AUTO_VISIBLE_MS = 10000;
  const FIRST_OPEN_MS = 1800;
  const NEXT_MIN_MS = 26000;
  const NEXT_MAX_MS = 44000;

  const FALLBACK_TERMS = [
    "Tornado",
    "Eros",
    "WPU",
    "Line Array",
    "T15",
    "JBL",
    "Pioneer",
    "Selenium",
    "Oversound",
    "Canhão",
    "Subwoofer",
    "Bass Reflex",
    "Triton",
    "15SW",
    "18SW"
  ];

  let autoOpenTimer = null;
  let autoCloseTimer = null;

  const path = () => (window.location.pathname || "/").toLowerCase().replace(/\/$/, "") || "/";
  const desktop = () => window.matchMedia("(min-width: 768px)").matches;
  const shouldRun = () => desktop() && TARGET_PATHS.has(path());
  const randomDelay = () => Math.floor(NEXT_MIN_MS + Math.random() * (NEXT_MAX_MS - NEXT_MIN_MS));

  function clearTimers() {
    if (autoOpenTimer) window.clearTimeout(autoOpenTimer);
    if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
    autoOpenTimer = null;
    autoCloseTimer = null;
  }

  function navigateToSearch(term) {
    const value = String(term || "").trim();
    if (!value) return false;

    const url = new URL(SEARCH_PATH, window.location.origin);
    url.searchParams.set("busca", value);

    const brand = new URLSearchParams(window.location.search).get("marca");
    if (brand) url.searchParams.set("marca", brand);

    window.location.assign(url.pathname + url.search);
    return true;
  }

  function removeRoot() {
    clearTimers();
    document.getElementById(ROOT_ID)?.remove();
  }

  function mount() {
    if (!shouldRun()) {
      removeRoot();
      return;
    }
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <style>
        #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#0b1f55}
        #${ROOT_ID} *{box-sizing:border-box}
        #${ROOT_ID} .pbx-tab{position:fixed;left:0;top:50%;transform:translateY(-50%);width:72px;height:154px;border:1px solid #7cc0ff;border-left:0;border-radius:0 22px 22px 0;background:linear-gradient(180deg,#1268ed 0%,#0733a5 100%);color:#fff;box-shadow:0 10px 26px rgba(0,55,180,.32);pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;padding:8px 4px;z-index:5}
        #${ROOT_ID} .pbx-tab:hover{filter:brightness(1.08)}
        #${ROOT_ID} .pbx-tab svg{width:28px;height:28px;stroke:#fff;stroke-width:2.2;fill:none}
        #${ROOT_ID} .pbx-tab strong{font-size:10px;line-height:1.05}
        #${ROOT_ID} .pbx-brand{font-size:10px;font-weight:900}.pbx-brand b{color:#ff3647}
        #${ROOT_ID} .pbx-chevrons{font-size:27px;line-height:.7;font-weight:300}

        #${ROOT_ID} .pbx-panel{position:fixed;left:72px;top:50%;width:min(620px,calc(100vw - 92px));transform:translate(calc(-100% - 82px),-50%);opacity:0;visibility:hidden;pointer-events:auto;transition:transform .68s cubic-bezier(.2,.9,.25,1),opacity .22s ease;z-index:4}
        #${ROOT_ID} .pbx-panel.is-open{transform:translate(0,-50%);opacity:1;visibility:visible}
        #${ROOT_ID} .pbx-card{position:relative;background:rgba(255,255,255,.985);border:1px solid #d8e6ff;border-radius:28px;padding:30px 28px 22px;box-shadow:0 20px 48px rgba(11,35,91,.22),0 0 30px rgba(36,106,255,.10);overflow:visible}

        #${ROOT_ID} .pbx-mascot{position:absolute;left:-6px;top:-114px;width:232px;height:194px;overflow:hidden;pointer-events:none;z-index:2;clip-path:polygon(9% 0,100% 0,100% 100%,18% 100%,18% 91%,0 91%,0 19%,9% 19%)}
        #${ROOT_ID} .pbx-mascot img{position:absolute;max-width:none;width:590px;height:auto;left:-72px;top:-2px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.10))}

        #${ROOT_ID} .pbx-close{position:absolute;right:14px;top:14px;width:34px;height:34px;border:0;border-radius:50%;background:#eef3ff;color:#183b86;font-size:24px;line-height:1;cursor:pointer}
        #${ROOT_ID} .pbx-head{padding-left:165px;min-height:72px;padding-right:26px}
        #${ROOT_ID} .pbx-title{margin:0;font-size:30px;line-height:1.05;font-weight:900;color:#0b1f55}.pbx-title span{color:#1568ef}
        #${ROOT_ID} .pbx-sub{margin:7px 0 0;font-size:13px;line-height:1.35;color:#617097}
        #${ROOT_ID} .pbx-search{display:flex;align-items:center;gap:8px;margin-top:18px;padding:6px 7px 6px 15px;border:2px solid #8ac3ff;border-radius:999px;background:#fff;box-shadow:0 0 0 5px rgba(56,129,255,.07),0 7px 18px rgba(30,93,202,.10)}
        #${ROOT_ID} .pbx-search-icon{width:23px;height:23px;flex:0 0 23px;stroke:#164fd8;stroke-width:2.4;fill:none}
        #${ROOT_ID} .pbx-input{min-width:0;flex:1;height:42px;border:0;outline:0;background:#fff;color:#0b1f55;font-size:17px;font-weight:600;padding:0 5px}
        #${ROOT_ID} .pbx-input::placeholder{color:#9ba7bf;font-weight:500}
        #${ROOT_ID} .pbx-mic{width:38px;height:38px;flex:0 0 38px;border:0;border-radius:50%;background:#edf3ff;color:#2468e8;cursor:pointer;display:grid;place-items:center}
        #${ROOT_ID} .pbx-mic svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none}
        #${ROOT_ID} .pbx-submit{height:40px;padding:0 20px;border:0;border-radius:999px;background:linear-gradient(90deg,#185ff1,#1551d8);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 6px 14px rgba(24,91,224,.25)}
        #${ROOT_ID} .pbx-popular{display:flex;align-items:flex-start;flex-wrap:wrap;gap:7px;margin-top:15px;font-size:11px;color:#5b6787}
        #${ROOT_ID} .pbx-popular-label{width:100%;font-size:11px;font-weight:900;letter-spacing:.35px;color:#213768;margin-bottom:1px}
        #${ROOT_ID} .pbx-chips{display:flex;flex-wrap:wrap;gap:7px;width:100%}
        #${ROOT_ID} .pbx-chip{border:1px solid #dbe6fb;border-radius:999px;background:#fff;color:#34466f;padding:6px 10px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(27,67,145,.06)}
        #${ROOT_ID} .pbx-chip:hover{border-color:#80b8ff;color:#1257df;background:#f8fbff}
        #${ROOT_ID} .pbx-toast{position:absolute;left:50%;bottom:-42px;transform:translateX(-50%);padding:8px 12px;border-radius:999px;background:#0b1f55;color:#fff;font-size:12px;white-space:nowrap;opacity:0;transition:opacity .2s ease;pointer-events:none}.pbx-toast.show{opacity:1}
        #${ROOT_ID}.pbx-shake .pbx-card{animation:pbxShake .28s linear 1}
        @keyframes pbxShake{0%,100%{transform:translateX(0)}30%{transform:translateX(-6px)}70%{transform:translateX(6px)}}
        @media(max-width:767px){#${ROOT_ID}{display:none!important}}
        @media(prefers-reduced-motion:reduce){#${ROOT_ID} .pbx-panel{transition:none}}
      </style>

      <button class="pbx-tab" type="button" aria-label="Abrir buscador de projetos">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>
        <strong>Pesquisar<br>Projetos</strong>
        <span class="pbx-brand">PELEGO <b>BOX</b></span>
        <span class="pbx-chevrons">››</span>
      </button>

      <section class="pbx-panel" role="search" aria-label="Buscador de projetos prontos">
        <div class="pbx-card">
          <div class="pbx-mascot"><img src="${LEFT_IMAGE}" alt=""></div>
          <button class="pbx-close" type="button" aria-label="Fechar buscador">×</button>
          <div class="pbx-head">
            <h2 class="pbx-title">Encontre seu <span>projeto!</span></h2>
            <p class="pbx-sub">Digite o que você procura. A busca vai localizar projetos prontos parecidos no site.</p>
          </div>
          <div class="pbx-search">
            <svg class="pbx-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>
            <input class="pbx-input" type="search" maxlength="180" autocomplete="off" placeholder="Digite aqui sua busca..." aria-label="Digite o que você procura">
            <button class="pbx-mic" type="button" aria-label="Busca por voz em breve"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"></path></svg></button>
            <button class="pbx-submit" type="button">Buscar</button>
          </div>
          <div class="pbx-popular">
            <div class="pbx-popular-label">OS MAIS PROCURADOS DE HOJE:</div>
            <div class="pbx-chips"></div>
          </div>
          <div class="pbx-toast" aria-live="polite"></div>
        </div>
      </section>`;

    document.body.appendChild(root);

    const panel = root.querySelector(".pbx-panel");
    const tab = root.querySelector(".pbx-tab");
    const input = root.querySelector(".pbx-input");
    const submit = root.querySelector(".pbx-submit");
    const mic = root.querySelector(".pbx-mic");
    const close = root.querySelector(".pbx-close");
    const toast = root.querySelector(".pbx-toast");
    const chipsWrap = root.querySelector(".pbx-chips");
    let pointerInside = false;
    let toastTimer = null;

    function toastMessage(message) {
      if (toastTimer) window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("show");
      toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
    }

    function renderPopularTerms(terms) {
      const cleaned = (Array.isArray(terms) ? terms : [])
        .map((item) => typeof item === "string" ? item : item?.termo)
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 15);

      const finalTerms = cleaned.length
        ? [...cleaned, ...FALLBACK_TERMS.filter((term) => !cleaned.some((current) => current.toLocaleLowerCase("pt-BR") === term.toLocaleLowerCase("pt-BR")))]
            .slice(0, 15)
        : FALLBACK_TERMS;

      chipsWrap.innerHTML = "";

      finalTerms.forEach((term) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pbx-chip";
        button.textContent = term;
        button.dataset.term = term;
        button.addEventListener("click", () => {
          input.value = term;
          submitSearch();
        });
        chipsWrap.appendChild(button);
      });
    }

    async function loadPopularTerms() {
      renderPopularTerms(FALLBACK_TERMS);

      try {
        const rows = await maisBuscadosHoje(15);
        if (Array.isArray(rows) && rows.length) {
          renderPopularTerms(rows);
        }
      } catch (error) {
        console.warn("Não foi possível carregar os mais procurados de hoje:", error?.message || error);
      }
    }

    function scheduleNext() {
      if (autoOpenTimer) window.clearTimeout(autoOpenTimer);
      autoOpenTimer = window.setTimeout(() => openPanel(true), randomDelay());
    }

    function scheduleClose() {
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      autoCloseTimer = window.setTimeout(() => {
        if (pointerInside || document.activeElement === input) {
          scheduleClose();
          return;
        }
        closePanel(true);
      }, AUTO_VISIBLE_MS);
    }

    function openPanel(automatic = false) {
      if (autoOpenTimer) window.clearTimeout(autoOpenTimer);
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      panel.classList.add("is-open");
      scheduleClose();
      if (!automatic) window.setTimeout(() => input.focus(), 320);
    }

    function closePanel(scheduleAgain = true) {
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      panel.classList.remove("is-open");
      if (scheduleAgain) scheduleNext();
    }

    function submitSearch() {
      const ok = navigateToSearch(input.value);
      if (ok) return;
      root.classList.remove("pbx-shake");
      void root.offsetWidth;
      root.classList.add("pbx-shake");
      input.focus();
    }

    tab.addEventListener("click", () => openPanel(false));
    tab.addEventListener("mouseenter", () => openPanel(true));
    close.addEventListener("click", () => closePanel(true));
    submit.addEventListener("click", submitSearch);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitSearch();
      }
    });
    mic.addEventListener("click", () => toastMessage("Busca por voz entra na próxima etapa."));
    panel.addEventListener("mouseenter", () => { pointerInside = true; });
    panel.addEventListener("mouseleave", () => { pointerInside = false; });

    loadPopularTerms();
    autoOpenTimer = window.setTimeout(() => openPanel(true), FIRST_OPEN_MS);
  }

  function refresh() {
    if (shouldRun()) mount(); else removeRoot();
  }

  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function (...args) { const result = push.apply(this, args); window.setTimeout(refresh, 0); return result; };
  history.replaceState = function (...args) { const result = replace.apply(this, args); window.setTimeout(refresh, 0); return result; };
  window.addEventListener("popstate", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("resize", refresh);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
})();