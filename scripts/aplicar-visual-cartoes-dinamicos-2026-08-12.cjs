const fs = require('fs');

const file = 'src/public/custom-elements/pelego-checkout-pronto.js';
let src = fs.readFileSync(file, 'utf8');

function replaceOnce(oldText, newText, label) {
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  }
  src = src.replace(oldText, newText);
}

const oldCss = String.raw`.visualCard{width:min(76%,340px);aspect-ratio:1.586/1;margin:0 auto 10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;border-radius:16px;background:linear-gradient(145deg,#222,#4b4b4b);color:#fff;box-shadow:0 10px 22px rgba(0,0,0,.18)}
.visualCardTop,.visualCardBottom{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cardChip{width:36px;height:26px;border-radius:6px;background:linear-gradient(135deg,#d9c98e,#f1e1a6)}
.cardBrand{font-size:13px;font-weight:700}
.visualNumber{font-size:16px;letter-spacing:1.6px;font-weight:600}
.visualLabel{display:block;margin-bottom:2px;font-size:6px;opacity:.7}
.visualValue{font-size:9px;font-weight:700;text-transform:uppercase}`;

const newCss = String.raw`/* CARTÃO VISUAL DINÂMICO: só aparência. Pagamento e payload permanecem intocados. */
.visualCard{
  position:relative;isolation:isolate;overflow:hidden;
  width:min(76%,340px);aspect-ratio:1.586/1;margin:0 auto 10px;padding:18px;
  display:flex;flex-direction:column;justify-content:space-between;border-radius:17px;
  background:linear-gradient(145deg,#171a20,#343b46 58%,#15171c);color:#fff;
  border:1px solid rgba(255,255,255,.20);
  box-shadow:0 13px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.26);
  text-shadow:0 1px 2px rgba(0,0,0,.55);
  transition:background .28s ease,border-color .28s ease,box-shadow .28s ease,filter .28s ease
}
.visualCard::before{
  content:"";position:absolute;z-index:-2;inset:-18%;pointer-events:none;
  background:
    radial-gradient(circle at 13% 16%,rgba(255,255,255,.24) 0 1px,transparent 2px),
    radial-gradient(circle at 68% 78%,rgba(255,255,255,.12) 0 1px,transparent 2px),
    repeating-linear-gradient(118deg,rgba(255,255,255,.028) 0 1px,transparent 1px 5px);
  background-size:37px 37px,53px 53px,auto;opacity:.68;transform:rotate(-2deg)
}
.visualCard::after{
  content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;
  background:linear-gradient(112deg,transparent 0 28%,rgba(255,255,255,.14) 42%,rgba(255,255,255,.025) 54%,transparent 70%);
  transform:translateX(-58%);transition:transform .55s ease
}
.visualCard:hover::after{transform:translateX(54%)}
.visualCardTop,.visualCardBottom{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px}
.visualCardTop{min-height:31px}
.cardChip{
  position:relative;width:39px;height:29px;flex:0 0 39px;border-radius:6px;
  border:1px solid rgba(88,70,18,.42);
  background:
    linear-gradient(90deg,transparent 46%,rgba(104,82,26,.48) 47% 51%,transparent 52%),
    linear-gradient(0deg,transparent 46%,rgba(104,82,26,.42) 47% 51%,transparent 52%),
    linear-gradient(135deg,#8f762b 0%,#e7cf77 17%,#fff0ab 39%,#b89237 61%,#f0dc88 82%,#9f7e2d 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.34),0 1px 2px rgba(0,0,0,.28)
}
.cardChip::before,.cardChip::after{content:"";position:absolute;pointer-events:none;border-color:rgba(104,82,26,.52)}
.cardChip::before{left:7px;right:7px;top:4px;bottom:4px;border-top:1px solid;border-bottom:1px solid;border-radius:4px}
.cardChip::after{top:5px;bottom:5px;left:50%;width:13px;transform:translateX(-50%);border-left:1px solid;border-right:1px solid;border-radius:3px}
.cardContactless{position:absolute;top:2px;right:75px;font:700 18px/1 Arial,sans-serif;letter-spacing:-3px;opacity:.88;transform:rotate(-7deg);transform-origin:center;color:rgba(255,255,255,.88)}
.cardBrand{position:relative;min-width:64px;font-size:13px;font-weight:800;line-height:1;text-align:right;letter-spacing:.2px;text-transform:uppercase;white-space:nowrap}
.visualNumber{position:relative;z-index:2;font-size:16px;letter-spacing:1.7px;font-weight:700;font-variant-numeric:tabular-nums;text-shadow:0 1px 0 rgba(255,255,255,.18),0 2px 3px rgba(0,0,0,.70)}
.visualLabel{display:block;margin-bottom:2px;font-size:6px;letter-spacing:.65px;opacity:.74}
.visualValue{font-size:9px;font-weight:800;letter-spacing:.45px;text-transform:uppercase}

/* As cores são temas premium inspirados nas bandeiras. A cor física exata do banco não é inferível apenas pelo número. */
.visualCard[data-brand="default"]{background:linear-gradient(145deg,#171a20,#3a414b 55%,#101216)}
.visualCard[data-brand="visa"][data-variant="0"]{background:radial-gradient(circle at 18% 8%,#345b91 0,transparent 35%),linear-gradient(145deg,#071a38,#123c73 58%,#061327)}
.visualCard[data-brand="visa"][data-variant="1"]{background:radial-gradient(circle at 75% 12%,#1a7f91 0,transparent 34%),linear-gradient(145deg,#052f43,#0a5a72 56%,#071f2c)}
.visualCard[data-brand="visa"][data-variant="2"]{background:radial-gradient(circle at 18% 12%,#715a27 0,transparent 38%),linear-gradient(145deg,#151515,#3c321e 58%,#0f0f0f)}
.visualCard[data-brand="visa"][data-variant="3"]{background:radial-gradient(circle at 72% 20%,#45307c 0,transparent 36%),linear-gradient(145deg,#10142e,#253c83 56%,#080b1d)}
.visualCard[data-brand="visa"] .cardBrand{font-size:21px;font-style:italic;letter-spacing:-1.3px;text-transform:uppercase}

.visualCard[data-brand="mastercard"][data-variant="0"]{background:radial-gradient(circle at 78% 22%,#5b2b20 0,transparent 34%),linear-gradient(145deg,#131313,#303030 56%,#101010)}
.visualCard[data-brand="mastercard"][data-variant="1"]{background:radial-gradient(circle at 20% 15%,#7b2030 0,transparent 38%),linear-gradient(145deg,#26070e,#661b2c 56%,#1b070b)}
.visualCard[data-brand="mastercard"][data-variant="2"]{background:radial-gradient(circle at 78% 20%,#7d6e52 0,transparent 38%),linear-gradient(145deg,#24211d,#5c5347 58%,#1d1a17)}
.visualCard[data-brand="mastercard"] .cardBrand{min-width:70px;padding-top:28px;font-size:7px;text-align:center;letter-spacing:.1px}
.visualCard[data-brand="mastercard"] .cardBrand::before,.visualCard[data-brand="mastercard"] .cardBrand::after{content:"";position:absolute;top:0;width:31px;height:31px;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.visualCard[data-brand="mastercard"] .cardBrand::before{left:10px;background:#eb001b}
.visualCard[data-brand="mastercard"] .cardBrand::after{right:10px;background:#f79e1b;mix-blend-mode:screen}

.visualCard[data-brand="elo"][data-variant="0"]{background:radial-gradient(circle at 83% 13%,#346b58 0,transparent 34%),linear-gradient(145deg,#111718,#273936 56%,#0b1011)}
.visualCard[data-brand="elo"][data-variant="1"]{background:radial-gradient(circle at 16% 8%,#273f92 0,transparent 34%),linear-gradient(145deg,#11162a,#293b70 56%,#0b0f1d)}
.visualCard[data-brand="elo"][data-variant="2"]{background:radial-gradient(circle at 78% 18%,#64458b 0,transparent 34%),linear-gradient(145deg,#191222,#3a2852 58%,#100c17)}
.visualCard[data-brand="elo"] .cardBrand{font-size:20px;text-transform:lowercase;letter-spacing:-1px}
.visualCard[data-brand="elo"] .cardBrand::before{content:"";display:inline-block;width:12px;height:12px;margin-right:4px;border:3px solid #f7ce38;border-right-color:#e63d3d;border-bottom-color:#2d86d5;border-radius:50%;vertical-align:-1px}

.visualCard[data-brand="amex"][data-variant="0"]{color:#152d43;text-shadow:none;background:radial-gradient(circle at 15% 10%,#f4fbff 0,transparent 28%),linear-gradient(145deg,#aebdca,#e1e8ed 48%,#8ea1b1)}
.visualCard[data-brand="amex"][data-variant="1"]{background:radial-gradient(circle at 18% 10%,#63a9ca 0,transparent 36%),linear-gradient(145deg,#0c4162,#27799f 56%,#082f48)}
.visualCard[data-brand="amex"] .cardBrand{padding:5px 6px;border:1px solid currentColor;border-radius:4px;font-size:9px;line-height:1.05;text-align:center;letter-spacing:.2px}
.visualCard[data-brand="amex"][data-variant="0"] .cardContactless{color:rgba(21,45,67,.82)}

.visualCard[data-brand="hipercard"]{background:radial-gradient(circle at 18% 10%,#d43739 0,transparent 36%),linear-gradient(145deg,#5e090d,#a51e22 56%,#47070a)}
.visualCard[data-brand="hipercard"] .cardBrand{font-size:15px;font-style:italic;text-transform:none}

.visualCard[data-brand="diners"][data-variant="0"]{background:radial-gradient(circle at 12% 12%,#d7e3ea 0,transparent 34%),linear-gradient(145deg,#637987,#a7b5be 52%,#4f626f)}
.visualCard[data-brand="diners"][data-variant="1"]{background:radial-gradient(circle at 80% 14%,#2f6f9c 0,transparent 35%),linear-gradient(145deg,#0e2a42,#315e7f 56%,#0a1e30)}
.visualCard[data-brand="diners"] .cardBrand{font-size:9px;line-height:1.05;text-align:center}

.visualCard[data-brand="discover"][data-variant="0"]{background:radial-gradient(circle at 84% 18%,#f08b2d 0,transparent 34%),linear-gradient(145deg,#161616,#333 55%,#101010)}
.visualCard[data-brand="discover"][data-variant="1"]{color:#252525;text-shadow:none;background:radial-gradient(circle at 84% 18%,#f2a459 0,transparent 34%),linear-gradient(145deg,#e7e7e7,#fafafa 55%,#cfcfcf)}
.visualCard[data-brand="discover"] .cardBrand{font-size:11px;letter-spacing:.4px}

.visualCard[data-brand="jcb"]{background:radial-gradient(circle at 18% 12%,#327fc6 0,transparent 34%),linear-gradient(145deg,#081d3d,#174f91 56%,#07152c)}
.visualCard[data-brand="jcb"] .cardBrand{padding:5px 7px;border-radius:5px;background:linear-gradient(90deg,#1677b8,#15964d 52%,#d14848);font-size:13px;text-align:center}

.visualCard[data-brand="unionpay"][data-variant="0"]{background:radial-gradient(circle at 82% 16%,#2a7b74 0,transparent 36%),linear-gradient(145deg,#082c36,#145b65 56%,#061f27)}
.visualCard[data-brand="unionpay"][data-variant="1"]{background:radial-gradient(circle at 18% 10%,#345692 0,transparent 34%),linear-gradient(145deg,#121c39,#304e81 56%,#0b1228)}
.visualCard[data-brand="unionpay"] .cardBrand{font-size:9px;line-height:1.05;text-align:center}

.visualCard[data-brand="aura"]{background:radial-gradient(circle at 16% 12%,#8b4bb0 0,transparent 34%),linear-gradient(145deg,#291036,#633377 58%,#1c0c26)}
.visualCard[data-brand="aura"] .cardBrand{font-size:15px;text-transform:lowercase}`;

replaceOnce(oldCss, newCss, 'CSS do cartão');

const oldHtml = String.raw`<div class="visualCard">
                <div class="visualCardTop"><span class="cardChip"></span><span id="visualBrand" class="cardBrand">CARTÃO</span></div>`;

const newHtml = String.raw`<div class="visualCard" data-brand="default" data-variant="0">
                <div class="visualCardTop"><span class="cardChip" aria-hidden="true"></span><span class="cardContactless" aria-hidden="true">)))</span><span id="visualBrand" class="cardBrand">CARTÃO</span></div>`;

replaceOnce(oldHtml, newHtml, 'HTML do cartão');

const oldJs = String.raw`function brand(v){var n=digits(v);if(/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363)/.test(n))return"ELO";if(/^(34|37)/.test(n))return"AMEX";if(/^(5[1-5]|2[2-7])/.test(n))return"MASTERCARD";if(/^4/.test(n))return"VISA";return"CARTÃO"}
function formatCard(v){return digits(v).slice(0,19).replace(/(\d{4})(?=\d)/g,"$1 ")}
function updateVisual(){var n=formatCard(E.cardNumber.value),m=digits(E.cardMonth.value).slice(0,2),y=digits(E.cardYear.value).slice(-2);E.visualBrand.textContent=brand(n);E.visualNumber.textContent=n||"•••• •••• •••• ••••";E.visualName.textContent=safe(E.cardName.value).toUpperCase()||"SEU NOME";E.visualExpiry.textContent=(m||"MM")+"/"+(y||"AA")}`;

const newJs = String.raw`function cardBrandInfo(v){
 var n=digits(v);
 /* Mantém Elo antes de Visa/Mastercard porque vários BINs Elo começam em faixas compartilhadas. */
 if(/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363)/.test(n))return{key:"elo",label:"elo",variants:3};
 if(/^(606282|3841)/.test(n))return{key:"hipercard",label:"Hipercard",variants:1};
 if(/^(34|37)/.test(n))return{key:"amex",label:"AMERICAN EXPRESS",variants:2};
 if(/^(5[1-5]|2(2[2-9]|[3-6][0-9]|7[01]|720))/.test(n))return{key:"mastercard",label:"MASTERCARD",variants:3};
 if(/^4/.test(n))return{key:"visa",label:"VISA",variants:4};
 if(/^(30[0-5]|36|38|39)/.test(n))return{key:"diners",label:"DINERS CLUB",variants:2};
 if(/^(6011|65|64[4-9]|622)/.test(n))return{key:"discover",label:"DISCOVER",variants:2};
 if(/^35/.test(n))return{key:"jcb",label:"JCB",variants:1};
 if(/^62/.test(n))return{key:"unionpay",label:"UNIONPAY",variants:2};
 if(/^50/.test(n))return{key:"aura",label:"aura",variants:1};
 return{key:"default",label:"CARTÃO",variants:1}
}
function brand(v){return cardBrandInfo(v).label}
function cardVariant(v,info){
 var n=digits(v).slice(0,8),sum=0;
 for(var i=0;i<n.length;i++)sum+=(i+3)*Number(n[i]||0);
 return String(sum%Math.max(1,Number(info.variants||1)))
}
function formatCard(v){
 var n=digits(v).slice(0,19),info=cardBrandInfo(n);
 if(info.key==="amex")return n.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/,function(_,a,b,c){return[a,b,c].filter(Boolean).join(" ")});
 if(info.key==="diners")return n.slice(0,14).replace(/^(\d{0,4})(\d{0,6})(\d{0,4}).*$/,function(_,a,b,c){return[a,b,c].filter(Boolean).join(" ")});
 return n.replace(/(\d{4})(?=\d)/g,"$1 ")
}
function updateVisual(){
 var raw=digits(E.cardNumber.value),n=formatCard(raw),m=digits(E.cardMonth.value).slice(0,2),y=digits(E.cardYear.value).slice(-2),info=cardBrandInfo(raw),card=E.visualNumber.closest(".visualCard");
 if(card){card.dataset.brand=info.key;card.dataset.variant=cardVariant(raw,info)}
 E.visualBrand.textContent=info.label;
 E.visualNumber.textContent=n||"•••• •••• •••• ••••";
 E.visualName.textContent=safe(E.cardName.value).toUpperCase()||"SEU NOME";
 E.visualExpiry.textContent=(m||"MM")+"/"+(y||"AA")
}`;

replaceOnce(oldJs, newJs, 'JS de bandeiras');

fs.writeFileSync(file, src, 'utf8');
console.log('Visual dinâmico de cartões aplicado com sucesso.');
