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

/*
  O checkout não pode depender do CDN do seletor internacional para sair do
  estado "Carregando checkout...". O HTML principal precisa avisar READY e
  renderizar primeiro. O seletor de país vira melhoria progressiva e carrega
  em segundo plano. Se o CDN estiver lento ou indisponível, o checkout continua
  funcional com os inputs de telefone normais.
*/
replaceOnce(
`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/css/intlTelInput.css">
<script src="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/js/intlTelInput.min.js"></script>`,
`<!-- intl-tel-input é carregado em segundo plano depois do READY -->`,
"Remover dependência bloqueante do seletor internacional"
);

const initMarker = `initInternationalPhonePickers();`;
const asyncLoader = `initInternationalPhonePickers();

var intlPhoneAssetsRequested=false;
function carregarIntlPhoneSemBloquearCheckout(){
 if(itiPhone||intlPhoneAssetsRequested)return;
 intlPhoneAssetsRequested=true;

 try{
  var css=document.createElement("link");
  css.rel="stylesheet";
  css.href="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/css/intlTelInput.css";
  document.head.appendChild(css);
 }catch(_){}

 if(window.intlTelInput){
  initInternationalPhonePickers();
  return;
 }

 try{
  var script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/js/intlTelInput.min.js";
  script.async=true;
  script.onload=function(){
   try{initInternationalPhonePickers()}catch(_){}
  };
  script.onerror=function(){
   intlPhoneAssetsRequested=false;
  };
  document.head.appendChild(script);
 }catch(_){
  intlPhoneAssetsRequested=false;
 }
}`;

if (!code.includes("function carregarIntlPhoneSemBloquearCheckout()")) {
  if (!code.includes(initMarker)) throw new Error("Inicialização do telefone não encontrada.");
  code = code.replace(initMarker, asyncLoader);
  changed = true;
}

replaceOnce(
`post({type:"READY",version:"HTML36_SOCIAL_MINIMAL_DATA"});`,
`post({type:"READY",version:"HTML37_FAST_BOOT_NO_BLOCKING_INTL"});
setTimeout(carregarIntlPhoneSemBloquearCheckout,0);`,
"READY imediato antes dos recursos opcionais"
);

if (code.includes('<script src="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/js/intlTelInput.min.js"></script>')) {
  throw new Error("O script bloqueante do intl-tel-input ainda está no head.");
}
if (code.includes('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/css/intlTelInput.css">')) {
  throw new Error("O CSS bloqueante do intl-tel-input ainda está no head.");
}
if (!code.includes('HTML37_FAST_BOOT_NO_BLOCKING_INTL')) {
  throw new Error("Versão de bootstrap rápido não aplicada.");
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Checkout rápido aplicado: interface não espera CDN do seletor internacional.");
} else {
  console.log("Checkout rápido já está aplicado.");
}
