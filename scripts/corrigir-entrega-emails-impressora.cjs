const fs = require('fs');

const PAGE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
const DELIVERY = 'src/backend/entregaProjetosProntos.jsw';
const CARD = 'src/backend/validaPayCartaoProjetosProntos.jsw';
const PIX = 'src/backend/validaPayPixProjetosProntosCore.jsw';
const HTTP = 'src/backend/http-functions.js';
const NOTIFY = 'src/backend/notificarVendaProjetoPronto.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, text) {
  fs.writeFileSync(path, `${text.trimEnd()}\n`, 'utf8');
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  return text.replace(from, to);
}

function replaceFunction(text, signature, replacement) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Função não encontrada: ${signature}`);

  const open = text.indexOf('{', start);
  if (open < 0) throw new Error(`Abertura da função não encontrada: ${signature}`);

  let depth = 0;
  let end = -1;

  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) throw new Error(`Fim da função não encontrado: ${signature}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

// -----------------------------------------------------------------------------
// PÁGINA DE ENTREGA
// 1) Após pagamento: impressora aguarda somente a imagem de Medidas.
// 2) Clique em download já pronto: charme visual de 3,5 s.
// 3) Galeria do Editor nunca é usada como fallback visual pelo código.
// 4) Projeto Completo pago atualiza o link do OneDrive antes de abrir o PDF.
// -----------------------------------------------------------------------------
let page = read(PAGE);

if (!page.includes('const CHARME_DOWNLOAD_MS =')) {
  const marker = 'const MIN_PROCESSAMENTO_VISIVEL =\n  500;';
  if (!page.includes(marker)) throw new Error('MIN_PROCESSAMENTO_VISIVEL não encontrado');
  page = page.replace(
    marker,
    `${marker}\n\nconst CHARME_DOWNLOAD_MS =\n  3500;`
  );
}

const oldProcessingBlock = `        if (!processamentoVisualEncerrado) {\n          await mostrarProcessamento();\n\n          const tempoProcessando =\n            processamentoVisivelDesde\n              ? Date.now() - processamentoVisivelDesde\n              : 0;\n\n          if (\n            tempoProcessando >=\n            MAX_PROCESSAMENTO_VISIVEL\n          ) {\n            processamentoVisualEncerrado = true;\n\n            try {\n              await $w(IDS.processando).hide();\n              await $w(IDS.processando).collapse();\n            } catch (_) {}\n\n            processamentoVisivelDesde = 0;\n          }\n        }\n\n        alterarDescricao(\n          processamentoVisualEncerrado\n            ? "Pagamento aprovado. Seus acessos já estão disponíveis; finalizando os arquivos..."\n            : "Pagamento aprovado. Estamos preparando seus arquivos..."\n        );`;

const newProcessingBlock = `        /*\n          Após pagamento, a impressora permanece até a imagem de Medidas\n          existir. Nas etapas seguintes ela já existe e a galeria pode abrir.\n        */\n        await mostrarProcessamento();\n\n        alterarDescricao(\n          "Pagamento aprovado. Estamos preparando seus arquivos..."\n        );`;

if (page.includes(oldProcessingBlock)) {
  page = page.replace(oldProcessingBlock, newProcessingBlock);
}

page = page.replace(
  /\nconst\s+MAX_PROCESSAMENTO_VISIVEL\s*=\s*\n?\s*5000\s*;\n?/g,
  '\n'
);

if (!page.includes('async function mostrarCharmeDownload()')) {
  const marker = 'async function baixarMedidas() {';
  if (!page.includes(marker)) throw new Error('baixarMedidas não encontrado');
  page = page.replace(
    marker,
    `async function mostrarCharmeDownload() {\n  const estadoAnterior = processamentoVisualEncerrado;\n  processamentoVisualEncerrado = false;\n\n  try {\n    await mostrarProcessamento();\n    await esperar(CHARME_DOWNLOAD_MS);\n    await esconderProcessamento();\n    await mostrarGaleria();\n  } catch (erro) {\n    console.warn(\n      "Falha no charme visual do download:",\n      erro?.message || erro\n    );\n  } finally {\n    processamentoVisualEncerrado = estadoAnterior;\n  }\n}\n\n${marker}`
  );
}

page = replaceOnce(
  page,
  '        await baixarMedidas();',
  '        await mostrarCharmeDownload();\n        await baixarMedidas();',
  'charme Medidas'
);
page = replaceOnce(
  page,
  '        await baixarProximoGrafico();',
  '        await mostrarCharmeDownload();\n        await baixarProximoGrafico();',
  'charme Gráficos'
);
page = replaceOnce(
  page,
  '        await baixarProjetoCompleto();',
  '        await mostrarCharmeDownload();\n        await baixarProjetoCompleto();',
  'charme Projeto Completo'
);

page = replaceFunction(
  page,
  'function entregaProcessada(',
  `function entregaProcessada(resultado) {
  const projeto = resultado?.project || {};

  /*
    REGRA OFICIAL:
    na abertura da página de entrega a impressora aguarda somente a imagem
    de Medidas. Não espera Gráficos nem o PDF do Projeto Completo.
  */
  return Boolean(
    safe(projeto.imagemMedidas)
  );
}`
);

page = replaceFunction(
  page,
  'async function baixarProjetoCompleto(',
  `async function baixarProjetoCompleto() {
  if (
    entrega?.access?.projeto !== true
  ) {
    return;
  }

  let arquivo =
    safe(entrega?.project?.pdfProjeto);

  /*
    O botão pode ser liberado alguns instantes antes de o Make gravar o
    webUrl do OneDrive. Atualiza a entrega por alguns segundos em vez de
    deixar o clique morrer sem resposta.
  */
  if (!arquivo) {
    alterarDescricao(
      "Projeto completo pago. Localizando o PDF..."
    );

    const checkoutId =
      safe(
        wixLocation.query.checkout_id ||
        wixLocation.query.checkoutId
      );

    const token =
      safe(wixLocation.query.token);

    for (
      let tentativa = 1;
      tentativa <= 5 && !arquivo;
      tentativa += 1
    ) {
      try {
        const atualizado =
          await buscarEntregaProjetoPronto({
            checkoutId,
            token
          });

        if (
          atualizado?.ok &&
          atualizado?.approved
        ) {
          entrega = atualizado;
          arquivo =
            safe(atualizado?.project?.pdfProjeto);
        }
      } catch (erro) {
        console.warn(
          "Falha ao atualizar link do projeto completo:",
          erro?.message || erro
        );
      }

      if (
        !arquivo &&
        tentativa < 5
      ) {
        await esperar(800);
      }
    }
  }

  if (!arquivo) {
    await mostrarGaleria();

    alterarDescricao(
      "O PDF do projeto completo ainda está sendo finalizado. Tente novamente em alguns segundos."
    );

    return;
  }

  /* Abre o compartilhamento original do OneDrive para visualizar o PDF online. */
  wixLocation.to(
    arquivo
  );
}`
);

write(PAGE, page);

// -----------------------------------------------------------------------------
// BACKEND DE ENTREGA
// O backend atual deve ser capaz de reacender o Make quando o pagamento está
// aprovado, a mídia não chegou e PROCESSANDO ficou preso por mais de 15 s.
// -----------------------------------------------------------------------------
const delivery = read(DELIVERY);
const deliveryChecks = [
  'MAKE_WEBHOOK_PROJETOS_PRONTOS',
  'PROCESS_RETRY_MS',
  'garantirProcessamentoAtual(',
  'arquivoAtualPronto(',
  'await garantirProcessamentoAtual('
];
for (const check of deliveryChecks) {
  if (!delivery.includes(check)) {
    throw new Error(`Backend de entrega incompleto: ${check}`);
  }
}

// -----------------------------------------------------------------------------
// VALIDAPAY
// Customer recebe nome, e-mail, documento e WhatsApp em E.164 (+55...).
// O produto/preço vinculado leva o título completo da etapa comprada.
// -----------------------------------------------------------------------------
let card = read(CARD);
card = card.replace(
  /return !stamp \|\| \(Date\.now\(\) - stamp\) > \(10 \* 60 \* 1000\);/,
  'return !stamp || (Date.now() - stamp) > 15000;'
);
card = card.replace(
  'phone: validaPayPhone(whatsapp)',
  'phone: whatsapp'
);
write(CARD, card);

let pix = read(PIX);
pix = pix.replace(
  'customer: { name: nome, email, phone: validaPayPhone(whatsapp), documentNumber: cpfCnpj }',
  'customer: { name: nome, email, phone: whatsapp, documentNumber: cpfCnpj }'
);

if (!pix.includes('assuntoEmail:')) {
  const marker = '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:';
  if (!pix.includes(marker)) throw new Error('Payload de e-mail do Pix sem ponto de inserção');
  pix = pix.replace(
    marker,
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n' +
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + decodeTitle(session.produto),\n' +
    '    tituloEmail: decodeTitle(session.produto),\n' +
    '    botaoTexto: normalizeType(session.tipoProduto) === "GRAFICOS"\n' +
    '      ? "BAIXAR GRÁFICOS"\n' +
    '      : normalizeType(session.tipoProduto) === "PROJETO_COMPLETO"\n' +
    '        ? "BAIXAR PROJETO COMPLETO"\n' +
    '        : "BAIXAR MEDIDAS",\n' +
    '    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(checkoutId),\n' +
    '    deliveryUrl:'
  );
}
write(PIX, pix);

// -----------------------------------------------------------------------------
// E-MAIL PELEGO BOX
// Payload explícito com assunto, título, botão, nome, CPF/CNPJ, e-mail,
// WhatsApp, produto, valor e URL da entrega.
// -----------------------------------------------------------------------------
let notify = read(NOTIFY);
if (!notify.includes('assuntoEmail:')) {
  const marker = '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:';
  if (!notify.includes(marker)) throw new Error('Payload de notificação sem ponto de inserção');
  notify = notify.replace(
    marker,
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n' +
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + safe(session.produto),\n' +
    '    tituloEmail: safe(session.produto),\n' +
    '    botaoTexto: type(session.tipoProduto) === "GRAFICOS"\n' +
    '      ? "BAIXAR GRÁFICOS"\n' +
    '      : type(session.tipoProduto) === "PROJETO_COMPLETO"\n' +
    '        ? "BAIXAR PROJETO COMPLETO"\n' +
    '        : "BAIXAR MEDIDAS",\n' +
    '    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(safe(session.checkoutId)),\n' +
    '    deliveryUrl:'
  );
}
write(NOTIFY, notify);

// -----------------------------------------------------------------------------
// WEBHOOK GERAL
// Corrige o erro de compilação: notificationResult era retornado no fluxo
// legado sem ter sido declarado.
// -----------------------------------------------------------------------------
let http = read(HTTP);
const makeBlock = `    const makeResult =\n      await triggerMake({\n        session,\n        purchase:\n          purchaseResult.purchase,\n        paymentId,\n        client\n      });\n\n    return ok({`;
const makeBlockFixed = `    const makeResult =\n      await triggerMake({\n        session,\n        purchase:\n          purchaseResult.purchase,\n        paymentId,\n        client\n      });\n\n    const notificationResult =\n      await notificarVendaProjetoProntoAprovada({\n        checkoutId,\n        chargeId: paymentId,\n        paymentMethod: "MERCADO_PAGO"\n      });\n\n    return ok({`;

if (http.includes(makeBlock)) {
  http = http.replace(makeBlock, makeBlockFixed);
}

if (http.includes('notification:\n          notificationResult') && !http.includes('const notificationResult =')) {
  throw new Error('notificationResult continua sem declaração');
}

http = http.replace(
  /\) > 10 \* 60 \* 1000;/g,
  ') > 15 * 1000;'
);
write(HTTP, http);

console.log('Hotfix validado: impressora espera Medidas, PDF online, Make, e-mail e ValidaPay.');
