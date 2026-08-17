(() => {
  const TARGET_SHEET = 'Videos_projetos';
  const DASHBOARDS = new Set(['Dashboard_Mensal', 'Dashboard_Anual']);
  let busy = false;
  let retryTimer = null;
  let lastKnownSheet = '';

  function txt(el) {
    return String((el && (el.innerText || el.textContent)) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function sidebarAberto() {
    const candidatos = [
      ...document.querySelectorAll('.script-application-sidebar'),
      ...document.querySelectorAll('.appsElementsSideSheetRoot')
    ];

    return candidatos.some(el => {
      if (!visible(el)) return false;
      const t = txt(el).toUpperCase();
      return t.includes('BUSCADOR') || el.classList.contains('script-application-sidebar');
    });
  }

  function activeSheetName() {
    const selectors = [
      '.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name',
      '.docs-sheet-active-tab .docs-sheet-tab-name',
      '[role="tab"][aria-selected="true"] .docs-sheet-tab-name',
      '[role="tab"][aria-selected="true"]',
      '.docs-sheet-active-tab'
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!visible(el)) continue;
        const name = txt(el);
        if (name) return name;
      }
    }

    return lastKnownSheet;
  }

  function sheetNameFromEvent(event) {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [];

    for (const el of path) {
      if (!(el instanceof Element)) continue;

      const tab = el.closest && el.closest(
        '.docs-sheet-tab, .docs-sheet-tab-outer-box, [role="tab"]'
      );

      if (tab) {
        const nameEl = tab.querySelector('.docs-sheet-tab-name');
        const nome = txt(nameEl || tab);
        if (nome) return nome;
      }

      const bruto = txt(el);
      if (bruto === TARGET_SHEET || DASHBOARDS.has(bruto)) return bruto;
    }

    return '';
  }

  function fireClick(el) {
    if (!el) return false;

    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (_) {}

    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + Math.max(1, r.width / 2));
    const y = Math.round(r.top + Math.max(1, r.height / 2));
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1
    };

    try {
      if (typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerdown', base));
      }
      el.dispatchEvent(new MouseEvent('mousedown', base));
      if (typeof PointerEvent === 'function') {
        el.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0 }));
      }
      el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
      el.click();
      return true;
    } catch (_) {
      try {
        el.click();
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function menuBuscador() {
    const pool = Array.from(document.querySelectorAll(
      '[role="menuitem"], [role="button"], [aria-haspopup="menu"], .goog-menuitem, .goog-menuitem-content, .goog-control, .menu-button, .docs-menubar-item, div, span'
    ));

    const matches = pool.filter(el => {
      if (!visible(el)) return false;
      const t = txt(el).toUpperCase();
      if (!t.includes('BUSCADOR')) return false;
      const r = el.getBoundingClientRect();
      return r.top < 180;
    });

    matches.sort((a, b) => {
      const ta = txt(a).toUpperCase();
      const tb = txt(b).toUpperCase();
      const pa = ta === '🔎 BUSCADOR' || ta === 'BUSCADOR' ? 0 : 1;
      const pb = tb === '🔎 BUSCADOR' || tb === 'BUSCADOR' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    const el = matches[0];
    if (!el) return null;
    return el.closest('[role="button"], [aria-haspopup="menu"], .goog-control, .menu-button, .docs-menubar-item') || el;
  }

  function itemAbrirBuscador() {
    const pool = Array.from(document.querySelectorAll(
      '[role="menuitem"], .goog-menuitem, .goog-menuitem-content, div, span'
    ));

    const matches = pool.filter(el => {
      if (!visible(el)) return false;
      return txt(el) === 'Abrir buscador';
    });

    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    const el = matches[0];
    if (!el) return null;
    return el.closest('[role="menuitem"], .goog-menuitem') || el;
  }

  function openSearch(attempt = 0) {
    if (busy || sidebarAberto()) return;

    const current = activeSheetName();
    if (current && current !== TARGET_SHEET) return;

    busy = true;

    const menu = menuBuscador();
    if (!menu) {
      busy = false;
      if (attempt < 20) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => openSearch(attempt + 1), 350);
      }
      return;
    }

    fireClick(menu);

    const tentarItem = (passo = 0) => {
      if (sidebarAberto()) {
        busy = false;
        return;
      }

      const item = itemAbrirBuscador();
      if (item) {
        fireClick(item);
        setTimeout(() => {
          busy = false;
          if (!sidebarAberto() && attempt < 20) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => openSearch(attempt + 1), 400);
          }
        }, 450);
        return;
      }

      if (passo < 5) {
        setTimeout(() => tentarItem(passo + 1), 120);
      } else {
        busy = false;
        if (attempt < 20) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => openSearch(attempt + 1), 400);
        }
      }
    };

    setTimeout(() => tentarItem(0), 100);
  }

  function garantirBuscador() {
    const current = activeSheetName();
    if (current) lastKnownSheet = current;

    if (current === TARGET_SHEET && !sidebarAberto()) {
      openSearch(0);
    }
  }

  document.addEventListener('click', event => {
    const nome = sheetNameFromEvent(event);
    if (!nome) return;

    lastKnownSheet = nome;

    if (nome === TARGET_SHEET) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => openSearch(0), 450);
    }
  }, true);

  const observer = new MutationObserver(() => {
    const current = activeSheetName();
    if (current) lastKnownSheet = current;
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: false
  });

  // Regra principal: enquanto Videos_projetos estiver ativa, o buscador deve existir.
  // Se o Google fechar a barra ao sair do dashboard, a extensão tenta reabrir sozinha.
  setInterval(garantirBuscador, 1000);
  setTimeout(garantirBuscador, 700);
})();
