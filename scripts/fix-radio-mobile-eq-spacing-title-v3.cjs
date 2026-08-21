const fs=require('fs');
const skinPath='src/public/custom-elements/pelego-radio.js';
const corePath='src/public/custom-elements/pelego-radio-core.js';
let s=fs.readFileSync(skinPath,'utf8');
let c=fs.readFileSync(corePath,'utf8');
function need(cond,label){if(!cond)throw new Error('Nao achei: '+label);}

// Ajuste visual mobile v6: 12 dB + 6 bandas ocupam 7 faixas horizontais iguais.
// Preset vai para baixo e removemos o vazio entre o titulo e os controles.
if(!s.includes('MOBILE_V6_EQ_SCOPE_FIX')){
  const marker='  .footer{display:none!important}\n}';
  need(s.includes(marker),'fim do CSS mobile');
  const css=`  /* MOBILE_V6_EQ_SCOPE_FIX */\n  .eqpanel{padding:0 6px 28px!important;grid-template-rows:20px minmax(0,1fr)!important;position:relative!important}\n  .eqhead{height:20px!important;min-height:20px!important;padding:0 2px!important;align-items:center!important;justify-content:flex-start!important}\n  .eqgrid{min-width:0!important;width:calc(100% - 42px)!important;margin-left:42px!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:0!important;padding:0!important;overflow:hidden!important;align-items:stretch!important;justify-content:stretch!important}\n  .eqgrid .band{justify-items:center!important;grid-template-rows:9px minmax(0,1fr) 12px!important}\n  .db-scale{left:0!important;width:42px!important;top:29px!important;bottom:40px!important;align-items:center!important;font-size:6px!important}\n  .preset{position:absolute!important;right:6px!important;bottom:4px!important;margin:0!important;gap:4px!important;font-size:7px!important;z-index:5!important}\n  .preset select{width:96px!important;min-width:96px!important;height:21px!important}\n  #shell .playbox .panel-title{justify-content:flex-start!important;text-align:left!important;gap:6px!important}\n  #shell .playbox .play-title-left{display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;margin:0!important}\n`;
  s=s.replace(marker,css+marker);
}

// Garante que icone e TOCANDO sejam um unico item flex no mobile.
if(!s.includes('pbMobileTitleV6')){
  const marker="  const eqTitle=root.querySelector('.eqpanel .eqtitle');";
  need(s.includes(marker),'marcador titulo equalizador');
  const ins=`  if(mobile){\n    const pbMobileTitleV6=root.querySelector('.playbox .panel-title');\n    if(pbMobileTitleV6) pbMobileTitleV6.innerHTML='<span class="play-title-left"><span class="pb-icon" style="font-size:18px">♫</span><span>TOCANDO</span></span>';\n  }\n`;
  s=s.replace(marker,ins+marker);
}
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v6');

// Corrige estado legado onde os dois escopos ficaram desligados.
const applyMarker='  applyConfig(){';
need(c.includes(applyMarker),'applyConfig');
if(!c.includes('pbScopeGuardV6')){
  c=c.replace(applyMarker,"  applyConfig(){/* pbScopeGuardV6 */if(!this.config.allowInternational&&!this.config.allowNational)this.config.allowInternational=true;");
}

const oldInt="this.international.onclick=()=>{this.config.allowInternational=!this.config.allowInternational;this.refreshGenreButtons();this.syncPersistentState();};";
const newInt="this.international.onclick=()=>{if(this.config.allowInternational&&!this.config.allowNational)return;this.config.allowInternational=!this.config.allowInternational;this.refreshGenreButtons();this.syncPersistentState();};";
if(c.includes(oldInt)) c=c.replace(oldInt,newInt);
else need(c.includes(newInt),'handler Internacional protegido');

const oldNat="this.national.onclick=async()=>{this.config.allowNational=!this.config.allowNational;this.refreshGenreButtons();if(this.config.allowNational)await this.loadBrazilStations();this.syncPersistentState();};";
const newNat="this.national.onclick=async()=>{if(this.config.allowNational&&!this.config.allowInternational)return;this.config.allowNational=!this.config.allowNational;this.refreshGenreButtons();if(this.config.allowNational)await this.loadBrazilStations();this.syncPersistentState();};";
if(c.includes(oldNat)) c=c.replace(oldNat,newNat);
else need(c.includes(newNat),'handler Nacional protegido');

// No mobile, somente os 8 botoes visiveis mandam no pool. Nacional/Internacional apenas definem a origem.
const oldPool="  persistentPool(){const selected=this.config.selectedGenres?.length?this.config.selectedGenres:['ROCK','POP','JAZZ','SERTANEJO'];let pool=[];if(this.config.allowInternational)pool.push(...STATIONS.filter(st=>this.stationTags(st).some(tag=>selected.includes(tag))));if(this.config.allowNational)pool.push(...this.brStations.filter(st=>this.stationTags(st).some(tag=>selected.includes(tag))));if(!pool.length&&this.config.allowNational&&this.brStations.length)pool.push(...this.brStations);if(!pool.length&&this.config.allowInternational)pool.push(...STATIONS);return pool;}";
const newPool="  persistentPool(){const mobile=Number(this.getBoundingClientRect?.().width||0)<=640;const mobileGenres=['ROCK','SERTANEJO','COUNTRY','REGGAE','POP','DANCE','JAZZ','BLUES'];let selected=this.config.selectedGenres?.length?this.config.selectedGenres:['ROCK','POP','JAZZ','SERTANEJO'];if(mobile)selected=selected.filter(x=>mobileGenres.includes(x));if(!selected.length)selected=['ROCK'];let pool=[];if(this.config.allowInternational)pool.push(...STATIONS.filter(st=>this.stationTags(st).some(tag=>selected.includes(tag))));if(this.config.allowNational)pool.push(...this.brStations.filter(st=>this.stationTags(st).some(tag=>selected.includes(tag))));if(!pool.length&&this.config.allowNational&&this.brStations.length)pool.push(...this.brStations);if(!pool.length&&this.config.allowInternational)pool.push(...STATIONS);return pool;}";
if(c.includes(oldPool)) c=c.replace(oldPool,newPool);
else need(c.includes("const mobileGenres=['ROCK','SERTANEJO','COUNTRY','REGGAE','POP','DANCE','JAZZ','BLUES'];"),'pool mobile ja ajustado');

fs.writeFileSync(skinPath,s);
fs.writeFileSync(corePath,c);
console.log('OK: equalizador harmonico, TOCANDO a esquerda e Nacional/Internacional comandando os 8 estilos sem estado ambos desligados');