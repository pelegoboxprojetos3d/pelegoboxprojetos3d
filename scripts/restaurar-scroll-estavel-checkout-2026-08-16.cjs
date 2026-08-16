const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

// 1) Remove a tentativa recente de lock pré-layout. Ela não existia na versão
// anterior ao commit que introduziu o scroll universal do Custom Element.
text = text.replace(
  /\/\* CHECKOUT_PRE_LAYOUT_SCROLL_LOCK_V1[\s\S]*?function beginLayoutChange\(mode\)\{[\s\S]*?\n\}\n\nvar CURRENT_LAYOUT_MODE=/,
  "var CURRENT_LAYOUT_MODE="
);

text = text
  .replace(/\s*beginLayoutChange\("PAYMENT"\);/g, "")
  .replace(/\s*beginLayoutChange\("PIX"\);/g, "")
  .replace(/\s*beginLayoutChange\("CARD"\);/g, "");

// 2) Remove os métodos adicionados para forçar/restaurar scroll e volta à
// lógica de altura que existia imediatamente antes do commit ff75f169...
const helpersStart = text.indexOf("  _captureLayoutScroll(data = {}) {");
const heightStart = text.indexOf('  _height(value, mode = "") {');
if (helpersStart >= 0 && heightStart > helpersStart) {
  text = text.slice(0, helpersStart) + text.slice(heightStart);
}

const start = text.indexOf('  _height(value, mode = "") {');
const end = text.indexOf("  _onWindowMessage(event) {", start);
if (start < 0 || end < 0) throw new Error("Bloco _height/_onWindowMessage não encontrado.");

const stableHeight = `  _height(value, mode = "") {
    const requested = Math.ceil(Number(value || 0));
    if (!Number.isFinite(requested) || requested <= 0) return;
    const height = Math.max(180, Math.min(2300, requested + 2));
    if (Math.abs(height - this._appliedHeight) <= 1) return;

    /*
      Comportamento estável anterior ao scroll universal:
      o Custom Element apenas ajusta a própria altura.
      Ele NÃO chama scrollIntoView e NÃO manda a página para o topo.
      No cartão, preserva a posição durante o crescimento do iframe.
    */
    const preserveScroll = String(mode || "").trim().toUpperCase() === "CARD";
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    this._appliedHeight = height;
    const css = \`${"${height}"}px\`;
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
  }
`;

text = text.slice(0, start) + stableHeight + text.slice(end);

// 3) CHECKOUT_LAYOUT_BEGIN deixa de existir. Se sobrou algum handler por uma
// versão intermediária, removemos para não deixar código morto interferindo.
text = text.replace(/\n\s*if \(type === "CHECKOUT_LAYOUT_BEGIN"\) \{[^\n]*\n?/g, "\n");

// 4) Mantém a melhoria correta das tentativas anteriores: Pix e Cartão não
// fazem scroll interno para a própria área.
text = text
  .replace(/\s*try\{E\.pixArea\.scrollIntoView\([^\n]*\}\s*catch\(_\)\{\}/g, "")
  .replace(/\s*try\{E\.cardSelected\.scrollIntoView\([^\n]*\}\s*catch\(_\)\{\}/g, "");

// Guardas: nenhuma chamada capaz de jogar o Custom Element para o topo pode
// permanecer no código executável.
if (text.includes("this._scrollCheckoutToTop()")) {
  throw new Error("Ainda existe chamada _scrollCheckoutToTop().");
}
if (text.includes("this.scrollIntoView({ behavior: \"smooth\", block: \"start\"")) {
  throw new Error("Ainda existe scrollIntoView do Custom Element.");
}
if (text.includes("E.pixArea.scrollIntoView") || text.includes("E.cardSelected.scrollIntoView")) {
  throw new Error("Ainda existe scrollIntoView interno de Pix/Cartão.");
}

fs.writeFileSync(path, text);
console.log("OK: restaurada a lógica de altura anterior ao scroll universal; Pix/Cartão permanecem sem scrollIntoView.");
