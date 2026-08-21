const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio.js';
let s = fs.readFileSync(path, 'utf8');

const oldBlock = `  /* MOBILE_V11_8_BANDS_RELAXED */
  .playbox{min-height:224px!important;height:224px!important;max-height:224px!important}
  .playbody{grid-template-rows:11px 28px 22px 48px 36px!important;row-gap:4px!important;padding:4px 8px 7px!important}
  .playbody>select{height:28px!important}
  .volrow{min-height:22px!important}
  .randomrow{gap:6px!important}
  .randomrow label{grid-template-rows:11px 30px!important;gap:3px!important;padding:2px 3px 3px!important}
  .randomrow select{height:30px!important}
  .controls{gap:6px!important;align-items:center!important}
  .controls button{height:36px!important}
  #shell .playbox .panel-title{justify-content:flex-start!important;gap:6px!important}
  #shell .playbox .play-meta{display:block!important;min-width:0!important;max-width:calc(100% - 98px)!important;margin-left:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:left!important;font-size:7px!important}`;

const newBlock = `  /* MOBILE_V12_TOCANDO_SPACING */
  .playbox{min-height:208px!important;height:208px!important;max-height:208px!important}
  .playbody{grid-template-rows:9px 23px 18px 34px 30px!important;row-gap:4px!important;padding:0 8px 1px!important}
  .playbody>select{height:23px!important}
  .volrow{min-height:18px!important}
  .randomrow{gap:8px!important;align-items:start!important;margin-top:2px!important;margin-bottom:0!important}
  .randomrow label{grid-template-rows:10px 24px!important;gap:2px!important;padding:2px 3px 1px!important}
  .randomrow select{height:24px!important}
  .controls{gap:8px!important;margin-top:0!important;margin-bottom:0!important;align-items:center!important}
  .controls button{height:30px!important;margin:0!important}
  .playbox .hint{display:none!important}
  .playbox .status{margin:0!important;padding:0!important}
  #shell .playbox .panel-title{justify-content:flex-start!important;gap:6px!important}
  #shell .playbox .play-meta{display:block!important;min-width:0!important;max-width:calc(100% - 98px)!important;margin-left:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:left!important;font-size:7px!important}`;

if (!s.includes(oldBlock)) {
  throw new Error('Bloco MOBILE_V11 não encontrado. Abortando para não mexer no lugar errado.');
}
s = s.replace(oldBlock, newBlock);
s = s.replace("style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-final-v11' : '20260821-desktop-preservado-v2';", "style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-final-v12' : '20260821-desktop-preservado-v2';");
fs.writeFileSync(path, s);
console.log('Painel TOCANDO mobile ajustado para V12.');
