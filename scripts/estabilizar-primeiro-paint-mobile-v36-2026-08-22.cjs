const fs = require('fs');

const radioFile = 'src/public/custom-elements/pelego-radio.js';
const coreFile = 'src/public/custom-elements/pelego-radio-core.js';
let radio = fs.readFileSync(radioFile, 'utf8');
let core = fs.readFileSync(coreFile, 'utf8');

// V36 não altera nenhuma medida do layout V35. Apenas impede o estado-base
// de aparecer antes da skin final e força o primeiro canvas já no tamanho certo.

// 1) O core é definido antes do arquivo de skin. No mobile, escondemos somente
// o estado intermediário. Desktop fica intocado.
if (!core.includes('PB_CORE_V36_HIDE_UNTIL_SKIN')) {
  const closeStyle = '</style>';
  const idx = core.indexOf(closeStyle);
  if (idx < 0) throw new Error('V36: </style> do core não encontrado.');
  const guard = `\n/* PB_CORE_V36_HIDE_UNTIL_SKIN */\n@media(max-width:640px){:host{visibility:hidden!important;opacity:0!important}}\n`;
  core = core.slice(0, idx) + guard + core.slice(idx);
}

// 2) A skin canônica final revela o elemento. Não mexe em width/height/gaps.
if (!radio.includes('PB_V36_READY_FIRST_PAINT')) {
  const hostNeedle = `:host{\n  display:block!important;`;
  const hostPatch = `:host{\n  display:block!important;\n  visibility:visible!important;opacity:1!important;`;
  if (!radio.includes(hostNeedle)) throw new Error('V36: início do :host mobile canônico não encontrado.');
  radio = radio.replace(hostNeedle, hostPatch);

  const appendNeedle = `  if(root.lastElementChild !== style) root.appendChild(style);`;
  const appendPatch = `${appendNeedle}\n  // PB_V36_READY_FIRST_PAINT: libera o host somente depois da skin final existir.\n  el.style.setProperty('visibility','visible','important');\n  el.style.setProperty('opacity','1','important');`;
  if (!radio.includes(appendNeedle)) throw new Error('V36: ponto de montagem da skin não encontrado.');
  radio = radio.replace(appendNeedle, appendPatch);

  const canvasNeedle = `  requestAnimationFrame(()=>{ try{ el.resizeCanvas?.(); el.drawIdleAnalyzer?.(); }catch(_){} });`;
  const canvasPatch = `  // Primeiro desenho já usa as dimensões V35 antes do primeiro paint visível.\n  try{ el.resizeCanvas?.(); el.drawIdleAnalyzer?.(); }catch(_){}\n  requestAnimationFrame(()=>{ try{ el.resizeCanvas?.(); el.drawIdleAnalyzer?.(); }catch(_){} });`;
  if (!radio.includes(canvasNeedle)) throw new Error('V36: ponto de resize do canvas não encontrado.');
  radio = radio.replace(canvasNeedle, canvasPatch);

  const sweepNeedle = `scheduleSkinSweep();\n\nif(window.__PELEGO_RADIO_SKIN_HEALER__)`;
  const sweepPatch = `// V36: aplica imediatamente para elementos que o core já atualizou antes deste módulo.\napplyAllSkins();\nscheduleSkinSweep();\n\nif(window.__PELEGO_RADIO_SKIN_HEALER__)`;
  if (!radio.includes(sweepNeedle)) throw new Error('V36: sweep inicial não encontrado.');
  radio = radio.replace(sweepNeedle, sweepPatch);
}

// 3) Segurança: as medidas aprovadas da V35 precisam continuar exatamente presentes.
const frozenLayout = [
  '.grid-top>.panel:nth-child(3),.analyzer{height:160px!important;min-height:160px!important;max-height:160px!important}',
  '.filters{height:140px!important;min-height:140px!important;max-height:140px!important}',
  '.playbox{height:220px!important;min-height:220px!important;max-height:220px!important}',
  '.eqpanel{height:160px!important;min-height:160px!important;max-height:160px!important}',
  'grid-template-rows:25px 114px 17px!important',
  'grid-template-rows:25px 113px 18px!important',
  "content:'ANALISADOR - 8 BANDAS'!important",
  "content:'⚙ EQUALIZADOR 8 BANDAS'!important"
];
for (const token of frozenLayout) {
  if (!radio.includes(token)) throw new Error('V36: layout V35 não preservado: ' + token);
}

fs.writeFileSync(radioFile, radio, 'utf8');
fs.writeFileSync(coreFile, core, 'utf8');

const required = [
  'PB_V36_READY_FIRST_PAINT',
  "el.style.setProperty('visibility','visible','important')",
  'applyAllSkins();\nscheduleSkinSweep();'
];
for (const token of required) if (!radio.includes(token)) throw new Error('V36 falhou no radio: ' + token);
if (!core.includes('PB_CORE_V36_HIDE_UNTIL_SKIN')) throw new Error('V36 falhou no core.');

console.log('V36 aplicada: V35 preservada; mobile oculto durante o estado-base e revelado já com skin/canvas finais.');
