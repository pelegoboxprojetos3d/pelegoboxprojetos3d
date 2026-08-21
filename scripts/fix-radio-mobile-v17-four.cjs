const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');

const start='  /* MOBILE_V17_FOUR_FIXES */';
const end='  /* END_MOBILE_V17_FOUR_FIXES */';
const re=new RegExp('\\n  \/\\* MOBILE_V17_FOUR_FIXES \\*\\/[\\s\\S]*?\/\\* END_MOBILE_V17_FOUR_FIXES \\*\\/','g');
s=s.replace(re,'');

const marker='  .footer{display:none!important}\n}';
if(!s.includes(marker)) throw new Error('fim do CSS mobile não encontrado');

const css=`
${start}
  /* 1) título visível sempre em 8 bandas */
  .grid-top>.panel:nth-child(3) .panel-title{font-size:0!important}
  .grid-top>.panel:nth-child(3) .panel-title .pb-icon{font-size:12px!important}
  .grid-top>.panel:nth-child(3) .panel-title::after{
    content:'ANALISADOR - 8 BANDAS'!important;
    font-size:12px!important;font-weight:700!important;letter-spacing:.2px!important;
    color:#19ef5d!important
  }

  /* 2) analisador aproximadamente 0,5 cm mais alto */
  .grid-top>.panel:nth-child(3),.analyzer{
    min-height:167px!important;height:167px!important;max-height:167px!important
  }
  .analyzer{grid-template-rows:25px minmax(0,1fr) 18px!important}

  /* 3) mapa do Brasil contido no botão Nacional */
  #national{overflow:hidden!important;position:relative!important;padding:2px 1px!important;gap:0!important}
  #national .scope-icon{
    width:24px!important;height:19px!important;max-width:24px!important;max-height:19px!important;
    min-width:0!important;min-height:0!important;margin:0 auto!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    position:static!important;transform:none!important;overflow:hidden!important
  }
  #national .scope-icon svg{
    width:22px!important;height:18px!important;max-width:22px!important;max-height:18px!important;
    display:block!important;position:static!important;transform:none!important;margin:0 auto!important
  }

  /* 4) espaço entre menus e botões inferiores do Tocando */
  .playbox{min-height:217px!important;height:217px!important;max-height:217px!important}
  .controls{
    position:relative!important;top:9px!important;
    margin-top:0!important;margin-bottom:0!important;gap:8px!important
  }
${end}
`;

s=s.replace(marker,css+marker);
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v17');
fs.writeFileSync(path,s);
console.log('OK V17: titulo 8, analisador +19px, Brasil contido, gap Tocando +9px.');
