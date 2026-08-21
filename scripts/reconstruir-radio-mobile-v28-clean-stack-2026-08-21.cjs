const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'MOBILE_V28_CLEAN_FOUR_STACK';
if (src.includes(marker)) {
  console.log('V28 já aplicada. Nada a alterar.');
  process.exit(0);
}

src = src.replaceAll('20260821-mobile-final-v27', '20260821-mobile-final-v28');

const cleanSkin = String.raw`

/* MOBILE_V28_CLEAN_FOUR_STACK
   Mobile refeito do zero: 310x700, quatro painéis empilhados, sem herdar os remendos V23-V27. */
const MOBILE_CLEAN_SKIN = ` + "`" + String.raw`
:host{
  display:block!important;
  width:310px!important;min-width:310px!important;max-width:310px!important;
  height:700px!important;min-height:700px!important;max-height:700px!important;
  margin:0 auto!important;overflow:hidden!important;
  color:#effff4!important;font-family:Arial,Helvetica,sans-serif!important;
  --g:#20ef64;--line:#13d94f;--panel:#020806;
}
*{box-sizing:border-box!important}
.shell{
  width:310px!important;min-width:310px!important;max-width:310px!important;
  height:700px!important;min-height:700px!important;max-height:700px!important;
  margin:0 auto!important;padding:5px!important;gap:6px!important;
  display:grid!important;grid-template-columns:1fr!important;
  grid-template-rows:160px 132px 220px 160px!important;
  align-content:start!important;overflow:hidden!important;
  background:#010504!important;border:0!important;border-radius:10px!important;box-shadow:none!important;
}
.topbar,.footer{display:none!important}
.grid-top,.grid-middle{display:contents!important}
.grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){display:none!important}
.panel{
  width:100%!important;min-width:0!important;height:100%!important;min-height:0!important;max-height:none!important;
  margin:0!important;padding:0!important;overflow:hidden!important;
  background:linear-gradient(180deg,#020806,#010504)!important;
  border:1px solid #13d94f!important;border-radius:10px!important;
  box-shadow:0 0 7px rgba(0,255,75,.07) inset!important;
}
.panel-title{
  display:flex!important;align-items:center!important;justify-content:flex-start!important;
  height:25px!important;min-height:25px!important;max-height:25px!important;
  padding:0 9px!important;gap:7px!important;
  color:#19ef5d!important;font-size:11px!important;font-weight:700!important;letter-spacing:.15px!important;
  white-space:nowrap!important;visibility:visible!important;opacity:1!important;
}
.panel-title::before,.panel-title::after,.eqtitle::before,.eqtitle::after{content:none!important;display:none!important}
.panel-title .pb-icon{width:16px!important;height:16px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 16px!important}
.panel-title .pb-icon svg{width:16px!important;height:16px!important;display:block!important}

/* 1. ANALISADOR */
.grid-top>.panel:nth-child(3),.analyzer{
  display:grid!important;grid-template-rows:25px minmax(0,1fr) 17px!important;
  width:100%!important;height:160px!important;min-height:160px!important;max-height:160px!important;
  margin:0!important;overflow:hidden!important;
}
.analyzer canvas{
  display:block!important;width:calc(100% - 14px)!important;height:100%!important;min-height:0!important;
  margin:0 7px!important;border:1px solid #385047!important;border-radius:3px!important;background:#020707!important;
}
.bands-label{height:17px!important;min-height:17px!important;font-size:6px!important;border:0!important;color:#dfe8e2!important}
.bands-label span{border:0!important;text-align:center!important}

/* 2. ESCOLHA O QUE QUER OUVIR */
.filters{height:132px!important;min-height:132px!important;max-height:132px!important;padding:0!important}
.filterbody{
  height:107px!important;min-height:107px!important;max-height:107px!important;
  display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;
  padding:0 6px 6px!important;overflow:hidden!important;
}
.scopebuttons{height:100%!important;display:grid!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:4px!important}
.scope{
  height:100%!important;min-height:0!important;margin:0!important;padding:3px 1px!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
  gap:5px!important;border:1px solid #30453b!important;border-radius:6px!important;
  background:linear-gradient(#0b1510,#050a07)!important;color:#dfe7e2!important;
  font-size:7px!important;line-height:1!important;
}
.scope.active{background:linear-gradient(#0ec648,#078a31)!important;border-color:#18ef5d!important;color:#fff!important}
#international .scope-icon,#national .scope-icon{display:flex!important;align-items:center!important;justify-content:center!important;margin:0 0 2px!important;width:23px!important;height:21px!important;line-height:1!important}
#international .scope-icon svg{width:22px!important;height:22px!important}
#national .scope-icon,#shell #national .scope-icon{width:26px!important;height:23px!important}
#national .scope-icon svg,#shell #national .scope-icon svg{width:25px!important;height:22px!important}
#international>span:last-child,#national>span:last-child{display:block!important;line-height:1.05!important;letter-spacing:.1px!important}
.genres{
  height:100%!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
  grid-template-rows:repeat(4,minmax(0,1fr))!important;grid-auto-rows:0!important;
  gap:4px!important;padding:0!important;overflow:hidden!important;align-content:stretch!important;
}
.genre{display:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0 2px!important;border-radius:5px!important;font-size:7px!important}
.genre:nth-child(-n+8){display:block!important}

/* 3. TOCANDO */
.playbox{display:grid!important;grid-template-rows:25px minmax(0,1fr)!important;height:220px!important;min-height:220px!important;max-height:220px!important;margin:0!important}
.playbody{
  min-height:0!important;height:195px!important;padding:4px 8px 7px!important;overflow:hidden!important;
  display:grid!important;grid-template-rows:11px 28px 23px 43px 36px!important;gap:4px!important;
}
.playbody>.label{font-size:8px!important;line-height:11px!important;color:#e7ece9!important}
.playbody select{height:28px!important;min-height:28px!important;font-size:9px!important}
.volrow{height:23px!important;display:grid!important;grid-template-columns:22px minmax(0,1fr) 34px!important;align-items:center!important;font-size:8px!important}
.randomrow{height:43px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
.randomrow label{display:grid!important;grid-template-rows:14px 29px!important;min-width:0!important}
.randomrow .label{font-size:7px!important;line-height:7px!important;white-space:normal!important;display:flex!important;align-items:flex-end!important}
.randomrow select{height:29px!important;min-height:29px!important;font-size:8px!important;padding:0 3px!important}
.hint{display:none!important}
.controls{height:36px!important;display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:6px!important;margin:0!important;position:static!important;transform:none!important}
.controls button{height:36px!important;min-height:36px!important;margin:0!important;padding:0 4px!important;border-radius:6px!important;font-size:10px!important}

/* 4. EQUALIZADOR */
.eqpanel{
  display:grid!important;grid-template-rows:25px minmax(0,1fr)!important;
  width:100%!important;height:160px!important;min-height:160px!important;max-height:160px!important;
  margin:0!important;padding:0 6px 6px!important;overflow:hidden!important;position:relative!important;
}
.eqhead{height:25px!important;min-height:25px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:5px!important;padding:0 2px!important}
.eqtitle{display:block!important;visibility:visible!important;opacity:1!important;color:#19ef5d!important;font-size:8.6px!important;font-weight:700!important;letter-spacing:0!important;white-space:nowrap!important}
.preset{position:static!important;display:flex!important;align-items:center!important;gap:3px!important;margin:0 0 0 auto!important;font-size:6px!important}
.preset select{width:88px!important;min-width:88px!important;height:20px!important;min-height:20px!important;font-size:7px!important;padding:0 3px!important}
.eqgrid{
  display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;
  width:calc(100% - 30px)!important;height:129px!important;min-height:0!important;
  margin:0 0 0 30px!important;padding:0!important;gap:0!important;overflow:hidden!important;align-items:stretch!important;
}
.eqgrid .band{display:none!important;grid-template-rows:9px minmax(0,1fr) 12px!important;justify-items:center!important;font-size:6px!important;min-width:0!important}
.eqgrid .band:nth-child(1),.eqgrid .band:nth-child(5),.eqgrid .band:nth-child(9),.eqgrid .band:nth-child(13),.eqgrid .band:nth-child(17),.eqgrid .band:nth-child(21),.eqgrid .band:nth-child(23),.eqgrid .band:nth-child(24){display:grid!important}
.band input[type=range]{width:70px!important;height:14px!important}
.band input::-webkit-slider-thumb{width:13px!important;height:13px!important}
.sliderwrap:before{height:84%!important}
.db-scale{left:0!important;width:30px!important;top:32px!important;bottom:18px!important;font-size:6px!important;align-items:center!important}
.eqgroups,.eqpanel:before,.eqpanel:after{display:none!important;content:none!important}
.toast{z-index:50!important}
` + "`" + String.raw`;
/* END_MOBILE_V28_CLEAN_FOUR_STACK */
`;

const insertBefore = '\nfunction title(el, html){ if(el) el.innerHTML = html; }';
if (!src.includes(insertBefore)) {
  throw new Error('Ponto para inserir MOBILE_CLEAN_SKIN não encontrado.');
}
src = src.replace(insertBefore, cleanSkin + insertBefore);

const skinNeedle = '  const skinForThisView = SKIN;';
if (!src.includes(skinNeedle)) {
  throw new Error('Seleção da skin atual não encontrada.');
}
src = src.replace(skinNeedle, '  const skinForThisView = mobile ? MOBILE_CLEAN_SKIN : SKIN;');

// Mantém o texto real e literal no mobile. Sem pseudo-elementos e sem número calculado por CSS antigo.
const analyzerNeedle = "  title(top[2], `<span class=\"pb-icon\">${BARS}</span>ANALISADOR - ${mobile ? '8' : '24'} BANDAS`);";
const analyzerPatch = "  title(top[2], `<span class=\"pb-icon\">${BARS}</span>ANALISADOR - ${mobile ? '8' : '24'} BANDAS`);";
if (!src.includes(analyzerNeedle)) throw new Error('Título do analisador não encontrado.');
src = src.replace(analyzerNeedle, analyzerPatch);

fs.writeFileSync(file, src, 'utf8');

if (!src.includes(marker)) throw new Error('Marcador V28 ausente.');
if (!src.includes('const skinForThisView = mobile ? MOBILE_CLEAN_SKIN : SKIN;')) throw new Error('Skin limpa não foi ativada no mobile.');
if (!src.includes('grid-template-rows:160px 132px 220px 160px')) throw new Error('As quatro alturas fixas não foram gravadas.');
if (!src.includes('grid-template-columns:repeat(8,minmax(0,1fr))')) throw new Error('Equalizador de 8 colunas não foi gravado.');
if (!src.includes('ANALISADOR - 8 BANDAS')) throw new Error('Texto literal de 8 bandas do analisador ausente.');
if (!src.includes('EQUALIZADOR 8 BANDAS')) throw new Error('Texto literal de 8 bandas do equalizador ausente.');

console.log('V28 aplicada: mobile 310x700 com quatro painéis fixos, sem herdar o CSS remendado anterior.');
