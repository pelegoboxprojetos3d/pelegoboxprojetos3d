const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count === 0) {
    if (text.includes(newText)) {
      console.log(`OK: ${label} já aplicado.`);
      return;
    }
    throw new Error(`Bloco não encontrado: ${label}`);
  }
  if (count !== 1) throw new Error(`Esperava 1 ocorrência em ${label}, encontrei ${count}.`);
  text = text.replace(oldText, newText);
}

replaceOnce(
  'function post(data){try{window.parent.postMessage(data,"*")}catch(_){}}',
  `function post(data){try{window.parent.postMessage(data,"*")}catch(_){}}\n\n/* CHECKOUT_PRE_LAYOUT_SCROLL_LOCK_V1\n   Captura a posição da PÁGINA PAI antes de esconder/mostrar blocos.\n   O postMessage chega depois, então mandar apenas CHECKOUT_LAYOUT era tarde demais:\n   o navegador/Wix já podia ter ancorado a rolagem em outro ponto. */\nfunction beginLayoutChange(mode){\n var sx=0,sy=0;\n try{\n  sx=Number(window.parent.scrollX||window.parent.pageXOffset||0);\n  sy=Number(window.parent.scrollY||window.parent.pageYOffset||0);\n }catch(_){}\n post({type:"CHECKOUT_LAYOUT_BEGIN",mode:String(mode||"").toUpperCase(),scrollX:sx,scrollY:sy});\n}`,
  "capturar scroll antes da mudança visual"
);

replaceOnce(
  'function showPayment(){\n if(S.paymentReady)return;',
  'function showPayment(){\n if(S.paymentReady)return;\n beginLayoutChange("PAYMENT");',
  "captura antes de identificação -> pagamento"
);

replaceOnce(
  'function openPix(){\n selectPaymentMethod("PIX");',
  'function openPix(){\n beginLayoutChange("PIX");\n selectPaymentMethod("PIX");',
  "captura antes de abrir PIX"
);

replaceOnce(
  'function openCard(){\n selectPaymentMethod("CARD");',
  'function openCard(){\n beginLayoutChange("CARD");\n selectPaymentMethod("CARD");',
  "captura antes de abrir cartão"
);

replaceOnce(
  '    this._appliedHeight = 0;\n    this._windowHandler = this._onWindowMessage.bind(this);',
  '    this._appliedHeight = 0;\n    this._layoutScrollLock = null;\n    this._windowHandler = this._onWindowMessage.bind(this);',
  "estado do scroll pré-layout"
);

replaceOnce(
  '  _scrollCheckoutToTop() {',
  `  _captureLayoutScroll(data = {}) {\n    const x = Number(data.scrollX);\n    const y = Number(data.scrollY);\n    this._layoutScrollLock = {\n      x: Number.isFinite(x) ? x : (window.scrollX || window.pageXOffset || 0),\n      y: Number.isFinite(y) ? y : (window.scrollY || window.pageYOffset || 0),\n      mode: String(data.mode || "").trim().toUpperCase(),\n      until: Date.now() + 1800\n    };\n  }\n  _restoreLayoutScroll(lock) {\n    if (!lock || Date.now() > lock.until) return;\n    const restore = () => {\n      try { window.scrollTo(lock.x, lock.y); } catch (_) {}\n    };\n    restore();\n    requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });\n    setTimeout(restore, 70);\n    setTimeout(restore, 160);\n    setTimeout(restore, 320);\n    setTimeout(restore, 650);\n    setTimeout(restore, 1050);\n  }\n  _scrollCheckoutToTop() {`,
  "métodos de lock pré-layout"
);

replaceOnce(
  '    const height = Math.max(180, Math.min(2300, requested + 2));',
  `    const height = Math.max(180, Math.min(2300, requested + 2));\n    const scrollLock = this._layoutScrollLock;\n    const lockActive = Boolean(\n      scrollLock &&\n      Date.now() <= scrollLock.until &&\n      (!scrollLock.mode || !modeKey || scrollLock.mode === modeKey)\n    );`,
  "usar posição capturada antes do layout"
);

replaceOnce(
  '    if (Math.abs(height - this._appliedHeight) <= 1) {\n      // PIX/CARD não reposicionam a página. O stepper deve continuar visível.\n      if (modeChanged && !paymentMode) this._scrollCheckoutToTop();\n      return;\n    }',
  `    if (Math.abs(height - this._appliedHeight) <= 1) {\n      if (lockActive) {\n        this._restoreLayoutScroll(scrollLock);\n        return;\n      }\n      if (modeChanged && !paymentMode) this._scrollCheckoutToTop();\n      return;\n    }`,
  "restaurar mesmo quando altura final é igual"
);

replaceOnce(
  '    const preserveScroll = paymentMode;\n    const scrollX = window.scrollX || window.pageXOffset || 0;\n    const scrollY = window.scrollY || window.pageYOffset || 0;',
  `    const preserveScroll = paymentMode || lockActive;\n    const scrollX = lockActive ? scrollLock.x : (window.scrollX || window.pageXOffset || 0);\n    const scrollY = lockActive ? scrollLock.y : (window.scrollY || window.pageYOffset || 0);`,
  "restaurar posição capturada, não a posição já deslocada"
);

replaceOnce(
  '      setTimeout(restoreScroll, 80);\n      setTimeout(restoreScroll, 180);',
  `      setTimeout(restoreScroll, 80);\n      setTimeout(restoreScroll, 180);\n      setTimeout(restoreScroll, 360);\n      setTimeout(restoreScroll, 700);\n      setTimeout(restoreScroll, 1100);`,
  "segurar posição durante reflow tardio do Wix"
);

replaceOnce(
  '    if (modeChanged && !paymentMode) {\n      this._scrollCheckoutToTop();\n    }',
  `    if (modeChanged && !paymentMode && !lockActive) {\n      this._scrollCheckoutToTop();\n    }\n    if (lockActive) {\n      const usedLock = scrollLock;\n      setTimeout(() => {\n        if (this._layoutScrollLock === usedLock) this._layoutScrollLock = null;\n      }, 1250);\n    }`,
  "não sobrescrever lock com scroll automático"
);

replaceOnce(
  '    if (type === "PAYMENT_CELEBRATION") { pelegoCelebrateFullScreen(data.tipoProduto || data.productType || "MEDIDAS"); return; }',
  '    if (type === "PAYMENT_CELEBRATION") { pelegoCelebrateFullScreen(data.tipoProduto || data.productType || "MEDIDAS"); return; }\n    if (type === "CHECKOUT_LAYOUT_BEGIN") { this._captureLayoutScroll(data); return; }',
  "receber posição pré-layout"
);

if (text.includes('E.pixArea.scrollIntoView')) throw new Error("scrollIntoView do PIX reapareceu.");
if (text.includes('E.cardSelected.scrollIntoView')) throw new Error("scrollIntoView do cartão reapareceu.");
if (!text.includes('CHECKOUT_PRE_LAYOUT_SCROLL_LOCK_V1')) throw new Error("Lock pré-layout não foi aplicado.");
if (!text.includes('type === "CHECKOUT_LAYOUT_BEGIN"')) throw new Error("Bridge do lock pré-layout não foi aplicado.");
if (!text.includes('const preserveScroll = paymentMode || lockActive;')) throw new Error("Restauração pré-layout não foi aplicada.");

fs.writeFileSync(path, text);
console.log("OK: scroll é capturado antes do reflow e restaurado após PAYMENT/PIX/CARD.");
