import wixLocation from 'wix-location';
import 'public/buscadorPopupPelegoBox.js';
import 'public/radioPelegoPersistente.js';

async function ocultarElementoGlobal(id) {
  try {
    const elemento = $w(id);
    if (!elemento) return;
    if (typeof elemento.hide === 'function') await elemento.hide();
    if (typeof elemento.collapse === 'function') await elemento.collapse();
  } catch (_) {}
}

$w.onReady(async function () {
  const pagina = String(wixLocation.path?.[0] || '').toLowerCase();

  if (pagina === 'video') {
    try {
      $w('#searchAppController3').hide();
    } catch (_) {}
  }

  if (pagina === 'radiopelegobox') {
    await Promise.allSettled([
      ocultarElementoGlobal('#botaoradio'),
      ocultarElementoGlobal('#image107'),
    ]);
  }
});
