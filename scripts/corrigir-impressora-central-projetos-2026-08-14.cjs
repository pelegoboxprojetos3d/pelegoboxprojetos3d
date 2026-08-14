const fs = require('fs');

const file = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(file, 'utf8');

const marker = '// IMPRESSORA_CENTRAL_COM_PROJETOS_V1';
if (code.includes(marker)) {
  console.log('Correção da impressora da central já aplicada.');
  process.exit(0);
}

const anchor = `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;

const replacement = `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

    // IMPRESSORA_CENTRAL_COM_PROJETOS_V1
    // Pelo avatar, primeiro confirmamos silenciosamente que a conta realmente
    // possui projetos. Só então ligamos a impressora enquanto os detalhes dos
    // projetos são carregados. Assim uma conta sem compras continua indo direto
    // para a página de aviso, mas uma conta com compras nunca fica numa tela
    // branca esperando o Repeater aparecer.
    processamentoVisualEncerrado = false;
    await mostrarProcessamento();

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;

if (!code.includes(anchor)) {
  throw new Error('Trecho da central de projetos não encontrado.');
}

code = code.replace(anchor, replacement);
fs.writeFileSync(file, code, 'utf8');
console.log('Impressora da central corrigida: conta com projetos mostra processamento antes do Repeater.');
