const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V30_FINAL_LOCK';
if (src.includes(marker)) {
  console.log('V30 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v29', '20260821-mobile-final-v30');

const needle = `/* END_MOBILE_V29_APPROVED_LAYOUT */\n.toast{z-index:50!important}`;
const patch = `/* END_MOBILE_V29_APPROVED_LAYOUT */\n\n/* MOBILE_V30_FINAL_LOCK */\n/* Títulos mobile imunes a qualquer rotina antiga que reescreva o texto. */\n.grid-top>.panel:nth-child(3) .panel-title{font-size:0!important}\n.grid-top>.panel:nth-child(3) .panel-title .pb-icon{display:inline-flex!important;width:16px!important;height:16px!important;flex:0 0 16px!important}\n.grid-top>.panel:nth-child(3) .panel-title::before{content:none!important;display:none!important}\n.grid-top>.panel:nth-child(3) .panel-title::after{\n  content:'ANALISADOR - 8 BANDAS'!important;display:inline!important;\n  color:#19ef5d!important;font-size:11px!important;font-weight:700!important;letter-spacing:.15px!important;white-space:nowrap!important\n}\n.eqtitle{font-size:0!important}\n.eqtitle::before{content:none!important;display:none!important}\n.eqtitle::after{\n  content:'⚙ EQUALIZADOR 8 BANDAS'!important;display:inline!important;\n  color:#19ef5d!important;font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;white-space:nowrap!important\n}\n\n/* Equalizador: tudo cabe de verdade dentro dos 160px, inclusive GRAVE/MÉDIO/AGUDO. */\n.eqpanel{\n  height:160px!important;min-height:160px!important;max-height:160px!important;\n  grid-template-rows:25px 109px 16px!important;padding:0 6px 6px!important;overflow:hidden!important\n}\n.eqgrid{height:109px!important;min-height:109px!important;max-height:109px!important}\n.eqgroups{height:16px!important;min-height:16px!important;max-height:16px!important}\n.db-scale{top:32px!important;bottom:22px!important}\n\n/* TOCANDO: selects e botões usam exatamente a mesma grade de três colunas. */\n.randomrow,.controls{grid-template-columns:repeat(3,1fr)!important;gap:6px!important;width:100%!important}\n.randomrow label,.randomrow select,.controls button{width:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important}\n.controls button{margin:0!important}\n\n/* Mantém a faixa atual na mesma linha do TOCANDO, alinhada à direita. */\n#shell .playbox .panel-title{justify-content:space-between!important}\n#shell .playbox .play-title-left{flex:0 0 auto!important}\n#shell .playbox .play-meta{margin-left:auto!important;text-align:right!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}\n/* END_MOBILE_V30_FINAL_LOCK */\n.toast{z-index:50!important}`;

if (!src.includes(needle)) {
  throw new Error('Ponto V29 não encontrado para aplicar V30.');
}
src = src.replace(needle, patch);
fs.writeFileSync(file, src, 'utf8');

const checks = [
  marker,
  "content:'ANALISADOR - 8 BANDAS'!important",
  "content:'⚙ EQUALIZADOR 8 BANDAS'!important",
  'grid-template-rows:25px 109px 16px!important',
  'grid-template-columns:repeat(3,1fr)!important',
  '20260821-mobile-final-v30'
];
for (const check of checks) {
  if (!src.includes(check)) throw new Error(`Validação V30 falhou: ${check}`);
}

console.log('V30 aplicada: títulos travados em 8 bandas, equalizador sem corte e controles simétricos.');
