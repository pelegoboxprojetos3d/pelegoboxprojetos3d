const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const start = '/* MOBILE_V28_CLEAN_FOUR_STACK';
const end = '/* END_MOBILE_V28_CLEAN_FOUR_STACK */';
const startAt = src.indexOf(start);
const endAt = src.indexOf(end);
if (startAt < 0 || endAt < 0 || endAt <= startAt) {
  throw new Error('Bloco mobile atual não encontrado.');
}

const canonicalBlock = `/* MOBILE_V32_CANONICAL_ONLY
   Uma única skin mobile. Sem V24-V31 empilhadas. */
const MOBILE_CLEAN_SKIN = \`
:host{
  display:block!important;width:310px!important;min-width:310px!important;max-width:310px!important;
  height:700px!important;min-height:700px!important;max-height:700px!important;
  margin:0 auto!important;overflow:hidden!important;color:#effff4!important;
  font-family:Arial,Helvetica,sans-serif!important;--g:#20ef64;--line:#13d94f;
}
*{box-sizing:border-box!important}
.shell{
  position:relative!important;width:310px!important;height:700px!important;
  min-width:310px!important;max-width:310px!important;min-height:700px!important;max-height:700px!important;
  margin:0 auto!important;padding:0!important;overflow:hidden!important;
  background:#010504!important;border:0!important;border-radius:10px!important;box-shadow:none!important;
}
.topbar,.footer{display:none!important}
.grid-top,.grid-middle{
  display:block!important;position:static!important;width:0!important;height:0!important;
  min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;
}
.grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){display:none!important}
.grid-top>.panel:nth-child(3),.filters,.playbox,.eqpanel{
  position:absolute!important;left:5px!important;width:300px!important;min-width:300px!important;max-width:300px!important;
  margin:0!important;padding:0!important;overflow:hidden!important;
  background:linear-gradient(180deg,#020806,#010504)!important;
  border:1px solid #13d94f!important;border-radius:10px!important;
  box-shadow:0 0 7px rgba(0,255,75,.07) inset!important;
}
.grid-top>.panel:nth-child(3),.analyzer{top:5px!important;height:160px!important;min-height:160px!important;max-height:160px!important}
.filters{top:171px!important;height:132px!important;min-height:132px!important;max-height:132px!important}
.playbox{top:309px!important;height:220px!important;min-height:220px!important;max-height:220px!important}
.eqpanel{top:535px!important;height:160px!important;min-height:160px!important;max-height:160px!important}

.panel-title{
  height:25px!important;min-height:25px!important;max-height:25px!important;
  display:flex!important;align-items:center!important;padding:0 9px!important;gap:7px!important;
  color:#19ef5d!important;font-weight:700!important;letter-spacing:.15px!important;white-space:nowrap!important;
}
.panel-title::before,.panel-title::after,.eqtitle::before,.eqtitle::after{content:none;display:none}

/* ANALISADOR */
.analyzer{display:grid!important;grid-template-rows:25px 118px 17px!important;overflow:hidden!important}
.grid-top>.panel:nth-child(3) .panel-title{font-size:0!important}
.grid-top>.panel:nth-child(3) .panel-title .pb-icon{
  display:inline-flex!important;width:16px!important;height:16px!important;flex:0 0 16px!important;font-size:12px!important;
}
.grid-top>.panel:nth-child(3) .panel-title .pb-icon svg{width:16px!important;height:16px!important;display:block!important}
.grid-top>.panel:nth-child(3) .panel-title::after{
  content:'ANALISADOR - 8 BANDAS'!important;display:inline!important;
  font-size:11px!important;color:#19ef5d!important;font-weight:700!important;letter-spacing:.15px!important;
}
.analyzer canvas{
  display:block!important;width:286px!important;height:118px!important;min-height:118px!important;max-height:118px!important;
  margin:0 7px!important;border:1px solid #385047!important;border-radius:3px!important;background:#020707!important;
}
.bands-label{
  display:grid!important;grid-template-columns:repeat(3,1fr)!important;height:17px!important;min-height:17px!important;max-height:17px!important;
  align-items:center!important;justify-items:center!important;color:#19ef5d!important;font-size:6px!important;font-weight:700!important;border:0!important;
}
.bands-label span{display:block!important;width:100%!important;border:0!important;text-align:center!important}

/* ESCOLHA O QUE QUER OUVIR */
.filters .panel-title{font-size:11px!important}
.filterbody{
  height:107px!important;min-height:107px!important;max-height:107px!important;
  display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;padding:0 6px 6px!important;overflow:hidden!important;
}
.scopebuttons{height:101px!important;display:grid!important;grid-template-rows:repeat(2,1fr)!important;gap:4px!important}
.scope{
  width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:3px 1px!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;
  border:1px solid #30453b!important;border-radius:6px!important;background:linear-gradient(#0b1510,#050a07)!important;
  color:#dfe7e2!important;font-size:7px!important;line-height:1!important;
}
.scope.active{background:linear-gradient(#0ec648,#078a31)!important;border-color:#18ef5d!important;color:#fff!important}
#international .scope-icon,#national .scope-icon,#shell #national .scope-icon{
  display:flex!important;align-items:center!important;justify-content:center!important;margin:0 0 2px!important;width:24px!important;height:22px!important;
}
#international .scope-icon svg{width:22px!important;height:22px!important}
#national .scope-icon svg,#shell #national .scope-icon svg{width:25px!important;height:22px!important}
#international>span:last-child,#national>span:last-child{line-height:1.05!important;letter-spacing:.1px!important}
.genres{
  height:101px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
  grid-template-rows:repeat(4,minmax(0,1fr))!important;gap:4px!important;padding:0!important;overflow:hidden!important;
}
.genre{display:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0 2px!important;border-radius:5px!important;font-size:7px!important}
.genre:nth-child(-n+8){display:block!important}

/* TOCANDO */
.playbox{display:grid!important;grid-template-rows:25px 195px!important}
#shell .playbox .panel-title{font-size:11px!important;justify-content:space-between!important;gap:6px!important}
#shell .playbox .play-title-left{display:inline-flex!important;align-items:center!important;gap:6px!important;flex:0 0 auto!important}
#shell .playbox .play-meta{
  display:block!important;margin-left:auto!important;max-width:145px!important;overflow:hidden!important;text-overflow:ellipsis!important;
  white-space:nowrap!important;text-align:right!important;color:#eef3f0!important;font-size:7px!important;font-weight:400!important;
}
.playbody{
  height:195px!important;min-height:195px!important;max-height:195px!important;
  padding:4px 8px 5px!important;overflow:hidden!important;
  display:grid!important;grid-template-rows:12px 29px 25px 52px 40px!important;gap:7px!important;
}
.playbody>.label{font-size:8px!important;line-height:12px!important;color:#e7ece9!important;align-self:end!important}
.playbody>select{height:29px!important;min-height:29px!important;max-height:29px!important;font-size:9px!important}
.volrow{height:25px!important;display:grid!important;grid-template-columns:22px minmax(0,1fr) 34px!important;gap:5px!important;align-items:center!important;font-size:8px!important}
.randomrow,.controls{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;width:100%!important;margin:0!important}
.randomrow{height:52px!important;min-height:52px!important;max-height:52px!important}
.randomrow label{display:grid!important;grid-template-rows:18px 34px!important;min-width:0!important;width:100%!important}
.randomrow .label{font-size:7px!important;line-height:8px!important;white-space:normal!important;display:flex!important;align-items:flex-end!important}
.randomrow select{height:34px!important;min-height:34px!important;max-height:34px!important;width:100%!important;font-size:8px!important;padding:0 4px!important}
.hint{display:none!important}
.controls{height:40px!important;min-height:40px!important;max-height:40px!important;position:static!important;top:auto!important;transform:none!important}
.controls button{height:40px!important;min-height:40px!important;max-height:40px!important;width:100%!important;margin:0!important;padding:0 3px!important;border-radius:6px!important;font-size:10px!important}

/* EQUALIZADOR */
.eqpanel{display:grid!important;grid-template-rows:25px 117px 18px!important;overflow:hidden!important}
.eqhead{
  height:25px!important;min-height:25px!important;max-height:25px!important;
  display:grid!important;grid-template-columns:minmax(0,1fr) 116px!important;align-items:center!important;gap:4px!important;padding:0 7px 0 8px!important;
}
.eqtitle{display:block!important;font-size:0!important;min-width:0!important;overflow:hidden!important;white-space:nowrap!important}
.eqtitle::after{
  content:'⚙ EQUALIZADOR 8 BANDAS'!important;display:inline!important;color:#19ef5d!important;font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;
}
.preset{position:static!important;display:grid!important;grid-template-columns:34px 78px!important;align-items:center!important;gap:4px!important;margin:0!important;font-size:6px!important;width:116px!important}
.preset select{width:78px!important;min-width:78px!important;max-width:78px!important;height:20px!important;min-height:20px!important;max-height:20px!important;font-size:7px!important;padding:0 3px!important}
.eqgrid{
  display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;width:264px!important;height:117px!important;
  margin:0 0 0 30px!important;padding:0!important;gap:0!important;overflow:hidden!important;align-items:stretch!important;
}
.eqgrid .band{display:none!important;grid-template-rows:10px 90px 17px!important;justify-items:center!important;font-size:6px!important;min-width:0!important}
.eqgrid .band:nth-child(1),.eqgrid .band:nth-child(5),.eqgrid .band:nth-child(9),.eqgrid .band:nth-child(13),.eqgrid .band:nth-child(17),.eqgrid .band:nth-child(21),.eqgrid .band:nth-child(23),.eqgrid .band:nth-child(24){display:grid!important}
.band input[type=range]{width:70px!important;height:14px!important}
.band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
.sliderwrap:before{height:84%!important}
.db-scale{left:0!important;width:30px!important;top:32px!important;bottom:22px!important;font-size:6px!important;align-items:center!important}
.eqgroups{
  display:grid!important;grid-template-columns:repeat(3,1fr)!important;width:264px!important;height:18px!important;
  margin:0 0 0 30px!important;padding:0!important;align-items:center!important;justify-items:center!important;
  color:#19ef5d!important;font-size:6px!important;font-weight:700!important;line-height:1!important;
}
.eqgroups span{display:block!important;width:100%!important;border-top:1px solid #13d94f!important;text-align:center!important;padding-top:3px!important}
.eqpanel:before,.eqpanel:after{display:none!important;content:none!important}
.toast{z-index:50!important}
\`;
/* END_MOBILE_V32_CANONICAL_ONLY */`;

src = src.slice(0, startAt) + canonicalBlock + src.slice(endAt + end.length);
src = src.replace(/20260821-mobile-final-v\d+/g, '20260821-mobile-final-v32');
src = src.replace(/ANALISADOR - \$\{mobile \? '6' : '24'\} BANDAS/g, "ANALISADOR - ${mobile ? '8' : '24'} BANDAS");
src = src.replace(/EQUALIZADOR \$\{mobile \? '6' : '24'\} BANDAS/g, "EQUALIZADOR ${mobile ? '8' : '24'} BANDAS");

if (!src.includes('const skinForThisView = mobile ? MOBILE_CLEAN_SKIN : SKIN;')) {
  throw new Error('Seleção da skin mobile canônica não encontrada.');
}

fs.writeFileSync(file, src, 'utf8');

const clean = src.slice(src.indexOf('/* MOBILE_V32_CANONICAL_ONLY'), src.indexOf('/* END_MOBILE_V32_CANONICAL_ONLY */'));
const required = [
  'ANALISADOR - 8 BANDAS',
  'EQUALIZADOR 8 BANDAS',
  'top:171px!important',
  'top:309px!important',
  'grid-template-rows:12px 29px 25px 52px 40px!important',
  'grid-template-columns:repeat(3,minmax(0,1fr))!important',
  'grid-template-columns:minmax(0,1fr) 116px!important'
];
for (const token of required) {
  if (!clean.includes(token)) throw new Error(`Validação V32 falhou: ${token}`);
}
for (const old of ['MOBILE_V29_APPROVED_LAYOUT','MOBILE_V30_FINAL_LOCK','MOBILE_V31_FLEX_STACK_FIX']) {
  if (clean.includes(old)) throw new Error(`Regra antiga ainda existe na skin canônica: ${old}`);
}

console.log('V32 aplicada: uma única skin mobile canônica, sem empilhamento de remendos.');
