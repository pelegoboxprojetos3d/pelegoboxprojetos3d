const fs=require('fs');
const skinPath='src/public/custom-elements/pelego-radio.js';
const corePath='src/public/custom-elements/pelego-radio-core.js';
let s=fs.readFileSync(skinPath,'utf8');
let c=fs.readFileSync(corePath,'utf8');
function need(v,label){if(!v)throw new Error('Nao achei: '+label);}

// Somente mobile: mover a barra PELEGO RADIO para abaixo do equalizador,
// compactar o painel TOCANDO e levar nome da radio + tempo para o cabecalho.
if(!s.includes('MOBILE_V10_TITLE_META_COMPACT')){
  const marker='  .footer{display:none!important}\n}';
  need(s.includes(marker),'fim do CSS mobile');
  const css=`  /* MOBILE_V10_TITLE_META_COMPACT */\n  .topbar{order:4!important;height:18px!important;min-height:18px!important;max-height:18px!important;padding:0 4px!important;justify-content:center!important;overflow:hidden!important}\n  .topbar .brandrow{justify-content:center!important;gap:0!important;min-width:0!important}\n  .topbar .logo-bars,.topbar .subtitle,.topbar .win{display:none!important}\n  .topbar .title{font-size:8px!important;font-weight:600!important;line-height:18px!important;letter-spacing:.15px!important;white-space:nowrap!important}\n  .playbox{min-height:216px!important;height:216px!important;max-height:216px!important}\n  .playbody{grid-template-rows:9px 23px 18px 32px 27px!important;gap:1px!important;padding:0 8px 5px!important}\n  .playbox .hint{display:none!important}\n  #shell .playbox .panel-title{justify-content:flex-start!important;text-align:left!important;gap:5px!important;overflow:hidden!important;white-space:nowrap!important}\n  #shell .playbox .play-title-left{display:inline-flex!important;align-items:center!important;gap:5px!important;flex:0 0 auto!important}\n  #shell .playbox .play-meta{display:block!important;min-width:0!important;max-width:calc(100% - 92px)!important;margin-left:2px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:left!important;color:#fff!important;font-size:7px!important;font-weight:500!important;letter-spacing:0!important;text-transform:none!important}\n`;
  s=s.replace(marker,css+marker);
}

const oldTitle="const playTitle=root.querySelector('.playbox .panel-title'); title(playTitle, mobile ? `<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span><span>TOCANDO</span></span>` : `<span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO`);";
const newTitle="const playTitle=root.querySelector('.playbox .panel-title'); title(playTitle, mobile ? `<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span><span>TOCANDO</span></span><span class=\"play-meta\" id=\"playMeta\"></span>` : `<span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO`);";
if(s.includes(oldTitle)) s=s.replace(oldTitle,newTitle); else need(s.includes('id=\"playMeta\"'),'titulo mobile com meta');

const oldGuard="if(pbMobileTitleV6) pbMobileTitleV6.innerHTML='<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span><span>TOCANDO</span></span>';";
const newGuard="if(pbMobileTitleV6) pbMobileTitleV6.innerHTML='<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span><span>TOCANDO</span></span><span class=\"play-meta\" id=\"playMeta\"></span>';";
if(s.includes(oldGuard)) s=s.replace(oldGuard,newGuard); else need(s.includes(newGuard),'guard mobile com meta');
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v10');

const oldMeta="  updatePlayMeta(){const meta=this.shadowRoot?.getElementById('playMeta');if(!meta)return;if(!this.currentStation){meta.textContent='Aguardando reprodução';return;}const estilo=String(this.currentStation?.genre||'').trim()||'Estilo';const faixa=String(this.currentStation?.name||'PELEGO RADIO').trim();meta.textContent=`${estilo} • ${faixa} • ${this.formatElapsed(this.audio?.currentTime)}`;}";
const newMeta="  updatePlayMeta(){const meta=this.shadowRoot?.getElementById('playMeta');if(!meta)return;const mobile=Number(this.getBoundingClientRect?.().width||0)<=640;if(!this.currentStation){meta.textContent=mobile?'Aguardando':'Aguardando reprodução';return;}const estilo=String(this.currentStation?.genre||'').trim()||'Estilo';const faixa=String(this.currentStation?.name||'PELEGO RADIO').trim();const tempo=this.formatElapsed(this.audio?.currentTime);meta.textContent=mobile?`${faixa} • ${tempo}`:`${estilo} • ${faixa} • ${tempo}`;}";
need(c.includes(oldMeta),'updatePlayMeta atual');
c=c.replace(oldMeta,newMeta);

const oldUi="if(titulo)titulo.innerHTML=mobile?`<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO</span>`:`<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO</span><span class=\"play-meta\" id=\"playMeta\"></span>`;";
const newUi="if(titulo)titulo.innerHTML=mobile?`<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO</span><span class=\"play-meta\" id=\"playMeta\"></span>`:`<span class=\"play-title-left\"><span class=\"pb-icon\" style=\"font-size:18px\">♫</span>TOCANDO</span><span class=\"play-meta\" id=\"playMeta\"></span>`;";
need(c.includes(oldUi),'applyPlayerUi mobile');
c=c.replace(oldUi,newUi);

fs.writeFileSync(skinPath,s);
fs.writeFileSync(corePath,c);
console.log('OK: titulo movido para baixo do equalizador e TOCANDO compacto com radio + tempo no mobile');
