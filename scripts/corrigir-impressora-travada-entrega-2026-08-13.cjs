const fs = require('fs');

const backendFile = 'src/backend/entregaProjetosProntos.jsw';
let backend = fs.readFileSync(backendFile, 'utf8');

const retryAntigo = 'const PROCESS_RETRY_MS =\n  15000;';
const retryNovo = 'const PROCESS_RETRY_MS =\n  180000;';
if (backend.includes(retryAntigo)) {
  backend = backend.replace(retryAntigo, retryNovo);
} else if (!backend.includes(retryNovo)) {
  throw new Error('PROCESS_RETRY_MS nao encontrado.');
}
fs.writeFileSync(backendFile, backend, 'utf8');

const pageFile = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let page = fs.readFileSync(pageFile, 'utf8');

if (!page.includes('async function encerrarProcessamentoPendente(')) {
  const marker = 'async function carregarDetalhesDaCentral(resumos) {';
  const idx = page.indexOf(marker);
  if (idx < 0) throw new Error('carregarDetalhesDaCentral nao encontrado.');

  const helper = `async function encerrarProcessamentoPendente(titulo, mensagem) {
  try {
    const repetidor = $w(IDS.repetidor);
    const dados = [itemRepeaterMensagem(titulo, mensagem)];
    iniciarCicloRepeater(dados.length);
    repetidor.data = dados;
    await aguardarRepeaterPronto(3000);
  } catch (erro) {
    console.warn(
      "Falha ao mostrar mensagem de processamento pendente:",
      erro?.message || erro
    );
  }

  await esconderProcessamento();
  processamentoVisualEncerrado = true;
}`;

  page = page.slice(0, idx) + helper + '\n\n' + page.slice(idx);
}

const terminalAntigo = `        await esconderBotaoVideo();

        return;`;
const terminalNovo = `        await esconderBotaoVideo();
        await encerrarProcessamentoPendente(
          "PAGAMENTO CONFIRMADO",
          "Seu pagamento foi confirmado, mas o arquivo ainda não terminou de ser preparado. Atualize esta página em alguns instantes."
        );

        return;`;

let trocas = 0;
while (page.includes(terminalAntigo) && trocas < 2) {
  page = page.replace(terminalAntigo, terminalNovo);
  trocas += 1;
}

const finalAntigo = `  alterarDescricao(
    "O pagamento foi recebido, mas a liberação ainda está sendo finalizada. Atualize a página em alguns instantes."
  );

  await esconderBotaoVideo();
}`;
const finalNovo = `  alterarDescricao(
    "O pagamento foi recebido, mas a liberação ainda está sendo finalizada. Atualize a página em alguns instantes."
  );

  await esconderBotaoVideo();
  await encerrarProcessamentoPendente(
    "PAGAMENTO CONFIRMADO",
    "Seu pagamento foi confirmado, mas o arquivo ainda está sendo finalizado. Atualize esta página em alguns instantes."
  );
}`;

if (page.includes(finalAntigo)) {
  page = page.replace(finalAntigo, finalNovo);
} else if (!page.includes('Seu pagamento foi confirmado, mas o arquivo ainda está sendo finalizado.')) {
  throw new Error('Bloco final de carregarEntrega nao encontrado.');
}

fs.writeFileSync(pageFile, page, 'utf8');
console.log('Correcao da impressora travada aplicada.');
