(() => {
  const ROOT_ID = "pelego-search-flyout";
  const TARGET_PATHS = new Set([
    "/ranking",
    "/videos-dos-projetos-prontos"
  ]);

  const SEARCH_PATH = "/videos-dos-projetos-prontos";

  const LEFT_IMAGE =
    "https://static.wixstatic.com/media/354683_1f33596da86e47a08bb651e97b4a4676~mv2.png";

  const RIGHT_IMAGE =
    "https://static.wixstatic.com/media/354683_7d2fd018ab2745d78ec3f033975b122b~mv2.png";

  const AUTO_VISIBLE_MS = 10000;
  const FIRST_MIN_MS = 1800;
  const FIRST_MAX_MS = 4500;
  const NEXT_MIN_MS = 22000;
  const NEXT_MAX_MS = 42000;

  let autoOpenTimer = null;
  let autoCloseTimer = null;

  function normalizedPath() {
    const path = (window.location.pathname || "/")
      .toLowerCase()
      .replace(/\/$/, "");

    return path || "/";
  }

  function isDesktop() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function shouldRun() {
    return isDesktop() && TARGET_PATHS.has(normalizedPath());
  }

  function randomBetween(min, max) {
    return Math.floor(min + Math.random() * (max - min));
  }

  function randomSide() {
    return Math.random() < 0.5 ? "left" : "right";
  }

  function clearAutoOpen() {
    if (autoOpenTimer) {
      window.clearTimeout(autoOpenTimer);
      autoOpenTimer = null;
    }
  }

  function clearAutoClose() {
    if (autoCloseTimer) {
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  function navigateToSearch(term) {
    const value = String(term || "").trim();

    if (!value) {
      return false;
    }

    const url = new URL(SEARCH_PATH, window.location.origin);
    url.searchParams.set("busca", value);

    const brand = new URLSearchParams(window.location.search).get("marca");

    if (brand) {
      url.searchParams.set("marca", brand);
    }

    window.location.assign(url.pathname + url.search);
    return true;
  }

  function removeRoot() {
    clearAutoOpen();
    clearAutoClose();

    const current = document.getElementById(ROOT_ID);

    if (current) {
      current.remove();
    }
  }

  function mount() {
    if (!shouldRun()) {
      removeRoot();
      return;
    }

    if (document.getElementById(ROOT_ID)) {
      return;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;

    root.innerHTML = `
      <style>
        #${ROOT_ID} {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          pointer-events: none;
          font-family: Arial, Helvetica, sans-serif;
        }

        #${ROOT_ID} .pbx-tab {
          position: fixed;
          top: 50%;
          width: 74px;
          height: 154px;
          transform: translateY(-50%);
          border: 1px solid rgba(124,190,255,.75);
          border-radius: 0 22px 22px 0;
          background: linear-gradient(180deg,#163ba9 0%,#041c6d 100%);
          color: #fff;
          box-shadow: 0 10px 24px rgba(0,43,160,.30), inset 0 0 18px rgba(68,178,255,.35);
          cursor: pointer;
          pointer-events: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 8px 5px;
          box-sizing: border-box;
          font-size: 10px;
          line-height: 1.05;
          text-align: center;
          transition: transform .18s ease, filter .18s ease;
          z-index: 4;
        }

        #${ROOT_ID} .pbx-tab:hover {
          filter: brightness(1.12);
        }

        #${ROOT_ID} .pbx-tab-left {
          left: 0;
        }

        #${ROOT_ID} .pbx-tab-right {
          right: 0;
          border-radius: 22px 0 0 22px;
        }

        #${ROOT_ID} .pbx-tab svg {
          width: 27px;
          height: 27px;
          stroke: #fff;
          stroke-width: 2.2;
          fill: none;
        }

        #${ROOT_ID} .pbx-tab strong {
          font-size: 10px;
          letter-spacing: .2px;
        }

        #${ROOT_ID} .pbx-tab .pbx-brand {
          font-weight: 800;
          color: #fff;
        }

        #${ROOT_ID} .pbx-tab .pbx-brand b {
          color: #ff2f3e;
        }

        #${ROOT_ID} .pbx-chevrons {
          font-size: 24px;
          line-height: .8;
          font-weight: 300;
        }

        #${ROOT_ID} .pbx-panel {
          position: fixed;
          top: 50%;
          width: min(640px, calc(100vw - 90px));
          transform: translateY(-50%);
          pointer-events: auto;
          opacity: 0;
          visibility: hidden;
          transition: transform .68s cubic-bezier(.2,.9,.25,1), opacity .28s ease;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,.24));
          z-index: 3;
        }

        #${ROOT_ID} .pbx-panel.side-left {
          left: 0;
          transform: translate(-110%, -50%);
        }

        #${ROOT_ID} .pbx-panel.side-right {
          right: 0;
          transform: translate(110%, -50%);
        }

        #${ROOT_ID} .pbx-panel.is-open.side-left,
        #${ROOT_ID} .pbx-panel.is-open.side-right {
          transform: translate(0, -50%);
          opacity: 1;
          visibility: visible;
        }

        #${ROOT_ID} .pbx-stage {
          position: relative;
          width: 100%;
          overflow: visible;
          user-select: none;
        }

        #${ROOT_ID} .pbx-art {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          pointer-events: none;
        }

        #${ROOT_ID} .pbx-input,
        #${ROOT_ID} .pbx-submit,
        #${ROOT_ID} .pbx-mic,
        #${ROOT_ID} .pbx-close {
          position: absolute;
          box-sizing: border-box;
        }

        #${ROOT_ID} .pbx-input {
          border: 0;
          outline: 0;
          background: transparent;
          color: #172a55;
          font-weight: 600;
          user-select: text;
          box-shadow: none;
        }

        #${ROOT_ID} .pbx-input::placeholder {
          color: #8e9ab3;
          font-weight: 500;
        }

        #${ROOT_ID} .pbx-submit,
        #${ROOT_ID} .pbx-mic,
        #${ROOT_ID} .pbx-close {
          border: 0;
          background: transparent;
          cursor: pointer;
          color: transparent;
        }

        #${ROOT_ID} .variant-left .pbx-input {
          left: 21.7%;
          top: 56.7%;
          width: 49.5%;
          height: 9.3%;
          padding: 0 1%;
          font-size: clamp(13px,1.25vw,18px);
        }

        #${ROOT_ID} .variant-left .pbx-mic {
          left: 74.2%;
          top: 56.4%;
          width: 6.3%;
          height: 10.2%;
        }

        #${ROOT_ID} .variant-left .pbx-submit {
          left: 80.6%;
          top: 56.3%;
          width: 13.1%;
          height: 10.3%;
        }

        #${ROOT_ID} .variant-left .pbx-close {
          right: 3.5%;
          top: 35.8%;
          width: 5.8%;
          aspect-ratio: 1;
        }

        #${ROOT_ID} .variant-right .pbx-input {
          left: 25.5%;
          top: 65.5%;
          width: 54%;
          height: 9%;
          padding: 0 1%;
          font-size: clamp(13px,1.25vw,18px);
        }

        #${ROOT_ID} .variant-right .pbx-mic {
          left: 80.7%;
          top: 64.8%;
          width: 7.2%;
          height: 10.8%;
        }

        #${ROOT_ID} .variant-right .pbx-submit {
          left: 24%;
          top: 78.7%;
          width: 72%;
          height: 10%;
        }

        #${ROOT_ID} .variant-right .pbx-close {
          right: 6%;
          top: 8.5%;
          width: 6%;
          aspect-ratio: 1;
        }

        #${ROOT_ID} .pbx-toast {
          position: absolute;
          left: 50%;
          bottom: 2%;
          transform: translate(-50%,8px);
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(8,24,71,.94);
          color: #fff;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          transition: .2s ease;
          pointer-events: none;
        }

        #${ROOT_ID} .pbx-toast.show {
          opacity: 1;
          transform: translate(-50%,0);
        }

        #${ROOT_ID}.pbx-shake .pbx-stage {
          animation: pbxShake .28s linear 1;
        }

        @keyframes pbxShake {
          0%,100% { transform: translateX(0); }
          30% { transform: translateX(-6px); }
          70% { transform: translateX(6px); }
        }

        @media (max-width: 767px) {
          #${ROOT_ID} {
            display: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          #${ROOT_ID} .pbx-panel {
            transition: none;
          }
        }
      </style>

      <button class="pbx-tab pbx-tab-left" data-side="left" type="button" aria-label="Abrir buscador de projetos pela esquerda">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>
        <strong>Pesquisar<br>Projetos</strong>
        <span class="pbx-brand">PELEGO <b>BOX</b></span>
        <span class="pbx-chevrons">››</span>
      </button>

      <button class="pbx-tab pbx-tab-right" data-side="right" type="button" aria-label="Abrir buscador de projetos pela direita">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path></svg>
        <strong>Pesquisar<br>Projetos</strong>
        <span class="pbx-brand">PELEGO <b>BOX</b></span>
        <span class="pbx-chevrons">‹‹</span>
      </button>

      <section class="pbx-panel side-left variant-left" role="search" aria-label="Buscador de projetos prontos">
        <div class="pbx-stage">
          <img class="pbx-art" alt="" src="${LEFT_IMAGE}">
          <input class="pbx-input" type="search" maxlength="180" autocomplete="off" placeholder="Digite aqui sua busca..." aria-label="Digite o que você procura">
          <button class="pbx-submit" type="button" aria-label="Buscar projetos">Buscar</button>
          <button class="pbx-mic" type="button" aria-label="Busca por voz, em breve"></button>
          <button class="pbx-close" type="button" aria-label="Fechar buscador"></button>
          <div class="pbx-toast" aria-live="polite"></div>
        </div>
      </section>
    `;

    document.body.appendChild(root);

    const panel = root.querySelector(".pbx-panel");
    const art = root.querySelector(".pbx-art");
    const input = root.querySelector(".pbx-input");
    const submit = root.querySelector(".pbx-submit");
    const mic = root.querySelector(".pbx-mic");
    const close = root.querySelector(".pbx-close");
    const toast = root.querySelector(".pbx-toast");
    const tabs = [...root.querySelectorAll(".pbx-tab")];

    let currentSide = null;
    let toastTimer = null;
    let pointerIsInside = false;

    function showToast(message) {
      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }

      toast.textContent = message;
      toast.classList.add("show");

      toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
      }, 2400);
    }

    function scheduleNextAuto(first = false) {
      clearAutoOpen();

      const delay = first
        ? randomBetween(FIRST_MIN_MS, FIRST_MAX_MS)
        : randomBetween(NEXT_MIN_MS, NEXT_MAX_MS);

      autoOpenTimer = window.setTimeout(() => {
        openPanel(randomSide(), true);
      }, delay);
    }

    function scheduleClose() {
      clearAutoClose();

      autoCloseTimer = window.setTimeout(() => {
        if (pointerIsInside || document.activeElement === input) {
          scheduleClose();
          return;
        }

        closePanel(true);
      }, AUTO_VISIBLE_MS);
    }

    function setVariant(side) {
      currentSide = side;
      panel.classList.remove("side-left", "side-right", "variant-left", "variant-right");
      panel.classList.add(`side-${side}`, `variant-${side}`);
      art.src = side === "left" ? LEFT_IMAGE : RIGHT_IMAGE;
      input.value = "";
    }

    function openPanel(side, automatic = false) {
      clearAutoOpen();
      clearAutoClose();

      setVariant(side);
      panel.classList.add("is-open");

      scheduleClose();

      if (!automatic) {
        window.setTimeout(() => input.focus(), 350);
      }
    }

    function closePanel(scheduleAgain = true) {
      clearAutoClose();
      panel.classList.remove("is-open");
      currentSide = null;

      if (scheduleAgain) {
        scheduleNextAuto(false);
      }
    }

    function submitSearch() {
      const ok = navigateToSearch(input.value);

      if (!ok) {
        root.classList.remove("pbx-shake");
        void root.offsetWidth;
        root.classList.add("pbx-shake");
        input.focus();
      }
    }

    tabs.forEach((tab) => {
      const side = tab.dataset.side;

      tab.addEventListener("click", () => openPanel(side, false));

      tab.addEventListener("mouseenter", () => {
        window.setTimeout(() => {
          if (tab.matches(":hover")) {
            openPanel(side, true);
          }
        }, 220);
      });
    });

    panel.addEventListener("mouseenter", () => {
      pointerIsInside = true;
      clearAutoClose();
    });

    panel.addEventListener("mouseleave", () => {
      pointerIsInside = false;

      if (panel.classList.contains("is-open")) {
        scheduleClose();
      }
    });

    input.addEventListener("focus", clearAutoClose);

    input.addEventListener("blur", () => {
      if (panel.classList.contains("is-open")) {
        scheduleClose();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitSearch();
      }
    });

    submit.addEventListener("click", submitSearch);

    mic.addEventListener("click", () => {
      showToast("Busca por voz entra na próxima etapa.");
    });

    close.addEventListener("click", () => closePanel(true));

    scheduleNextAuto(true);
  }

  function refreshForRoute() {
    if (shouldRun()) {
      mount();
    } else {
      removeRoot();
    }
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    window.setTimeout(refreshForRoute, 0);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    window.setTimeout(refreshForRoute, 0);
    return result;
  };

  window.addEventListener("popstate", refreshForRoute);
  window.addEventListener("pageshow", refreshForRoute);
  window.addEventListener("resize", refreshForRoute);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshForRoute, { once: true });
  } else {
    refreshForRoute();
  }
})();