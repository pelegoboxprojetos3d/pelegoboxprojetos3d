const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V31_FLEX_STACK_FIX';
if (src.includes(marker)) {
  console.log('V31 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v30', '20260821-mobile-final-v31');

const needle = `/* END_MOBILE_V30_FINAL_LOCK */\n.toast{z-index:50!important}`;
const patch = `/* END_MOBILE_V30_FINAL_LOCK */\n\n/* MOBILE_V31_FLEX_STACK_FIX */\n/* Quatro blocos em fluxo vertical real. Sem linha fantasma/espaco morto do grid. */\n.shell{\n  display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;\n  width:310px!important;min-width:310px!important;max-width:310px!important;\n  height:700px!important;min-height:700px!important;max-height:700px!important;\n  padding:5px!important;gap:6px!important;overflow:hidden!important\n}\n.grid-top,.grid-middle{display:contents!important}\n.grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){display:none!important}\n.grid-top>.panel:nth-child(3),.analyzer{flex:0 0 160px!important;height:160px!important;min-height:160px!important;max-height:160px!important}\n.filters{flex:0 0 132px!important;height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important}\n.playbox{flex:0 0 220px!important;height:220px!important;min-height:220px!important;max-height:220px!important;margin:0!important}\n.eqpanel{flex:0 0 160px!important;height:160px!important;min-height:160px!important;max-height:160px!important;margin:0!important}\n\n/* Titulos: usar somente o texto real escrito pelo JS. Nada de pseudo-titulo duplicado. */\n.grid-top>.panel:nth-child(3) .panel-title{font-size:11px!important;visibility:visible!important;opacity:1!important}\n.grid-top>.panel:nth-child(3) .panel-title::before,\n.grid-top>.panel:nth-child(3) .panel-title::after{content:none!important;display:none!important}\n.eqtitle{font-size:8.6px!important;visibility:visible!important;opacity:1!important}\n.eqtitle::before,.eqtitle::after{content:none!important;display:none!important}\n\n/* TOCANDO: respirar verticalmente sem esconder ou amontoar controles. */\n.playbody{\n  height:195px!important;min-height:195px!important;max-height:195px!important;\n  padding:5px 8px 6px!important;overflow:hidden!important;\n  display:grid!important;grid-template-rows:11px 28px 23px 43px 36px!important;\n  row-gap:0!important;align-content:space-between!important\n}\n.randomrow,.controls{\n  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;\n  gap:6px!important;width:100%!important;min-width:0!important;margin:0!important\n}\n.randomrow label,.randomrow select,.controls button{\n  width:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;margin:0!important\n}\n.controls{position:static!important;top:auto!important;transform:none!important;overflow:visible!important}\n.controls button{height:36px!important;min-height:36px!important;padding:0 2px!important}\n\n/* O filtro fica preso aos 132px sem criar sobra externa nem cortar a ultima linha. */\n.filterbody{height:107px!important;min-height:107px!important;max-height:107px!important;padding:0 6px 6px!important;overflow:hidden!important}\n.genres{height:101px!important;min-height:101px!important;max-height:101px!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;align-content:stretch!important}\n\n/* Mantem a faixa atual na direita do TOCANDO. */\n#shell .playbox .panel-title{display:flex!important;align-items:center!important;justify-content:space-between!important}\n#shell .playbox .play-meta{margin-left:auto!important;text-align:right!important;max-width:145px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}\n/* END_MOBILE_V31_FLEX_STACK_FIX */\n.toast{z-index:50!important}`;

if (!src.includes(needle)) {
  throw new Error('Ponto V30 não encontrado para aplicar V31.');
}
src = src.replace(needle, patch);

fs.writeFileSync(file, src, 'utf8');

const checks = [
  marker,
  'display:flex!important;flex-direction:column!important',
  'flex:0 0 132px!important',
  'align-content:space-between!important',
  'panel-title::after{content:none!important;display:none!important}',
  '20260821-mobile-final-v31'
];
for (const check of checks) {
  if (!src.includes(check)) throw new Error(`Validação V31 falhou: ${check}`);
}

console.log('V31 aplicada: pilha flex sem espaco morto, titulos sem duplicacao e botoes respirando.');
