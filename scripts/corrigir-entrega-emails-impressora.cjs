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

// -----------------------------------------------------------------------------
// PÁGINA DE ENTREGA
// 1) Após pagamento: impressora permanece até a mídia real da etapa existir.
// 2) Clique em download já pronto: charme visual de 3,5 s.
// 3) Galeria do Editor nunca é usada como fallback visual pelo código.
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

const oldProcessingBlock = `        if (!processamentoVisualEncerrado) {\n          await mostrarProcessamento();\n\n          const tempoProcessando =\n            processamentoVisivelDesde\n              ? Date.now() - processamentoVisivelDesde\n              : 0;\n\n          if (\n            tempoProcessando >=\n            MAX_PROCESSAMENTO_VISIVEL\n          ) {\n            processamentoVisualEncerrado = true;\n\n            try {\n              await $w(IDS.processando).hide();\n              await $w(IDS.processando).collapse();\n            } catch (_) {}\n\n            processamentoVisivelDesde = 0;\n          }\n        }\n\n        alterarDescricao(\n          processamentoVisualEncerrado\n            ? \"Pagamento aprovado. Seus acessos já estão disponíveis; finalizando os arquivos...\"\n            : \"Pagamento aprovado. Estamos preparando seus arquivos...\"\n        );`;

const newProcessingBlock = `        /*\n          Após pagamento, a impressora permanece até o arquivo real da etapa\n          existir. Ela não desaparece por cronômetro e não deixa tela vazia.\n        */\n        await mostrarProcessamento();\n\n        alterarDescricao(\n          \"Pagamento aprovado. Estamos preparando seus arquivos...\"\n        );`;

if (page.includes(oldProcessingBlock)) {
  page = page.replace(oldProcessingBlock, newProcessingBlock);
}

// Um script legado executado antes deste hotfix ainda recria essa constante.
// Ela não pode controlar a entrega pós-pagamento, portanto removemos de novo.
page = page.replace(
  /\nconst\s+MAX_PROCESSAMENTO_VISIVEL\s*=\s*\n?\s*5000\s*;\n?/g,
  '\n'
);

if (!page.includes('async function mostrarCharmeDownload()')) {
  const marker = 'async function baixarMedidas() {';
  if (!page.includes(marker)) throw new Error('baixarMedidas não encontrado');
  page = page.replace(
    marker,
    `async function mostrarCharmeDownload() {\n  const estadoAnterior = processamentoVisualEncerrado;\n  processamentoVisualEncerrado = false;\n\n  try {\n    await mostrarProcessamento();\n    await esperar(CHARME_DOWNLOAD_MS);\n    await esconderProcessamento();\n    await mostrarGaleria();\n  } catch (erro) {\n    console.warn(\n      \"Falha no charme visual do download:\",\n      erro?.message || erro\n    );\n  } finally {\n    processamentoVisualEncerrado = estadoAnterior;\n  }\n}\n\n${marker}`
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
const makeBlockFixed = `    const makeResult =\n      await triggerMake({\n        session,\n        purchase:\n          purchaseResult.purchase,\n        paymentId,\n        client\n      });\n\n    const notificationResult =\n      await notificarVendaProjetoProntoAprovada({\n        checkoutId,\n        chargeId: paymentId,\n        paymentMethod: \"MERCADO_PAGO\"\n      });\n\n    return ok({`;

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

console.log('Hotfix validado: impressora, Make, email Pelego Box, ValidaPay e notificationResult.');
