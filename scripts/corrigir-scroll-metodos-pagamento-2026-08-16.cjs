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
  '  var modeChanged = Boolean(modeKey && modeKey !== this._lastLayoutMode);\n  if (modeKey) this._lastLayoutMode = modeKey;',
  '  var modeChanged = Boolean(modeKey && modeKey !== this._lastLayoutMode);\n  const paymentMode = modeKey === "PIX" || modeKey === "CARD";\n  if (modeKey) this._lastLayoutMode = modeKey;',
  "detectar modo PIX/CARD"
);

replaceOnce(
  '    if (Math.abs(height - this._appliedHeight) <= 1) {\n      if (modeChanged) this._scrollCheckoutToTop();\n      return;\n    }',
  '    if (Math.abs(height - this._appliedHeight) <= 1) {\n      // PIX/CARD não reposicionam a página. O stepper deve continuar visível.\n      if (modeChanged && !paymentMode) this._scrollCheckoutToTop();\n      return;\n    }',
  "não subir checkout em PIX/CARD sem mudança de altura"
);

replaceOnce(
  '    const preserveScroll = modeKey === "CARD" && !modeChanged;',
  '    // Ao abrir PIX ou CARTÃO, preserva exatamente a posição atual da página.\n    const preserveScroll = paymentMode;',
  "preservar scroll em PIX e CARD"
);

replaceOnce(
  '    if (modeChanged) {\n      this._scrollCheckoutToTop();\n    }',
  '    if (modeChanged && !paymentMode) {\n      this._scrollCheckoutToTop();\n    }',
  "não subir checkout após redimensionar PIX/CARD"
);

replaceOnce(
  ' try{E.pixArea.scrollIntoView({behavior:"smooth",block:"nearest"})}catch(_){}',
  ' /* PAGAMENTO_SEM_SALTO_SCROLL_V1: mantém o stepper visível ao abrir PIX. */',
  "remover scrollIntoView do PIX"
);

replaceOnce(
  ' try{E.cardSelected.scrollIntoView({behavior:"smooth",block:"start"})}catch(_){}',
  ' /* PAGAMENTO_SEM_SALTO_SCROLL_V1: mantém o stepper visível ao abrir CARTÃO. */',
  "remover scrollIntoView do cartão"
);

fs.writeFileSync(path, text);
console.log("OK: PIX e CARTÃO trocam apenas a área de pagamento sem deslocar a página.");
