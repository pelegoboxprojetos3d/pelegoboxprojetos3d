const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const startMarkers = ['/* MOBILE_V32_CANONICAL_ONLY','/* MOBILE_V33_CANONICAL_FLOW'];
let startAt = -1;
let startMarker = '';
for (const marker of startMarkers) {
  const idx = src.indexOf(marker);
  if (idx >= 0) { startAt = idx; startMarker = marker; break; }
}
const endMarkers = ['/* END_MOBILE_V32_CANONICAL_ONLY */','/* END_MOBILE_V33_CANONICAL_FLOW */'];
let endAt = -1;
let endMarker = '';
for (const marker of endMarkers) {
  const idx = src.indexOf(marker, startAt + 1);
  if (idx >= 0) { endAt = idx; endMarker = marker; break; }
}
if (startAt < 0 || endAt < 0 || endAt <= startAt) throw new Error('Skin mobile canônica atual não encontrada.');

const block = `/* MOBILE_V33_CANONICAL_FLOW
   Fluxo natural: 4 painéis reais empilhados, sem position:absolute e sem corte do 4º painel. */
const MOBILE_CLEAN_SKIN = \`
:host{
  display:block!important;
  width:310px!important;min-width:310px!important;max-width:310px!important;
  height:auto!important;min-height:700px!important;max-height:none!important;
  margin:0 auto!important;overflow:visible!important;
  color:#effff4!important;font-family:Arial,Helvetica,sans-serif!important;
  --g:#20ef64;--line:#13d94f;
}
*{box-sizing:border-box!important}
.shell{
  width:310px!important;min-width:310px!important;max-width:310px!important;
  height:auto!important;min-height:700px!important;max-height:none!important;
  margin:0 auto!important;padding:5px!important;gap:6px!important;
  display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;
  overflow:visible!important;background:#010504!important;border:0!important;border-radius:10px!important;box-shadow:none!important;
}
.topbar,.footer{display:none!important}
.grid-top,.grid-middle{display:contents!important}
.grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){display:none!important}
.grid-top>.panel:nth-child(3),.filters,.playbox,.eqpanel{
  position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;
  flex:0 0 auto!important;width:300px!important;min-width:300px!important;max-width:300px!important;
  margin:0!important;padding:0!important;overflow:hidden!important;
  background:linear-gradient(180deg,#020806,#010504)!important;
  border:1px solid #13d94f!important;border-radius:10px!important;
  box-shadow:0 0 7px rgba(0,255,75,.07) inset!important;
}
.grid-top>.panel:nth-child(3),.analyzer{height:160px!important;min-height:160px!important;max-height:160px!important}
.filters{height:132px!important;min-height:132px!important;max-height:132px!important}
.playbox{height:220px!important;min-height:220px!important;max-height:220px!important}
.eqpanel{height:160px!important;min-height:160px!important;max-height:160px!important}

.panel-title{
  height:25px!important;min-height:25px!important;max-height:25px!important;
  display:flex!important;align-items:center!important;padding:0 9px!important;gap:7px!important;
  color:#19ef5d!important;font-weight:700!important;letter-spacing:.15px!important;white-space:nowrap!important;
}
.panel-title::before,.panel-title::after,.eqtitle::before,.eqtitle::after{content:none!important;display:none!important}

/* ANALISADOR */
.analyzer{display:grid!important;grid-template-rows:25px 118px 17px!important;overflow:hidden!important}
.grid-top>.panel:nth-child(3) .panel-title{font-size:11px!important}
.grid-top>.panel:nth-child(3) .panel-title .pb-icon{display:inline-flex!important;width:16px!important;height:16px!important;flex:0 0 16px!important}
.grid-top>.panel:nth-child(3) .panel-title .pb-icon svg{width:16px!important;height:16px!important;display:block!important}
.analyzer canvas{display:block!important;width:286px!important;height:118px!important;min-height:118px!important;max-height:118px!important;margin:0 7px!important;border:1px solid #385047!important;border-radius:3px!important;background:#020707!important}
.bands-label{display:grid!important;grid-template-columns:repeat(3,1fr)!important;height:17px!important;min-height:17px!important;max-height:17px!important;align-items:center!important;justify-items:center!important;color:#19ef5d!important;font-size:6px!important;font-weight:700!important;border:0!important}
.bands-label span{display:block!important;width:100%!important;border:0!important;text-align:center!important}

/* ESCOLHA */
.filters .panel-title{font-size:11px!important}
.filterbody{height:107px!important;min-height:107px!important;max-height:107px!important;display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;padding:0 6px 6px!important;overflow:hidden!important}
.scopebuttons{height:101px!important;display:grid!important;grid-template-rows:repeat(2,1fr)!important;gap:4px!important}
.scope{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:3px 1px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;border:1px solid #30453b!important;border-radius:6px!important;background:linear-gradient(#0b1510,#050a07)!important;color:#dfe7e2!important;font-size:7px!important;line-height:1!important}
.scope.active{background:linear-gradient(#0ec648,#078a31)!important;border-color:#18ef5d!important;color:#fff!important}
#international .scope-icon,#national .scope-icon,#shell #national .scope-icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0 0 2px!important;width:24px!important;height:22px!important}
#international .scope-icon svg{width:22px!important;height:22px!important}
#national .scope-icon svg,#shell #national .scope-icon svg{width:25px!important;height:22px!important}
#international>span:last-child,#national>span:last-child{line-height:1.05!important;letter-spacing:.1px!important}
.genres{height:101px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;gap:4px!important;padding:0!important;overflow:hidden!important}
.genre{display:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0 2px!important;border-radius:5px!important;font-size:7px!important}
.genre:nth-child(-n+8){display:block!important}

/* TOCANDO */
.playbox{display:grid!important;grid-template-rows:25px 195px!important}
#shell .playbox .panel-title{font-size:11px!important;justify-content:space-between!important;gap:6px!important}
#shell .playbox .play-title-left{display:inline-flex!important;align-items:center!important;gap:6px!important;flex:0 0 auto!important}
#shell .playbox .play-meta{display:block!important;margin-left:auto!important;max-width:145px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:right!important;color:#eef3f0!important;font-size:7px!important;font-weight:400!important}
.playbody{height:195px!important;min-height:195px!important;max-height:195px!important;padding:4px 8px 5px!important;overflow:hidden!important;display:grid!important;grid-template-rows:12px 29px 25px 52px 40px!important;gap:7px!important}
.playbody>.label{font-size:8px!important;line-height:12px!important;color:#e7ece9!important;align-self:end!important}
.playbody>select{height:29px!important;min-height:29px!important;max-height:29px!important;font-size:9px!important}
#shell .playbox .volrow{height:25px!important;display:grid!important;grid-template-columns:22px minmax(0,1fr) 34px!important;gap:5px!important;align-items:center!important;font-size:8px!important;padding-right:0!important;overflow:visible!important}
#shell .playbox #volumeValue{position:static!important;transform:none!important;width:34px!important;min-width:34px!important;background:transparent!important;padding-left:0!important;text-align:right!important;font-size:8px!important}
#shell .playbox .randomrow,#shell .playbox .controls{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;width:100%!important;margin:0!important}
#shell .playbox .randomrow{height:52px!important;min-height:52px!important;max-height:52px!important}
#shell .playbox .randomrow label{display:grid!important;grid-template-rows:18px 34px!important;min-width:0!important;width:100%!important;border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}
#shell .playbox .randomrow .label{font-size:7px!important;line-height:8px!important;white-space:normal!important;display:flex!important;align-items:flex-end!important;background:transparent!important;border:0!important;padding:0!important}
#shell .playbox .randomrow select{height:34px!important;min-height:34px!important;max-height:34px!important;width:100%!important;font-size:8px!important;padding:0 4px!important}
.hint{display:none!important}
#shell .playbox .controls{height:40px!important;min-height:40px!important;max-height:40px!important;position:static!important;top:auto!important;transform:none!important}
#shell .playbox .controls button{height:40px!important;min-height:40px!important;max-height:40px!important;width:100%!important;margin:0!important;padding:0 3px!important;border-radius:6px!important;font-size:10px!important}

/* EQUALIZADOR */
.eqpanel{display:grid!important;grid-template-rows:25px 117px 18px!important;overflow:hidden!important}
.eqhead{height:25px!important;min-height:25px!important;max-height:25px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 116px!important;align-items:center!important;gap:4px!important;padding:0 7px 0 8px!important}
.eqtitle{display:block!important;font-size:8.6px!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important;color:#19ef5d!important;font-weight:700!important}
.preset{position:static!important;display:grid!important;grid-template-columns:34px 78px!important;align-items:center!important;gap:4px!important;margin:0!important;font-size:6px!important;width:116px!important}
.preset select{width:78px!important;min-width:78px!important;max-width:78px!important;height:20px!important;min-height:20px!important;max-height:20px!important;font-size:7px!important;padding:0 3px!important}
.eqgrid{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;width:264px!important;height:117px!important;margin:0 0 0 30px!important;padding:0!important;gap:0!important;overflow:hidden!important;align-items:stretch!important}
.eqgrid .band{display:none!important;grid-template-rows:10px 90px 17px!important;justify-items:center!important;font-size:6px!important;min-width:0!important}
.eqgrid .band:nth-child(1),.eqgrid .band:nth-child(5),.eqgrid .band:nth-child(9),.eqgrid .band:nth-child(13),.eqgrid .band:nth-child(17),.eqgrid .band:nth-child(21),.eqgrid .band:nth-child(23),.eqgrid .band:nth-child(24){display:grid!important}
.band input[type=range]{width:70px!important;height:14px!important}
.band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
.sliderwrap:before{height:84%!important}
.db-scale{left:0!important;width:30px!important;top:32px!important;bottom:22px!important;font-size:6px!important;align-items:center!important}
.eqgroups{display:grid!important;grid-template-columns:repeat(3,1fr)!important;width:264px!important;height:18px!important;margin:0 0 0 30px!important;padding:0!important;align-items:center!important;justify-items:center!important;color:#19ef5d!important;font-size:6px!important;font-weight:700!important;line-height:1!important}
.eqgroups span{display:block!important;width:100%!important;border-top:1px solid #13d94f!important;text-align:center!important;padding-top:3px!important}
.eqpanel:before,.eqpanel:after{display:none!important;content:none!important}
.toast{z-index:50!important}
\`;
/* END_MOBILE_V33_CANONICAL_FLOW */`;

src = src.slice(0, startAt) + block + src.slice(endAt + endMarker.length);
src = src.replace(/20260821-mobile-final-v\d+/g, '20260821-mobile-final-v33');

const styleNeedle = "  if(style.textContent !== skinForThisView) style.textContent = skinForThisView;";
const stylePatch = "  if(style.textContent !== skinForThisView) style.textContent = skinForThisView;\n  if(root.lastElementChild !== style) root.appendChild(style);";
if (src.includes(styleNeedle) && !src.includes('root.lastElementChild !== style')) src = src.replace(styleNeedle, stylePatch);

const connectedNeedle = `  p.connectedCallback = function(){\n    originalConnected?.call(this);\n    bindSingleEngine(this);\n    applySkin(this);\n  };`;
const connectedPatch = `  p.connectedCallback = function(){\n    originalConnected?.call(this);\n    bindSingleEngine(this);\n    applySkin(this);\n    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(this.isConnected) applySkin(this); }));\n  };`;
if (src.includes(connectedNeedle)) src = src.replace(connectedNeedle, connectedPatch);

fs.writeFileSync(file, src, 'utf8');

const required = [
  'MOBILE_V33_CANONICAL_FLOW',
  'display:flex!important;flex-direction:column!important',
  '.grid-top,.grid-middle{display:contents!important}',
  "height:auto!important;min-height:700px!important",
  'grid-template-rows:12px 29px 25px 52px 40px!important',
  'EQUALIZADOR ${mobile ? \'8\' : \'24\'} BANDAS',
  'requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(this.isConnected) applySkin(this); }))'
];
for (const token of required) if (!src.includes(token)) throw new Error('Validação V33 falhou: ' + token);

console.log('V33 aplicada: quatro painéis em fluxo natural, skin aplicada por último e equalizador dentro do fluxo visível.');
