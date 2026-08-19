const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  src = src.replace(from, to);
}

replaceOnce(
  ':host{width:100%!important;height:800px!important;max-height:none!important;min-height:800px!important;overflow:visible!important}',
  ':host{width:100%!important;height:748px!important;max-height:none!important;min-height:748px!important;overflow:visible!important}',
  'altura do host'
);

replaceOnce(
  'width:100%!important;height:800px!important;max-height:none!important;min-height:800px!important;overflow:hidden!important;',
  'width:100%!important;height:748px!important;max-height:none!important;min-height:748px!important;overflow:hidden!important;',
  'altura da shell'
);

replaceOnce(
  'grid-template-rows:40px 260px 250px 165px 45px!important;',
  'grid-template-rows:40px 260px 250px 165px!important;',
  'linha do footer no grid desktop'
);

replaceOnce(
  '.win{gap:25px!important;font-size:17px!important;padding-right:4px!important}',
  '.win{gap:25px!important;font-size:18px!important;padding-right:4px!important;align-items:center!important}.win span:nth-child(2){font-size:0!important;width:16px!important;height:16px!important;border:2px solid currentColor!important;display:inline-block!important;box-sizing:border-box!important}',
  'controles da janela'
);

replaceOnce(
  '.footer{grid-template-columns:',
  '.footer{display:none!important;grid-template-columns:',
  'ocultar footer'
);

replaceOnce(
  'min-height:1180px!important;max-height:none!important;overflow:hidden!important;grid-template-rows:auto auto auto auto auto!important;',
  'min-height:1080px!important;max-height:none!important;overflow:hidden!important;grid-template-rows:auto auto auto auto!important;',
  'grid mobile sem footer'
);

fs.writeFileSync(file, src);
console.log('Footer removido e botão maximizar ajustado.');
