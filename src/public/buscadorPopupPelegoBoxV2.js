import { maisBuscadosHoje, prepararBuscaProjeto } from "backend/buscasProjetos.web";

(() => {
  const ROOT_ID = "pelego-search-flyout-v2";
  const TARGET_PATHS = new Set(["/ranking", "/videos-dos-projetos-prontos"]);
  const SEARCH_PATH = "/videos-dos-projetos-prontos";
  const MASCOT_IMAGE = "https://static.wixstatic.com/media/354683_1f33596da86e47a08bb651e97b4a4676~mv2.png";

  const AUTO_VISIBLE_MS = 10000;
  const FIRST_OPEN_MS = 1800;
  const NEXT_MIN_MS = 26000;
  const NEXT_MAX_MS = 44000;
  const POPULAR_LIMIT = 5;

  const FALLBACK_TERMS = ["Tornado", "Eros", "WPU", "Line Array", "T15"];
  const CHIP_COLORS = ["#1674f4", "#e51f3f", "#ff7a00", "#7a20c7", "#19a64a"];

  let autoOpenTimer = null;
  let autoCloseTimer = null;

  const currentPath = () =>
    (window.location.pathname || "/").toLowerCase().replace(/\/$/, "") || "/";

  const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;
  const shouldRun = () => isDesktop() && TARGET_PATHS.has(currentPath());
  const randomDelay = () =>
    Math.floor(NEXT_MIN_MS + Math.random() * (NEXT_MAX_MS - NEXT_MIN_MS));

  function clearTimers() {
    if (autoOpenTimer) clearTimeout(autoOpenTimer);
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
    autoOpenTimer = null;
    autoCloseTimer = null;
  }

  function removeRoot() {
    clearTimers();
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById("pelego-search-flyout")?.remove();
  }

  function prettyTerm(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const fallback = FALLBACK_TERMS.find(
      (term) => term.toLocaleLowerCase("pt-BR") === raw.toLocaleLowerCase("pt-BR")
    );
    if (fallback) return fallback;

    return raw
      .split(/\s+/)
      .map((word) => {
        if (/^[a-z]{1,4}\d+$/i.test(word) || /^[a-z]{2,4}$/i.test(word)) {
          return word.toLocaleUpperCase("pt-BR");
        }
        return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR");
      })
      .join(" ");
  }

  function navigateToSearch(resolvedTerm, originalTerm = "") {
    const resolved = String(resolvedTerm || "").trim();
    const original = String(originalTerm || "").trim();
    if (!resolved) return false;

    // A busca do popup é SEMPRE global. Marca anterior nunca acompanha a nova busca.
    const url = new URL(SEARCH_PATH, window.location.origin);
    url.searchParams.set("busca", resolved);

    if (original && original.toLocaleLowerCase("pt-BR") !== resolved.toLocaleLowerCase("pt-BR")) {
      url.searchParams.set("busca_original", original);
    }

    window.location.assign(url.pathname + url.search);
    return true;
  }

  function mount() {
    if (!shouldRun()) {
      removeRoot();
      return;
    }

    if (document.getElementById(ROOT_ID)) return;
    document.getElementById("pelego-search-flyout")?.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <style>
        #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#0b1f55}
        #${ROOT_ID} *{box-sizing:border-box}

        #${ROOT_ID} .pbx-tab{
          position:fixed;left:0;top:50%;transform:translateY(-50%);
          width:72px;height:198px;
          border:1.5px solid #83c7ff;border-left:0;border-radius:0 36px 36px 0;
          background:linear-gradient(180deg,#1674f4 0%,#0a4bd6 52%,#062e9c 100%);
          color:#fff;box-shadow:0 12px 30px rgba(0,65,190,.30),inset 0 0 0 1px rgba(255,255,255,.16);
          pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:7px;text-align:center;padding:12px 4px;z-index:7;transition:filter .18s ease,transform .18s ease
        }
        #${ROOT_ID} .pbx-tab:hover{filter:brightness(1.09);transform:translateY(-50%) translateX(2px)}
        #${ROOT_ID} .pbx-tab svg{width:31px;height:31px;stroke:#fff;stroke-width:2.2;fill:none}
        #${ROOT_ID} .pbx-tab strong{font-size:10px;line-height:1.08}
        #${ROOT_ID} .pbx-brand{font-size:10px;font-weight:900}
        #${ROOT_ID} .pbx-brand b{color:#ff4052}
        #${ROOT_ID} .pbx-chevrons{font-size:30px;line-height:.7;font-weight:300}

        #${ROOT_ID} .pbx-panel{
          position:fixed;left:72px;top:50%;width:min(590px,calc(100vw - 96px));
          transform:translate(calc(-100% - 86px),-50%);opacity:0;visibility:hidden;
          pointer-events:auto;transition:transform .64s cubic-bezier(.18,.9,.24,1),opacity .20s ease;z-index:6
        }
        #${ROOT_ID} .pbx-panel.is-open{transform:translate(0,-50%);opacity:1;visibility:visible}

        #${ROOT_ID} .pbx-card{
          position:relative;background:rgba(255,255,255,.995);border:1.5px solid #bcdcff;border-radius:34px;
          padding:31px 28px 20px;box-shadow:0 22px 54px rgba(11,35,91,.23),0 0 0 5px rgba(65,136,255,.045),0 0 30px rgba(36,106,255,.10);overflow:visible
        }

        #${ROOT_ID} .pbx-mascot{
          position:absolute;left:-2px;top:-114px;width:226px;height:194px;overflow:hidden;pointer-events:none;z-index:2;
          clip-path:polygon(10% 0,100% 0,100% 100%,20% 100%,20% 91%,0 91%,0 20%,10% 20%)
        }
        #${ROOT_ID} .pbx-mascot img{position:absolute;max-width:none;width:590px;height:auto;left:-72px;top:-2px;filter:drop-shadow(0 8px 10px rgba(0,0,0,.10))}

        #${ROOT_ID} .pbx-close{position:absolute;right:14px;top:14px;width:34px;height:34px;border:1px solid #dce8ff;border-radius:50%;background:#f3f7ff;color:#183b86;font-size:23px;line-height:1;cursor:pointer}
        #${ROOT_ID} .pbx-head{padding-left:165px;min-height:72px;padding-right:26px}
        #${ROOT_ID} .pbx-title{margin:0;font-size:30px;line-height:1.05;font-weight:900;color:#0b1f55}
        #${ROOT_ID} .pbx-title span{color:#1568ef}
        #${ROOT_ID} .pbx-sub{margin:7px 0 0;font-size:13px;line-height:1.35;color:#617097}

        #${ROOT_ID} .pbx-search{
          display:flex;align-items:center;gap:8px;margin-top:18px;height:58px;padding:5px 7px 5px 15px;
          border:2px solid #79b9ff;border-radius:999px;background:#fff;
          box-shadow:0 0 0 5px rgba(56,129,255,.07),0 8px 19px rgba(30,93,202,.11)
        }
        #${ROOT_ID} .pbx-search:focus-within{border-color:#2878ef;box-shadow:0 0 0 5px rgba(40,120,239,.10),0 8px 20px rgba(30,93,202,.13)}
        #${ROOT_ID} .pbx-search-icon{width:23px;height:23px;flex:0 0 23px;stroke:#164fd8;stroke-width:2.4;fill:none}
        #${ROOT_ID} .pbx-input{
          min-width:0;flex:1;height:44px;border:0!important;outline:0!important;background:transparent!important;
          box-shadow:none!important;color:#0b1f55;font-size:17px;font-weight:600;padding:0 6px;line-height:44px;
          appearance:none;-webkit-appearance:none
        }
        #${ROOT_ID} .pbx-input::-webkit-search-cancel-button{display:none}
        #${ROOT_ID} .pbx-input::placeholder{color:#9aa8c2;font-weight:500;opacity:1}
        #${ROOT_ID} .pbx-mic{width:40px;height:40px;flex:0 0 40px;border:0;border-radius:50%;background:#edf3ff;color:#2468e8;cursor:pointer;display:grid;place-items:center}
        #${ROOT_ID} .pbx-mic svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none}
        #${ROOT_ID} .pbx-submit{height:42px;min-width:92px;padding:0 21px;border:0;border-radius:999px;background:linear-gradient(90deg,#216bf3,#1551d8);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 6px 14px rgba(24,91,224,.25)}
        #${ROOT_ID} .pbx-submit:disabled{opacity:.7;cursor:wait}

        #${ROOT_ID} .pbx-popular{display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-top:15px}
        #${ROOT_ID} .pbx-popular-label{width:100%;font-size:11px;font-weight:900;letter-spacing:.35px;color:#213768;margin-bottom:1px}
        #${ROOT_ID} .pbx-chips{display:flex;flex-wrap:nowrap;gap:7px;width:100%}
        #${ROOT_ID} .pbx-chip{
          min-width:0;flex:1;border:1px solid #d7e5fb;border-radius:999px;background:#fff;color:#34466f;
          padding:7px 7px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(27,67,145,.06);
          display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap
        }
        #${ROOT_ID} .pbx-chip:hover{border-color:#80b8ff;color:#1257df;background:#f8fbff}
        #${ROOT_ID} .pbx-chip-icon{width:19px;height:19px;flex:0 0 19px;border-radius:50%;display:grid;place-items:center;color:#fff}
        #${ROOT_ID} .pbx-chip-icon svg{width:11px;height:11px;stroke:#fff;stroke-width:2.4;fill:none}

        #${ROOT_ID} .pbx-toast{position:absolute;left:50%;bottom:-42px;transform:translateX(-50%);padding:8px 12px;border-radius:999px;background:#0b1f55;color:#fff;font-size:12px;white-space:nowrap;opacity:0;transition:opacity .2s ease;pointer-events:none}
        #${ROOT_ID} .pbx-toast.show{opacity:1}
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
          <div class="pbx-mascot"><img src="${MASCOT_IMAGE}" alt=""></div>
          <button class="pbx-close" type="button" aria-label="Fechar buscador">×</button>

          <div class="pbx-head">
            <h2 class="pbx-title">Encontre seu <span>projeto!</span></h2>
            <p class="pbx-sub">Digite o que você procura. A busca localiza projetos prontos parecidos no site.</p>
          </div>

          <div class="pbx-search">
            <svg class="pbx-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>
            <input class="pbx-input" type="search" maxlength="180" autocomplete="off" spellcheck="false" placeholder="Digite aqui sua busca..." aria-label="Digite o que você procura">
            <button class="pbx-mic" type="button" aria-label="Busca por voz em breve"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"></path></svg></button>
            <button class="pbx-submit" type="button">Buscar</button>
          </div>

          <div class="pbx-popular">
            <div class="pbx-popular-label">OS MAIS BUSCADOS HOJE:</div>
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
    let submitting = false;

    function toastMessage(message) {
      if (toastTimer) clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("show");
      toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    }

    function renderPopularTerms(terms) {
      const cleaned = (Array.isArray(terms) ? terms : [])
        .map((item) => typeof item === "string" ? item : item?.termo)
        .map(prettyTerm)
        .filter(Boolean)
        .slice(0, POPULAR_LIMIT);

      const lower = new Set(cleaned.map((term) => term.toLocaleLowerCase("pt-BR")));
      const finalTerms = [
        ...cleaned,
        ...FALLBACK_TERMS.filter((term) => !lower.has(term.toLocaleLowerCase("pt-BR")))
      ].slice(0, POPULAR_LIMIT);

      chipsWrap.innerHTML = "";

      finalTerms.forEach((term, index) => {
        const button = document.createElement("button");
        const icon = document.createElement("span");
        const label = document.createElement("span");

        button.type = "button";
        button.className = "pbx-chip";
        icon.className = "pbx-chip-icon";
        icon.style.background = CHIP_COLORS[index % CHIP_COLORS.length];
        icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5"></circle><path d="M14 14L19 19"></path></svg>`;
        label.textContent = term;

        button.appendChild(icon);
        button.appendChild(label);
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
        const rows = await maisBuscadosHoje(POPULAR_LIMIT);
        if (Array.isArray(rows) && rows.length) renderPopularTerms(rows);
      } catch (error) {
        console.warn("Mais buscados indisponíveis:", error?.message || error);
      }
    }

    function scheduleNext() {
      if (autoOpenTimer) clearTimeout(autoOpenTimer);
      autoOpenTimer = setTimeout(() => openPanel(true), randomDelay());
    }

    function scheduleClose() {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      autoCloseTimer = setTimeout(() => {
        if (pointerInside || document.activeElement === input || submitting) {
          scheduleClose();
          return;
        }
        closePanel(true);
      }, AUTO_VISIBLE_MS);
    }

    function openPanel(automatic = false) {
      if (autoOpenTimer) clearTimeout(autoOpenTimer);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      panel.classList.add("is-open");
      scheduleClose();
      if (!automatic) setTimeout(() => input.focus(), 300);
    }

    function closePanel(scheduleAgain = true) {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      panel.classList.remove("is-open");
      if (scheduleAgain) scheduleNext();
    }

    function invalidSearch() {
      root.classList.remove("pbx-shake");
      void root.offsetWidth;
      root.classList.add("pbx-shake");
      input.focus();
    }

    async function submitSearch() {
      if (submitting) return;

      const original = String(input.value || "").trim();
      if (!original) {
        invalidSearch();
        return;
      }

      submitting = true;
      submit.disabled = true;
      const oldLabel = submit.textContent;
      submit.textContent = "Buscando...";

      let resolved = original;

      try {
        const prepared = await prepararBuscaProjeto(original, currentPath());
        if (prepared?.termoResolvido) resolved = prepared.termoResolvido;
      } catch (error) {
        console.warn("Busca aproximada indisponível, usando termo original:", error?.message || error);
      }

      if (!navigateToSearch(resolved, original)) {
        submitting = false;
        submit.disabled = false;
        submit.textContent = oldLabel;
        invalidSearch();
      }
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
    autoOpenTimer = setTimeout(() => openPanel(true), FIRST_OPEN_MS);
  }

  function refresh() {
    if (shouldRun()) mount();
    else removeRoot();
  }

  const push = history.pushState;
  const replace = history.replaceState;

  history.pushState = function (...args) {
    const result = push.apply(this, args);
    setTimeout(refresh, 0);
    return result;
  };

  history.replaceState = function (...args) {
    const result = replace.apply(this, args);
    setTimeout(refresh, 0);
    return result;
  };

  window.addEventListener("popstate", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("resize", refresh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();