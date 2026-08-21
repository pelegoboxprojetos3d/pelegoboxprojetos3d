const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V25_REAL_TITLES_FIX';
if (src.includes(marker)) {
  console.log('V25 já aplicada. Nada a alterar.');
  process.exit(0);
}

// Os títulos reais já são escritos por applySkin(). O problema era CSS antigo
// escondendo o texto e tentando recriá-lo com pseudo-elementos conflitantes.
// V25 deixa apenas o texto real visível e desliga os pseudos no mobile.
src = src.replaceAll('20260821-mobile-final-v24', '20260821-mobile-final-v25');

const needle = `  /* END_MOBILE_V24_HEIGHT_EQ8_FIX */\n  .footer{display:none!important}`;
const patch = `  /* END_MOBILE_V24_HEIGHT_EQ8_FIX */\n\n  /* MOBILE_V25_REAL_TITLES_FIX */\n  .grid-top>.panel:nth-child(3) .panel-title{\n    display:flex!important;align-items:center!important;\n    font-size:12px!important;font-weight:700!important;letter-spacing:.2px!important;\n    color:#19ef5d!important;visibility:visible!important;opacity:1!important;\n    white-space:nowrap!important\n  }\n  .grid-top>.panel:nth-child(3) .panel-title::before,\n  .grid-top>.panel:nth-child(3) .panel-title::after{\n    content:none!important;display:none!important\n  }\n  .eqtitle{\n    display:block!important;font-size:8.6px!important;font-weight:700!important;\n    letter-spacing:0!important;color:#19ef5d!important;visibility:visible!important;\n    opacity:1!important;white-space:nowrap!important\n  }\n  .eqtitle::before,.eqtitle::after{\n    content:none!important;display:none!important\n  }\n  /* END_MOBILE_V25_REAL_TITLES_FIX */\n  .footer{display:none!important}`;

if (!src.includes(needle)) {
  throw new Error('Ponto de inserção do V25 não encontrado; arquivo não foi alterado.');
}

src = src.replace(needle, patch);
fs.writeFileSync(file, src, 'utf8');

if (!src.includes('ANALISADOR - ${mobile ? \'8\' : \'24\'} BANDAS')) {
  throw new Error('Texto real do título do analisador não encontrado.');
}
if (!src.includes('EQUALIZADOR ${mobile ? \'8\' : \'24\'} BANDAS')) {
  throw new Error('Texto real do título do equalizador não encontrado.');
}
if (!src.includes('20260821-mobile-final-v25')) {
  throw new Error('Revisão V25 não aplicada.');
}

console.log('V25 aplicada: ANALISADOR - 8 BANDAS e EQUALIZADOR 8 BANDAS voltaram como texto real.');
