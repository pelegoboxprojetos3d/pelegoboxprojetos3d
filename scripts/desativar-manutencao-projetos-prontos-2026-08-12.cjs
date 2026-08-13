const fs = require("fs");

const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let code = fs.readFileSync(FILE, "utf8");

const ativo = `const MANUTENCAO_ATIVA =\n  true;`;
const liberado = `const MANUTENCAO_ATIVA =\n  false;`;

if (code.includes(liberado)) {
  console.log("Manutenção de Projetos Prontos já está desativada.");
  process.exit(0);
}

if (!code.includes(ativo)) {
  throw new Error("Não encontrei a flag MANUTENCAO_ATIVA no formato esperado.");
}

code = code.replace(ativo, liberado);
fs.writeFileSync(FILE, code, "utf8");
console.log("Manutenção desativada: /checkoutprojetosprontos liberado para visitantes.");
