(() => {
  const POPUP_ID = "pelego-search-flyout";
  const TARGET_PATHS = new Set([
    "/projetos-prontos",
    "/videos-dos-projetos-prontos"
  ]);
  const SEARCH_PATH = "/buscador-projetos-prontos";
  const IMAGE_URL = "https://static.wixstatic.com/media/354683_1f33596da86e47a08bb651e97b4a4676~mv2.png";
  const VISIBLE_MS = 9000;
  const MIN_HIDDEN_MS = 16000;
  const MAX_HIDDEN_MS = 26000;

  let cycleTimer = null;

  function normalizedPath() {
    const path = (window.location.pathname || "/")
      .toLowerCase()
      .replace(/\/$/, "");

    return path || "/";
  }

  function shouldRun() {
    return TARGET_PATHS.has(normalizedPath());
  }

  function clearTimer() {
    if (cycleTimer) {
      window.clearTimeout(cycleTimer);
      cycleTimer = null;
    }
  }

  function randomHiddenDelay() {
    return Math.floor(
      MIN_HIDDEN_MS +
      Math.random() * (MAX_HIDDEN_MS - MIN_HIDDEN_MS)
    );
  }

  function navigateToSearch(term) {
    const value = String(term || "").trim();

    if (!value) {
      return false;
    }

    const url = new URL(
      SEARCH_PATH,
      window.location.origin
    );

    url.searchParams.set("busca", value);

    const brand = new URLSearchParams(
      window.location.search
    ).get("marca");

    if (brand) {
      url.searchParams.set("marca", brand);
    }

    window.location.assign(
      url.pathname + url.search
    );

    return true;
  }

  function removePopup() {
    clearTimer();

    const current = document.getElementById(
      POPUP_ID
    );

    if (current) {
      current.remove();
    }
  }

  function mountPopup() {
    if (!shouldRun()) {
      removePopup();
      return;
    }

    if (document.getElementById(POPUP_ID)) {
      return;
    }

    const host = document.createElement("div");

    host.id = POPUP_ID;
    host.setAttribute("role", "search");
    host.setAttribute(
      "aria-label",
      "Buscador de projetos prontos"
    );

    host.innerHTML = `
      <style>
        #${POPUP_ID} {
          position: fixed;
          left: 0;
          top: 50%;
          width: min(640px, 94vw);
          aspect-ratio: 3 / 2;
          transform: translate(-100%, -50%);
          z-index: 2147483000;
          transition: transform .72s cubic-bezier(.2,.9,.25,1);
          pointer-events: none;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,.25));
          font-family: Arial, Helvetica, sans-serif;
        }

        #${POPUP_ID}.is-visible {
          transform: translate(0, -50%);
        }

        #${POPUP_ID}.is-peeking {
          transform: translate(calc(-100% + 84px), -50%);
        }

        #${POPUP_ID} .pbx-wrap {
          position: relative;
          width: 100%;
          height: 100%;
          pointer-events: auto;
          user-select: none;
        }

        #${POPUP_ID} .pbx-art {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
        }

        #${POPUP_ID} .pbx-input {
          position: absolute;
          left: 21.2%;
          top: 56.1%;
          width: 52.2%;
          height: 10.7%;
          border: 0;
          outline: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.97);
          padding: 0 2.2%;
          box-sizing: border-box;
          color: #0a1b52;
          font-weight: 600;
          font-size: clamp(13px, 1.35vw, 18px);
          box-shadow: inset 0 0 0 1px rgba(35,111,255,.08);
          user-select: text;
        }

        #${POPUP_ID} .pbx-input::placeholder {
          color: #8b95ad;
          font-weight: 500;
        }

        #${POPUP_ID} .pbx-submit {
          position: absolute;
          left: 80.1%;
          top: 56.2%;
          width: 13.5%;
          height: 10.5%;
          border: 0;
          border-radius: 999px;
          background: transparent;
          cursor: pointer;
          color: transparent;
        }

        #${POPUP_ID} .pbx-mic {
          position: absolute;
          left: 73.7%;
          top: 56.1%;
          width: 6.4%;
          height: 10.5%;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }

        #${POPUP_ID} .pbx-close {
          position: absolute;
          right: 3.5%;
          top: 36%;
          width: 5.5%;
          aspect-ratio: 1;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }

        #${POPUP_ID} .pbx-tab {
          position: absolute;
          left: 0;
          top: 42%;
          width: 11%;
          height: 31%;
          border: 0;
          border-radius: 0 24px 24px 0;
          background: transparent;
          cursor: pointer;
        }

        #${POPUP_ID} .pbx-toast {
          position: absolute;
          left: 15%;
          bottom: 1.8%;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(8,24,71,.92);
          color: #fff;
          font-size: 12px;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity .2s ease, transform .2s ease;
          pointer-events: none;
          white-space: nowrap;
        }

        #${POPUP_ID} .pbx-toast.show {
          opacity: 1;
          transform: translateY(0);
        }

        #${POPUP_ID}.pbx-shake .pbx-wrap {
          animation: pbxShake .28s linear 1;
        }

        @keyframes pbxShake {
          0%,100% { transform: translateX(0); }
          30% { transform: translateX(-6px); }
          70% { transform: translateX(6px); }
        }

        @media (max-width: 620px) {
          #${POPUP_ID} {
            width: min(96vw, 500px);
            top: 48%;
          }

          #${POPUP_ID}.is-peeking {
            transform: translate(calc(-100% + 60px), -50%);
          }

          #${POPUP_ID} .pbx-input {
            font-size: 13px;
          }

          #${POPUP_ID} .pbx-toast {
            left: 10%;
            font-size: 11px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          #${POPUP_ID} {
            transition: none;
          }
        }
      </style>

      <div class="pbx-wrap">
        <img class="pbx-art" alt="" src="${IMAGE_URL}">

        <input
          class="pbx-input"
          type="search"
          maxlength="180"
          autocomplete="off"
          placeholder="Digite aqui sua busca..."
          aria-label="Digite o que você procura"
        >

        <button
          class="pbx-submit"
          type="button"
          aria-label="Buscar projetos"
        >Buscar</button>

        <button
          class="pbx-mic"
          type="button"
          aria-label="Busca por voz, em breve"
        ></button>

        <button
          class="pbx-close"
          type="button"
          aria-label="Fechar buscador"
        ></button>

        <button
          class="pbx-tab"
          type="button"
          aria-label="Abrir buscador de projetos"
        ></button>

        <div
          class="pbx-toast"
          aria-live="polite"
        ></div>
      </div>
    `;

    document.body.appendChild(host);

    const input = host.querySelector(".pbx-input");
    const submit = host.querySelector(".pbx-submit");
    const mic = host.querySelector(".pbx-mic");
    const close = host.querySelector(".pbx-close");
    const tab = host.querySelector(".pbx-tab");
    const toast = host.querySelector(".pbx-toast");

    let toastTimer = null;

    function showToast(message) {
      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }

      toast.textContent = message;
      toast.classList.add("show");

      toastTimer = window.setTimeout(
        () => toast.classList.remove("show"),
        2600
      );
    }

    function show() {
      clearTimer();
      host.classList.remove("is-peeking");
      host.classList.add("is-visible");

      cycleTimer = window.setTimeout(
        hideAndSchedule,
        VISIBLE_MS
      );
    }

    function peek() {
      host.classList.remove("is-visible");
      host.classList.add("is-peeking");
    }

    function hideAndSchedule() {
      clearTimer();
      peek();

      cycleTimer = window.setTimeout(
        show,
        randomHiddenDelay()
      );
    }

    function submitSearch() {
      const ok = navigateToSearch(input.value);

      if (!ok) {
        host.classList.remove("pbx-shake");
        void host.offsetWidth;
        host.classList.add("pbx-shake");
        input.focus();
      }
    }

    submit.addEventListener(
      "click",
      submitSearch
    );

    input.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitSearch();
        }
      }
    );

    input.addEventListener("focus", () => {
      clearTimer();
      host.classList.remove("is-peeking");
      host.classList.add("is-visible");
    });

    input.addEventListener("blur", () => {
      cycleTimer = window.setTimeout(
        hideAndSchedule,
        VISIBLE_MS
      );
    });

    mic.addEventListener("click", () => {
      showToast(
        "Busca por voz entra na próxima etapa."
      );
    });

    close.addEventListener(
      "click",
      hideAndSchedule
    );

    tab.addEventListener(
      "click",
      show
    );

    peek();

    cycleTimer = window.setTimeout(
      show,
      1800
    );
  }

  function refreshForRoute() {
    if (shouldRun()) {
      mountPopup();
    } else {
      removePopup();
    }
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(
      this,
      args
    );

    window.setTimeout(refreshForRoute, 0);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(
      this,
      args
    );

    window.setTimeout(refreshForRoute, 0);
    return result;
  };

  window.addEventListener(
    "popstate",
    refreshForRoute
  );

  window.addEventListener(
    "pageshow",
    refreshForRoute
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      refreshForRoute,
      { once: true }
    );
  } else {
    refreshForRoute();
  }
})();