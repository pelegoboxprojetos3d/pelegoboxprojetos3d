(() => {
  const GID_VIDEOS = '1613309343';
  const DASHBOARDS = new Set(['1900100001', '1900200002']);
  const RELOAD_GUARD = 'pelego_busca_reload_guard_v120';

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

  // Esta extensão NÃO toca mais na sidebar e NÃO tenta clicar em menus do Sheets.
  // O Apps Script continua responsável por fechar o buscador nos dashboards.
  // A única tarefa daqui é automatizar o F5 que já sabemos que reabre o buscador.

  let ultimoGid = gidAtual();

  if (sessionStorage.getItem(RELOAD_GUARD) === '1') {
    sessionStorage.removeItem(RELOAD_GUARD);
  }

  function verificarTroca() {
    const atual = gidAtual();
    if (!atual || atual === ultimoGid) return;

    const anterior = ultimoGid;
    ultimoGid = atual;

    if (DASHBOARDS.has(anterior) && atual === GID_VIDEOS) {
      if (sessionStorage.getItem(RELOAD_GUARD) === '1') return;

      sessionStorage.setItem(RELOAD_GUARD, '1');
      setTimeout(() => location.reload(), 120);
    }
  }

  window.addEventListener('hashchange', verificarTroca, true);
  window.addEventListener('popstate', verificarTroca, true);
  document.addEventListener('click', () => setTimeout(verificarTroca, 80), true);
  setInterval(verificarTroca, 250);
})();
