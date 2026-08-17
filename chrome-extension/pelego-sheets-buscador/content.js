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

  function sheetNameFromTab(el) {
    const tab = el && el.closest
      ? el.closest('.docs-sheet-tab, [role="tab"]')
      : null;
    if (!tab) return '';

    const nameEl = tab.querySelector('.docs-sheet-tab-name');
    return txt(nameEl || tab);
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
      const el = document.querySelector(sel);
      if (el && visible(el)) {
        const name = txt(el);
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

  function openSearch(attempt = 0, forced = false) {
    if (busy) return;

    // Quando a troca veio do clique real na aba, não dependemos da classe
    // "active" do Google Sheets, que às vezes demora para mudar no DOM.
    if (!forced && activeSheetName() !== TARGET_SHEET) return;

    busy = true;

    const menu = findClickable('🔎 BUSCADOR', true) || findClickable('BUSCADOR', false);
    if (!menu) {
      busy = false;
      if (attempt < 12) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => openSearch(attempt + 1, forced), 400);
      }
      return;
    }

    menu.click();

    setTimeout(() => {
      const item = findClickable('Abrir buscador', true);
      if (item) item.click();
      busy = false;

      if (!item && attempt < 12) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => openSearch(attempt + 1, forced), 400);
      }
    }, 300);
  }

  function scheduleOpen(forced) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => openSearch(0, !!forced), 550);
  }

  // Caminho principal: detecta o clique na própria aba do Sheets.
  // Isso resolve a volta Dashboard -> Videos_projetos sem F5.
  document.addEventListener('click', event => {
    const name = sheetNameFromTab(event.target);
    if (!name) return;

    lastSheet = name;
    if (name === TARGET_SHEET) scheduleOpen(true);
  }, true);

  // Fallback para teclado, scripts internos e outras formas de trocar de aba.
  function handleSheetChange() {
    const current = activeSheetName();
    if (!current || current === lastSheet) return;

    lastSheet = current;
    if (current === TARGET_SHEET) scheduleOpen(false);
  }

  const observer = new MutationObserver(handleSheetChange);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: false
  });

  setInterval(handleSheetChange, 600);
  setTimeout(handleSheetChange, 800);
})();
