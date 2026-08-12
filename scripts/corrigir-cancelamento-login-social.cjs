const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";

const code = fs.readFileSync(PAGE, "utf8");

const antigo = `    .catch(
      () => {
        wixLocation.to("/");
      }
    );`;

const novo = `    .catch(
      () => {
        /*
          Fechar o login social no X ou clicar fora NÃO tira o visitante
          da página do projeto. Carregamos a página normalmente, mantendo
          valores e compras bloqueados até ele tentar fazer login novamente.
        */
        iniciarPaginaComTratamento();
      }
    );`;

if (code.includes(novo)) {
  console.log("Cancelamento do login social já mantém o visitante na página.");
  process.exit(0);
}

if (!code.includes(antigo)) {
  throw new Error("Trecho do cancelamento do login social não encontrado.");
}

fs.writeFileSync(PAGE, code.replace(antigo, novo), "utf8");
console.log("Cancelamento do login social corrigido: X/clique fora mantém a página atual.");
