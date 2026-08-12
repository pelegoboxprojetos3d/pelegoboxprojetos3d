const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const marker = "function perfilMembroFrontend(membro = {}) {";

let code = fs.readFileSync(PAGE, "utf8");
let alterou = false;

while (true) {
  const first = code.indexOf(marker);
  if (first < 0) {
    throw new Error("Bloco perfilMembroFrontend não encontrado.");
  }

  const second = code.indexOf(marker, first + marker.length);
  if (second < 0) break;

  /*
    O script de login social antigo podia inserir o mesmo bloco novamente.
    Mantemos somente a cópia mais recente, que contém a regra oficial atual.
  */
  code = code.slice(0, first) + code.slice(second);
  alterou = true;
}

if (alterou) {
  fs.writeFileSync(PAGE, code, "utf8");
  console.log("Duplicação do bloco de login social removida.");
} else {
  console.log("Login social sem duplicação.");
}
