const fs = require('fs');

const file = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(file, 'utf8');

const markerV1 = '// IMPRESSORA_CENTRAL_COM_PROJETOS_V1';
const markerV2 = '// IMPRESSORA_CENTRAL_IMEDIATA_V2';

// V1: garante que a central com projetos usa a impressora antes do Repeater.
if (!code.includes(markerV1)) {
  const anchorV1 = `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;

  const replacementV1 = `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

    // IMPRESSORA_CENTRAL_COM_PROJETOS_V1
    processamentoVisualEncerrado = false;
    await mostrarProcessamento();

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;

  if (!code.includes(anchorV1)) {
    throw new Error('Trecho V1 da central de projetos não encontrado.');
  }
  code = code.replace(anchorV1, replacementV1);
}

// V2: ao entrar pelo avatar/URL da central, a impressora precisa aparecer
// imediatamente, antes da consulta assíncrona dos projetos. Antes o onReady
// escondia a impressora, aguardava listarProjetosProntosDoMembroAtual() e só
// depois a mostrava. Nesse intervalo o Wix recolhia a área útil e deixava o
// rodapé ocupar a tela inteira.
if (!code.includes(markerV2)) {
  const hideProcessando = `  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}`;

  const showImmediately = `  if (acessoDireto) {
    // Link de e-mail/checkout: mantém a impressora fechada até validar a conta.
    try {
      const processando = $w(IDS.processando);
      if (typeof processando.hide === "function") processando.hide();
      if (typeof processando.collapse === "function") processando.collapse();
    } catch (_) {}
  } else {
    // IMPRESSORA_CENTRAL_IMEDIATA_V2
    // Central pelo avatar: abre a impressora antes de qualquer consulta remota,
    // eliminando o quadro intermediário em que aparecia somente o rodapé.
    processamentoVisualEncerrado = false;
    blindarAberturaEntrega();
  }`;

  if (!code.includes(hideProcessando)) {
    throw new Error('Bloco inicial da impressora no onReady não encontrado.');
  }
  code = code.replace(hideProcessando, showImmediately);

  const oldElse = `  } else {
    /*
      Entrada pelo avatar: não existe produto específico sendo entregue.
      Portanto não existe motivo para mostrar a impressora enquanto a central
      consulta se o membro possui projetos.
    */
    processamentoVisualEncerrado = true;
  }`;

  const newElse = `  } else {
    /*
      A central já abriu a impressora imediatamente no começo do onReady.
      Ela permanece visível enquanto os projetos são consultados e renderizados.
    */
    processamentoVisualEncerrado = false;
  }`;

  if (!code.includes(oldElse)) {
    throw new Error('Bloco antigo da entrada pelo avatar não encontrado.');
  }
  code = code.replace(oldElse, newElse);
}

fs.writeFileSync(file, code, 'utf8');
console.log('Impressora da central corrigida: sem flash do rodapé antes do processamento.');
