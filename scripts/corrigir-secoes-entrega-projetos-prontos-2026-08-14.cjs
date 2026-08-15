const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const MARCADOR = "PB: saída suave da seção vazia junto com a impressora";

const blocoSemVazia = `const SECOES_ENTREGA = {
  // Seção 1: Repeater + impressora. Fica visível durante o processamento.
  principal: '#SESSAO1REPETIDOREIMPRESSORA',

  // Seção 2: três banners dos botões. Fica desligada enquanto a impressora roda.
  banners: '#SESSAODOISBANERSBOTAO',

  // Seção 3: aviso IMPORTANTE. Fica desligada enquanto a impressora roda.
  final: '#SESSAO3AVISOIMPORTANTE'
};`;

const blocoComVazia = `const SECOES_ENTREGA = {
  // Seção 1: Repeater + impressora. Fica visível durante o processamento.
  principal: '#SESSAO1REPETIDOREIMPRESSORA',

  // Seção 2: três banners dos botões. Fica desligada enquanto a impressora roda.
  banners: '#SESSAODOISBANERSBOTAO',

  // Seção 3: aviso IMPORTANTE. Fica desligada enquanto a impressora roda.
  final: '#SESSAO3AVISOIMPORTANTE',

  // Seção 4: espaçador visual. Sai suavemente junto com a impressora.
  vazia: '#SESSAO4VAZIA'
};`;

if (!code.includes("#SESSAO4VAZIA")) {
  if (!code.includes(blocoSemVazia)) {
    throw new Error("Bloco SECOES_ENTREGA esperado não encontrado. Nada foi alterado.");
  }
  code = code.replace(blocoSemVazia, blocoComVazia);
}

if (!code.includes(MARCADOR)) {
  const trechoAntigo = `    const processando = $w(IDS.processando);

    if (typeof processando.hide === "function") {
      await processando.hide("fade");
    }

    if (typeof processando.collapse === "function") {
      await processando.collapse();
    }

    processamentoVisivelDesde = 0;`;

  const trechoNovo = `    const processando = $w(IDS.processando);

    // PB: saída suave da seção vazia junto com a impressora.
    // Primeiro ambas desaparecem em fade; só depois o espaço é recolhido.
    let secaoVazia = null;
    try {
      secaoVazia = $w(SECOES_ENTREGA.vazia);
    } catch (_) {}

    const transicoesSaida = [];

    if (typeof processando.hide === "function") {
      transicoesSaida.push(processando.hide("fade", { duration: 650 }));
    }

    if (secaoVazia && typeof secaoVazia.hide === "function") {
      transicoesSaida.push(secaoVazia.hide("fade", { duration: 650 }));
    }

    await Promise.allSettled(transicoesSaida);

    if (typeof processando.collapse === "function") {
      await processando.collapse();
    }

    if (secaoVazia && typeof secaoVazia.collapse === "function") {
      await secaoVazia.collapse();
    }

    processamentoVisivelDesde = 0;`;

  if (!code.includes(trechoAntigo)) {
    throw new Error("Trecho atual de esconderProcessamento() não encontrado. Nada foi alterado.");
  }

  code = code.replace(trechoAntigo, trechoNovo);
}

for (const id of [
  "#SESSAO1REPETIDOREIMPRESSORA",
  "#SESSAODOISBANERSBOTAO",
  "#SESSAO3AVISOIMPORTANTE",
  "#SESSAO4VAZIA"
]) {
  if (!code.includes(id)) {
    throw new Error(`ID obrigatório ausente após correção: ${id}`);
  }
}

if (!code.includes(MARCADOR)) {
  throw new Error("Marcador da transição suave não encontrado após correção.");
}

fs.writeFileSync(FILE, code, "utf8");
console.log("OK: seção vazia sai em fade de 650 ms junto com a impressora e só depois recolhe.");
