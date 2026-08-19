const fs = require('fs');

const radioPath = 'src/public/custom-elements/pelego-radio.js';
const masterPath = 'src/pages/masterPage.js';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

let radio = fs.readFileSync(radioPath, 'utf8');

radio = replaceOnce(
  radio,
  ':host{width:100%!important;height:835px!important;max-height:none!important;min-height:835px!important;overflow:visible!important}',
  ':host{width:100%!important;height:800px!important;max-height:none!important;min-height:800px!important;overflow:visible!important}',
  'altura host 835'
);

radio = replaceOnce(
  radio,
  'width:100%!important;height:835px!important;max-height:none!important;min-height:835px!important;overflow:hidden!important;',
  'width:100%!important;height:800px!important;max-height:none!important;min-height:800px!important;overflow:hidden!important;',
  'altura shell 835'
);

radio = replaceOnce(
  radio,
  'border:0!important;border-radius:0!important;background:#010504!important;box-shadow:none!important;',
  'border:0!important;border-radius:12px!important;background:#010504!important;box-shadow:none!important;',
  'cantos externos'
);

radio = replaceOnce(
  radio,
  'grid-template-rows:40px 280px 245px 180px 50px!important;',
  'grid-template-rows:40px 260px 250px 165px 45px!important;',
  'proporções principais'
);

radio = replaceOnce(
  radio,
  '.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important;height:260px!important;align-self:start!important}',
  '.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important;height:100%!important;align-self:stretch!important}',
  'analisador'
);

radio = replaceOnce(
  radio,
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important;margin-top:-27px!important;height:calc(100% + 27px)!important}',
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important;margin-top:0!important;height:100%!important}',
  'tocando sem sobreposição'
);

radio = replaceOnce(
  radio,
  '.playbody{padding:6px 14px 10px!important;grid-template-rows:12px 28px 22px 44px minmax(18px,1fr) 34px!important;gap:3px!important}',
  '.playbody{padding:5px 14px 10px!important;grid-template-rows:12px 28px 24px 44px minmax(24px,1fr) 36px!important;gap:4px!important}',
  'distribuição interna tocando'
);

radio = replaceOnce(
  radio,
  '.hint{font-size:9px!important;line-height:11px!important;color:#fff!important;font-weight:500!important;white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;padding-top:1px!important}',
  '.hint{font-size:10px!important;line-height:12.5px!important;color:#fff!important;font-weight:500!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;padding-top:2px!important}',
  'texto branco do tocador'
);

radio = replaceOnce(
  radio,
  '.controls button{height:34px!important;font-size:11px!important;border-radius:5px!important}',
  '.controls button{height:36px!important;font-size:11px!important;border-radius:6px!important}',
  'botões do tocador'
);

fs.writeFileSync(radioPath, radio);

const master = `import wixLocation from 'wix-location';\n\nasync function ocultarElementoGlobal(id) {\n  try {\n    const elemento = $w(id);\n    if (!elemento) return;\n    if (typeof elemento.hide === 'function') await elemento.hide();\n    if (typeof elemento.collapse === 'function') await elemento.collapse();\n  } catch (_) {}\n}\n\n$w.onReady(async function () {\n  const pagina = String(wixLocation.path?.[0] || '').toLowerCase();\n\n  if (pagina === 'video') {\n    try {\n      $w('#searchAppController3').hide();\n    } catch (_) {}\n  }\n\n  if (pagina === 'radiopelegobox') {\n    await Promise.allSettled([\n      ocultarElementoGlobal('#botaoradio'),\n      ocultarElementoGlobal('#image107'),\n    ]);\n  }\n});\n`;

fs.writeFileSync(masterPath, master);

console.log('Ajustes finais da Rádio Pelego aplicados.');
