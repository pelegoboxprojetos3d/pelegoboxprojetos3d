const fs = require("fs");

const caminho = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let codigo = fs.readFileSync(caminho, "utf8");
let alterou = false;

const inicio = "function montarTituloPagina(";
const fim = "\n\nfunction montarTituloCheckout(";

const posInicio = codigo.indexOf(inicio);
const posFim = codigo.indexOf(fim, posInicio);

if (posInicio < 0 || posFim < 0) {
  throw new Error("Não encontrei a função montarTituloPagina na página de entrega.");
}

const regraNova = `function montarTituloPagina(projeto) {
  /*
    O título da página de entrega vem diretamente da coluna titulo.
    Não acrescenta código, não remove prefixo e não altera maiúsculas/minúsculas.
  */
  return safe(projeto?.titulo);
}`;

const atual = codigo.slice(posInicio, posFim);
if (atual !== regraNova) {
  codigo = codigo.slice(0, posInicio) + regraNova + codigo.slice(posFim);
  alterou = true;
}

const sessaoAntiga = `  const sessao =\n    dados.session;\n\n`;
if (codigo.includes(sessaoAntiga)) {
  codigo = codigo.replace(sessaoAntiga, "");
  alterou = true;
}

const chamadaAntiga = `    montarTituloPagina(\n      projeto,\n      sessao\n    );`;
const chamadaNova = `    montarTituloPagina(\n      projeto\n    );`;

if (codigo.includes(chamadaAntiga)) {
  codigo = codigo.replace(chamadaAntiga, chamadaNova);
  alterou = true;
}

if (!codigo.includes("return safe(projeto?.titulo);")) {
  throw new Error("A regra de título original não foi aplicada.");
}

if (alterou) {
  fs.writeFileSync(caminho, codigo, "utf8");
  console.log("Título da entrega agora usa diretamente a coluna titulo.");
} else {
  console.log("Título da entrega já usa diretamente a coluna titulo.");
}
