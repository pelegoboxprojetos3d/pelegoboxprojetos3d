const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V24_HEIGHT_EQ8_FIX';
if (src.includes(marker)) {
  console.log('V24 já aplicada. Nada a alterar.');
  process.exit(0);
}

// O V23 espalhou 239px por várias camadas da skin e também por estilo inline.
// Mantemos todas essas regras coerentes para que o analisador e seu contêiner
// tenham exatamente a mesma altura.
src = src.replaceAll('239px', '270px');
src = src.replaceAll('20260821-mobile-final-v23', '20260821-mobile-final-v24');

const needle = `  /* END_MOBILE_V23_ANALYZER_CLIP_FIX */\n  .footer{display:none!important}`;
const patch = `  /* END_MOBILE_V23_ANALYZER_CLIP_FIX */\n\n  /* MOBILE_V24_HEIGHT_EQ8_FIX */\n  :host{\n    height:900px!important;min-height:900px!important;max-height:none!important;\n    overflow:visible!important\n  }\n  .shell{\n    height:900px!important;min-height:900px!important;max-height:none!important;\n    overflow:hidden!important;align-content:start!important\n  }\n  .grid-top{\n    min-height:270px!important;height:270px!important;max-height:270px!important;\n    overflow:hidden!important;margin:0!important\n  }\n  .grid-top>.panel:nth-child(3),.analyzer{\n    min-height:270px!important;height:270px!important;max-height:270px!important;\n    overflow:hidden!important;margin:0!important\n  }\n  .grid-middle{\n    position:relative!important;z-index:1!important;\n    margin-top:7px!important;overflow:visible!important\n  }\n  .eqtitle{font-size:0!important;white-space:nowrap!important}\n  .eqtitle::before{content:none!important;display:none!important}\n  .eqtitle::after{\n    content:'⚙ EQUALIZADOR 8 BANDAS'!important;display:inline!important;\n    font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;\n    color:inherit!important\n  }\n  /* END_MOBILE_V24_HEIGHT_EQ8_FIX */\n  .footer{display:none!important}`;

if (!src.includes(needle)) {
  throw new Error('Ponto de inserção do V24 não encontrado; arquivo não foi alterado.');
}

src = src.replace(needle, patch);
fs.writeFileSync(file, src, 'utf8');

if (!src.includes('EQUALIZADOR 8 BANDAS')) throw new Error('Título de 8 bandas não encontrado após ajuste.');
if (!src.includes('height:900px!important')) throw new Error('Altura mobile de 900px não foi aplicada.');
if (!src.includes('height:270px!important')) throw new Error('Altura do analisador de 270px não foi aplicada.');

console.log('V24 aplicada: elemento mobile 900px, analisador 270px e título visual 8 bandas.');
