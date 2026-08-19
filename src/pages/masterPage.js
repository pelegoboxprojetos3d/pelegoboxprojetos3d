import wixLocation from 'wix-location';

async function ocultarElementoGlobal(id) {
  try {
    const elemento = $w(id);
    if (!elemento) return;
    if (typeof elemento.hide === 'function') await elemento.hide();
    if (typeof elemento.collapse === 'function') await elemento.collapse();
  } catch (_) {}
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

  // O mini player lateral substitui o antigo botão global da Rádio Pelego.
  // Mantemos os demais elementos globais intactos.
  await ocultarElementoGlobal('#botaoradio');
});