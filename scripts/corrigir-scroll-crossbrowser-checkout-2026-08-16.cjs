const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (text.includes(to)) {
    console.log(`OK: ${label} já aplicado.`);
    return;
  }
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperava 1 ocorrência, encontrei ${count}.`);
  text = text.replace(from, to);
}

const helper = `function post(data){try{window.parent.postMessage(data,"*")}catch(_){}}

/* CHECKOUT_SCROLL_CROSSBROWSER_V1
   Chrome já mantém a posição corretamente com o resize estável restaurado.
   Nos demais navegadores, o iframe/Custom Element pode disparar scroll anchoring
   quando uma microtela troca de altura. Capturamos o scroll da página PAI
   SINCRONAMENTE, antes de esconder/mostrar qualquer bloco, e o restauramos por
   uma janela curta. Não toca em pagamento, foco, dados ou layout visual. */
function googleChromePuro(){
 var ua=safe(navigator.userAgent);
 var chromium=/Chrome\\/\\d+/i.test(ua)||/CriOS\\/\\d+/i.test(ua);
 var outro=/Edg\\/|EdgiOS\\/|OPR\\/|OPiOS\\/|SamsungBrowser\\/|YaBrowser\\//i.test(ua);
 var brave=Boolean(navigator.brave);
 return chromium&&!outro&&!brave;
}
function preservarScrollPaiCrossBrowser(){
 if(googleChromePuro())return;
 var pai=null,x=0,y=0,root=null,body=null;
 try{
  pai=window.parent;
  if(!pai||pai===window)return;
  x=Number(pai.scrollX||pai.pageXOffset||0);
  y=Number(pai.scrollY||pai.pageYOffset||0);
  root=pai.document&&pai.document.documentElement;
  body=pai.document&&pai.document.body;
 }catch(_){return}

 var restaurar=function(){
  try{
   var oldRoot=root?root.style.scrollBehavior:"";
   var oldBody=body?body.style.scrollBehavior:"";
   if(root)root.style.scrollBehavior="auto";
   if(body)body.style.scrollBehavior="auto";
   pai.scrollTo(x,y);
   if(root)root.style.scrollBehavior=oldRoot;
   if(body)body.style.scrollBehavior=oldBody;
  }catch(_){}
 };

 restaurar();
 requestAnimationFrame(function(){restaurar();requestAnimationFrame(restaurar)});
 [35,90,170,300,520,800,1150,1500].forEach(function(ms){setTimeout(restaurar,ms)});
}`;

replaceOnce(
  'function post(data){try{window.parent.postMessage(data,"*")}catch(_){}}',
  helper,
  "instalar trava cross-browser"
);

replaceOnce(
  'function showPayment(){\n if(S.paymentReady)return;\n S.paymentReady=true;',
  'function showPayment(){\n if(S.paymentReady)return;\n preservarScrollPaiCrossBrowser();\n S.paymentReady=true;',
  "preservar scroll antes de Identificação -> Pagamento"
);

replaceOnce(
  'function openPix(){\n selectPaymentMethod("PIX");',
  'function openPix(){\n preservarScrollPaiCrossBrowser();\n selectPaymentMethod("PIX");',
  "preservar scroll antes de abrir Pix"
);

replaceOnce(
  'function openCard(){\n selectPaymentMethod("CARD");',
  'function openCard(){\n preservarScrollPaiCrossBrowser();\n selectPaymentMethod("CARD");',
  "preservar scroll antes de abrir Cartão"
);

if (text.includes("this._scrollCheckoutToTop()")) {
  throw new Error("A função antiga que mandava o Custom Element subir reapareceu.");
}
if (text.includes("E.pixArea.scrollIntoView") || text.includes("E.cardSelected.scrollIntoView")) {
  throw new Error("scrollIntoView antigo de Pix/Cartão reapareceu.");
}

fs.writeFileSync(path, text);
console.log("OK: Chrome fica intocado; demais navegadores preservam o scroll do pai antes das três trocas de microtela.");
