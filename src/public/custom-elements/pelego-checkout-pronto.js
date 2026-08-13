const CHECKOUT_HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pelego Box - Checkout Projeto Pronto</title>
<script defer src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/css/intlTelInput.css">
<script src="https://cdn.jsdelivr.net/npm/intl-tel-input@29.2.2/dist/js/intlTelInput.min.js"></script>
<style>
:root{
  --green:#159447;--green-dark:#0f7c3a;--green-soft:#f3fff6;
  --text:#222;--muted:#747474;--line:#dedede;--soft:#f7f9fb;
  --warn:#8b6500;--warn-bg:#fff6d4;--danger:#b3261e;--danger-bg:#fff0ee;
  --success:#146c2e;--success-bg:#edf9f0;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent;color:var(--text);font-family:Arial,Helvetica,sans-serif}
body{padding:7px}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.hidden{display:none!important}
.wrap{width:100%;max-width:1000px;margin:0 auto}

/* STEPPER */
.stepper{
  display:grid;grid-template-columns:1fr 58px 1fr 58px 1fr;gap:8px;align-items:center;
  padding:8px 88px;margin-bottom:9px;background:#fff;border:1px solid #e8e8e8;border-radius:17px;
  box-shadow:0 6px 18px rgba(0,0,0,.035)
}
.step{min-height:42px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e1e1e1;border-radius:23px;background:#fafafa;color:#555;font-size:11px}
.step.active,.step.done{border-color:#b9e5c5;background:#effcf3;color:var(--green-dark);font-weight:700}
.stepNo{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #ccc;background:#fff;font-weight:700}
.step.active .stepNo,.step.done .stepNo{background:var(--green);border-color:var(--green);color:#fff}
.sep{height:5px;border-radius:8px;background:#e6e6e6}

/* PRODUCT */
.checkoutCard{background:#fff;border:1px solid #e5e5e5;border-radius:17px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.04)}
.productHeader{display:grid;grid-template-columns:194px 1fr;gap:17px;align-items:center;padding:10px;border-bottom:1px solid #e5e5e5}
.productImageWrap{width:194px;height:110px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #e8e8e8;border-radius:10px;background:#f5f5f5}
.productImage{width:100%;height:100%;object-fit:contain;padding:3px}
.productFallback{font-size:11px;color:#888}
.productMeta{min-width:0}
.productTitle{margin:0;color:#161616;font-size:16px;line-height:1.3;font-weight:700;overflow-wrap:anywhere;text-transform:none}
.productDetails{
  margin-top:6px;
  display:inline-flex;
  align-items:baseline;
  gap:4px;
  font-size:10px;
  line-height:1;
  color:#666
}
.productPrice{
  display:inline-block;
  color:#111;
  font-weight:700;
  line-height:1;
  vertical-align:baseline
}
@media(min-width:681px){
  .productDetails{font-size:11px}
  .productPrice{font-size:13px}
}

/* CONTENT / FORM */
.content{padding:10px 12px 13px}
.panelHeader{text-align:center;margin-bottom:12px}
.panelHeader h2{margin:0;font-size:21px;line-height:1.2;color:#111;font-weight:700}
.panelHeader p{margin:7px auto 0;max-width:680px;font-size:10px;line-height:1.4;color:#666}
.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:11px 12px}
.fieldFull{grid-column:1/-1}
.emailField{margin-bottom:10px}
.label{display:block;margin-bottom:5px;color:#171717;font-size:12px;font-weight:700}
.required{color:#d32f2f}
.control{width:100%;height:48px;padding:0 13px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none}
.control:focus{border-color:#71ba87;box-shadow:0 0 0 3px rgba(21,148,71,.10)}
.phoneRow{display:block;position:relative}
.phonePrefix,.countrySelect{display:none!important}
.phoneRow .control{border-radius:12px}
.phoneRow .iti{width:100%}
.phoneRow .iti__tel-input{width:100%;height:48px;border:1px solid #d7d7d7;border-radius:12px;background:#fff;color:#171717;outline:none;padding-left:118px!important}
.phoneRow .iti__tel-input:focus{border-color:#71ba87;box-shadow:0 0 0 3px rgba(21,148,71,.10)}
.phoneRow .iti__selected-country{min-width:108px;padding:0 10px;border-right:1px solid #d7d7d7;background:#fafafa;border-radius:12px 0 0 12px}
.phoneRow .iti__selected-country-primary{gap:8px;padding:0!important}
.phoneRow .iti__flag{transform:scale(1.35);transform-origin:center;margin-right:5px}
.phoneRow .iti__selected-dial-code{font-size:15px;font-weight:700;color:#171717}
.phoneRow .iti__arrow{margin-left:4px;border-top-width:5px;border-left-width:4px;border-right-width:4px}
.phoneRow .iti__country-container{z-index:30}
.phoneRow .iti__dropdown-content{min-width:330px;max-width:min(92vw,430px);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.18);overflow:hidden}
.phoneRow .iti__search-input{height:42px;font-size:14px;padding:0 12px}
.phoneRow .iti__country{min-height:42px;padding:7px 12px;gap:10px;font-size:14px}
.phoneRow .iti__country .iti__flag{transform:scale(1.25)}
.phoneRow .iti__country-name{font-weight:600}
.phoneRow .iti__dial-code{font-weight:700;color:#555}
.hint{margin:5px 0 0;color:#777;font-size:9px}
.emailNotice{padding:9px 11px;border-left:4px solid #1877f2;border-radius:9px;background:#eef5ff;color:#2d405b;font-size:10px;line-height:1.4}
.alert{display:none;margin-top:9px;padding:9px 10px;border-radius:9px;font-size:10px;line-height:1.4}
.alert.info{display:block;background:#eef5ff;color:#285b9a}
.alert.error{display:block;background:var(--danger-bg);color:var(--danger)}
.alert.success{display:block;background:var(--success-bg);color:var(--success)}
.button{width:100%;min-height:47px;border:0;border-radius:11px;font-weight:700;transition:transform .13s,filter .13s,opacity .13s}
.button:hover:not(:disabled){transform:translateY(-2px);filter:brightness(.985)}
.buttonPrimary{background:var(--green);color:#fff;border:2px solid var(--green)}
.button:disabled{opacity:.45;cursor:not-allowed;transform:none}
.buttonPrimary:disabled{background:#f5fff7;color:var(--green);border-color:var(--green);opacity:1;box-shadow:0 3px 11px rgba(38,133,53,.09)}
.buttonLink{margin-top:7px;min-height:28px;background:transparent;color:#666;text-decoration:underline}

/* PAYMENT NORMAL, visual preservado */
.paymentHeader{text-align:center;margin-bottom:9px}
.paymentHeaderTitle{margin:0;font-size:20px;color:#181818;font-weight:700}
.paymentTopGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(230px,.95fr);gap:8px;align-items:stretch;margin-bottom:9px}
.methodColumn{display:flex;min-width:0;flex-direction:column;gap:7px}
.method{display:flex;width:100%;min-height:55px;align-items:center;gap:8px;padding:7px 8px;overflow:hidden;border:1px solid #d8d8d8;border-radius:11px;background:#fff}
.method.available{cursor:pointer;transition:transform .14s,box-shadow .14s,border-color .14s}
.method.available:hover{transform:translateY(-3px);box-shadow:0 7px 16px rgba(0,0,0,.07)}
.method.active{border:2px solid var(--green);background:#f5fff7;box-shadow:0 3px 11px rgba(38,133,53,.09)}
.method.disabled{background:#fafafa;opacity:.56}
.methodLogo{display:flex;width:42px;height:35px;flex:0 0 42px;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;background:#f4f4f4}
.method.active .methodLogo{background:#e3f6e7}
.methodLogo img{display:block;width:31px;max-width:92%;height:24px;max-height:90%;object-fit:contain}
.methodLogo.wide img{width:40px;height:22px}
.methodText{min-width:0;flex:1 1 auto}
.methodName{display:block;overflow:hidden;color:#222;font-size:12px;font-weight:700;line-height:1.15;text-overflow:ellipsis}
.methodDescription{display:block;margin-top:2px;overflow:hidden;color:#777;font-size:8px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}
.methodStatus{flex:0 0 auto;padding:4px 5px;border-radius:999px;background:#eee;color:#777;font-size:7px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.method.active .methodStatus{background:#dff3e3;color:var(--green)}
.paymentNotice{min-width:0;margin:0;padding:10px 11px;border:1px solid #d9e2ec;border-left:4px solid var(--green);border-radius:10px;background:#f7f9fb}
.paymentNoticeTitle{margin:0 0 6px;color:#222;font-size:12px;font-weight:700;line-height:1.3}
.paymentNoticeList{margin:0;padding-left:17px;color:#444;font-size:10px;line-height:1.4}
.paymentNoticeList li+li{margin-top:3px}

/* PIX */
.pixCard{width:100%;overflow:hidden;border:1px solid #dce5f2;border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(20,120,255,.07)}
.pixBody{display:grid;grid-template-columns:210px minmax(0,1fr);gap:14px;align-items:center;padding:10px}
.qrBox{position:relative;display:flex;width:210px;height:210px;align-items:center;justify-content:center;overflow:hidden;border:1px solid #e3e3e3;border-radius:12px;background:#fff}
.qrRender{display:flex;width:100%;height:100%;align-items:center;justify-content:center}
.qrRender img,.qrRender canvas{max-width:195px!important;max-height:195px!important}
 .tetrisWrap{position:absolute;inset:0;display:block;overflow:hidden;background:#090d12}
#tetrisCanvas{display:block;width:100%;height:100%;image-rendering:pixelated;border:0;background:#0c1118}
.tetrisText{position:absolute;left:0;right:0;bottom:5px;margin:0;padding:3px 6px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#eef8ef;font-size:9px;font-weight:700;letter-spacing:.3px;text-align:center;text-shadow:0 1px 2px #000}
.pixInfo{min-width:0}
.pixCodeLabel{display:block;margin:0 0 5px;color:#333;font-size:11px;font-weight:700}
.pixCode{display:block;width:100%;height:44px;min-height:44px;max-height:44px;margin:0;padding:7px 9px;resize:none;overflow:hidden;border:1px solid #ddd;border-radius:9px;outline:0;background:#f7f7f7;color:#333;font-family:monospace;font-size:8px;line-height:1.16;word-break:break-all}
.copyButton{min-height:44px;margin-top:6px;border:0;background:var(--green);color:#fff}
.copyButton:disabled{opacity:1;background:#91cda2;color:#fff;cursor:default;transform:none}
.pixStatus{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:7px;padding:9px;border-radius:10px;background:var(--warn-bg);color:var(--warn);font-size:11px;font-weight:700;text-align:center;animation:waitingBlink .82s ease-in-out infinite}
.statusDot{width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:#e9ae00;box-shadow:0 0 0 0 rgba(233,174,0,.55);animation:pulse .82s ease-in-out infinite}
.pixStatus.approved{background:var(--success-bg);color:var(--success);animation:none}
.pixStatus.approved .statusDot{background:var(--green);box-shadow:none;animation:none}
.pixStatus.error{background:var(--danger-bg);color:var(--danger);animation:none}
.pixStatus.error .statusDot{background:var(--danger);box-shadow:none;animation:none}
@keyframes waitingBlink{0%,100%{opacity:1;background:#fff6d4;box-shadow:0 0 0 rgba(233,174,0,0)}50%{opacity:.62;background:#ffe89a;box-shadow:0 0 18px rgba(233,174,0,.28)}}
@keyframes pulse{0%,100%{opacity:.55;box-shadow:0 0 0 0 rgba(233,174,0,.55)}50%{opacity:1;box-shadow:0 0 0 7px rgba(233,174,0,0)}}
.mobileDeferred{display:none}

/* CARD MODE: duas colunas iguais */
.cardModeGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:stretch}
.cardLeft,.cardRight{min-width:0;border:1px solid #e1e1e1;border-radius:13px;padding:11px;background:#fff}
.cardLeft{display:flex;flex-direction:column}
.cardLeft .paymentHeaderTitle{text-align:center;margin-bottom:10px}
.cardLeft .method{min-height:53px}
.cardLeft .paymentNotice{margin-top:9px}
/* CARTÃO VISUAL DINÂMICO: só aparência. Pagamento e payload permanecem intocados. */
.visualCard{
  position:relative;isolation:isolate;overflow:hidden;
  width:min(76%,340px);aspect-ratio:1.586/1;margin:0 auto 10px;padding:18px;
  display:flex;flex-direction:column;justify-content:space-between;border-radius:17px;
  background:linear-gradient(145deg,#171a20,#343b46 58%,#15171c);color:#fff;
  border:1px solid rgba(10,14,18,.38);
  box-shadow:0 12px 22px rgba(0,0,0,.22),0 4px 8px rgba(0,0,0,.12);
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
.visualCard[data-brand="aura"] .cardBrand{font-size:15px;text-transform:lowercase}
.savedCardBanner{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:10px 12px;border:1px solid #b9e5c5;border-radius:11px;background:#effcf3;color:#174d29}
.savedCardInfo{min-width:0;display:flex;flex-direction:column;gap:3px}
.savedCardTitle{font-size:11px;font-weight:800;text-transform:uppercase}
.savedCardMeta{font-size:12px;font-weight:700}
.savedCardAction{flex:0 0 auto;border:0;background:transparent;color:var(--green-dark);font-size:10px;font-weight:800;text-decoration:underline;cursor:pointer}
.cardForm.useSavedCard .cardSensitiveField{display:none!important}
.cardForm{padding:10px;border:1px solid #e2e2e2;border-radius:12px;background:#fff}
.cardFields{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
.cardFull{grid-column:1/-1}
.cardWide{grid-column:span 2}
.cardControl{height:43px}
.cardSubmit{margin-top:10px}
.successPanel{text-align:center;padding:32px 15px}
.successIcon{width:58px;height:58px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--green);color:#fff;font-size:29px;font-weight:700}
.successPanel h2{margin:0;color:#164e29;font-size:22px}
.successPanel p{margin:8px auto 16px;max-width:560px;color:#666;font-size:12px}

/* MOBILE */
@media(max-width:680px){
  body{padding:3px}
  .stepper{grid-template-columns:1fr 26px 1fr 26px 1fr;gap:3px;padding:5px;margin-bottom:7px;border-radius:13px}
  .step{min-height:49px;flex-direction:column;gap:2px;padding:4px 2px;border-radius:12px;font-size:8px}
  .stepNo{width:21px;height:21px;font-size:9px}.sep{height:3px}
  .checkoutCard{border-radius:13px}
  .productHeader{display:flex;flex-direction:column;gap:7px;padding:5px 4px 8px;text-align:center}
  .productImageWrap{width:100%;height:auto;aspect-ratio:16/9;border-radius:9px;background:#fff}
  .productImage{width:100%;height:100%;padding:1px;object-fit:contain}
  .productMeta{width:100%;padding:0 4px}.productTitle{font-size:14px;line-height:1.3}.productDetails{margin-top:7px;font-size:14px;font-weight:700;line-height:1.15}.productPrice{font-size:14px;font-weight:700}
  .content{padding:9px 7px 11px}.panelHeader h2{font-size:20px}.panelHeader p{font-size:10px}
  .formGrid{grid-template-columns:1fr;gap:9px}.fieldFull{grid-column:auto}
  .control,.phonePrefix{height:47px}
  .paymentTopGrid{grid-template-columns:1fr;gap:7px}
  .paymentTopGrid.pix-selected .centerColumn{display:none}
  .paymentTopGrid.pix-selected .paymentNotice{display:none}
  .method{min-height:52px}
  .pixBody{grid-template-columns:1fr;gap:10px;padding:8px}
  .qrBox{width:min(230px,78vw);height:min(230px,78vw);margin:0 auto}
  #tetrisCanvas{width:min(190px,64vw);height:min(190px,64vw)}
  .mobileDeferred.active{display:flex;flex-direction:column;gap:7px;margin-top:8px}
  .mobileDeferred .paymentNotice{display:block}
  .cardModeGrid{grid-template-columns:1fr;gap:10px}
  .cardLeft,.cardRight{padding:8px}
  #cardPaymentNotice{width:100%;margin-top:0}
  .visualCard{width:100%;max-width:none;padding:15px}
  .visualNumber{font-size:14px}
  .cardFields{grid-template-columns:1fr 1fr}.cardFull,.cardWide{grid-column:1/-1}
}
.checkoutBoot{min-height:72px;display:flex;align-items:center;justify-content:center;padding:12px;color:#555;font:600 12px Arial,Helvetica,sans-serif;text-align:center}
.checkoutBootDot{width:18px;height:18px;margin-right:9px;border:3px solid #dfeee4;border-top-color:#159447;border-radius:50%;animation:checkoutBootSpin .65s linear infinite}
@keyframes checkoutBootSpin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="checkoutBoot" class="checkoutBoot"><span class="checkoutBootDot"></span><span>Carregando checkout...</span></div>
<main id="checkoutMain" class="wrap" style="display:none">
  <div class="stepper">
    <div class="step active" id="step1"><span class="stepNo">1</span><span>Identificação</span></div>
    <div class="sep"></div>
    <div class="step" id="step2"><span class="stepNo">2</span><span>Pagamento</span></div>
    <div class="sep"></div>
    <div class="step" id="step3"><span class="stepNo">3</span><span>Produto</span></div>
  </div>

  <section class="checkoutCard">
    <header class="productHeader">
      <div class="productImageWrap">
        <img id="productImage" class="productImage" alt="Imagem do projeto">
        <span id="productFallback" class="productFallback hidden">Imagem indisponível</span>
      </div>
      <div class="productMeta">
        <h1 id="productTitle" class="productTitle">Projeto Pronto</h1>
        <div class="productDetails">Valor: <strong id="productPrice" class="productPrice">R$ 0,00</strong></div>
      </div>
    </header>

    <div class="content">
      <section id="identityPanel">
        <div class="panelHeader">
          <h2>Confira seus dados</h2>
          <p>Seu e-mail já vem da conta Google/Facebook. Confira nome, WhatsApp e CPF uma única vez neste navegador.</p>
        </div>
        <div class="formGrid">
          <div>
            <label class="label">WhatsApp com DDD <span class="required">*</span></label>
            <div class="phoneRow">
              <input type="hidden" id="countrySelect" value="55|br">
              <input id="phoneInput" class="control" type="tel" inputmode="numeric" maxlength="15" placeholder="47988168971">
            </div>
            <p class="hint">Informe somente DDD e número.</p>
          </div>
          <div>
            <label class="label">Confirme seu WhatsApp <span class="required">*</span></label>
            <div class="phoneRow">
              <input type="hidden" id="countryConfirmSelect" value="55|br">
              <input id="phoneConfirmInput" class="control" type="tel" inputmode="numeric" maxlength="15" placeholder="Digite novamente">
            </div>
            <p id="phoneConfirmHint" class="hint">Digite novamente o mesmo WhatsApp.</p>
          </div>
          <div>
            <label class="label">Seu nome <span class="required">*</span></label>
            <input id="nameInput" class="control" type="text" autocomplete="name" maxlength="120" placeholder="Ex: João Silva">
          </div>
          <div>
            <label class="label">CPF <span class="required">*</span></label>
            <input id="cpfInput" class="control" type="text" inputmode="numeric" maxlength="14" placeholder="000.000.000-00">
            <p class="hint">Informe o CPF do responsável pela compra.</p>
          </div>
          <div class="fieldFull emailField">
            <label class="label">E-mail da sua conta</label>
            <input id="emailInput" class="control" type="email" autocomplete="email" maxlength="254" readonly aria-readonly="true">
            <input id="emailConfirmInput" type="hidden">
            <p class="hint">Esse e-mail vem do seu login Google/Facebook e não pode ser alterado aqui.</p>
          </div>
        </div>
        <div id="identityAlert" class="alert"></div>
        <button id="identityButton" class="button buttonPrimary" type="button" disabled>Continuar para pagamento</button>
        <button id="identityBack" class="button buttonLink" type="button">Voltar</button>
      </section>

      <section id="paymentPanel" class="hidden">
        <div id="paymentNormal">
          <header class="paymentHeader"><h2 class="paymentHeaderTitle">Escolha a forma de pagamento</h2></header>
          <div class="paymentTopGrid" id="paymentTopGrid">
            <div class="methodColumn" id="leftColumn">
              <div id="pixMethod" class="method active available">
                <div class="methodLogo"><img src="https://pay.innerai.com/assets/paymentMethods/pix.svg" alt="Pix"></div>
                <div class="methodText"><span class="methodName">Pix</span><span class="methodDescription">Aprovação rápida</span></div><span class="methodStatus">Ativo</span>
              </div>
              <div id="cardMethod" class="method active available">
                <div class="methodLogo"><img src="https://pay.innerai.com/assets/paymentMethods/card.svg" alt="Cartão de crédito"></div>
                <div class="methodText"><span class="methodName">Cartão de crédito</span><span class="methodDescription">Pagamento parcelado</span></div><span class="methodStatus">Ativo</span>
              </div>
              <div id="googleMethod" class="method disabled">
                <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-google_pay-a84baf6d35b2ea6cfe4eb22921f0642c04fe4202a32891c97682f4851c508f7a.png" alt="Google Pay"></div>
                <div class="methodText"><span class="methodName">Google Pay</span><span class="methodDescription">Carteira digital</span></div><span class="methodStatus">Em breve</span>
              </div>
            </div>

            <div class="methodColumn centerColumn" id="centerColumn">
              <div id="pixAutoMethod" class="method disabled">
                <div class="methodLogo"><img src="https://cursos.estevaosoares.com/cdn/shopifycloud/checkout-web/assets/c1/assets/pix.BiPKIIQK.svg" alt="Pix Automático"></div>
                <div class="methodText"><span class="methodName">Pix Automático</span><span class="methodDescription">Autorização recorrente</span></div><span class="methodStatus">Em breve</span>
              </div>
              <div id="appleMethod" class="method disabled">
                <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-apple_pay-51d871ea6497f023fea1fdfef1bf6bdfa972b533d08f25d6e94d60e58180316b.png" alt="Apple Pay"></div>
                <div class="methodText"><span class="methodName">Apple Pay</span><span class="methodDescription">Carteira digital</span></div><span class="methodStatus">Em breve</span>
              </div>
              <div id="paypalMethod" class="method disabled">
                <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-paypal-f9eb6400b101bb5ed6b4d721ee967514a2976bac3cd60439c9b9d5d8a9b9ef02.png" alt="PayPal"></div>
                <div class="methodText"><span class="methodName">PayPal</span><span class="methodDescription">Pagamento online</span></div><span class="methodStatus">Em breve</span>
              </div>
            </div>

            <aside class="paymentNotice" id="paymentNotice">
              <h3 class="paymentNoticeTitle">Informações importantes sobre o pagamento</h3>
              <ul class="paymentNoticeList">
                <li>A liberação acontece automaticamente após a confirmação.</li>
                <li>Mantenha esta página aberta enquanto realiza o pagamento.</li>
                <li>O acesso ao produto será aberto assim que o pagamento for identificado.</li>
                <li>Você receberá dois e-mails: um confirmando o pagamento e outro com o acesso ao produto.</li>
              </ul>
            </aside>
          </div>

          <article id="pixArea" class="pixCard hidden">
            <div class="pixBody">
              <div class="qrBox">
                <div id="qrRender" class="qrRender"></div>
                <div id="tetrisWrap" class="tetrisWrap">
                  <canvas id="tetrisCanvas" width="240" height="240"></canvas>
                  <div class="tetrisText">Preparando seu Pix...</div>
                </div>
              </div>
              <div class="pixInfo">
                <label class="pixCodeLabel" for="pixCode">Pix copia e cola</label>
                <textarea id="pixCode" class="pixCode" readonly aria-label="Código Pix copia e cola"></textarea>
                <button id="copyPixButton" class="button copyButton" type="button" disabled>Copiar código Pix</button>
                <div id="pixStatus" class="pixStatus"><span class="statusDot"></span><span id="pixStatusText">AGUARDANDO PIX</span></div>
              </div>
            </div>
          </article>

          <div id="mobileDeferred" class="mobileDeferred"></div>
        </div>

        <div id="paymentCardMode" class="hidden">
          <div class="cardModeGrid">
            <section class="cardLeft" id="cardLeft">
              <h2 class="paymentHeaderTitle">Escolha a forma de pagamento</h2>
              <div class="methodColumn">
                <div id="cardSelected" class="method active">
                  <div class="methodLogo"><img src="https://pay.innerai.com/assets/paymentMethods/card.svg" alt="Cartão"></div>
                  <div class="methodText"><span class="methodName">Cartão de crédito</span><span class="methodDescription">Pagamento parcelado</span></div><span class="methodStatus">Selecionado</span>
                </div>
                <div id="pixFromCard" class="method active available">
                  <div class="methodLogo"><img src="https://pay.innerai.com/assets/paymentMethods/pix.svg" alt="Pix"></div>
                  <div class="methodText"><span class="methodName">Pix</span><span class="methodDescription">Aprovação rápida</span></div><span class="methodStatus">Ativo</span>
                </div>
                <div class="method disabled">
                  <div class="methodLogo"><img src="https://cursos.estevaosoares.com/cdn/shopifycloud/checkout-web/assets/c1/assets/pix.BiPKIIQK.svg" alt="Pix Automático"></div>
                  <div class="methodText"><span class="methodName">Pix Automático</span><span class="methodDescription">Autorização recorrente</span></div><span class="methodStatus">Em breve</span>
                </div>
                <div class="method disabled">
                  <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-google_pay-a84baf6d35b2ea6cfe4eb22921f0642c04fe4202a32891c97682f4851c508f7a.png" alt="Google Pay"></div>
                  <div class="methodText"><span class="methodName">Google Pay</span><span class="methodDescription">Carteira digital</span></div><span class="methodStatus">Em breve</span>
                </div>
                <div class="method disabled">
                  <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-apple_pay-51d871ea6497f023fea1fdfef1bf6bdfa972b533d08f25d6e94d60e58180316b.png" alt="Apple Pay"></div>
                  <div class="methodText"><span class="methodName">Apple Pay</span><span class="methodDescription">Carteira digital</span></div><span class="methodStatus">Em breve</span>
                </div>
                <div class="method disabled">
                  <div class="methodLogo wide"><img src="https://cdn2.domestika.org/assets/payment-methods/logo-paypal-f9eb6400b101bb5ed6b4d721ee967514a2976bac3cd60439c9b9d5d8a9b9ef02.png" alt="PayPal"></div>
                  <div class="methodText"><span class="methodName">PayPal</span><span class="methodDescription">Pagamento online</span></div><span class="methodStatus">Em breve</span>
                </div>
              </div>
              <aside class="paymentNotice" id="cardPaymentNotice">
                <h3 class="paymentNoticeTitle">Informações importantes sobre o pagamento</h3>
                <ul class="paymentNoticeList">
                  <li>Confira os dados do cartão antes de pagar.</li>
                  <li>O número completo e o CVV não são gravados pelo checkout.</li>
                  <li>A liberação acontece após a confirmação da operadora.</li>
                  <li>Se preferir, volte para Pix sem perder seus dados.</li>
                  <li>A liberação acontece automaticamente após a confirmação.</li>
                  <li>Mantenha esta página aberta enquanto realiza o pagamento.</li>
                  <li>O acesso ao produto será aberto assim que o pagamento for identificado.</li>
                  <li>Você receberá dois e-mails: um confirmando o pagamento e outro com o acesso ao produto.</li>
                </ul>
              </aside>
            </section>

            <section class="cardRight" id="cardRight">
              <div id="savedCardBanner" class="savedCardBanner hidden">
                <div class="savedCardInfo"><span class="savedCardTitle">Cartão salvo</span><span id="savedCardMeta" class="savedCardMeta"></span></div>
                <button id="savedCardAction" class="savedCardAction" type="button">Trocar cartão</button>
              </div>
              <div class="visualCard" data-brand="default" data-variant="0">
                <div class="visualCardTop"><span class="cardChip" aria-hidden="true"></span><span class="cardContactless" aria-hidden="true">)))</span><span id="visualBrand" class="cardBrand">CARTÃO</span></div>
                <div id="visualNumber" class="visualNumber">•••• •••• •••• ••••</div>
                <div class="visualCardBottom">
                  <div><span class="visualLabel">NOME</span><span id="visualName" class="visualValue">SEU NOME</span></div>
                  <div><span class="visualLabel">VALIDADE</span><span id="visualExpiry" class="visualValue">MM/AA</span></div>
                </div>
              </div>
              <form id="cardForm" class="cardForm" autocomplete="on" name="payment-card-form">
                <div class="cardFields">
                  <div class="cardFull cardSensitiveField"><label class="label">Número do cartão</label><input id="cardNumber" name="cc-number" class="control cardControl" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="23" placeholder="0000 0000 0000 0000"></div>
                  <div class="cardSensitiveField"><label class="label">Mês</label><input id="cardMonth" name="cc-exp-month" class="control cardControl" type="text" inputmode="numeric" autocomplete="cc-exp-month" maxlength="2" placeholder="MM"></div>
                  <div class="cardSensitiveField"><label class="label">Ano</label><input id="cardYear" name="cc-exp-year" class="control cardControl" type="text" inputmode="numeric" autocomplete="cc-exp-year" maxlength="4" placeholder="AA"></div>
                  <div class="cardSensitiveField"><label class="label">CVV</label><input id="cardCvv" name="cc-csc" class="control cardControl" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="•••"></div>
                  <div class="cardWide cardSensitiveField"><label class="label">Nome impresso no cartão</label><input id="cardName" name="cc-name" class="control cardControl" type="text" autocomplete="cc-name" placeholder="Ex: João Silva"></div>
                  <div class="cardSensitiveField"><label class="label">CPF/CNPJ</label><input id="cardDocument" name="card-document" class="control cardControl" type="text" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="Somente números"></div>
                  <div class="cardFull"><label class="label">Parcelas</label><select id="installments" class="control cardControl"></select></div>
                </div>
                <div id="cardAlert" class="alert"></div>
                <button id="cardSubmit" class="button buttonPrimary cardSubmit" type="submit">Pagar com cartão</button>
              </form>
            </section>
          </div>
        </div>

        <button id="paymentBack" class="button buttonLink" type="button">Voltar</button>
      </section>

      <section id="successPanel" class="successPanel hidden">
        <div class="successIcon">✓</div><h2>Pagamento aprovado</h2><p>Pagamento confirmado. Abrindo seu produto...</p>
      </section>

      <section id="alreadyPanel" class="successPanel hidden">
        <div class="successIcon">✓</div><h2>Esta etapa já foi comprada</h2><p>O acesso desta etapa já está liberado.</p>
        <button id="alreadyBack" class="button buttonPrimary" type="button">Voltar</button>
      </section>
    </div>
  </section>
</main>

<script>
(function(){
"use strict";

var S={ctx:{},checkoutId:"",saving:false,paymentReady:false,pixCode:"",tetris:null,cardBusy:false,savedCard:null,useSavedCard:false};

function $(id){return document.getElementById(id)}
var E={
 step1:$("step1"),step2:$("step2"),step3:$("step3"),img:$("productImage"),fallback:$("productFallback"),title:$("productTitle"),price:$("productPrice"),
 identity:$("identityPanel"),payment:$("paymentPanel"),normal:$("paymentNormal"),cardMode:$("paymentCardMode"),success:$("successPanel"),already:$("alreadyPanel"),savedCardBanner:$("savedCardBanner"),savedCardMeta:$("savedCardMeta"),savedCardAction:$("savedCardAction"),
 country:$("countrySelect"),countryConfirm:$("countryConfirmSelect"),phone:$("phoneInput"),phoneConfirm:$("phoneConfirmInput"),phoneConfirmHint:$("phoneConfirmHint"),name:$("nameInput"),cpf:$("cpfInput"),email:$("emailInput"),email2:$("emailConfirmInput"),identityAlert:$("identityAlert"),identityBtn:$("identityButton"),
 topGrid:$("paymentTopGrid"),left:$("leftColumn"),center:$("centerColumn"),notice:$("paymentNotice"),google:$("googleMethod"),pixAuto:$("pixAutoMethod"),apple:$("appleMethod"),paypal:$("paypalMethod"),deferred:$("mobileDeferred"),
 pix:$("pixMethod"),card:$("cardMethod"),pixFromCard:$("pixFromCard"),pixArea:$("pixArea"),qr:$("qrRender"),tetrisWrap:$("tetrisWrap"),tetrisCanvas:$("tetrisCanvas"),pixCode:$("pixCode"),copy:$("copyPixButton"),pixStatus:$("pixStatus"),pixStatusText:$("pixStatusText"),
 cardLeft:$("cardLeft"),cardRight:$("cardRight"),cardSelected:$("cardSelected"),cardPaymentNotice:$("cardPaymentNotice"),cardForm:$("cardForm"),cardNumber:$("cardNumber"),cardMonth:$("cardMonth"),cardYear:$("cardYear"),cardCvv:$("cardCvv"),cardName:$("cardName"),cardDocument:$("cardDocument"),installments:$("installments"),cardAlert:$("cardAlert"),cardSubmit:$("cardSubmit"),
 visualBrand:$("visualBrand"),visualNumber:$("visualNumber"),visualName:$("visualName"),visualExpiry:$("visualExpiry")
};

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
initInternationalPhonePickers();

function safe(v){return String(v==null?"":v).trim()}
function digits(v){return safe(v).replace(/\D/g,"")}
function email(v){return safe(v).toLowerCase()}
function money(v){var n=Number(v||0);if(!isFinite(n))n=0;return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function post(data){try{window.parent.postMessage(data,"*")}catch(_){}}

var CURRENT_LAYOUT_MODE="INITIAL";
var HEIGHT_TIMER=null;
var LAST_EMITTED_HEIGHT=0;
var LAST_VIEWPORT_MOBILE=window.innerWidth<=680;

function checkoutRealHeight(){
  var wrap=document.querySelector(".wrap");
  var body=document.body;

  if(wrap){
    var rect=wrap.getBoundingClientRect();
    if(rect.height>0){
      var styles=body ? window.getComputedStyle(body) : null;
      var paddingTop=styles ? (parseFloat(styles.paddingTop)||0) : 0;
      var paddingBottom=styles ? (parseFloat(styles.paddingBottom)||0) : 0;
      return Math.ceil(rect.height + paddingTop + paddingBottom);
    }
  }

  var boot=document.getElementById("checkoutBoot");
  if(boot && !boot.classList.contains("hidden")){
    return Math.ceil(boot.getBoundingClientRect().height + 12);
  }

  return Math.ceil(document.documentElement.scrollHeight || 0);
}

function emitCheckoutHeight(){
  var h=checkoutRealHeight();
  if(!h)return;
  if(Math.abs(h-LAST_EMITTED_HEIGHT)<=1)return;
  LAST_EMITTED_HEIGHT=h;
  post({
    type:"CHECKOUT_LAYOUT",
    mode:CURRENT_LAYOUT_MODE,
    height:h
  });
}

function layoutMode(mode){
  CURRENT_LAYOUT_MODE=String(mode||"INITIAL").toUpperCase();
  clearTimeout(HEIGHT_TIMER);
  emitCheckoutHeight();
  HEIGHT_TIMER=setTimeout(emitCheckoutHeight,140);
}
function incoming(raw){var d=raw;if(typeof d==="string"){try{d=JSON.parse(d)}catch(_){d={type:d}}}if(d&&d.data&&typeof d.data==="object"&&!d.type)d=d.data;return d&&typeof d==="object"?d:{}}
function deepPixValue(obj){
 var seen=[];
 function walk(v,depth){if(depth>8||v==null)return"";if(typeof v==="string"){var t=safe(v);if(/^000201/.test(t)&&t.length>70)return t;if(/BR\.GOV\.BCB\.PIX/i.test(t)&&t.length>70)return t;return""}if(typeof v!=="object"||seen.indexOf(v)>=0)return"";seen.push(v);var keys=Object.keys(v);for(var i=0;i<keys.length;i++){var k=keys[i].toLowerCase(),val=v[keys[i]];if(/emv|copypaste|copy_paste|pixcode|pix_code|brcode|br_code/.test(k)&&typeof val==="string"&&safe(val))return safe(val)}for(var j=0;j<keys.length;j++){var found=walk(v[keys[j]],depth+1);if(found)return found}return""}return walk(obj,0)
}
function deepQrValue(obj){
 var seen=[];function walk(v,depth){if(depth>8||v==null||typeof v!=="object"||seen.indexOf(v)>=0)return"";seen.push(v);var keys=Object.keys(v);for(var i=0;i<keys.length;i++){var k=keys[i].toLowerCase(),val=v[keys[i]];if(/qrcode|qr_code|qrbase64|qrcodebase64/.test(k)&&typeof val==="string"&&safe(val))return safe(val)}for(var j=0;j<keys.length;j++){var f=walk(v[keys[j]],depth+1);if(f)return f}return""}return walk(obj,0)
}
function setAlert(node,kind,text){node.className="alert";node.textContent="";if(!safe(text))return;node.classList.add(kind||"info");node.textContent=text}

function decodeEntities(v){
 var t=document.createElement("textarea");
 t.innerHTML=safe(v);
 return t.value.replace(/\s+/g," ").trim();
}
function prettyTitle(v){
 var text=decodeEntities(v);
 if(!text)return "Projeto Pronto";
 var letters=text.replace(/[^A-Za-zÀ-ÿ]/g,"");
 if(!letters)return text;
 var upp=(letters.match(/[A-ZÀ-Þ]/g)||[]).length;
 if(upp/letters.length<.82)return text;
 var small={DE:1,DA:1,DO:1,DAS:1,DOS:1,E:1,EM:1,PARA:1,COM:1,SEM:1,POR:1};
 var keep={JBL:1,QVS:1,RMS:1,SPL:1,DSP:1,USB:1,TWS:1,LED:1,PRO:1,KC:1,PA:1};
 return text.split(/\s+/).map(function(word,index){
   var core=word.replace(/^[^A-Za-zÀ-ÿ0-9#]+|[^A-Za-zÀ-ÿ0-9"'#]+$/g,"");
   if(!core)return word;
   if(/[0-9]/.test(core)||keep[core.toUpperCase()])return word;
   if(index>0&&small[core.toUpperCase()])return word.toLowerCase();
   return word.toLowerCase().replace(/(^|[-/])([a-zà-ÿ])/g,function(_,a,b){return a+b.toUpperCase()});
 }).join(" ");
}
function setStep(n){
 [E.step1,E.step2,E.step3].forEach(function(el,i){el.classList.remove("active","done");if(i+1<n)el.classList.add("done");if(i+1===n)el.classList.add("active")});
}
function countryInfo(select){var raw=safe(select&&select.value||"55|br").split("|");return{ddi:digits(raw[0])||"55",country:safe(raw[1]||"br").toLowerCase()}}
function phoneLocal(v,ddi){var n=digits(v),d=digits(ddi||"55");if(d&&n.indexOf(d)===0&&n.length>d.length+5)n=n.slice(d.length);return n.length>=6&&n.length<=15?n:""}
function formatPhone(v,ddi){var d=digits(ddi||"55"),n=phoneLocal(v,d)||digits(v).slice(0,15);if(d==="55"&&n.length===11)return n.replace(/^(\d{2})(\d{5})(\d{4})$/,"($1) $2-$3");if(d==="55"&&n.length===10)return n.replace(/^(\d{2})(\d{4})(\d{4})$/,"($1) $2-$3");return n}
function cpf(v){return digits(v).slice(0,11)}
function formatCpf(v){var n=cpf(v);return n.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1-$2")}
function validCpf(v){var n=cpf(v);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;var s=0,i,d;for(i=0;i<9;i++)s+=Number(n[i])*(10-i);d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;s=0;for(i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10])}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email(v))}


function stageDisplayTitle(value,type,projectCode){
 var original=decodeEntities(value);
 if(!original)return "Projeto Pronto";
 var qm=original.match(/\b(00[1-9]|01[0-4])\b\s*$/i);
 var q=qm?qm[1]:"";
 var cut=original.replace(/\s*\bPELEGO\s+BOX\b[\s\S]*$/i,"").replace(/\s+/g," ").trim();
 cut=prettyTitle(cut);
 var found=cut.match(/^\s*#?\s*(\d+)\s+(.*)$/);
 var code=found?found[1]:digits(projectCode);
 var body=found?found[2]:cut;
 var stagePrefix=/^(?:(?:Medidas(?:\s+do)?\s+Projeto\s+Pronto(?:\s+para)?)|(?:Análises\s+Gráficas\s+do\s+Projeto\s+Pronto(?:\s+para)?)|(?:Analises\s+Graficas\s+do\s+Projeto\s+Pronto(?:\s+para)?)|(?:Gráficos(?:\s+do)?\s+Projeto\s+Pronto(?:\s+para)?)|(?:Graficos(?:\s+do)?\s+Projeto\s+Pronto(?:\s+para)?)|(?:Projeto\s+Completo(?:\s+para)?)|(?:Projeto\s+Pronto\s+Completo))\s+/i;
 var previous="";
 while(body&&body!==previous){previous=body;body=body.replace(stagePrefix,"").trim()}
 var normalized=safe(type).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s-]+/g,"_");
 var prefix=normalized==="GRAFICOS"?"Gráficos Projeto Pronto":normalized==="PROJETO_COMPLETO"?"Projeto Pronto Completo":"Medidas Projeto Pronto";
 return [code?"#"+code:"",prefix,body,q].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

function hydrate(ctx){
 S.ctx=ctx||{};
 E.title.textContent=stageDisplayTitle(S.ctx.titulo||S.ctx.produto||S.ctx.name,S.ctx.tipoProduto,S.ctx.codigoProjeto);
 E.price.textContent=money(S.ctx.valor||S.ctx.price);
 var src=safe(S.ctx.imagem||S.ctx.img);
 if(src){E.img.src=src;E.img.classList.remove("hidden");E.fallback.classList.add("hidden")}else{E.img.classList.add("hidden");E.fallback.classList.remove("hidden")}
 var wantedDdi=digits(S.ctx.ddi||"55")||"55",wantedCountry=safe(S.ctx.country||"br").toLowerCase();if(E.country)E.country.value=wantedDdi+"|"+wantedCountry;if(E.countryConfirm)E.countryConfirm.value=wantedDdi+"|"+wantedCountry;if(itiPhone)setItiCountry(itiPhone,wantedCountry);if(itiPhoneConfirm)setItiCountry(itiPhoneConfirm,wantedCountry);var ci=countryInfo(E.country),p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp,ci.ddi);if(p)E.phone.value=formatPhone(p,ci.ddi);if(E.phoneConfirm)E.phoneConfirm.value="";
 if(S.ctx.nome)E.name.value=safe(S.ctx.nome);
 if(S.ctx.cpfCnpj)E.cpf.value=formatCpf(S.ctx.cpfCnpj);
 if(S.ctx.email){E.email.value=email(S.ctx.email);E.email2.value=email(S.ctx.email)}
 fillInstallments();
 syncIdentityButton();
}











function phoneConfirmationMatches(){
 var a=phoneLocal(E.phone.value,countryInfo(E.country).ddi),b=phoneLocal(E.phoneConfirm.value,countryInfo(E.countryConfirm).ddi);
 return Boolean(a&&b&&a===b)
}
function syncPhoneConfirmationState(){
 if(!E.phoneConfirm||!E.phoneConfirmHint)return;
 var a=phoneLocal(E.phone.value,countryInfo(E.country).ddi),b=phoneLocal(E.phoneConfirm.value,countryInfo(E.countryConfirm).ddi),mismatch=Boolean(b&&a!==b);
 E.phoneConfirm.style.borderColor=mismatch?"#d32f2f":"";
 E.phoneConfirm.style.boxShadow=mismatch?"0 0 0 3px rgba(211,47,47,.10)":"";
 E.phoneConfirmHint.textContent=mismatch?"Os números não conferem.":"Digite novamente o mesmo WhatsApp.";
 E.phoneConfirmHint.style.color=mismatch?"#b3261e":"#777";
}
function identityFieldsReady(){
 var p=phoneLocal(E.phone.value,countryInfo(E.country).ddi),p2=phoneLocal(E.phoneConfirm.value,countryInfo(E.countryConfirm).ddi),n=safe(E.name.value).replace(/\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 return Boolean(p&&p2&&p===p2&&n.length>=3&&validCpf(c)&&validEmail(a))
}
function syncIdentityButton(){
 syncPhoneConfirmationState();
 if(!E.identityBtn)return;
 E.identityBtn.disabled=S.saving||!identityFieldsReady();
}
function validateIdentity(){
 var p=phoneLocal(E.phone.value,countryInfo(E.country).ddi),p2=phoneLocal(E.phoneConfirm.value,countryInfo(E.countryConfirm).ddi),n=safe(E.name.value).replace(/\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 if(!p){setAlert(E.identityAlert,"error","Informe um WhatsApp válido com DDD.");E.phone.focus();return false}
 if(!p2){setAlert(E.identityAlert,"error","Confirme seu WhatsApp.");E.phoneConfirm.focus();return false}
 if(p!==p2){setAlert(E.identityAlert,"error","Os números de WhatsApp não conferem.");syncPhoneConfirmationState();E.phoneConfirm.focus();return false}
 if(n.length<3){setAlert(E.identityAlert,"error","Informe seu nome completo.");E.name.focus();return false}
 if(!validCpf(c)){setAlert(E.identityAlert,"error","Informe um CPF válido.");E.cpf.focus();return false}
 if(!validEmail(a)){setAlert(E.identityAlert,"error","Não foi possível carregar o e-mail da sua conta Google/Facebook.");return false}
 return true
}

function customerPayload(){
 var ci=countryInfo(E.country),p=phoneLocal(E.phone.value,ci.ddi),n=safe(E.name.value).replace(/\s+/g," ");
 return{type:"CREATE_CUSTOMER",checkoutId:S.checkoutId,whatsapp:p,whatsappE164:p?"+"+ci.ddi+p:"",ddi:ci.ddi,country:ci.country,nome:n,nomeCliente:n,cpfCnpj:cpf(E.cpf.value),cpf:cpf(E.cpf.value),email:email(E.email.value),ctx:S.ctx}
}
function basePayment(){
 var ci=countryInfo(E.country),p=phoneLocal(E.phone.value||S.ctx.whatsapp,ci.ddi);
 return{checkoutId:S.checkoutId,clienteId:safe(S.ctx.clienteId),nome:safe(E.name.value||S.ctx.nome),nomeCliente:safe(E.name.value||S.ctx.nome),email:email(E.email.value||S.ctx.email),cpfCnpj:cpf(E.cpf.value||S.ctx.cpfCnpj),whatsapp:p,whatsappE164:p?"+"+ci.ddi+p:"",ddi:ci.ddi,country:ci.country,codigoProjeto:safe(S.ctx.codigoProjeto),tipoProduto:safe(S.ctx.tipoProduto||"MEDIDAS"),produto:decodeEntities(S.ctx.produto||S.ctx.titulo),valor:Number(S.ctx.valor||S.ctx.price||0),img:safe(S.ctx.img||S.ctx.imagem),returnUrl:safe(S.ctx.returnUrl),ctx:S.ctx}
}
function showPayment(){
 if(S.paymentReady)return;
 S.paymentReady=true;S.saving=false;E.identityBtn.disabled=false;setAlert(E.identityAlert,"","");
 E.identity.classList.add("hidden");E.payment.classList.remove("hidden");E.normal.classList.remove("hidden");E.cardMode.classList.add("hidden");setStep(2);
 layoutMode("PAYMENT");
 try{window.scrollTo({top:0,behavior:"smooth"})}catch(_){}
}

/* TETRIS AUTÔNOMO DENTRO DO QR */
function startTetris(){
 stopTetris();
 var canvas=E.tetrisCanvas,ctx=canvas.getContext("2d"),cols=16,rows=16;
 var cell=Math.floor(Math.min(canvas.width/cols,canvas.height/rows));
 var fieldW=cols*cell,fieldH=rows*cell,ox=Math.floor((canvas.width-fieldW)/2),oy=Math.floor((canvas.height-fieldH)/2);
 var board=Array.from({length:rows},function(){return Array(cols).fill(0)});
 var pieces=[
  [[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]
 ];
 var piece=null,x=0,y=0,targetX=0,last=0,tick=0;
 function rotate(p){var h=p.length,w=p[0].length,out=Array.from({length:w},function(){return Array(h).fill(0)});for(var py=0;py<h;py++)for(var px=0;px<w;px++)out[px][h-1-py]=p[py][px];return out}
 function collide(nx,ny,testPiece){var p=testPiece||piece;for(var py=0;py<p.length;py++)for(var px=0;px<p[py].length;px++)if(p[py][px]){var bx=nx+px,by=ny+py;if(bx<0||bx>=cols||by>=rows)return true;if(by>=0&&board[by][bx])return true}return false}
 function seed(){for(var r=rows-4;r<rows;r++)for(var c=0;c<cols;c++)if(Math.random()<.28)board[r][c]=1;for(var rr=rows-4;rr<rows;rr++){if(board[rr].every(Boolean))board[rr][Math.floor(Math.random()*cols)]=0}}
 function spawn(){piece=pieces[Math.floor(Math.random()*pieces.length)].map(function(r){return r.slice()});var spins=Math.floor(Math.random()*4);while(spins--){var rotated=rotate(piece);if(rotated[0].length<=cols)piece=rotated}x=Math.floor((cols-piece[0].length)/2);y=-piece.length;targetX=Math.floor(Math.random()*Math.max(1,cols-piece[0].length+1));tick=0}
 function lock(){for(var py=0;py<piece.length;py++)for(var px=0;px<piece[py].length;px++)if(piece[py][px]){var by=y+py,bx=x+px;if(by>=0&&by<rows)board[by][bx]=1}
  for(var r=rows-1;r>=0;r--)if(board[r].every(Boolean)){board.splice(r,1);board.unshift(Array(cols).fill(0));r++}
  spawn();if(collide(x,y)){board=Array.from({length:rows},function(){return Array(cols).fill(0)});seed()}
 }
 function playMove(){
  tick++;
  if(tick%4===0&&Math.random()<.55){var rotated=rotate(piece);if(!collide(x,y,rotated))piece=rotated}
  if(x<targetX&&!collide(x+1,y))x++;else if(x>targetX&&!collide(x-1,y))x--;
  if(!collide(x,y+1))y++;else lock();
 }
 function draw(){
  var grad=ctx.createLinearGradient(0,0,0,canvas.height);grad.addColorStop(0,"#0a1119");grad.addColorStop(1,"#111b25");ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="rgba(255,255,255,.045)";ctx.lineWidth=1;
  for(var gy=0;gy<=rows;gy++){ctx.beginPath();ctx.moveTo(ox,oy+gy*cell);ctx.lineTo(ox+fieldW,oy+gy*cell);ctx.stroke()}
  for(var gx=0;gx<=cols;gx++){ctx.beginPath();ctx.moveTo(ox+gx*cell,oy);ctx.lineTo(ox+gx*cell,oy+fieldH);ctx.stroke()}
  function block(bx,by,live){if(by<0)return;var px=ox+bx*cell,py=oy+by*cell;ctx.fillStyle=live?"#56e36f":"#22a447";ctx.fillRect(px+1,py+1,cell-2,cell-2);ctx.fillStyle=live?"rgba(255,255,255,.34)":"rgba(255,255,255,.14)";ctx.fillRect(px+2,py+2,cell-4,Math.max(2,Math.floor(cell*.16)));ctx.fillStyle="rgba(0,0,0,.18)";ctx.fillRect(px+2,py+cell-4,cell-4,2)}
  for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)if(board[r][c])block(c,r,false);
  for(var py=0;py<piece.length;py++)for(var px=0;px<piece[py].length;px++)if(piece[py][px])block(x+px,y+py,true);
 }
 function loop(ts){if(!last||ts-last>125){if(last)playMove();last=ts;draw()}S.tetris=requestAnimationFrame(loop)}
 seed();spawn();S.tetris=requestAnimationFrame(loop)
}
function stopTetris(){if(S.tetris){cancelAnimationFrame(S.tetris);S.tetris=null}}

function mobilePixOrder(){
 if(window.innerWidth>680)return;
 E.topGrid.classList.add("pix-selected");
 [E.card,E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});
 E.deferred.classList.add("active");
}
function restoreDesktopOrder(){
 if(window.innerWidth<=680)return;
 E.topGrid.classList.remove("pix-selected");E.deferred.classList.remove("active");
 if(E.card.parentElement!==E.left)E.left.appendChild(E.card);
 if(E.google.parentElement!==E.left)E.left.appendChild(E.google);
 if(E.pixAuto.parentElement!==E.center)E.center.appendChild(E.pixAuto);
 if(E.apple.parentElement!==E.center)E.center.appendChild(E.apple);
 if(E.paypal.parentElement!==E.center)E.center.appendChild(E.paypal);
 if(E.notice.parentElement!==E.topGrid)E.topGrid.appendChild(E.notice);
}
window.addEventListener("resize",function(){
 var mobile=window.innerWidth<=680;
 if(mobile===LAST_VIEWPORT_MOBILE)return;
 LAST_VIEWPORT_MOBILE=mobile;
 if(mobile){
   if(!E.pixArea.classList.contains("hidden"))mobilePixOrder();
   if(!E.cardMode.classList.contains("hidden"))mobileCardOrder();
 }else{
   restoreDesktopOrder();
   restoreCardDesktop();
 }
 layoutMode(CURRENT_LAYOUT_MODE);
});

function setPaymentMethodStatus(node,text){
 if(!node)return;
 var status=node.querySelector(".methodStatus");
 if(status)status.textContent=text;
}
function selectPaymentMethod(method){
 var selected=safe(method).toUpperCase();
 setPaymentMethodStatus(E.pix,selected==="PIX"?"Selecionado":"Ativo");
 setPaymentMethodStatus(E.card,selected==="CARD"?"Selecionado":"Ativo");
 setPaymentMethodStatus(E.cardSelected,"Selecionado");
 setPaymentMethodStatus(E.pixFromCard,"Ativo");
}
function openPix(){
 selectPaymentMethod("PIX");
 E.cardMode.classList.add("hidden");E.normal.classList.remove("hidden");E.pixArea.classList.remove("hidden");
 S.pixCode="";E.pixCode.value="";E.copy.disabled=true;E.qr.innerHTML="";E.tetrisWrap.classList.remove("hidden");
 E.pixStatus.className="pixStatus";E.pixStatusText.textContent="AGUARDANDO PIX";
 layoutMode("PIX");
 startTetris();mobilePixOrder();
 var p=basePayment();p.type="CREATE_PIX";post(p);
 try{E.pixArea.scrollIntoView({behavior:"smooth",block:"nearest"})}catch(_){}
}
function renderQr(code,qrSource){
 var c=safe(code);S.pixCode=c;E.pixCode.value=c;E.copy.disabled=!c;stopTetris();E.tetrisWrap.classList.add("hidden");E.qr.innerHTML="";
 var source=safe(qrSource);
 if(source&&(/^data:image/i.test(source)||/^https?:\/\//i.test(source))){var img=document.createElement("img");img.src=source;img.alt="QR Code Pix";E.qr.appendChild(img);return}
 if(c&&typeof QRCode!=="undefined"){try{new QRCode(E.qr,{text:c,width:195,height:195,correctLevel:QRCode.CorrectLevel.M});return}catch(_){}}
 E.tetrisWrap.classList.remove("hidden");startTetris()
}
function copyPix(){
 if(!S.pixCode)return;
 function done(){E.copy.textContent="Código Pix copiado";setTimeout(function(){E.copy.textContent="Copiar código Pix"},1400)}
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(S.pixCode).then(done).catch(function(){fallback(done)})}else fallback(done)
}
function fallback(done){var t=document.createElement("textarea");t.value=S.pixCode;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();try{document.execCommand("copy")}catch(_){}document.body.removeChild(t);done()}

/* CARTÃO */
function restoreCardDesktop(){
 if(!E.cardLeft||!E.cardRight)return;
 if(window.innerWidth>680){
   var grid=E.cardLeft.parentElement;
   if(E.cardRight.parentElement!==grid)grid.appendChild(E.cardRight);
   if(E.cardPaymentNotice&&E.cardPaymentNotice.parentElement!==E.cardLeft)E.cardLeft.appendChild(E.cardPaymentNotice);
 }
}
function mobileCardOrder(){
 if(window.innerWidth>680){restoreCardDesktop();return}
 var list=E.cardSelected&&E.cardSelected.parentElement;
 if(!list)return;

 /* Ordem mobile aprovada:
    Cartão selecionado -> cartão/formulário/Pagar -> informações -> Pix -> demais métodos. */
 if(E.cardRight)list.insertBefore(E.cardRight,E.cardSelected.nextSibling);
 if(E.cardPaymentNotice){
   if(E.pixFromCard&&E.pixFromCard.parentElement===list)list.insertBefore(E.cardPaymentNotice,E.pixFromCard);
   else list.appendChild(E.cardPaymentNotice);
 }
}
function applySavedCardMode(useSaved){
 S.useSavedCard=Boolean(useSaved&&S.savedCard&&S.savedCard.existe===true);
 if(S.useSavedCard){
   E.cardForm.classList.add("useSavedCard");E.savedCardBanner.classList.remove("hidden");E.savedCardAction.textContent="Trocar cartão";
   var c=S.savedCard,last=digits(c.cardLastFour).slice(-4),m=digits(c.cardExpirationMonth).padStart(2,"0").slice(-2),y=digits(c.cardExpirationYear).slice(-2);
   E.savedCardMeta.textContent=(safe(c.cardBrand)||"CARTÃO")+" •••• "+last+"  |  "+m+"/"+y;
   var savedLabel=safe(c.cardBrand).toUpperCase(),savedInfo={key:"default",label:safe(c.cardBrand)||"CARTÃO",variants:1};
   if(savedLabel.indexOf("VISA")>=0)savedInfo={key:"visa",label:"VISA",variants:4};
   else if(savedLabel.indexOf("MASTER")>=0)savedInfo={key:"mastercard",label:"MASTERCARD",variants:3};
   else if(savedLabel.indexOf("ELO")>=0)savedInfo={key:"elo",label:"elo",variants:3};
   else if(savedLabel.indexOf("AMEX")>=0||savedLabel.indexOf("AMERICAN")>=0)savedInfo={key:"amex",label:"AMERICAN EXPRESS",variants:2};
   else if(savedLabel.indexOf("HIPER")>=0)savedInfo={key:"hipercard",label:"Hipercard",variants:1};
   else if(savedLabel.indexOf("DINERS")>=0)savedInfo={key:"diners",label:"DINERS CLUB",variants:2};
   else if(savedLabel.indexOf("DISCOVER")>=0)savedInfo={key:"discover",label:"DISCOVER",variants:2};
   else if(savedLabel.indexOf("JCB")>=0)savedInfo={key:"jcb",label:"JCB",variants:1};
   else if(savedLabel.indexOf("UNION")>=0)savedInfo={key:"unionpay",label:"UNIONPAY",variants:2};
   var savedVisual=E.visualNumber.closest(".visualCard");if(savedVisual){savedVisual.dataset.brand=savedInfo.key;savedVisual.dataset.variant=cardVariant(last,savedInfo)}
   E.visualBrand.textContent=savedInfo.label;E.visualNumber.textContent="•••• •••• •••• "+last;E.visualName.textContent=safe(c.cardHolderName).toUpperCase()||"SEU NOME";E.visualExpiry.textContent=(m||"MM")+"/"+(y||"AA");
   if(!digits(E.cardDocument.value)&&digits(c.cardDocument))E.cardDocument.value=digits(c.cardDocument);
   E.cardSubmit.textContent="Pagar com cartão salvo";
 }else{
   E.cardForm.classList.remove("useSavedCard");
   if(S.savedCard&&S.savedCard.existe===true){E.savedCardBanner.classList.remove("hidden");E.savedCardAction.textContent="Usar cartão salvo"}else E.savedCardBanner.classList.add("hidden");
   E.cardSubmit.textContent=S.savedCard&&S.savedCard.existe===true?"Pagar com novo cartão":"Pagar com cartão";updateVisual();
 }
 layoutMode("CARD");
}

function openCard(){
 selectPaymentMethod("CARD");
 restoreDesktopOrder();

 /* Aproveita os dados já informados no checkout. */
 if(!safe(E.cardName.value)&&safe(E.name.value||S.ctx.nome))E.cardName.value=safe(E.name.value||S.ctx.nome);
 if(!digits(E.cardDocument.value)&&cpf(E.cpf.value||S.ctx.cpfCnpj))E.cardDocument.value=cpf(E.cpf.value||S.ctx.cpfCnpj);

 E.normal.classList.add("hidden");E.cardMode.classList.remove("hidden");setAlert(E.cardAlert,"","");
 applySavedCardMode(Boolean(S.savedCard&&S.savedCard.existe===true));

 /* Navegadores podem aplicar o cartão salvo alguns instantes após o formulário aparecer. */
 [120,350,800,1500].forEach(function(ms){setTimeout(function(){if(!S.useSavedCard)updateVisual()},ms)});

 mobileCardOrder();
 try{E.cardSelected.scrollIntoView({behavior:"smooth",block:"start"})}catch(_){}
}
function cardBrandInfo(v){
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
}
function fillInstallments(){E.installments.innerHTML="";var amount=Number(S.ctx.valor||S.ctx.price||0);for(var i=1;i<=12;i++){var o=document.createElement("option");o.value=i;o.textContent=i+"x de "+money(amount/i);E.installments.appendChild(o)}}
function luhn(v){var n=digits(v),sum=0,alt=false;if(n.length<13||n.length>19)return false;for(var i=n.length-1;i>=0;i--){var d=Number(n[i]);if(alt){d*=2;if(d>9)d-=9}sum+=d;alt=!alt}return sum%10===0}
function submitCard(ev){
 ev.preventDefault();if(S.cardBusy)return;
 if(S.useSavedCard&&S.savedCard&&S.savedCard.existe===true){
   S.cardBusy=true;E.cardSubmit.disabled=true;setAlert(E.cardAlert,"info","Processando seu cartão salvo...");
   var saved=basePayment();saved.type="CREATE_CARD";saved.useSavedPaymentMethod=true;saved.cardDocument=digits(S.savedCard.cardDocument||E.cardDocument.value||S.ctx.cpfCnpj);saved.installments=Number(E.installments.value||1);post(saved);return;
 }
 var number=digits(E.cardNumber.value),month=digits(E.cardMonth.value).padStart(2,"0").slice(-2),year=digits(E.cardYear.value),cvv=digits(E.cardCvv.value),name=safe(E.cardName.value).replace(/\s+/g," "),doc=digits(E.cardDocument.value);
 if(!luhn(number)){setAlert(E.cardAlert,"error","Número do cartão inválido.");return}
 if(!/^(0[1-9]|1[0-2])$/.test(month)){setAlert(E.cardAlert,"error","Mês inválido.");return}
 if(!/^\d{2}(\d{2})?$/.test(year)){setAlert(E.cardAlert,"error","Ano inválido.");return}
 if(!/^\d{3,4}$/.test(cvv)){setAlert(E.cardAlert,"error","CVV inválido.");return}
 if(name.length<3){setAlert(E.cardAlert,"error","Informe o nome impresso no cartão.");return}
 if(doc.length!==11&&doc.length!==14){setAlert(E.cardAlert,"error","Informe o CPF/CNPJ do portador.");return}
 S.cardBusy=true;E.cardSubmit.disabled=true;setAlert(E.cardAlert,"info","Processando cartão com segurança...");
 var p=basePayment();p.type="CREATE_CARD";p.card={number:number,month:month,year:year,cvv:cvv,name:name};p.cardDocument=doc;p.installments=Number(E.installments.value||1);post(p)
}
function resetCard(){S.cardBusy=false;E.cardSubmit.disabled=false;E.cardCvv.value=""}
function celebratePayment(){
 var old=document.getElementById("paymentCelebrationCanvas");if(old)old.remove();
 var canvas=document.createElement("canvas");canvas.id="paymentCelebrationCanvas";
 canvas.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;";
 document.body.appendChild(canvas);
 var ctx=canvas.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2),w=0,h=0,particles=[],raf=0,start=performance.now();
 function resize(){w=window.innerWidth;h=window.innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
 resize();
 var raw=safe(S.ctx.tipoProduto||"MEDIDAS").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s-]+/g,"_");
 var mode=raw==="GRAFICOS"?2:raw==="PROJETO_COMPLETO"?3:1;
 var colors=mode===1?["#159447","#88d49f","#ffffff","#f0c84b"]:mode===2?["#159447","#77c8ff","#ffffff","#a78bfa"]:["#159447","#f1c84b","#ffffff","#ff8a65","#80cbc4"];
 function add(x,y,vx,vy,size,life,shape){particles.push({x:x,y:y,vx:vx,vy:vy,size:size,life:life,max:life,rot:Math.random()*6.28,vr:(Math.random()-.5)*.22,color:colors[(Math.random()*colors.length)|0],shape:shape||0})}
 function burst(x,y,count,power){for(var i=0;i<count;i++){var a=Math.random()*Math.PI*2,s=power*(.45+Math.random()*.75);add(x,y,Math.cos(a)*s,Math.sin(a)*s-(Math.random()*1.5),4+Math.random()*6,80+Math.random()*40,i%3)}}
 if(mode===1){
   burst(w*.5,h*.42,88,6.2);
   for(var i=0;i<28;i++){add(0,h*.68,3+Math.random()*4,-5-Math.random()*4,4+Math.random()*5,95+Math.random()*30,i%3);add(w,h*.68,-3-Math.random()*4,-5-Math.random()*4,4+Math.random()*5,95+Math.random()*30,i%3)}
 }else if(mode===2){
   for(var j=0;j<95;j++){add(Math.random()*w,-20-Math.random()*h*.28,(Math.random()-.5)*1.8,2.2+Math.random()*3.8,3+Math.random()*5,120+Math.random()*60,j%2)}
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.38,54,5.2)},260);
 }else{
   burst(w*.28,h*.38,62,6.8);burst(w*.72,h*.38,62,6.8);
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.30,96,7.6)},240);
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.48,70,6.4)},520);
 }
 function draw(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;if(p.shape===1){ctx.fillRect(-p.size*.7,-p.size*.18,p.size*1.4,p.size*.36)}else if(p.shape===2){ctx.beginPath();ctx.arc(0,0,p.size*.46,0,Math.PI*2);ctx.fill()}else{ctx.fillRect(-p.size*.45,-p.size*.45,p.size*.9,p.size*.9)}ctx.restore()}
 function frame(now){ctx.clearRect(0,0,w,h);for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.life--;p.vy+=mode===2?.045:.085;p.vx*=.992;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;draw(p);if(p.life<=0||p.y>h+80)particles.splice(i,1)}if((particles.length&&now-start<4200)||now-start<900){raf=requestAnimationFrame(frame)}else{cancelAnimationFrame(raf);canvas.remove()}}
 raf=requestAnimationFrame(frame);
 setTimeout(function(){if(canvas.isConnected){cancelAnimationFrame(raf);canvas.remove()}},4700)
}
function showSuccess(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.already.classList.add("hidden");E.success.classList.remove("hidden");setStep(3);layoutMode("SUCCESS");post({type:"PAYMENT_CELEBRATION",tipoProduto:S.ctx.tipoProduto||"MEDIDAS"})}
function showAlready(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.success.classList.add("hidden");E.already.classList.remove("hidden");setStep(3);layoutMode("SUCCESS")}

E.img.addEventListener("error",function(){E.img.classList.add("hidden");E.fallback.classList.remove("hidden")});
E.country.addEventListener("change",function(){E.countryConfirm.value=this.value;E.phone.value=formatPhone(E.phone.value,countryInfo(E.country).ddi);E.phoneConfirm.value="";syncIdentityButton()});
E.countryConfirm.addEventListener("change",function(){E.country.value=this.value;E.phone.value=formatPhone(E.phone.value,countryInfo(E.country).ddi);E.phoneConfirm.value="";syncIdentityButton()});
E.phone.addEventListener("input",function(){this.value=formatPhone(this.value,countryInfo(E.country).ddi);syncIdentityButton()});
E.phoneConfirm.addEventListener("input",function(){this.value=formatPhone(this.value,countryInfo(E.countryConfirm).ddi);syncIdentityButton()});
E.name.addEventListener("input",syncIdentityButton);
E.cpf.addEventListener("input",function(){this.value=formatCpf(this.value);syncIdentityButton()});
E.email.addEventListener("input",syncIdentityButton);
E.email2.addEventListener("input",syncIdentityButton);
E.identityBtn.addEventListener("click",function(){if(S.saving||!validateIdentity())return;S.saving=true;syncIdentityButton();setAlert(E.identityAlert,"info","Salvando seus dados...");post(customerPayload())});
syncIdentityButton();
E.pix.addEventListener("click",openPix);E.pixFromCard.addEventListener("click",openPix);E.card.addEventListener("click",openCard);E.copy.addEventListener("click",copyPix);
$("identityBack").onclick=$("paymentBack").onclick=$("alreadyBack").onclick=function(){post({type:"BACK"})};
E.cardForm.addEventListener("submit",submitCard);
E.savedCardAction.addEventListener("click",function(){if(!S.savedCard)return;applySavedCardMode(!S.useSavedCard);});
E.cardNumber.addEventListener("input",function(){this.value=formatCard(this.value);updateVisual()});
E.cardMonth.addEventListener("input",function(){this.value=digits(this.value).slice(0,2);updateVisual();if(this.value.length===2)E.cardYear.focus()});
E.cardYear.addEventListener("input",function(){this.value=digits(this.value).slice(0,4);updateVisual();if(this.value.length===2||this.value.length===4)E.cardCvv.focus()});
E.cardCvv.addEventListener("input",function(){this.value=digits(this.value).slice(0,4)});
E.cardName.addEventListener("input",updateVisual);
[E.cardNumber,E.cardMonth,E.cardYear,E.cardName].forEach(function(node){
 node.addEventListener("change",updateVisual);
 node.addEventListener("blur",updateVisual);
});
E.cardDocument.addEventListener("input",function(){this.value=digits(this.value).slice(0,14)});

window.addEventListener("message",function(event){
 var d=incoming(event.data),type=safe(d.type||d.tipo||d.action).toUpperCase();if(!type)return;
 if(type==="PROJECT_META"){
 if(d.titulo){S.ctx.titulo=safe(d.titulo);E.title.textContent=stageDisplayTitle(S.ctx.titulo,S.ctx.tipoProduto||d.tipoProduto,S.ctx.codigoProjeto||d.codigoProjeto)}
 var projectImage=safe(d.imagem);
 if(projectImage){S.ctx.imagem=projectImage;S.ctx.img=projectImage;E.img.src=projectImage;E.img.classList.remove("hidden");E.fallback.classList.add("hidden")}
 layoutMode(CURRENT_LAYOUT_MODE);
 return
}
if(type==="SAVED_CARD"){S.savedCard=d.existe===true?{...d,existe:true}:null;if(!E.cardMode.classList.contains("hidden"))applySavedCardMode(Boolean(S.savedCard));return}
if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});var boot=$("checkoutBoot"),main=$("checkoutMain");if(boot)boot.classList.add("hidden");if(main)main.style.display="block";document.body.style.visibility="visible";setStep(1);if(d.skipIdentity===true){S.paymentReady=false;showPayment()}else{layoutMode("INITIAL")}return}
 if(["CUSTOMER_READY","DATA_SAVED","PAYMENT_READY","SHOW_PAYMENT"].indexOf(type)>=0){
   if(d.ok===false){S.saving=false;E.identityBtn.disabled=false;setAlert(E.identityAlert,"error",safe(d.error)||"Não foi possível salvar os dados.");return}
   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);if(d.nome)S.ctx.nome=safe(d.nome);if(d.email)S.ctx.email=email(d.email);if(d.cpfCnpj)S.ctx.cpfCnpj=digits(d.cpfCnpj);showPayment();return
 }
 if(type==="CUSTOMER_RESULT"){if(d.ok===false){S.saving=false;E.identityBtn.disabled=false;setAlert(E.identityAlert,"error",safe(d.error)||"Não foi possível salvar os dados.")}else if(d.ok===true){if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);showPayment()}return}
 if(type==="ALREADY_PURCHASED"){showAlready();return}
 if(type==="PIX_LOADING"){E.pixArea.classList.remove("hidden");E.pixStatus.className="pixStatus";E.pixStatusText.textContent="AGUARDANDO PIX";if(!S.tetris)startTetris();return}
 if(type==="PIX_RESULT"){
   var code=safe(d.emv||d.copyPaste||d.pixCode||d.brCode)||deepPixValue(d);
   var qrSource=safe(d.qrCode)||deepQrValue(d);
   if(code||qrSource)renderQr(code,qrSource);
   E.pixStatus.className=d.approved===true?"pixStatus approved":"pixStatus";
   E.pixStatusText.textContent=d.approved===true?"PAGAMENTO APROVADO":"AGUARDANDO PIX";
   if(d.approved===true)showSuccess();return
 }
 if(type==="PIX_STATUS"){
   if(d.approved===true){showSuccess();return}
   if(d.ok===false&&!d.processing&&!d.recoverable){E.pixStatus.className="pixStatus error";E.pixStatusText.textContent="NÃO FOI POSSÍVEL GERAR O PIX";stopTetris()}
   else{E.pixStatus.className="pixStatus";E.pixStatusText.textContent="AGUARDANDO PIX";if(!S.pixCode&&!S.tetris)startTetris()}
   return
 }
 if(type==="PIX_APPROVED"){showSuccess();return}
 if(type==="CARD_LOADING"){S.cardBusy=true;E.cardSubmit.disabled=true;setAlert(E.cardAlert,"info",safe(d.message)||"Processando cartão com segurança...");return}
 if(type==="CARD_RESULT"){if(d.approved===true||d.accepted===true){setAlert(E.cardAlert,"success",d.approved===true?"Pagamento aprovado.":(d.paymentApproved===true?"Pagamento aprovado. Preparando sua entrega...":"Pagamento recebido. Aguardando confirmação..."));E.cardCvv.value="";if(d.approved===true)showSuccess()}else{resetCard();if(S.useSavedCard&&safe(d.error).toLowerCase().includes("salvo"))applySavedCardMode(false);setAlert(E.cardAlert,"error",safe(d.error)||"Não foi possível processar o cartão.")}return}
});

if(typeof ResizeObserver!=="undefined"){
  try{
    var checkoutObservedWrap=document.querySelector(".wrap");
    var checkoutHeightObserver=new ResizeObserver(function(){
      clearTimeout(HEIGHT_TIMER);
      HEIGHT_TIMER=setTimeout(emitCheckoutHeight,80);
    });
    if(checkoutObservedWrap)checkoutHeightObserver.observe(checkoutObservedWrap);
  }catch(_){}
}

window.addEventListener("load",function(){
  layoutMode("INITIAL");
});

post({type:"READY",version:"HTML36_SOCIAL_MINIMAL_DATA"});
})();
</script>
</body>
</html>`;


function pelegoCelebrateFullScreen(tipoProduto) {
  try {
    const old = document.getElementById('pelegoPaymentCelebrationFullScreen');
    if (old) old.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'pelegoPaymentCelebrationFullScreen';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;margin:0;padding:0;';
    (document.body || document.documentElement).appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    let h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const raw = String(tipoProduto || 'MEDIDAS')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[\s-]+/g, '_');
    const mode = raw === 'GRAFICOS' ? 2 : raw === 'PROJETO_COMPLETO' ? 3 : 1;
    const palettes = {
      1: ['#159447', '#7dd89b', '#ffffff', '#f4c84b', '#e8f7ed'],
      2: ['#159447', '#48b8ff', '#ffffff', '#8b7cf6', '#73e1d2'],
      3: ['#159447', '#ffd24d', '#ffffff', '#ff7b5c', '#58c7c7', '#c67cff']
    };
    const colors = palettes[mode];
    const particles = [];
    const start = performance.now();
    const duration = 1850;
    let raf = 0;

    function add(x, y, vx, vy, size, life, shape) {
      particles.push({
        x, y, vx, vy, size, life, max: life,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.26,
        color: colors[(Math.random() * colors.length) | 0],
        shape: shape || 0
      });
    }

    function burst(x, y, count, power, upward) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = power * (0.45 + Math.random() * 0.8);
        add(
          x, y,
          Math.cos(a) * speed,
          Math.sin(a) * speed - (upward || 0),
          5 + Math.random() * 7,
          70 + Math.random() * 45,
          i % 3
        );
      }
    }

    function rain(count) {
      for (let i = 0; i < count; i++) {
        add(
          Math.random() * w,
          -20 - Math.random() * h * 0.28,
          (Math.random() - 0.5) * 1.8,
          2.5 + Math.random() * 3.4,
          4 + Math.random() * 6,
          85 + Math.random() * 45,
          i % 3
        );
      }
    }

    if (mode === 1) {
      burst(w * 0.50, h * 0.46, 135, 8.2, 1.6);
      burst(w * 0.10, h * 0.72, 55, 6.8, 4.2);
      burst(w * 0.90, h * 0.72, 55, 6.8, 4.2);
    } else if (mode === 2) {
      rain(190);
      burst(w * 0.18, h * 0.38, 60, 6.6, 1.4);
      burst(w * 0.82, h * 0.38, 60, 6.6, 1.4);
    } else {
      burst(w * 0.50, h * 0.84, 150, 10.2, 7.0);
      burst(w * 0.18, h * 0.70, 75, 7.8, 5.3);
      burst(w * 0.82, h * 0.70, 75, 7.8, 5.3);
      rain(80);
    }

    function draw(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      if (p.shape === 1) {
        ctx.fillRect(-p.size * 0.8, -p.size * 0.18, p.size * 1.6, p.size * 0.36);
      } else if (p.shape === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size * 0.48, -p.size * 0.48, p.size * 0.96, p.size * 0.96);
      }
      ctx.restore();
    }

    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 1.35;
        p.vy += mode === 2 ? 0.055 : 0.105;
        p.vx *= 0.994;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        draw(p);
        if (p.life <= 0 || p.y > h + 100) particles.splice(i, 1);
      }

      if (now - start < duration && particles.length) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }

    raf = requestAnimationFrame(frame);
    setTimeout(() => {
      if (canvas.isConnected) {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }, 2200);
  } catch (error) {
    console.warn('Falha na celebração fullscreen:', error?.message || error);
  }
}

class PelegoCheckoutPronto extends HTMLElement {
  static get observedAttributes() { return ["checkout-message"]; }
  constructor() {
    super();
    this._frame = null;
    this._mounted = false;
    this._pending = null;
    this._frameReady = false;
    this._appliedHeight = 0;
    this._windowHandler = this._onWindowMessage.bind(this);
  }
  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;
    this._frameReady = false;
    this.style.display = "block";
    // O Wix pode publicar o slot do Custom Element com largura intrínseca estreita.
    // No site publicado, usamos a viewport real para o checkout não cair no CSS mobile no desktop.
    /* Desktop largo; mobile limitado e centralizado. */
    if (window.innerWidth <= 680) {
      const slotWidth = this.getBoundingClientRect().width || this.offsetWidth || 300;
      const targetWidth = Math.min(360, Math.max(300, window.innerWidth - 12));
      this.style.width = `${targetWidth}px`;
      this.style.maxWidth = `${targetWidth}px`;
      this.style.marginLeft = `${Math.round((slotWidth - targetWidth) / 2)}px`;
    } else {
      this.style.width = "min(1000px, calc(100vw - 24px))";
      this.style.maxWidth = "1000px";
      this.style.marginLeft = "0";
    }
    this.style.minWidth = "0";
    this.style.height = "220px";
    this.style.boxSizing = "border-box";
    this.style.overflow = "hidden";
    this.style.background = "transparent";
    this.style.transition = "none";
    const frame = document.createElement("iframe");
    frame.title = "Checkout Pelego Box";
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("frameborder", "0");
    frame.style.cssText = "display:block;width:100%;height:220px;border:0;margin:0;padding:0;overflow:hidden;background:transparent";
    this.replaceChildren(frame);
    this._frame = frame;
    window.addEventListener("message", this._windowHandler);

    let checkoutMounted = false;
    const mountCheckout = () => {
      if (checkoutMounted) return;
      const doc = frame.contentDocument;
      if (!doc) return;
      checkoutMounted = true;
      doc.open();
      doc.write(CHECKOUT_HTML);
      doc.close();
      setTimeout(() => this._flush(), 0);
    };

    frame.addEventListener("load", mountCheckout, { once: true });
    frame.src = "about:blank";
    setTimeout(mountCheckout, 0);
  }
  disconnectedCallback() {
    window.removeEventListener("message", this._windowHandler);
    this._mounted = false;
    this._frameReady = false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== "checkout-message" || !newValue || oldValue === newValue) return;
    try { this.sendToCheckout(JSON.parse(newValue)); }
    catch (e) { console.error("PELEGO CUSTOM: mensagem Wix inválida", e); }
  }
  sendToCheckout(data) {
    if (!data || typeof data !== "object") return;

    /*
      Não joga INIT dentro do about:blank. Antes isso podia perder a primeira
      mensagem quando a página era rápida demais. Guardamos o último payload
      até o HTML interno avisar READY.
    */
    if (!this._frameReady) {
      this._pending = data;
      return;
    }

    if (this._frame?.contentWindow) {
      try { this._frame.contentWindow.postMessage(data, "*"); return; }
      catch (_) {}
    }
    this._pending = data;
  }
  _flush() {
    if (!this._pending) return;
    const data = this._pending;
    this._pending = null;
    this.sendToCheckout(data);
  }
  _normalize(raw) {
    let data = raw;
    if (typeof data === "string") {
      try { data = JSON.parse(data); }
      catch (_) { data = { type: data }; }
    }
    if (data?.data && typeof data.data === "object" && !data.type) data = data.data;
    return data && typeof data === "object" ? data : {};
  }
  _height(value) {
    const requested = Math.ceil(Number(value || 0));
    if (!Number.isFinite(requested) || requested <= 0) return;
    const height = Math.max(180, Math.min(2300, requested + 2));
    if (Math.abs(height - this._appliedHeight) <= 1) return;
    this._appliedHeight = height;
    const css = `${height}px`;
    this.style.height = css;
    this.style.minHeight = css;
    this.style.maxHeight = css;
    if (this._frame) this._frame.style.height = css;
    this.dispatchEvent(new CustomEvent("checkout-height-change", { detail: { height }, bubbles: true, composed: true }));
  }
  _onWindowMessage(event) {
    if (!this._frame?.contentWindow || event.source !== this._frame.contentWindow) return;
    const data = this._normalize(event.data);
    const type = String(data.type || data.tipo || data.action || "").trim().toUpperCase();
    if (type === "PAYMENT_CELEBRATION") { pelegoCelebrateFullScreen(data.tipoProduto || data.productType || "MEDIDAS"); return; }
    if (type === "READY") {
      this._frameReady = true;
      this._flush();
    }
    if (type === "CHECKOUT_LAYOUT") { this._height(data.height); return; }
    this.dispatchEvent(new CustomEvent("checkout-message", { detail: data, bubbles: true, composed: true }));
  }
}
if (!customElements.get("pelego-checkout-pronto")) {
  customElements.define("pelego-checkout-pronto", PelegoCheckoutPronto);
}

/* COUNTRY_SELECTORS_SYNCED_V2 */
