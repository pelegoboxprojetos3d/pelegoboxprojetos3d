(() => {
  const GID_VIDEOS = '1613309343';
  const DASHBOARDS = new Set(['1900100001', '1900200002']);
  const RELOAD_GUARD = 'pelego_busca_reload_guard_v140';

  function gidAtual() {
    const hash = String(location.hash || '');
    const achouHash = hash.match(/(?:^|[&#?])gid=(\d+)/);
    if (achouHash) return achouHash[1];

    try {
      const url = new URL(location.href);
      return String(url.searchParams.get('gid') || '');
    } catch (_) {
      const achouUrl = String(location.href).match(/[?&]gid=(\d+)/);
      return achouUrl ? achouUrl[1] : '';
    }
  }

  function visivel(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }

  function pareceSidebar(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 220 && r.width <= 620 && r.height >= 220 && r.right >= window.innerWidth - 650;
  }

  function acharHostSidebar() {
    const diretos = [
      document.querySelector('.script-application-sidebar'),
      document.querySelector('.appsElementsSideSheetRoot')
    ].filter(Boolean);

    for (const el of diretos) {
      if (visivel(el)) return el;
    }

    const iframes = Array.from(document.querySelectorAll('iframe'));
    for (const iframe of iframes) {
      if (!visivel(iframe) || !pareceSidebar(iframe)) continue;

      let atual = iframe;
      let melhor = iframe;
      for (let i = 0; atual && i < 9; i++, atual = atual.parentElement) {
        if (pareceSidebar(atual)) melhor = atual;
      }
      return melhor;
    }

    const textos = Array.from(document.querySelectorAll('div,span'));
    for (const el of textos) {
      const t = String(el.textContent || '').toUpperCase();
      if (!t.includes('BUSCADOR') || !t.includes('PELEGO')) continue;

      let atual = el;
      let melhor = null;
      for (let i = 0; atual && i < 9; i++, atual = atual.parentElement) {
        if (pareceSidebar(atual)) melhor = atual;
      }
      if (melhor) return melhor;
    }

    return null;
  }

  function clicarFechar(host) {
    const pool = Array.from(document.querySelectorAll(
      'button,[role="button"],[aria-label],[data-tooltip],[title]'
    ));

    const candidatos = pool.filter(el => {
      if (!visivel(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.right < window.innerWidth - 650) return false;

      const label = [
        el.getAttribute('aria-label'),
        el.getAttribute('data-tooltip'),
        el.getAttribute('title'),
        el.textContent
      ].filter(Boolean).join(' ').toLowerCase();

      const nomeFecha = /\b(fechar|close)\b/.test(label) || /^[×✕x]$/i.test(String(el.textContent || '').trim());
      if (!nomeFecha) return false;

      if (!host) return true;
      return host.contains(el) || (r.left >= host.getBoundingClientRect().left - 80);
    });

    if (!candidatos.length) return false;

    candidatos.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top || rb.right - ra.right;
    });

    try {
      candidatos[0].click();
      return true;
    } catch (_) {
      return false;
    }
  }

  function esconderHost(host) {
    if (!host) return false;

    let raiz = host;
    let atual = host.parentElement;
    for (let i = 0; atual && i < 5; i++, atual = atual.parentElement) {
      if (!pareceSidebar(atual)) break;
      raiz = atual;
    }

    raiz.style.setProperty('display', 'none', 'important');
    raiz.style.setProperty('width', '0', 'important');
    raiz.style.setProperty('min-width', '0', 'important');
    raiz.style.setProperty('max-width', '0', 'important');
    raiz.style.setProperty('overflow', 'hidden', 'important');
    raiz.setAttribute('data-pelego-sidebar-fechada', '1');

    try {
      window.dispatchEvent(new Event('resize'));
    } catch (_) {}

    return true;
  }

  function fecharBuscadorNoDashboard(tentativa = 0) {
    if (!DASHBOARDS.has(gidAtual())) return;

    const host = acharHostSidebar();
    if (host) {
      if (clicarFechar(host)) {
        setTimeout(() => {
          const ainda = acharHostSidebar();
          if (ainda) esconderHost(ainda);
        }, 250);
        return;
      }

      esconderHost(host);
      return;
    }

    if (tentativa < 20) {
      setTimeout(() => fecharBuscadorNoDashboard(tentativa + 1), 150);
    }
  }

  function recarregarVideosUmaVez() {
    if (sessionStorage.getItem(RELOAD_GUARD) === '1') return;
    sessionStorage.setItem(RELOAD_GUARD, '1');
    setTimeout(() => location.reload(), 120);
  }

  let ultimoGid = gidAtual();

  if (sessionStorage.getItem(RELOAD_GUARD) === '1') {
    sessionStorage.removeItem(RELOAD_GUARD);
  }

  function verificarTroca() {
    const atual = gidAtual();
    if (!atual) return;

    if (DASHBOARDS.has(atual)) {
      fecharBuscadorNoDashboard(0);
    }

    if (atual === ultimoGid) return;

    const anterior = ultimoGid;
    ultimoGid = atual;

    // A volta para Videos_projetos já está comprovadamente funcionando:
    // um F5 automático recria o buscador pelo Apps Script.
    if (DASHBOARDS.has(anterior) && atual === GID_VIDEOS) {
      recarregarVideosUmaVez();
    }
  }

  window.addEventListener('hashchange', verificarTroca, true);
  window.addEventListener('popstate', verificarTroca, true);
  document.addEventListener('click', () => setTimeout(verificarTroca, 60), true);

  // Também resolve quando a página já abre diretamente em um dashboard.
  setInterval(verificarTroca, 250);
  setTimeout(verificarTroca, 300);
})();
