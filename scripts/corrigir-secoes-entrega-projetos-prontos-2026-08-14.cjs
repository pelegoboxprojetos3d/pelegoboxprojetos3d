const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const antigo = `const SECOES_ENTREGA = {
  principal: '#imagensdoprodutobotao1e2',
  banners: '#section1',
  final: '#section2'
};`;

const novo = `const SECOES_ENTREGA = {
  // Seção 1: Repeater + impressora. Fica visível durante o processamento.
  principal: '#SESSAO1REPETIDOREIMPRESSORA',

  // Seção 2: três banners dos botões. Fica desligada enquanto a impressora roda.
  banners: '#SESSAODOISBANERSBOTAO',

  // Seção 3: aviso IMPORTANTE. Fica desligada enquanto a impressora roda.
  final: '#SESSAO3AVISOIMPORTANTE'
};`;

if (code.includes(novo)) {
  console.log("IDs das seções da entrega já estão corretos.");
  process.exit(0);
}

if (!code.includes(antigo)) {
  throw new Error("Bloco SECOES_ENTREGA antigo não encontrado. Nada foi alterado.");
}

code = code.replace(antigo, novo);

for (const id of [
  "#SESSAO1REPETIDOREIMPRESSORA",
  "#SESSAODOISBANERSBOTAO",
  "#SESSAO3AVISOIMPORTANTE"
]) {
  if (!code.includes(id)) {
    throw new Error(`ID obrigatório ausente após correção: ${id}`);
  }
}

fs.writeFileSync(FILE, code, "utf8");
console.log("Seções da entrega corrigidas: 1 visível com impressora; 2 e 3 recolhidas; após a impressora o Repeater e as seções inferiores voltam.");
