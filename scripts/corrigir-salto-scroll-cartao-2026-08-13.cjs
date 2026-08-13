const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

const oldHeight = `  _height(value) {
    const requested = Math.ceil(Number(value || 0));
    if (!Number.isFinite(requested) || requested <= 0) return;
    const height = Math.max(180, Math.min(2300, requested + 2));
    if (Math.abs(height - this._appliedHeight) <= 1) return;
    this._appliedHeight = height;
    const css = \`${height}px\`;
    this.style.height = css;
    this.style.minHeight = css;
    this.style.maxHeight = css;
    if (this._frame) this._frame.style.height = css;
    this.dispatchEvent(new CustomEvent("checkout-height-change", { detail: { height }, bubbles: true, composed: true }));
  }`;

const newHeight = `  _height(value, mode = "") {
    const requested = Math.ceil(Number(value || 0));
    if (!Number.isFinite(requested) || requested <= 0) return;
    const height = Math.max(180, Math.min(2300, requested + 2));
    if (Math.abs(height - this._appliedHeight) <= 1) return;

    /*
      Ao trocar PIX -> CARTÃO o iframe cresce bastante. Chrome/Wix pode aplicar
      scroll anchoring e deslocar a página para baixo, fazendo o topo do checkout
      sumir. No modo CARD preservamos exatamente a posição da página antes do
      redimensionamento e desativamos o elemento como âncora de rolagem.
    */
    const preserveScroll = String(mode || "").trim().toUpperCase() === "CARD";
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    this._appliedHeight = height;
    const css = \`${height}px\`;
    this.style.overflowAnchor = "none";
    this.style.height = css;
    this.style.minHeight = css;
    this.style.maxHeight = css;

    if (this._frame) {
      this._frame.style.overflowAnchor = "none";
      this._frame.style.height = css;
    }

    if (preserveScroll) {
      const restoreScroll = () => {
        try { window.scrollTo(scrollX, scrollY); } catch (_) {}
      };

      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
      setTimeout(restoreScroll, 80);
      setTimeout(restoreScroll, 180);
    }

    this.dispatchEvent(new CustomEvent("checkout-height-change", { detail: { height }, bubbles: true, composed: true }));
  }`;

if (text.includes(oldHeight)) {
  text = text.replace(oldHeight, newHeight);
} else if (!text.includes('const preserveScroll = String(mode || "").trim().toUpperCase() === "CARD";')) {
  throw new Error("Bloco _height do checkout não encontrado para correção do scroll.");
}

const oldLayout = `    if (type === "CHECKOUT_LAYOUT") { this._height(data.height); return; }`;
const newLayout = `    if (type === "CHECKOUT_LAYOUT") { this._height(data.height, data.mode); return; }`;

if (text.includes(oldLayout)) {
  text = text.replace(oldLayout, newLayout);
} else if (!text.includes('this._height(data.height, data.mode)')) {
  throw new Error("Tratamento CHECKOUT_LAYOUT não encontrado.");
}

fs.writeFileSync(path, text);
console.log("Checkout atualizado: abrir cartão não desloca mais a página para baixo.");
