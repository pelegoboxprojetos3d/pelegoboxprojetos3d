const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V29_APPROVED_LAYOUT';
if (src.includes(marker)) {
  console.log('V29 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v28', '20260821-mobile-final-v29');

const cssNeedle = `.eqgroups,.eqpanel:before,.eqpanel:after{display:none!important;content:none!important}\n.toast{z-index:50!important}`;
const cssPatch = `/* MOBILE_V29_APPROVED_LAYOUT */\n/* TOCANDO: título à esquerda e faixa atual à direita */\n#shell .playbox .panel-title{\n  display:flex!important;align-items:center!important;justify-content:space-between!important;\n  gap:6px!important;padding:0 9px!important\n}\n#shell .playbox .play-title-left{\n  display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;\n  gap:6px!important;min-width:0!important;flex:0 0 auto!important\n}\n#shell .playbox .play-meta{\n  display:block!important;visibility:visible!important;opacity:1!important;\n  margin-left:auto!important;min-width:0!important;max-width:150px!important;\n  overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;\n  text-align:right!important;color:#eef3f0!important;font-size:7px!important;font-weight:400!important\n}\n\n/* Mesma grade para os três selects e os três botões */\n.randomrow,.controls{\n  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;\n  column-gap:6px!important;width:100%!important;margin-left:0!important;margin-right:0!important\n}\n.randomrow label,.controls button{width:100%!important;min-width:0!important;max-width:none!important}\n.controls{position:static!important;top:auto!important;transform:none!important}\n.controls button{margin:0!important;padding-left:2px!important;padding-right:2px!important}\n\n/* ANALISADOR: grupos sob as oito bandas */\n.bands-label{\n  display:grid!important;grid-template-columns:repeat(3,1fr)!important;\n  align-items:center!important;justify-items:center!important;\n  height:17px!important;min-height:17px!important;max-height:17px!important;\n  color:#19ef5d!important;font-size:6px!important;font-weight:700!important\n}\n.bands-label span{display:block!important;width:100%!important;border:0!important;text-align:center!important}\n\n/* EQUALIZADOR: reserva uma linha própria para GRAVE / MÉDIO / AGUDO */\n.eqpanel{grid-template-rows:25px 111px 18px!important}\n.eqgrid{height:111px!important;min-height:111px!important;max-height:111px!important}\n.eqgroups{\n  display:grid!important;grid-template-columns:repeat(3,1fr)!important;\n  width:calc(100% - 30px)!important;height:18px!important;min-height:18px!important;max-height:18px!important;\n  margin:0 0 0 30px!important;padding:0!important;align-items:center!important;justify-items:center!important;\n  color:#19ef5d!important;font-size:6px!important;font-weight:700!important;line-height:1!important\n}\n.eqgroups span{display:block!important;width:100%!important;padding:0!important;border-top:1px solid #13d94f!important;text-align:center!important}\n.eqpanel:before,.eqpanel:after{display:none!important;content:none!important}\n/* END_MOBILE_V29_APPROVED_LAYOUT */\n.toast{z-index:50!important}`;

if (!src.includes(cssNeedle)) {
  throw new Error('Ponto CSS da V28 não encontrado para aplicar V29.');
}
src = src.replace(cssNeedle, cssPatch);

const jsNeedle = `  const eqTitle=root.querySelector('.eqpanel .eqtitle'); if(eqTitle) eqTitle.textContent=\`⚙ EQUALIZADOR \${mobile ? '8' : '24'} BANDAS\`; /* PB_EQ_TITLE_8_BANDAS_FINAL_20260821 */`;
const jsPatch = `  const eqTitle=root.querySelector('.eqpanel .eqtitle'); if(eqTitle) eqTitle.textContent=\`⚙ EQUALIZADOR \${mobile ? '8' : '24'} BANDAS\`; /* PB_EQ_TITLE_8_BANDAS_FINAL_20260821 */\n  if(mobile){\n    const analyzerGroups=root.querySelectorAll('.bands-label span');\n    ['GRAVE','MÉDIO','AGUDO'].forEach((txt,i)=>{ if(analyzerGroups[i]) analyzerGroups[i].textContent=txt; });\n    const eqGroups=root.querySelectorAll('.eqgroups span');\n    ['GRAVE','MÉDIO','AGUDO'].forEach((txt,i)=>{ if(eqGroups[i]) eqGroups[i].textContent=txt; });\n  }`;

if (!src.includes(jsNeedle)) {
  throw new Error('Ponto JS do título do equalizador não encontrado para aplicar V29.');
}
src = src.replace(jsNeedle, jsPatch);

fs.writeFileSync(file, src, 'utf8');

const checks = [
  marker,
  'justify-content:space-between!important',
  'grid-template-columns:repeat(3,minmax(0,1fr))!important',
  ".eqpanel{grid-template-rows:25px 111px 18px!important}",
  "['GRAVE','MÉDIO','AGUDO']",
  '20260821-mobile-final-v29'
];
for (const check of checks) {
  if (!src.includes(check)) throw new Error(`Validação V29 falhou: ${check}`);
}

console.log('V29 aplicada: layout aprovado, faixa à direita, botões simétricos e grupos GRAVE/MÉDIO/AGUDO restaurados.');
