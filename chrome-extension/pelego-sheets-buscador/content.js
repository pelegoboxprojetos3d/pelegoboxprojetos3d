(() => {
  const TARGET_SHEET = 'Videos_projetos';
  let lastSheet = '';
  let busy = false;
  let retryTimer = null;

  function txt(el) {
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function activeSheetName() {
    const selectors = [
      '.docs-sheet-active-tab',
      '.docs-sheet-tab.docs-sheet-active-tab',
      '[role="tab"][aria-selected="true"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && visible(el)) {
        const name = txt(el).replace(/^\s+|\s+$/g, '');
        if (name) return name;
      }
    }
    return '';
  }

  function clickableFor(el) {
    if (!el) return null;
    return el.closest('[role="menuitem"], [role="button"], .goog-menuitem, .goog-control, .menu-button') || el;
  }

  function findClickable(label, exact = true) {
    const pool = Array.from(document.querySelectorAll(
      '[role="menuitem"], [role="button"], .goog-menuitem, .goog-menuitem-content, .goog-control, .menu-button, div, span'
    ));

    const matches = pool.filter(el => {
      if (!visible(el)) return false;
      const t = txt(el);
      if (!t) return false;
      return exact ? t === label : t.includes(label);
    });

    matches.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (ra.width * ra.height) - (rb.width * rb.height);
    });

    return clickableFor(matches[0]);
  }

  function openSearch(attempt = 0) {
    if (busy) return;
    if (activeSheetName() !== TARGET_SHEET) return;

    busy = true;

    const menu = findClickable('🔎 BUSCADOR', true) || findClickable('BUSCADOR', false);
    if (!menu) {
      busy = false;
      if (attempt < 8) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => openSearch(attempt + 1), 450);
      }
      return;
    }

    menu.click();

    setTimeout(() => {
      const item = findClickable('Abrir buscador', true);
      if (item) item.click();
      busy = false;

      if (!item && attempt < 8) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => openSearch(attempt + 1), 450);
      }
    }, 260);
  }

  function handleSheetChange() {
    const current = activeSheetName();
    if (!current || current === lastSheet) return;

    lastSheet = current;

    if (current === TARGET_SHEET) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => openSearch(0), 350);
    }
  }

  const observer = new MutationObserver(handleSheetChange);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: false
  });

  setInterval(handleSheetChange, 700);
  setTimeout(handleSheetChange, 800);
})();
