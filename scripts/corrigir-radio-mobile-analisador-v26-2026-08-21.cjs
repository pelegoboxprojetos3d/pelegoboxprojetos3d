const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V26_ANALYZER_160_FIX';
if (src.includes(marker)) {
  console.log('V26 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v25', '20260821-mobile-final-v26');

const needle = `  /* END_MOBILE_V25_REAL_TITLES_FIX */\n  .footer{display:none!important}`;
const patch = `  /* END_MOBILE_V25_REAL_TITLES_FIX */\n\n  /* MOBILE_V26_ANALYZER_160_FIX */\n  .grid-top{\n    min-height:160px!important;height:160px!important;max-height:160px!important;\n    overflow:hidden!important;margin:0!important\n  }\n  .grid-top>.panel:nth-child(3),.analyzer{\n    min-height:160px!important;height:160px!important;max-height:160px!important;\n    overflow:hidden!important;margin:0!important\n  }\n  .analyzer{grid-template-rows:25px minmax(0,1fr) 18px!important}\n  .analyzer canvas{height:auto!important;min-height:0!important;align-self:stretch!important}\n  /* END_MOBILE_V26_ANALYZER_160_FIX */\n  .footer{display:none!important}`;

if (!src.includes(needle)) {
  throw new Error('Ponto de inserção do V26 não encontrado; arquivo não foi alterado.');
}

src = src.replace(needle, patch);

// O JS também travava o painel em 270px com estilo inline. Ajusta só o mobile.
src = src.replace(
  "analyzerPanel.style.setProperty('min-height','270px','important');\n      analyzerPanel.style.setProperty('height','270px','important');\n      analyzerPanel.style.setProperty('max-height','270px','important');",
  "analyzerPanel.style.setProperty('min-height','160px','important');\n      analyzerPanel.style.setProperty('height','160px','important');\n      analyzerPanel.style.setProperty('max-height','160px','important');"
);

fs.writeFileSync(file, src, 'utf8');

if (!src.includes('MOBILE_V26_ANALYZER_160_FIX')) throw new Error('Marcador V26 ausente.');
if (!src.includes("analyzerPanel.style.setProperty('height','160px','important')")) throw new Error('Altura inline do analisador não foi ajustada.');
if (!src.includes('ANALISADOR - ${mobile ? \'8\' : \'24\'} BANDAS')) throw new Error('Título real do analisador desapareceu.');
if (!src.includes('EQUALIZADOR ${mobile ? \'8\' : \'24\'} BANDAS')) throw new Error('Título real do equalizador desapareceu.');

console.log('V26 aplicada: analisador mobile 160px, títulos preservados.');
