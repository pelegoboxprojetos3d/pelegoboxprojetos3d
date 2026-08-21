const fs = require('fs');

const skinFile = 'src/public/custom-elements/pelego-radio.js';
const coreFile = 'src/public/custom-elements/pelego-radio-core.js';

function trocarSeisPorOito(src) {
  return src
    .replace(/ANALISADOR\s*-\s*6\s*BANDAS/g, 'ANALISADOR - 8 BANDAS')
    .replace(/EQUALIZADOR\s*6\s*BANDAS/g, 'EQUALIZADOR 8 BANDAS')
    .replace(/mobile\s*\?\s*'6'\s*:\s*'24'/g, "mobile ? '8' : '24'")
    .replace(/mobile\s*\?\s*"6"\s*:\s*"24"/g, 'mobile ? "8" : "24"');
}

let skin = trocarSeisPorOito(fs.readFileSync(skinFile, 'utf8'));
let core = trocarSeisPorOito(fs.readFileSync(coreFile, 'utf8'));

if (!skin.includes('MOBILE_V33_CANONICAL_FLOW')) {
  throw new Error('Skin mobile V33 canônica não encontrada.');
}

if (!skin.includes('MOBILE_V34_TITLE_LOCK')) {
  const endToken = '`;\n/* END_MOBILE_V33_CANONICAL_FLOW */';
  if (!skin.includes(endToken)) {
    throw new Error('Fim da skin V33 não encontrado.');
  }

  const cssLock = String.raw`

/* MOBILE_V34_TITLE_LOCK
   Títulos visuais fixos em 8 bandas. O texto real fica oculto para impedir
   que qualquer rotina antiga mostre 6 bandas sem tocar no layout. */
.grid-top>.panel:nth-child(3) .panel-title{
  font-size:0!important;
}
.grid-top>.panel:nth-child(3) .panel-title::after{
  content:'ANALISADOR - 8 BANDAS'!important;
  display:inline!important;
  visibility:visible!important;
  opacity:1!important;
  font-size:11px!important;
  line-height:1!important;
  color:#19ef5d!important;
  font-weight:700!important;
  letter-spacing:.15px!important;
  white-space:nowrap!important;
}
.eqpanel .eqtitle{
  font-size:0!important;
}
.eqpanel .eqtitle::after{
  content:'⚙ EQUALIZADOR 8 BANDAS'!important;
  display:inline!important;
  visibility:visible!important;
  opacity:1!important;
  font-size:8.6px!important;
  line-height:1!important;
  color:#19ef5d!important;
  font-weight:700!important;
  letter-spacing:0!important;
  white-space:nowrap!important;
}
/* END_MOBILE_V34_TITLE_LOCK */
`;

  skin = skin.replace(endToken, cssLock + '\n' + endToken);
}

if (!core.includes('PB_CORE_V34_TITLE_8_BANDAS')) {
  core += '\n/* PB_CORE_V34_TITLE_8_BANDAS: força novo deploy do core mobile com títulos 8 BANDAS. */\n';
}

if (/ANALISADOR\s*-\s*6\s*BANDAS/.test(skin) || /EQUALIZADOR\s*6\s*BANDAS/.test(skin)) {
  throw new Error('Ainda existe título 6 BANDAS em pelego-radio.js');
}
if (/ANALISADOR\s*-\s*6\s*BANDAS/.test(core) || /EQUALIZADOR\s*6\s*BANDAS/.test(core)) {
  throw new Error('Ainda existe título 6 BANDAS em pelego-radio-core.js');
}
if (!skin.includes("content:'ANALISADOR - 8 BANDAS'!important")) {
  throw new Error('Lock visual do analisador não foi aplicado.');
}
if (!skin.includes("content:'⚙ EQUALIZADOR 8 BANDAS'!important")) {
  throw new Error('Lock visual do equalizador não foi aplicado.');
}

fs.writeFileSync(skinFile, skin, 'utf8');
fs.writeFileSync(coreFile, core, 'utf8');
console.log('V34 aplicada: títulos visuais travados em 8 BANDAS e core atualizado.');
