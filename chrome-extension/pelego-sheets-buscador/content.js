(() => {
  const TARGET_SHEET = 'Videos_projetos';
  const DASHBOARDS = new Set(['Dashboard_Mensal', 'Dashboard_Anual']);
  const SHEETS = new Set([TARGET_SHEET, ...DASHBOARDS]);
  const MARK = 'data-pelego-buscador-sidebar';
  const ORIGINAL_STYLE = 'data-pelego-original-style';
  let lastKnownSheet = '';
  let timer = null;

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

  function nomeConhecido(texto) {
    const t = String(texto || '').trim();
    if (SHEETS.has(t)) return t;
    for (const nome of SHEETS) {
      if (t.includes(nome) && t.length <= nome.length + 20) return nome;
    }
    return '';
  }

  function sheetNameFromEvent(event) {
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [];

    for (const el of path) {
      if (!(el instanceof Element)) continue;

      const direto = nomeConhecido(txt(el));
      if (direto) return direto;

      const nameEl = el.querySelector && el.querySelector('.docs-sheet-tab-name');
      const interno = nomeConhecido(txt(nameEl));
      if (interno) return interno;
    }

    return '';
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
        const nome = nomeConhecido(txt(el));
        if (nome) return nome;
      }
    }

    return lastKnownSheet;
  }

  function subirAteHostSidebar(el) {
    let atual = el;
    let melhor = null;

    for (let i = 0; atual && i < 9; i++, atual = atual.parentElement) {
      const r = atual.getBoundingClientRect ? atual.getBoundingClientRect() : null;
      if (!r) continue;

      const temIframe = !!(atual.querySelector && atual.querySelector('iframe'));
      const pareceLateral = r.width >= 250 && r.width <= 460 && r.height >= 250;
      const estaDireita = r.right >= window.innerWidth - 520;

      if ((temIframe || pareceLateral) && pareceLateral && estaDireita) melhor = atual;
    }

    return melhor;
  }

  function findSidebarHost() {
    const marcado = document.querySelector(`[${MARK}="1"]`);
    if (marcado) return marcado;

    const diretos = [
      document.querySelector('.script-application-sidebar'),
      document.querySelector('.appsElementsSideSheetRoot')
    ].filter(Boolean);

    for (const el of diretos) {
      el.setAttribute(MARK, '1');
      return el;
    }

    const textos = Array.from(document.querySelectorAll('div, span'));
    for (const el of textos) {
      const t = txt(el).toUpperCase();
      if (!t.includes('BUSCADOR') || !t.includes('PELEGO')) continue;
      const host = subirAteHostSidebar(el);
      if (host) {
        host.setAttribute(MARK, '1');
        return host;
      }
    }

    const iframes = Array.from(document.querySelectorAll('iframe'));
    for (const iframe of iframes) {
      const r = iframe.getBoundingClientRect();
      if (r.width < 240 || r.width > 430 || r.height < 250) continue;
      if (r.right < window.innerWidth - 520) continue;

      const host = subirAteHostSidebar(iframe) || iframe.parentElement || iframe;
      host.setAttribute(MARK, '1');
      return host;
    }

    return null;
  }

  function salvarEstiloOriginal(host) {
    if (!host || host.hasAttribute(ORIGINAL_STYLE)) return;
    const original = host.getAttribute('style');
    host.setAttribute(ORIGINAL_STYLE, original == null ? '__SEM_STYLE__' : original);
  }

  function ocultarSidebar() {
    const host = findSidebarHost();
    if (!host) return false;

    salvarEstiloOriginal(host);
    host.style.setProperty('display', 'none', 'important');
    host.setAttribute('data-pelego-oculto', '1');
    return true;
  }

  function mostrarSidebar() {
    const host = document.querySelector(`[${MARK}="1"]`) || findSidebarHost();
    if (!host) return false;

    const original = host.getAttribute(ORIGINAL_STYLE);
    if (original === '__SEM_STYLE__') {
      host.removeAttribute('style');
    } else if (original != null) {
      host.setAttribute('style', original);
    } else {
      host.style.removeProperty('display');
    }

    host.removeAttribute('data-pelego-oculto');
    return true;
  }

  function aplicarModo(nome) {
    if (!nome) return;
    lastKnownSheet = nome;

    clearTimeout(timer);

    if (DASHBOARDS.has(nome)) {
      // Dá um instante para o Sheets terminar a troca visual da aba.
      timer = setTimeout(() => ocultarSidebar(), 80);
      return;
    }

    if (nome === TARGET_SHEET) {
      // Não "reabre" nada. Apenas mostra a MESMA sidebar que ficou viva.
      timer = setTimeout(() => mostrarSidebar(), 40);
    }
  }

  // Caminho principal: clique humano real na aba inferior da planilha.
  document.addEventListener('click', event => {
    const nome = sheetNameFromEvent(event);
    if (nome) aplicarModo(nome);
  }, true);

  // Fallback para trocas por teclado ou mudanças internas do Sheets.
  const observer = new MutationObserver(() => {
    const nome = activeSheetName();
    if (nome && nome !== lastKnownSheet) aplicarModo(nome);
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: false
  });

  setInterval(() => {
    const nome = activeSheetName();
    if (nome) aplicarModo(nome);
  }, 900);

  setTimeout(() => {
    const nome = activeSheetName();
    if (nome) aplicarModo(nome);
  }, 700);
})();
