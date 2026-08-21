const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');

// V21: estabiliza somente o mobile. Remove títulos duplicados, elimina reaplicação cíclica do skin e trava o analisador em 239px.
const reOldBlock=new RegExp('\\n  \/\\* MOBILE_V17_FOUR_FIXES \\*\\/[\\s\\S]*?\/\\* END_MOBILE_V17_FOUR_FIXES \\*\\/','g');
s=s.replace(reOldBlock,'');
const reV21Block=new RegExp('\\n  \/\\* MOBILE_V21_STABLE \\*\\/[\\s\\S]*?\/\\* END_MOBILE_V21_STABLE \\*\\/','g');
s=s.replace(reV21Block,'');

const marker='  .footer{display:none!important}\n}';
if(!s.includes(marker)) throw new Error('fim do CSS mobile não encontrado');

const css=`
  /* MOBILE_V21_STABLE */
  /* largura mobile fixa e centralizada, sem alternar 315/310 */
  :host{
    width:310px!important;min-width:310px!important;max-width:310px!important;
    margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important
  }
  .shell{
    width:310px!important;min-width:310px!important;max-width:310px!important;
    margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important
  }

  /* primeiro retângulo: analisador com altura realmente travada */
  .grid-top>.panel:nth-child(3),.analyzer{
    width:100%!important;max-width:100%!important;
    min-height:239px!important;height:239px!important;max-height:239px!important
  }
  .analyzer{grid-template-rows:25px minmax(0,1fr) 18px!important}
  .analyzer canvas{
    width:calc(100% - 14px)!important;max-width:calc(100% - 14px)!important;
    margin-left:7px!important;margin-right:7px!important
  }
  .grid-top>.panel:nth-child(3) .panel-title{font-size:12px!important;white-space:nowrap!important}
  .grid-top>.panel:nth-child(3) .panel-title::before,
  .grid-top>.panel:nth-child(3) .panel-title::after{content:none!important;display:none!important}

  /* um único título real do equalizador, sem pseudo-elemento duplicando */
  .eqtitle{
    font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;
    white-space:nowrap!important
  }
  .eqtitle::before,.eqtitle::after{content:none!important;display:none!important}

  /* preservar mapa do Brasil contido no botão Nacional */
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

  /* preservar o respiro no bloco Tocando */
  .playbox{min-height:217px!important;height:217px!important;max-height:217px!important}
  .controls{
    position:relative!important;top:9px!important;
    margin-top:0!important;margin-bottom:0!important;gap:8px!important
  }
  /* END_MOBILE_V21_STABLE */
`;
s=s.replace(marker,css+marker);

// Mobile é decidido apenas pelo viewport. A própria largura da rádio não pode decidir o skin e provocar alternância.
s=s.replace(/function isMobileRadio\(el\)\{[\s\S]*?\n\}/,`function isMobileRadio(el){
  return !!window.matchMedia?.('(max-width:640px)')?.matches;
}`);

// O CSS é sempre o mesmo. A media query faz o trabalho; não reescrevemos o stylesheet conforme a largura muda.
s=s.replace("  const skinForThisView = mobile ? SKIN.replace('@media(max-width:640px){','@media(max-width:100000px){') : SKIN;","  const skinForThisView = SKIN;");

// Remove ResizeObserver que reaplicava o skin quando a própria rádio mudava de tamanho.
s=s.replace(/\n  if\(!el\.__pbMobileResizeObserver[\s\S]*?\n  \}\n\n  const top/, '\n\n  const top');

// Além do CSS, trava a altura diretamente no painel real para impedir regras antigas de vencerem no mobile.
const revLine="  style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-final-v20' : '20260821-desktop-preservado-v2';";
if(!s.includes(revLine)) throw new Error('linha de revisão V20 não encontrada');
s=s.replace(revLine,`  style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-final-v21' : '20260821-desktop-preservado-v2';

  const analyzerPanel=root.querySelector('.grid-top>.panel:nth-child(3)');
  if(analyzerPanel){
    if(mobile){
      analyzerPanel.style.setProperty('min-height','239px','important');
      analyzerPanel.style.setProperty('height','239px','important');
      analyzerPanel.style.setProperty('max-height','239px','important');
    }else{
      analyzerPanel.style.removeProperty('min-height');
      analyzerPanel.style.removeProperty('height');
      analyzerPanel.style.removeProperty('max-height');
    }
  }`);

// Um único ajuste após o layout. Nada de 4 reaplicações após F5.
s=s.replace(/const scheduleSkinSweep = \(\)=>\{[\s\S]*?\n\};/,`const scheduleSkinSweep = ()=>{
  requestAnimationFrame(()=>applyAllSkins());
};`);

// Mata o healer antigo que reaplicava o skin a cada 1,2 s e fazia títulos/medidas oscilarem.
s=s.replace(/\n\s*window\.__PELEGO_RADIO_SKIN_HEALER__ = setInterval\(applyAllSkins,1200\);/,'');
const observerMarker='if(!window.__PELEGO_RADIO_SKIN_OBSERVER__){';
if(s.includes(observerMarker) && !s.includes('clearInterval(window.__PELEGO_RADIO_SKIN_HEALER__)')){
  s=s.replace(observerMarker,`if(window.__PELEGO_RADIO_SKIN_HEALER__){
  clearInterval(window.__PELEGO_RADIO_SKIN_HEALER__);
  window.__PELEGO_RADIO_SKIN_HEALER__=null;
}

${observerMarker}`);
}

fs.writeFileSync(path,s);
console.log('OK V21: skin mobile estável, analisador 239px real e título do equalizador sem duplicação.');
