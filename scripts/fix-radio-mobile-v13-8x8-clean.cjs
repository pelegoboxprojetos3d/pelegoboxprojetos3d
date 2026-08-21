const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');
const need=(cond,msg)=>{if(!cond)throw new Error(msg)};

// V13: mobile realmente 8x8. Desktop permanece intocado.
// Frequências escolhidas para o mobile, em correspondência 1:1 entre analisador e EQ:
// 40, 100, 250, 630, 1.6K, 4K, 10K, 16K.

const replacements=[
  ["const labels=mobile?['40','100','250','1K','4K','16K']:","const labels=mobile?['40','100','250','630','1.6K','4K','10K','16K']:"],
  ['const mobile=isMobileRadio(this),count=mobile?6:24;','const mobile=isMobileRadio(this),count=mobile?8:24;'],
  ['const count=isMobileRadio(this)?6:24;','const count=isMobileRadio(this)?8:24;'],
  ['const freqs=mobile?[40,100,250,1000,4000,16000]:','const freqs=mobile?[40,100,250,630,1600,4000,10000,16000]:']
];
for(const [from,to] of replacements){
  need(s.includes(from),`marcador não encontrado: ${from}`);
  s=s.replace(from,to);
}

// Remove eventual V13 antigo para tornar a execução idempotente.
s=s.replace(/\n  \/\* MOBILE_V13_8X8_CLEAN \*\/[\s\S]*?\/\* END_MOBILE_V13_8X8_CLEAN \*\//g,'');

const marker='  .footer{display:none!important}\n}';
need(s.includes(marker),'fim do CSS mobile não encontrado');
const css=`
  /* MOBILE_V13_8X8_CLEAN */
  .eqpanel{
    min-height:154px!important;height:154px!important;max-height:154px!important;
    padding:0 6px 7px!important;grid-template-rows:25px minmax(0,1fr)!important;
    overflow:hidden!important
  }
  .eqhead{height:25px!important;min-height:25px!important;padding:0 2px!important;gap:5px!important}
  .eqtitle{font-size:8.6px!important;letter-spacing:0!important}
  .preset{gap:3px!important;font-size:6.5px!important}
  .preset select{width:86px!important;min-width:86px!important;height:20px!important;font-size:7px!important;padding:0 2px!important}

  .eqgrid{
    display:grid!important;
    width:calc(100% - 30px)!important;height:100%!important;
    margin:0 0 0 30px!important;padding:0!important;
    grid-template-columns:repeat(8,minmax(0,1fr))!important;
    grid-template-rows:minmax(0,1fr)!important;
    grid-auto-flow:column!important;grid-auto-rows:minmax(0,1fr)!important;
    column-gap:1px!important;row-gap:0!important;
    align-items:stretch!important;justify-items:stretch!important;
    overflow:hidden!important
  }
  .eqgrid .band{
    display:none!important;min-width:0!important;width:auto!important;height:100%!important;
    justify-items:center!important;align-items:center!important;
    grid-template-rows:11px minmax(0,1fr) 13px!important;
    font-size:5.8px!important;overflow:visible!important
  }
  .eqgrid .band:nth-child(1){display:grid!important;grid-column:1!important;grid-row:1!important}
  .eqgrid .band:nth-child(5){display:grid!important;grid-column:2!important;grid-row:1!important}
  .eqgrid .band:nth-child(9){display:grid!important;grid-column:3!important;grid-row:1!important}
  .eqgrid .band:nth-child(13){display:grid!important;grid-column:4!important;grid-row:1!important}
  .eqgrid .band:nth-child(17){display:grid!important;grid-column:5!important;grid-row:1!important}
  .eqgrid .band:nth-child(21){display:grid!important;grid-column:6!important;grid-row:1!important}
  .eqgrid .band:nth-child(23){display:grid!important;grid-column:7!important;grid-row:1!important}
  .eqgrid .band:nth-child(24){display:grid!important;grid-column:8!important;grid-row:1!important}
  .eqgrid .band .db,.eqgrid .band .freq{
    width:100%!important;min-width:0!important;text-align:center!important;
    margin:0!important;padding:0!important;line-height:1!important;
    white-space:nowrap!important;overflow:visible!important
  }
  .sliderwrap{width:100%!important;min-width:0!important;overflow:visible!important}
  .band input[type=range]{width:80px!important;height:13px!important;margin:0!important}
  .band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
  .sliderwrap:before{width:3px!important;height:84%!important}
  .db-scale{left:4px!important;width:25px!important;top:43px!important;bottom:25px!important;font-size:6px!important}
  /* END_MOBILE_V13_8X8_CLEAN */
`;
s=s.replace(marker,css+marker);
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v13');

need(s.includes("const labels=mobile?['40','100','250','630','1.6K','4K','10K','16K']"),'analisador mobile não ficou com 8 rótulos');
need(s.includes('count=mobile?8:24'),'analisador mobile não ficou com 8 barras');
need(s.includes('grid-template-columns:repeat(8,minmax(0,1fr))'),'EQ mobile não ficou com 8 colunas');
need(s.includes('.eqgrid .band:nth-child(24){display:grid!important;grid-column:8!important;grid-row:1!important}'),'oitava banda não foi travada na coluna 8');

fs.writeFileSync(path,s);
console.log('OK V13: mobile 8 barras no analisador + 8 sliders no EQ, todos em uma única linha e em correspondência 1:1.');
