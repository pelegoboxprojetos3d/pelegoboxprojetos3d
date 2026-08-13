const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const from = `const MIN_PROCESSAMENTO_VISIVEL =\n  500;`;
const to = `const MIN_PROCESSAMENTO_VISIVEL =\n  5000;`;

if (code.includes(to)) {
  console.log("Impressora da entrega já está configurada para no mínimo 5 segundos.");
} else {
  if (!code.includes(from)) {
    throw new Error("Constante MIN_PROCESSAMENTO_VISIVEL esperada não encontrada.");
  }
  code = code.replace(from, to);
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Impressora da entrega configurada para permanecer visível por pelo menos 5 segundos.");
}
