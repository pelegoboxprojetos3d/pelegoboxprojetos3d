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
  '    const paymentMode = modeKey === "PIX" || modeKey === "CARD";',
  '    // PAYMENT é a transição logo após preencher/confirmar os dados. Ela também não pode deslocar a página.\n    const paymentMode = modeKey === "PAYMENT" || modeKey === "PIX" || modeKey === "CARD";',
  "preservar posição também na transição para pagamento"
);

if (text.includes('E.pixArea.scrollIntoView')) {
  throw new Error("scrollIntoView do PIX reapareceu.");
}
if (text.includes('E.cardSelected.scrollIntoView')) {
  throw new Error("scrollIntoView do cartão reapareceu.");
}
if (!text.includes('const preserveScroll = paymentMode;')) {
  throw new Error("Proteção de scroll do redimensionamento não está presente.");
}

fs.writeFileSync(path, text);
console.log("OK: identificação -> pagamento -> PIX/CARTÃO mantém a posição da página e o stepper visível.");
