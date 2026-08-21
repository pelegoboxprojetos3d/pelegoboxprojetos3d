const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');

// V23: mantém o mobile em 310px / 8 bandas e impede o canvas do analisador
// de ocupar a altura inteira do painel e vazar por baixo da seção seguinte.
const oldStart='  /* MOBILE_V17_FOUR_FIXES */';
const oldEnd='  /* END_MOBILE_V17_FOUR_FIXES */';
const oldRe=new RegExp('\\n  \/\\* MOBILE_V17_FOUR_FIXES \\*\\/[\\s\\S]*?\/\\* END_MOBILE_V17_FOUR_FIXES \\*\\/','g');
s=s.replace(oldRe,'');

const v23Re=/\n  \/\* MOBILE_V23_ANALYZER_CLIP_FIX \*\/[\s\S]*?\/\* END_MOBILE_V23_ANALYZER_CLIP_FIX \*\//g;
s=s.replace(v23Re,'');

const marker='  .footer{display:none!important}\n}';
if(!s.includes(marker)) throw new Error('fim do CSS mobile não encontrado');

const css=`
${oldStart}
  /* V23.1 - largura mobile 310px e centralização */
  :host{
    width:310px!important;max-width:310px!important;
    margin-left:auto!important;margin-right:auto!important;
    box-sizing:border-box!important
  }
  .shell{
    width:310px!important;max-width:310px!important;
    margin-left:auto!important;margin-right:auto!important;
    box-sizing:border-box!important
  }

  /* V23.2 - títulos mobile sempre em 8 bandas */
  .grid-top>.panel:nth-child(3) .panel-title{font-size:0!important}
  .grid-top>.panel:nth-child(3) .panel-title .pb-icon{font-size:12px!important}
  .grid-top>.panel:nth-child(3) .panel-title::after{
    content:'ANALISADOR - 8 BANDAS'!important;
    font-size:12px!important;font-weight:700!important;letter-spacing:.2px!important;
    color:#19ef5d!important
  }
  .eqtitle{font-size:0!important;white-space:nowrap!important}
  .eqtitle::after{
    content:'⚙ EQUALIZADOR 8 BANDAS'!important;
    font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;
    color:inherit!important
  }

  /* V23.3 - bloco do analisador fecha em 239px e não invade o próximo painel */
  .grid-top{
    display:block!important;
    width:100%!important;
    min-height:239px!important;height:239px!important;max-height:239px!important;
    overflow:hidden!important;
    position:relative!important;
    margin:0!important
  }
  .grid-top>.panel:nth-child(3),.analyzer{
    display:grid!important;
    width:100%!important;max-width:100%!important;
    min-height:239px!important;height:239px!important;max-height:239px!important;
    overflow:hidden!important;
    position:relative!important;
    margin:0!important
  }
  .analyzer{grid-template-rows:25px minmax(0,1fr) 18px!important}
  .analyzer canvas{
    display:block!important;
    width:calc(100% - 14px)!important;max-width:calc(100% - 14px)!important;
    height:auto!important;min-height:0!important;max-height:none!important;
    align-self:stretch!important;
    margin:0 7px!important;
    overflow:hidden!important;
    position:relative!important;
    z-index:0!important
  }
  .analyzer .bands-label{
    position:relative!important;
    z-index:1!important;
    background:#050908!important
  }
  .grid-middle{
    position:relative!important;
    z-index:1!important;
    margin-top:0!important
  }

  /* V23.4 - preservar mapa do Brasil contido no botão Nacional */
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

  /* V23.5 - preservar espaço do bloco Tocando */
  .playbox{min-height:217px!important;height:217px!important;max-height:217px!important}
  .controls{
    position:relative!important;top:9px!important;
    margin-top:0!important;margin-bottom:0!important;gap:8px!important
  }
${oldEnd}

  /* MOBILE_V23_ANALYZER_CLIP_FIX */
  .grid-top{height:239px!important;max-height:239px!important;overflow:hidden!important}
  .analyzer{height:239px!important;max-height:239px!important;overflow:hidden!important}
  .analyzer canvas{height:auto!important;min-height:0!important;align-self:stretch!important}
  .grid-middle{position:relative!important;z-index:1!important;margin-top:0!important}
  /* END_MOBILE_V23_ANALYZER_CLIP_FIX */
`;

s=s.replace(marker,css+marker);
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v23');

if(!s.includes('MOBILE_V23_ANALYZER_CLIP_FIX')) throw new Error('fix V23 não inserido');
if(!s.includes('height:auto!important')) throw new Error('canvas não foi limitado ao grid');
if(!s.includes("content:'ANALISADOR - 8 BANDAS'")) throw new Error('título do analisador 8 bandas ausente');
if(!s.includes("content:'⚙ EQUALIZADOR 8 BANDAS'")) throw new Error('título do equalizador 8 bandas ausente');

fs.writeFileSync(path,s);
console.log('OK V23: analisador mobile contido em 239px, canvas sem vazamento e 8 bandas preservadas.');
