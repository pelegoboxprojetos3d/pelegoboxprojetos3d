const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V27_FORCE_8_AND_SCOPE_GAP';
if (src.includes(marker)) {
  console.log('V27 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v26', '20260821-mobile-final-v27');

const cssNeedle = `  /* END_MOBILE_V26_ANALYZER_160_FIX */\n  .footer{display:none!important}`;
const cssPatch = `  /* END_MOBILE_V26_ANALYZER_160_FIX */\n\n  /* MOBILE_V27_FORCE_8_AND_SCOPE_GAP */\n  #international,#national{\n    gap:6px!important;padding-top:5px!important;padding-bottom:5px!important\n  }\n  #international .scope-icon,#national .scope-icon{margin-bottom:3px!important}\n  #international>span:last-child,#national>span:last-child{\n    line-height:1.08!important;letter-spacing:.15px!important\n  }\n  /* END_MOBILE_V27_FORCE_8_AND_SCOPE_GAP */\n  .footer{display:none!important}`;

if (!src.includes(cssNeedle)) {
  throw new Error('Ponto CSS do V27 não encontrado.');
}
src = src.replace(cssNeedle, cssPatch);

const jsNeedle = `  const eqTitle=root.querySelector('.eqpanel .eqtitle'); if(eqTitle) eqTitle.textContent=\`⚙ EQUALIZADOR \${mobile ? '8' : '24'} BANDAS\`; /* PB_EQ_TITLE_8_BANDAS_FINAL_20260821 */`;
const jsPatch = `  const eqTitle=root.querySelector('.eqpanel .eqtitle'); if(eqTitle) eqTitle.textContent=\`⚙ EQUALIZADOR \${mobile ? '8' : '24'} BANDAS\`; /* PB_EQ_TITLE_8_BANDAS_FINAL_20260821 */\n\n  // V27: no mobile, os dois títulos ficam literalmente em 8 bandas.\n  // Reaplica após o carregamento para neutralizar qualquer rotina antiga que tente restaurar 6.\n  if(mobile){\n    const forceEightBands=()=>{\n      const analyzerTitle=root.querySelector('.grid-top>.panel:nth-child(3) .panel-title');\n      if(analyzerTitle) analyzerTitle.innerHTML=\`<span class=\"pb-icon\">\${BARS}</span>ANALISADOR - 8 BANDAS\`;\n      const equalizerTitle=root.querySelector('.eqpanel .eqtitle');\n      if(equalizerTitle) equalizerTitle.textContent='⚙ EQUALIZADOR 8 BANDAS';\n    };\n    forceEightBands();\n    requestAnimationFrame(forceEightBands);\n    setTimeout(forceEightBands,120);\n    setTimeout(forceEightBands,600);\n  }`;

if (!src.includes(jsNeedle)) {
  throw new Error('Ponto JS dos títulos V27 não encontrado.');
}
src = src.replace(jsNeedle, jsPatch);

fs.writeFileSync(file, src, 'utf8');

if (!src.includes(marker)) throw new Error('Marcador V27 ausente.');
if (!src.includes('ANALISADOR - 8 BANDAS')) throw new Error('Título literal do analisador não foi aplicado.');
if (!src.includes("EQUALIZADOR 8 BANDAS'")) throw new Error('Título literal do equalizador não foi aplicado.');
if (!src.includes('gap:6px!important')) throw new Error('Espaçamento dos botões não foi aplicado.');

console.log('V27 aplicada: títulos mobile blindados em 8 bandas e botões com mais respiro.');
