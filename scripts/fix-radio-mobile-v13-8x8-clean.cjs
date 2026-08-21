const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');
const need=(cond,msg)=>{if(!cond)throw new Error(msg)};

// V14: corrige somente o equalizador mobile.
// O analisador já está correto em 8 bandas e não deve ser alterado.
need(s.includes("const labels=mobile?['40','100','250','630','1.6K','4K','10K','16K']"),'analisador mobile 8 bandas não encontrado');
need(s.includes('count=mobile?8:24'),'analisador mobile não está em 8 bandas');

// Remove overrides anteriores do EQ para que exista uma única regra final.
s=s.replace(/\n  \/\* MOBILE_V13_8X8_CLEAN \*\/[\s\S]*?\/\* END_MOBILE_V13_8X8_CLEAN \*\//g,'');
s=s.replace(/\n  \/\* MOBILE_V14_EQ_FLEX_8 \*\/[\s\S]*?\/\* END_MOBILE_V14_EQ_FLEX_8 \*\//g,'');

const marker='  .footer{display:none!important}\n}';
need(s.includes(marker),'fim do CSS mobile não encontrado');

const css=`
  /* MOBILE_V14_EQ_FLEX_8 */
  .eqpanel{
    min-height:154px!important;height:154px!important;max-height:154px!important;
    padding:0 6px 7px!important;grid-template-rows:25px minmax(0,1fr)!important;
    overflow:hidden!important
  }
  .eqhead{
    height:25px!important;min-height:25px!important;padding:0 2px!important;
    display:flex!important;align-items:center!important;justify-content:space-between!important;gap:5px!important
  }
  .eqtitle{font-size:8.6px!important;letter-spacing:0!important;white-space:nowrap!important}
  .preset{position:static!important;margin-left:auto!important;gap:3px!important;font-size:6.5px!important}
  .preset select{width:86px!important;min-width:86px!important;height:20px!important;font-size:7px!important;padding:0 2px!important}

  .eqgrid{
    display:flex!important;
    flex-direction:row!important;flex-wrap:nowrap!important;
    width:calc(100% - 28px)!important;height:100%!important;
    margin:0 0 0 28px!important;padding:0!important;
    gap:0!important;overflow:hidden!important;
    align-items:stretch!important;justify-content:flex-start!important
  }
  .eqgrid .band{
    display:none!important;
    flex:0 0 12.5%!important;width:12.5%!important;max-width:12.5%!important;min-width:0!important;
    height:100%!important;margin:0!important;padding:0!important;
    justify-items:center!important;align-items:center!important;
    grid-template-rows:11px minmax(0,1fr) 13px!important;
    font-size:5.8px!important;overflow:visible!important
  }
  .eqgrid .band:nth-child(1),
  .eqgrid .band:nth-child(5),
  .eqgrid .band:nth-child(9),
  .eqgrid .band:nth-child(13),
  .eqgrid .band:nth-child(17),
  .eqgrid .band:nth-child(21),
  .eqgrid .band:nth-child(23),
  .eqgrid .band:nth-child(24){display:grid!important}

  .eqgrid .band .db,.eqgrid .band .freq{
    width:100%!important;min-width:0!important;text-align:center!important;
    margin:0!important;padding:0!important;line-height:1!important;
    white-space:nowrap!important;overflow:visible!important
  }
  .sliderwrap{
    width:100%!important;min-width:0!important;height:100%!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    position:relative!important;overflow:visible!important
  }
  .sliderwrap:before{
    left:50%!important;transform:translateX(-50%)!important;
    width:3px!important;height:82%!important
  }
  .band input[type=range]{width:70px!important;height:13px!important;margin:0!important}
  .band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
  .db-scale{left:3px!important;width:24px!important;top:43px!important;bottom:25px!important;font-size:6px!important}
  /* END_MOBILE_V14_EQ_FLEX_8 */
`;

s=s.replace(marker,css+marker);
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v14');

need(s.includes('MOBILE_V14_EQ_FLEX_8'),'override V14 não foi inserido');
need(s.includes('flex:0 0 12.5%'),'as 8 colunas iguais não foram criadas');
need(s.includes('.eqgrid .band:nth-child(24){display:grid!important}'),'oitava banda não foi mantida visível');

fs.writeFileSync(path,s);
console.log('OK V14: equalizador mobile com 8 bandas em 8 colunas iguais, sem alterar analisador, tocando ou desktop.');
