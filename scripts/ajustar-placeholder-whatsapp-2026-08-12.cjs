const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";
const TARGET = 'placeholder="47988168971"';

let code = fs.readFileSync(FILE, "utf8");
let changed = false;

for (const current of [
  'placeholder="Ex: (11) 99888-7766"',
  'placeholder="Ex: 47988419261"',
  'placeholder="Ex: 47988168971"'
]) {
  if (code.includes(current)) {
    code = code.split(current).join(TARGET);
    changed = true;
  }
}

if (!changed && !code.includes(TARGET)) {
  throw new Error("Placeholder do WhatsApp não encontrado.");
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Placeholder do WhatsApp ajustado para 47988168971.");
} else {
  console.log("Placeholder do WhatsApp já está correto.");
}
