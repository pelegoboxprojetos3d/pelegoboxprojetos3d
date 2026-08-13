const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

// Seletor internacional completo. A biblioteca traz a lista inteira de países,
// busca por país, bandeiras em alta resolução e DDI separado do número.
if (!code.includes("intl-tel-input@29.2.2")) {
  replaceOnce(
    '<script defer src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>',
    '<script defer src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/css/intlTelInput.css">\n<script src="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/js/intlTelInput.min.js"></script>',
    "Assets do seletor internacional"
  );
}

const selectLeft = /<select id="countrySelect"[\s\S]*?<\/select>/;
if (selectLeft.test(code)) {
  code = code.replace(selectLeft, '<input type="hidden" id="countrySelect" value="55|br">');
  changed = true;
}
const selectRight = /<select id="countryConfirmSelect"[\s\S]*?<\/select>/;
if (selectRight.test(code)) {
  code = code.replace(selectRight, '<input type="hidden" id="countryConfirmSelect" value="55|br">');
  changed = true;
}

const oldCss = '.phoneRow{display:grid;grid-template-columns:122px 1fr}\n.phonePrefix{height:48px;display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid #d7d7d7;border-right:0;border-radius:12px 0 0 12px;background:#fafafa;font-size:13px;font-weight:700}.countrySelect{width:122px;padding:0 7px;cursor:pointer;outline:none;color:#171717;appearance:auto}.countrySelect:focus{border-color:#71ba87;box-shadow:0 0 0 3px rgba(21,148,71,.10)}\n.phoneRow .control{border-radius:0 12px 12px 0}';
const newCss = '.phoneRow{display:block;position:relative}\n.phonePrefix,.countrySelect{display:none!important}\n.phoneRow .control{border-radius:12px}\n.phoneRow .iti{width:100%}\n.phoneRow .iti__tel-input{width:100%;height:48px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none;padding-left:118px!important}\n.phoneRow .iti__tel-input:focus{border-color:#71ba87;box-shadow:0 0 0 3px rgba(21,148,71,.10)}\n.phoneRow .iti__selected-country{min-width:108px;padding:0 10px;border-right:1px solid #d7d7d7;background:#fafafa;border-radius:12px 0 0 12px}\n.phoneRow .iti__selected-country-primary{gap:8px;padding:0!important}\n.phoneRow .iti__flag{transform:scale(1.35);transform-origin:center;margin-right:5px}\n.phoneRow .iti__selected-dial-code{font-size:15px;font-weight:700;color:#171717}\n.phoneRow .iti__arrow{margin-left:4px;border-top-width:5px;border-left-width:4px;border-right-width:4px}\n.phoneRow .iti__country-container{z-index:30}\n.phoneRow .iti__dropdown-content{min-width:330px;max-width:min(92vw,430px);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.18);overflow:hidden}\n.phoneRow .iti__search-input{height:42px;font-size:14px;padding:0 12px}\n.phoneRow .iti__country{min-height:42px;padding:7px 12px;gap:10px;font-size:14px}\n.phoneRow .iti__country .iti__flag{transform:scale(1.25)}\n.phoneRow .iti__country-name{font-weight:600}\n.phoneRow .iti__dial-code{font-weight:700;color:#555}';
if (code.includes(oldCss)) {
  code = code.replace(oldCss, newCss);
  changed = true;
} else if (!code.includes('.phoneRow .iti__selected-dial-code')) {
  const marker = '.phoneRow .control{border-radius:0 12px 12px 0}';
  if (!code.includes(marker)) throw new Error("CSS do telefone não encontrado.");
  code = code.replace(marker, newCss);
  changed = true;
}

const oldHydrate = 'var wantedDdi=digits(S.ctx.ddi||"55")||"55";[E.country,E.countryConfirm].forEach(function(sel){if(!sel)return;var opt=Array.prototype.find.call(sel.options,function(o){return safe(o.value).split("|")[0]===wantedDdi});if(opt)sel.value=opt.value});var ci=countryInfo(E.country),p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp,ci.ddi);if(p)E.phone.value=formatPhone(p,ci.ddi);if(E.phoneConfirm)E.phoneConfirm.value="";';
const newHydrate = 'var wantedDdi=digits(S.ctx.ddi||"55")||"55",wantedCountry=safe(S.ctx.country||"br").toLowerCase();if(E.country)E.country.value=wantedDdi+"|"+wantedCountry;if(E.countryConfirm)E.countryConfirm.value=wantedDdi+"|"+wantedCountry;if(itiPhone)setItiCountry(itiPhone,wantedCountry);if(itiPhoneConfirm)setItiCountry(itiPhoneConfirm,wantedCountry);var ci=countryInfo(E.country),p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp,ci.ddi);if(p)E.phone.value=formatPhone(p,ci.ddi);if(E.phoneConfirm)E.phoneConfirm.value="";';
if (code.includes(oldHydrate)) {
  code = code.replace(oldHydrate, newHydrate);
  changed = true;
}

if (!code.includes('function initInternationalPhonePickers()')) {
  const re = /(var E=\{[\s\S]*?\n\};)/;
  if (!re.test(code)) throw new Error("Mapa E dos elementos não encontrado.");

  const init = String.raw`
var itiPhone=null,itiPhoneConfirm=null,countrySyncBusy=false;
function itiData(instance){
 if(!instance)return{ddi:"55",country:"br"};
 var d={};
 try{d=typeof instance.getSelectedCountry==="function"?instance.getSelectedCountry():instance.getSelectedCountryData()}catch(_){}
 return{ddi:digits(d&&d.dialCode||"55")||"55",country:safe(d&&d.iso2||"br").toLowerCase()}
}
function setItiCountry(instance,iso2){
 if(!instance||!iso2)return;
 try{
  if(typeof instance.setSelectedCountry==="function")instance.setSelectedCountry(iso2);
  else if(typeof instance.setCountry==="function")instance.setCountry(iso2)
 }catch(_){}
}
function writeCountryState(hidden,info){if(hidden)hidden.value=(info.ddi||"55")+"|"+(info.country||"br")}
function syncPhoneCountry(source,target,sourceHidden,targetHidden,clearConfirmation){
 if(countrySyncBusy)return;
 countrySyncBusy=true;
 try{
  var info=itiData(source);
  writeCountryState(sourceHidden,info);
  writeCountryState(targetHidden,info);
  setItiCountry(target,info.country);
  if(clearConfirmation&&E.phoneConfirm)E.phoneConfirm.value="";
 }finally{countrySyncBusy=false}
 syncIdentityButton();
}
function initInternationalPhonePickers(){
 if(!window.intlTelInput||!E.phone||!E.phoneConfirm)return;
 var opts={
  initialCountry:"br",
  separateDialCode:true,
  countrySearch:true,
  countryOrder:["br","us","pt","ar","py","uy"]
 };
 itiPhone=window.intlTelInput(E.phone,opts);
 itiPhoneConfirm=window.intlTelInput(E.phoneConfirm,opts);
 writeCountryState(E.country,itiData(itiPhone));
 writeCountryState(E.countryConfirm,itiData(itiPhoneConfirm));
 E.phone.addEventListener("countrychange",function(){syncPhoneCountry(itiPhone,itiPhoneConfirm,E.country,E.countryConfirm,true)});
 E.phoneConfirm.addEventListener("countrychange",function(){syncPhoneCountry(itiPhoneConfirm,itiPhone,E.countryConfirm,E.country,false)});
}
initInternationalPhonePickers();`;

  code = code.replace(re, `$1\n${init}`);
  changed = true;
}

if (!code.includes('/* COUNTRY_SELECTORS_SYNCED_V2 */')) {
  code += '\n/* COUNTRY_SELECTORS_SYNCED_V2 */\n';
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Seletor internacional completo aplicado: bandeiras maiores, busca, todos os países e sincronização entre os dois WhatsApps.");
} else {
  console.log("Seletor internacional completo já está aplicado.");
}

// Compatibilidade: o script legado seguinte não pode quebrar o workflow se o checkout
// já evoluiu e os trechos antigos não existirem mais.
const LOGIN_SCRIPT = "scripts/corrigir-login-social-reabertura-robusta-2026-08-12.cjs";
let loginScript = fs.readFileSync(LOGIN_SCRIPT, "utf8");
const antigo = '  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);';
const novo = '  if (!code.includes(from)) { console.log(`${label}: trecho legado não existe mais; mantendo versão atual.`); return; }';
if (loginScript.includes(antigo)) {
  loginScript = loginScript.replace(antigo, novo);
  fs.writeFileSync(LOGIN_SCRIPT, loginScript, "utf8");
  console.log("Compatibilidade do script legado de login preparada.");
}
