const fs = require('fs');

const radioWrapper = 'src/public/custom-elements/pelego-radio.js';
const masterPage = 'src/pages/masterPage.js';

function update(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(path, after, 'utf8');
}

update(radioWrapper, (src) => {
  return src.replace("import '../radioPelegoPersistente.js';\n", '');
});

update(masterPage, (src) => {
  let out = src.replace("import 'public/radioPelegoPersistente.js';\n", '');

  if (!out.includes('__PELEGO_WIX_NAVIGATE_RADIO__')) {
    const marker = "$w.onReady(async function () {\n";
    const bridge = "$w.onReady(async function () {\n  try {\n    if (typeof window !== 'undefined') {\n      window.__PELEGO_WIX_NAVIGATE_RADIO__ = () => {\n        try {\n          wixLocation.to('/radiopelegobox');\n          return true;\n        } catch (_) {\n          return false;\n        }\n      };\n    }\n  } catch (_) {}\n";
    if (!out.includes(marker)) throw new Error('Marcador $w.onReady não encontrado em masterPage.js');
    out = out.replace(marker, bridge);
  }
  return out;
});

const wrapperNow = fs.readFileSync(radioWrapper, 'utf8');
const masterNow = fs.readFileSync(masterPage, 'utf8');
if (wrapperNow.includes("radioPelegoPersistente.js")) throw new Error('Import legado ainda presente em pelego-radio.js');
if (masterNow.includes("radioPelegoPersistente.js")) throw new Error('Import legado ainda presente em masterPage.js');
if (!masterNow.includes('__PELEGO_WIX_NAVIGATE_RADIO__')) throw new Error('Ponte de navegação Wix não foi criada');

console.log('OK: motor popup legado removido e navegação Wix preparada.');
