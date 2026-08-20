import wixLocation from 'wix-location';
import { registrarBuscaZero, registrarBuscaPronto } from 'backend/searchTracking';

async function ocultarElementoGlobal(id) {
  try {
    const elemento = $w(id);
    if (!elemento) return;
    if (typeof elemento.hide === 'function') await elemento.hide();
    if (typeof elemento.collapse === 'function') await elemento.collapse();
  } catch (_) {}
}

function safe(value) {
  return String(value ?? '').trim();
}

function queryValue(name) {
  return safe(wixLocation.query?.[name]);
}

function shouldSkipAnonymousDuplicate(term) {
  if (typeof window === 'undefined' || !term) return false;

  try {
    const key = 'pb_zero_last_search';
    const now = Date.now();
    const previous = JSON.parse(window.sessionStorage.getItem(key) || '{}');
    const duplicate = previous.term === term && now - Number(previous.at || 0) < 5000;
    window.sessionStorage.setItem(key, JSON.stringify({ term, at: now }));
    return duplicate;
  } catch (_) {
    return false;
  }
}

async function registrarBuscaDaPagina() {
  const pagina = safe(wixLocation.path?.[0]).toLowerCase();
  const url = safe(wixLocation.url);

  if (pagina === 'search') {
    const termo = queryValue('oq') || queryValue('q');
    const sessionId = queryValue('sid');

    if (!termo) return;
    if (!sessionId && shouldSkipAnonymousDuplicate(termo)) return;

    try {
      await registrarBuscaZero({
        termo,
        pagina: url,
        sessionId
      });
    } catch (error) {
      console.warn('Não foi possível registrar a busca do Projeto Feito do Zero:', error?.message || error);
    }
    return;
  }

  if (pagina === 'videos-dos-projetos-prontos') {
    const termo = queryValue('oq') || queryValue('busca');
    const sessionId = queryValue('sid');

    if (!termo) return;

    try {
      // O rastreamento nunca deve disparar login, redirecionar ou bloquear a busca.
      // Se a sessão de membro ainda não estiver disponível, o backend simplesmente não grava esta tentativa.
      await registrarBuscaPronto({
        termo,
        pagina: url,
        sessionId
      });
    } catch (error) {
      console.warn('Não foi possível registrar a busca dos Projetos Prontos:', error?.message || error);
    }
  }
}

$w.onReady(async function () {
  try {
    if (typeof window !== 'undefined') {
      window.__PELEGO_WIX_NAVIGATE_RADIO__ = () => {
        try {
          wixLocation.to('/radiopelegobox');
          return true;
        } catch (_) {
          return false;
        }
      };

      if (!window.__PELEGO_WIX_RADIO_MESSAGE_BRIDGE__) {
        window.__PELEGO_WIX_RADIO_MESSAGE_BRIDGE__ = true;
        window.addEventListener('message', (event) => {
          try {
            if (event?.data?.type === 'PELEGO_OPEN_RADIO') {
              window.__PELEGO_WIX_NAVIGATE_RADIO__?.();
            }
          } catch (_) {}
        });
      }
    }
  } catch (_) {}

  const pagina = String(wixLocation.path?.[0] || '').toLowerCase();

  if (pagina === 'video') {
    try {
      $w('#searchAppController3').hide();
    } catch (_) {}
  }

  await ocultarElementoGlobal('#botaoradio');

  // Rastreamento em segundo plano. Nunca interfere na navegação ou autenticação.
  registrarBuscaDaPagina().catch((error) => {
    console.warn('Não foi possível concluir o rastreamento da busca:', error?.message || error);
  });
});