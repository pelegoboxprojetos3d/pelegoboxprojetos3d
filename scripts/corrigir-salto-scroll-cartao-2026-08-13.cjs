const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

const oldSignature = "  _height(value) {";
const newSignature = "  _height(value, mode = \"\") {";

if (text.includes(oldSignature)) {
  text = text.replace(oldSignature, newSignature);
} else if (!text.includes(newSignature)) {
  throw new Error("Assinatura _height do checkout não encontrada.");
}

const oldResize = [
  "    this._appliedHeight = height;",
  "    const css = `${height}px`;",
  "    this.style.height = css;",
  "    this.style.minHeight = css;",
  "    this.style.maxHeight = css;",
  "    if (this._frame) this._frame.style.height = css;"
].join("\n");

const newResize = [
  "    /*",
  "      No modo CARD preservamos a posição da página durante o crescimento",
  "      do iframe. Isso impede o scroll anchoring do Chrome/Wix de empurrar",
  "      o checkout para baixo quando o formulário do cartão aparece.",
  "    */",
  "    const preserveScroll = String(mode || \"\").trim().toUpperCase() === \"CARD\";",
  "    const scrollX = window.scrollX || window.pageXOffset || 0;",
  "    const scrollY = window.scrollY || window.pageYOffset || 0;",
  "",
  "    this._appliedHeight = height;",
  "    const css = `${height}px`;",
  "    this.style.overflowAnchor = \"none\";",
  "    this.style.height = css;",
  "    this.style.minHeight = css;",
  "    this.style.maxHeight = css;",
  "",
  "    if (this._frame) {",
  "      this._frame.style.overflowAnchor = \"none\";",
  "      this._frame.style.height = css;",
  "    }",
  "",
  "    if (preserveScroll) {",
  "      const restoreScroll = () => {",
  "        try { window.scrollTo(scrollX, scrollY); } catch (_) {}",
  "      };",
  "",
  "      restoreScroll();",
  "      requestAnimationFrame(() => {",
  "        restoreScroll();",
  "        requestAnimationFrame(restoreScroll);",
  "      });",
  "      setTimeout(restoreScroll, 80);",
  "      setTimeout(restoreScroll, 180);",
  "    }"
].join("\n");

if (text.includes(oldResize)) {
  text = text.replace(oldResize, newResize);
} else if (!text.includes("const preserveScroll = String(mode || \"\").trim().toUpperCase() === \"CARD\";")) {
  throw new Error("Bloco de redimensionamento do checkout não encontrado.");
}

const oldLayout = "    if (type === \"CHECKOUT_LAYOUT\") { this._height(data.height); return; }";
const newLayout = "    if (type === \"CHECKOUT_LAYOUT\") { this._height(data.height, data.mode); return; }";

if (text.includes(oldLayout)) {
  text = text.replace(oldLayout, newLayout);
} else if (!text.includes(newLayout)) {
  throw new Error("Tratamento CHECKOUT_LAYOUT não encontrado.");
}

fs.writeFileSync(path, text);
console.log("Checkout atualizado: abrir cartão não desloca mais a página para baixo.");
