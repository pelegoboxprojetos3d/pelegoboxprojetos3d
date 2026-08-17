(() => {
  const GID_VIDEOS = '1613309343';
  const DASHBOARDS = new Set(['1900100001', '1900200002']);
  const RELOAD_GUARD = 'pelego_busca_reload_guard_v130';

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

  // Estratégia simples e confiável:
  // - entrou em Dashboard_Mensal/Anual => recarrega a página; no onOpen o buscador não abre.
  // - voltou de dashboard para Videos_projetos => recarrega a página; no onOpen o buscador abre.
  // Não toca na sidebar, não simula clique e não depende de onSelectionChange.

  let ultimoGid = gidAtual();

  if (sessionStorage.getItem(RELOAD_GUARD) === '1') {
    sessionStorage.removeItem(RELOAD_GUARD);
  }

  function recarregarUmaVez() {
    if (sessionStorage.getItem(RELOAD_GUARD) === '1') return;
    sessionStorage.setItem(RELOAD_GUARD, '1');
    setTimeout(() => location.reload(), 120);
  }

  function verificarTroca() {
    const atual = gidAtual();
    if (!atual || atual === ultimoGid) return;

    const anterior = ultimoGid;
    ultimoGid = atual;

    // Entrou em qualquer dashboard: automatiza o F5 que garante tela limpa.
    if (DASHBOARDS.has(atual)) {
      recarregarUmaVez();
      return;
    }

    // Voltou de dashboard para Videos_projetos: automatiza o F5 que reabre o buscador.
    if (DASHBOARDS.has(anterior) && atual === GID_VIDEOS) {
      recarregarUmaVez();
    }
  }

  window.addEventListener('hashchange', verificarTroca, true);
  window.addEventListener('popstate', verificarTroca, true);
  document.addEventListener('click', () => setTimeout(verificarTroca, 80), true);
  setInterval(verificarTroca, 250);
})();
