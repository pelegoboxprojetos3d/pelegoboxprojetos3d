const fs = require('fs');

const corePath = 'src/public/custom-elements/pelego-radio-core.js';
const skinPath = 'src/public/custom-elements/pelego-radio.js';
let core = fs.readFileSync(corePath, 'utf8');
let skin = fs.readFileSync(skinPath, 'utf8');

const MARK = '/* MOBILE_V22_CORE_FINAL */';
const css = `
${MARK}
@media(max-width:640px){
  :host{
    display:block!important;
    width:310px!important;min-width:310px!important;max-width:310px!important;
    height:auto!important;min-height:0!important;max-height:none!important;
    margin-left:auto!important;margin-right:auto!important;
    overflow:visible!important;box-sizing:border-box!important
  }
  .shell{
    width:310px!important;min-width:310px!important;max-width:310px!important;
    height:auto!important;min-height:0!important;max-height:none!important;
    margin:0 auto!important;padding:5px!important;gap:7px!important;
    grid-template-rows:auto auto auto auto!important;
    overflow:hidden!important;box-sizing:border-box!important
  }
  .grid-top{display:block!important;height:auto!important;min-height:0!important;overflow:visible!important}
  .grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){display:none!important}
  .grid-top>.panel:nth-child(3),.analyzer{
    display:grid!important;width:100%!important;max-width:100%!important;
    min-height:239px!important;height:239px!important;max-height:239px!important
  }
  .analyzer{grid-template-rows:25px minmax(0,1fr) 18px!important}
  .analyzer canvas{width:calc(100% - 14px)!important;max-width:calc(100% - 14px)!important;height:100%!important;margin:0 7px!important;min-height:0!important}
  .grid-middle{grid-template-columns:1fr!important;gap:7px!important;overflow:visible!important}
  .filters{min-height:129px!important;height:129px!important;max-height:129px!important;padding-bottom:0!important;overflow:hidden!important}
  .filterbody{height:calc(100% - 25px)!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;padding:0 6px 6px!important}
  .scopebuttons{height:100%!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:4px!important}
  .scope{height:100%!important;min-height:0!important;font-size:7px!important;gap:1px!important;padding:1px!important}
  .genres{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;grid-auto-rows:0!important;gap:4px!important;overflow:hidden!important;padding-top:0!important;align-content:stretch!important}
  .genre{display:none!important;height:auto!important;min-height:0!important;font-size:7px!important;padding:0 2px!important}
  .genre:nth-child(-n+8){display:block!important}
  #national{overflow:hidden!important;position:relative!important;padding:2px 1px!important;gap:0!important}
  #national .scope-icon{width:24px!important;height:19px!important;max-width:24px!important;max-height:19px!important;min-width:0!important;min-height:0!important;margin:0 auto!important;display:flex!important;align-items:center!important;justify-content:center!important;position:static!important;transform:none!important;overflow:hidden!important}
  #national .scope-icon svg{width:22px!important;height:18px!important;max-width:22px!important;max-height:18px!important;display:block!important;position:static!important;transform:none!important;margin:0 auto!important}
  .playbox{min-height:217px!important;height:217px!important;max-height:217px!important;margin-top:0!important}
  .playbody{padding:0 8px 1px!important;grid-template-rows:9px 23px 18px 34px 30px!important;row-gap:4px!important}
  .playbox .hint{display:none!important}
  .randomrow{gap:8px!important;align-items:start!important;margin-top:2px!important;margin-bottom:0!important}
  .randomrow label{grid-template-rows:10px 24px!important;gap:2px!important;padding:2px 3px 1px!important}
  .randomrow select{height:24px!important}
  .controls{position:relative!important;top:9px!important;gap:8px!important;margin-top:0!important;margin-bottom:0!important;align-items:center!important}
  .controls button{height:30px!important;margin:0!important}
  .eqpanel{min-height:154px!important;height:154px!important;max-height:154px!important;padding:0 6px 7px!important;grid-template-rows:25px minmax(0,1fr)!important;position:relative!important;overflow:hidden!important}
  .eqhead{height:25px!important;min-height:25px!important;padding:0 2px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:5px!important}
  .eqtitle{font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;white-space:nowrap!important}
  .eqtitle::before,.eqtitle::after{content:none!important;display:none!important}
  .preset{position:static!important;margin-left:auto!important;display:flex!important;align-items:center!important;gap:3px!important;font-size:6.5px!important}
  .preset select{width:86px!important;min-width:86px!important;height:20px!important;font-size:7px!important;padding:0 2px!important}
  .eqgrid{position:relative!important;display:block!important;width:calc(100% - 28px)!important;height:100%!important;margin:0 0 0 28px!important;padding:0!important;overflow:hidden!important;min-width:0!important}
  .eqgrid .band{display:none!important;position:absolute!important;top:0!important;bottom:0!important;width:12.5%!important;max-width:12.5%!important;min-width:12.5%!important;height:100%!important;margin:0!important;padding:0!important;justify-items:center!important;align-items:center!important;grid-template-rows:11px minmax(0,1fr) 13px!important;font-size:5.8px!important;overflow:visible!important}
  .eqgrid .band:nth-child(1){display:grid!important;left:0!important}
  .eqgrid .band:nth-child(5){display:grid!important;left:12.5%!important}
  .eqgrid .band:nth-child(9){display:grid!important;left:25%!important}
  .eqgrid .band:nth-child(13){display:grid!important;left:37.5%!important}
  .eqgrid .band:nth-child(17){display:grid!important;left:50%!important}
  .eqgrid .band:nth-child(21){display:grid!important;left:62.5%!important}
  .eqgrid .band:nth-child(23){display:grid!important;left:75%!important}
  .eqgrid .band:nth-child(24){display:grid!important;left:87.5%!important}
  .eqgrid .band .db,.eqgrid .band .freq{width:100%!important;text-align:center!important;margin:0!important;padding:0!important;line-height:1!important;white-space:nowrap!important;overflow:visible!important}
  .sliderwrap{width:100%!important;min-width:0!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;position:relative!important;overflow:visible!important}
  .sliderwrap:before{left:50%!important;transform:translateX(-50%)!important;width:3px!important;height:82%!important}
  .band input[type=range]{width:70px!important;height:13px!important;margin:0!important}
  .band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
  .eqgroups{display:none!important}
  .db-scale{left:3px!important;width:24px!important;top:43px!important;bottom:25px!important;font-size:6px!important}
  .footer{display:none!important}
}
/* END_MOBILE_V22_CORE_FINAL */
`;

if (!core.includes(MARK)) {
  const closeStyle = '</style>';
  const idx = core.indexOf(closeStyle);
  if (idx < 0) throw new Error('Não encontrei </style> no core');
  core = core.slice(0, idx) + css + core.slice(idx);
}

const oldConnected = "connectedCallback(){this.cache();this.buildGenres();this.buildEq();this.buildPreset();this.bind();this.applyConfig();this.syncPersistentState();this.loadBrazilStations().then(()=>this.syncPersistentState()).catch(()=>{});this.renderProducts();this.startCatalogRotation();this.setupCanvas();this.refreshDevices();requestAnimationFrame(()=>{this.applyPlayerUi();this.syncPersistentState();});}";
const newConnected = "connectedCallback(){this.cache();this.buildGenres();this.buildEq();this.buildPreset();this.bind();this.applyConfig();this.applyMobileFinalV22();this.syncPersistentState();this.loadBrazilStations().then(()=>this.syncPersistentState()).catch(()=>{});this.renderProducts();this.startCatalogRotation();this.setupCanvas();this.refreshDevices();requestAnimationFrame(()=>{this.applyPlayerUi();this.applyMobileFinalV22();this.syncPersistentState();});}";
if (!core.includes('applyMobileFinalV22()')) {
  if (!core.includes(oldConnected)) throw new Error('connectedCallback do core não encontrado');
  core = core.replace(oldConnected, newConnected);
}

if (!core.includes('/* PB_V22_MOBILE_METHOD */')) {
  const anchor = '  buildGenres(){';
  const method = `  /* PB_V22_MOBILE_METHOD */\n  applyMobileFinalV22(){const mobile=!!window.matchMedia?.('(max-width:640px)')?.matches;if(!mobile)return;const analyzerTitle=this.shadowRoot?.querySelector('.grid-top>.panel:nth-child(3) .panel-title');if(analyzerTitle)analyzerTitle.textContent='〽 ANALISADOR - 8 BANDAS';const eqTitle=this.shadowRoot?.querySelector('.eqpanel .eqtitle');if(eqTitle){eqTitle.textContent='⚙ EQUALIZADOR 8 BANDAS';eqTitle.style.removeProperty('font-size');}this.dataset.pelegoMobileRev='V22';}\n`;
  if (!core.includes(anchor)) throw new Error('âncora buildGenres não encontrada');
  core = core.replace(anchor, method + anchor);
}

// O wrapper continua sendo útil quando for o arquivo ligado no Editor, mas deve concordar com o core.
skin = skin.replace(/20260821-mobile-final-v21/g, '20260821-mobile-final-v22');
if (!skin.includes('/* MOBILE_V22_WRAPPER_GUARD */')) {
  const marker = '  .footer{display:none!important}\n}';
  const guard = `  /* MOBILE_V22_WRAPPER_GUARD */\n  :host,.shell{width:310px!important;min-width:310px!important;max-width:310px!important;margin-left:auto!important;margin-right:auto!important}\n  .grid-top>.panel:nth-child(3),.analyzer{min-height:239px!important;height:239px!important;max-height:239px!important}\n  .eqtitle{font-size:8.6px!important;white-space:nowrap!important}\n  .eqtitle::before,.eqtitle::after{content:none!important;display:none!important}\n  /* END_MOBILE_V22_WRAPPER_GUARD */\n`;
  if (!skin.includes(marker)) throw new Error('fim do CSS mobile do wrapper não encontrado');
  skin = skin.replace(marker, guard + marker);
}

fs.writeFileSync(corePath, core);
fs.writeFileSync(skinPath, skin);
console.log('V22 gerada: core e wrapper sincronizados para o mesmo mobile final.');
