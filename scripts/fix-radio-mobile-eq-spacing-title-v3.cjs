const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');
function rep(a,b,label){if(!s.includes(a))throw new Error('Nao achei: '+label);s=s.replace(a,b);}
rep(
  ".eqpanel{min-height:160px!important;height:160px!important;max-height:160px!important;overflow:hidden!important;padding:0 6px 5px!important;grid-template-rows:27px minmax(0,1fr)!important}.eqhead{padding:0 2px!important;align-items:center!important}.eqtitle{font-size:9px!important;white-space:nowrap!important}.preset{margin-left:auto!important;gap:4px!important;font-size:7px!important}.preset select{width:96px!important;min-width:96px!important;height:21px!important}",
  ".eqpanel{min-height:160px!important;height:160px!important;max-height:160px!important;overflow:hidden!important;padding:0 6px 28px!important;grid-template-rows:27px minmax(0,1fr)!important;position:relative!important}.eqhead{padding:0 2px!important;align-items:center!important;justify-content:flex-start!important}.eqtitle{font-size:9px!important;white-space:nowrap!important}.preset{position:absolute!important;right:6px!important;bottom:4px!important;margin:0!important;gap:4px!important;font-size:7px!important;z-index:5!important}.preset select{width:96px!important;min-width:96px!important;height:21px!important}",
  'preset abaixo do equalizador'
);
rep(
  ".eqgrid{min-width:0!important;width:100%!important;grid-template-columns:repeat(6,30px)!important;gap:9px!important;padding:2px 0 0 25px!important;overflow:hidden!important;align-items:stretch!important;justify-content:center!important}",
  ".eqgrid{min-width:0!important;width:100%!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:0!important;padding:2px 0 0 34px!important;overflow:hidden!important;align-items:stretch!important;justify-content:stretch!important}.eqgrid .band{justify-items:center!important}",
  'equalizador 6 bandas com espacamento matematico'
);
rep(
  "title(root.querySelector('.playbox .panel-title'), `<span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO`);",
  "const playTitle=root.querySelector('.playbox .panel-title'); title(playTitle, mobile ? `<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span><span>TOCANDO</span></span>` : `<span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO`);",
  'titulo tocando agrupado a esquerda no mobile'
);
rep("'20260821-mobile-final-v3'","'20260821-mobile-final-v5'",'revisao da skin mobile');
fs.writeFileSync(path,s);
console.log('OK: 12dB + 6 bandas em espacos iguais, preset embaixo e TOCANDO a esquerda');