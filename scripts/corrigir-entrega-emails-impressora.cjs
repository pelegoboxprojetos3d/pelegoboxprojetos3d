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

function insertBefore(text, marker, insertion, label) {
  if (text.includes(insertion.trim())) return text;
  if (!text.includes(marker)) throw new Error(`Marcador não encontrado: ${label}`);
  return text.replace(marker, `${insertion}${marker}`);
}

function insertAfter(text, marker, insertion, label) {
  if (text.includes(insertion.trim())) return text;
  if (!text.includes(marker)) throw new Error(`Marcador não encontrado: ${label}`);
  return text.replace(marker, `${marker}${insertion}`);
}

// -----------------------------------------------------------------------------
// Página de entrega
// Regra: após pagamento, impressora permanece até o arquivo atual realmente
// existir. Não existe mais timeout visual de 5 s que deixe a página vazia.
// Nos cliques de download, a impressora aparece por 3,5 s apenas como charme.
// -----------------------------------------------------------------------------
let page = read(PAGE);

if (!page.includes('const CHARME_DOWNLOAD_MS =')) {
  page = page.replace(
    /const\s+MAX_PROCESSAMENTO_VISIVEL\s*=\s*5000\s*;/,
    `const MAX_PROCESSAMENTO_VISIVEL =\n  5000;\n\nconst CHARME_DOWNLOAD_MS =\n  3500;`
  );
}

const oldProcessingBlock = `        if (!processamentoVisualEncerrado) {\n          await mostrarProcessamento();\n\n          const tempoProcessando =\n            processamentoVisivelDesde\n              ? Date.now() - processamentoVisivelDesde\n              : 0;\n\n          if (\n            tempoProcessando >=\n            MAX_PROCESSAMENTO_VISIVEL\n          ) {\n            processamentoVisualEncerrado = true;\n\n            try {\n              await $w(IDS.processando).hide();\n              await $w(IDS.processando).collapse();\n            } catch (_) {}\n\n            processamentoVisivelDesde = 0;\n          }\n        }\n\n        alterarDescricao(\n          processamentoVisualEncerrado\n            ? \"Pagamento aprovado. Seus acessos já estão disponíveis; finalizando os arquivos...\"\n            : \"Pagamento aprovado. Estamos preparando seus arquivos...\"\n        );`;

const newProcessingBlock = `        /*\n          Após pagamento, a impressora só sai quando entregaProcessada()\n          confirmar que o arquivo da etapa chegou. Não escondemos por relógio.\n        */\n        await mostrarProcessamento();\n\n        alterarDescricao(\n          \"Pagamento aprovado. Estamos preparando seus arquivos...\"\n        );`;

if (page.includes(oldProcessingBlock)) {
  page = page.replace(oldProcessingBlock, newProcessingBlock);
}

if (!page.includes('async function mostrarCharmeDownload()')) {
  const marker = `async function baixarMedidas() {`;
  const fn = `async function mostrarCharmeDownload() {\n  /*\n    Quando o cliente baixa um arquivo que já está pronto, mostramos a\n    impressora só por estética. A galeria volta em seguida caso a navegação\n    de download não retire o usuário da página.\n  */\n  const estadoAnterior = processamentoVisualEncerrado;\n  processamentoVisualEncerrado = false;\n\n  try {\n    await mostrarProcessamento();\n    await esperar(CHARME_DOWNLOAD_MS);\n    await esconderProcessamento();\n    await mostrarGaleria();\n  } catch (erro) {\n    console.warn(\n      \"Falha no charme visual do download:\",\n      erro?.message || erro\n    );\n  } finally {\n    processamentoVisualEncerrado = estadoAnterior;\n  }\n}\n\n\n`;
  page = insertBefore(page, marker, fn, 'função de charme do download');
}

page = replaceOnce(
  page,
  `        await baixarMedidas();`,
  `        await mostrarCharmeDownload();\n        await baixarMedidas();`,
  'charme botão medidas'
);
page = replaceOnce(
  page,
  `        await baixarProximoGrafico();`,
  `        await mostrarCharmeDownload();\n        await baixarProximoGrafico();`,
  'charme botão gráficos'
);
page = replaceOnce(
  page,
  `        await baixarProjetoCompleto();`,
  `        await mostrarCharmeDownload();\n        await baixarProjetoCompleto();`,
  'charme botão projeto completo'
);

write(PAGE, page);

// -----------------------------------------------------------------------------
// Backend de entrega
// Se o pagamento está aprovado, mas o Make não gerou o arquivo, a própria
// consulta da página de entrega reenvia o webhook. Retenta após 15 s, não 10 min.
// -----------------------------------------------------------------------------
let delivery = read(DELIVERY);

if (!delivery.includes('from "wix-fetch"')) {
  delivery = delivery.replace(
    `import wixData from "wix-data";`,
    `import wixData from "wix-data";\nimport { fetch } from "wix-fetch";\nimport { getSecret } from "wix-secrets-backend";`
  );
}

if (!delivery.includes('const MAKE_PROCESS_SECRET =')) {
  const marker = `const PROJECTS_COLLECTION =\n  "Videosprojetos";`;
  delivery = insertAfter(
    delivery,
    marker,
    `\n\nconst MAKE_PROCESS_SECRET =\n  "MAKE_WEBHOOK_PROJETOS_PRONTOS";\n\nconst PROCESS_RETRY_MS =\n  15000;`,
    'constantes de reprocessamento'
  );
}

if (!delivery.includes('async function garantirProcessamentoAtual(')) {
  const marker = `function stagePaymentValue(`;
  const helper = `function arquivoAtualPronto(\n  session,\n  purchase\n) {\n  const tipo =\n    normalizeType(\n      session?.tipoProduto\n    );\n\n  if (tipo === \"PROJETO_COMPLETO\") {\n    return Boolean(\n      mediaSource(\n        purchase?.arquivoProjeto ||\n        purchase?.arquivo_projeto ||\n        purchase?.pdfProjeto\n      )\n    );\n  }\n\n  if (tipo === \"GRAFICOS\") {\n    return [\n      purchase?.imagemGrafico1,\n      purchase?.imagemGrafico2,\n      purchase?.imagemGrafico3,\n      purchase?.imagemGrafico4\n    ].some(\n      (value) => Boolean(mediaSource(value))\n    );\n  }\n\n  return Boolean(\n    mediaSource(\n      purchase?.imagemMedidas\n    )\n  );\n}\n\nfunction processamentoAtualAtrasado(\n  purchase\n) {\n  const stamp = new Date(\n    purchase?.dataProcessamento ||\n    purchase?._updatedDate ||\n    0\n  ).getTime();\n\n  return (\n    !stamp ||\n    (Date.now() - stamp) >=\n      PROCESS_RETRY_MS\n  );\n}\n\nasync function garantirProcessamentoAtual(\n  session,\n  purchases,\n  client\n) {\n  const paymentId =\n    safe(session?.paymentId);\n\n  const purchase =\n    purchases.find(\n      (item) =>\n        purchaseMatchesPayment(\n          item,\n          paymentId\n        )\n    ) ||\n    newestFirst(purchases)[0] ||\n    null;\n\n  if (!purchase) {\n    return {\n      sent: false,\n      reason: \"purchase_not_found\"\n    };\n  }\n\n  if (\n    arquivoAtualPronto(\n      session,\n      purchase\n    )\n  ) {\n    return {\n      sent: false,\n      reason: \"asset_ready\"\n    };\n  }\n\n  const status =\n    safe(\n      purchase?.statusProcessamento\n    ).toUpperCase();\n\n  if (\n    status === \"PROCESSANDO\" &&\n    !processamentoAtualAtrasado(\n      purchase\n    )\n  ) {\n    return {\n      sent: false,\n      reason: \"already_processing\"\n    };\n  }\n\n  let webhookUrl = \"\";\n\n  try {\n    webhookUrl =\n      safe(\n        await getSecret(\n          MAKE_PROCESS_SECRET\n        )\n      );\n  } catch (_) {\n    webhookUrl = \"\";\n  }\n\n  if (!webhookUrl) {\n    return {\n      sent: false,\n      reason: \"make_secret_missing\"\n    };\n  }\n\n  const processing = {\n    ...purchase,\n    statusProcessamento: \"PROCESSANDO\",\n    dataProcessamento: new Date()\n  };\n\n  let saved = processing;\n\n  try {\n    saved = await wixData.update(\n      PURCHASES_COLLECTION,\n      processing,\n      DB_OPTS\n    );\n  } catch (_) {}\n\n  const payload = {\n    event: \"pagamento_aprovado_projeto_pronto\",\n    clienteId: firstValue(\n      client?.clienteId,\n      session?.clienteId\n    ),\n    nomeCliente: firstValue(\n      client?.nome,\n      session?.nomeCliente\n    ),\n    email: normalizeEmail(\n      firstValue(\n        client?.email,\n        session?.email\n      )\n    ),\n    whatsapp: normalizarWhatsappBrasil(\n      firstValue(\n        client?.whatsapp,\n        sessionWhatsapp(session)\n      )\n    ),\n    cpfCnpj: safe(\n      session?.cpfCnpj\n    ).replace(/\\D/g, \"\"),\n    codigoProjeto: normalizeProjectCode(\n      session?.codigoProjeto\n    ),\n    produto: safe(session?.produto),\n    tipoProduto: normalizeType(\n      session?.tipoProduto\n    ),\n    valor: Number(\n      session?.valor ||\n      saved?.valor ||\n      0\n    ),\n    pagamento: \"approved\",\n    statusCompra: \"approved\",\n    idPagamento: paymentId,\n    checkoutId: safe(\n      session?.checkoutId\n    ),\n    tokenDeEntrega: sessionToken(\n      session\n    ),\n    chaveCompra: safe(\n      saved?.chaveCompra\n    )\n  };\n\n  try {\n    const response = await fetch(\n      webhookUrl,\n      {\n        method: \"post\",\n        headers: {\n          \"Content-Type\": \"application/json\"\n        },\n        body: JSON.stringify(payload)\n      }\n    );\n\n    if (!response.ok) {\n      try {\n        await wixData.update(\n          PURCHASES_COLLECTION,\n          {\n            ...saved,\n            statusProcessamento: \"PENDENTE\",\n            dataProcessamento: new Date()\n          },\n          DB_OPTS\n        );\n      } catch (_) {}\n\n      return {\n        sent: false,\n        reason: \"make_http_error\",\n        status: response.status\n      };\n    }\n\n    return {\n      sent: true\n    };\n  } catch (error) {\n    try {\n      await wixData.update(\n        PURCHASES_COLLECTION,\n        {\n          ...saved,\n          statusProcessamento: \"PENDENTE\",\n          dataProcessamento: new Date()\n        },\n        DB_OPTS\n      );\n    } catch (_) {}\n\n    console.error(\n      \"Falha ao reenviar processamento para o Make:\",\n      error?.message || error\n    );\n\n    return {\n      sent: false,\n      reason: \"make_fetch_error\"\n    };\n  }\n}\n\n`;
  delivery = insertBefore(delivery, marker, helper, 'garantia de processamento do Make');
}

if (!delivery.includes('await garantirProcessamentoAtual(\n    session,\n    allPurchases,\n    client\n  );')) {
  const anchor = `  client =\n    await findClientProfile(\n      session,\n      allPurchases\n    );\n\n  const result =`;
  const replacement = `  client =\n    await findClientProfile(\n      session,\n      allPurchases\n    );\n\n  /*\n    Se o pagamento foi aprovado e o arquivo não chegou, a própria página\n    garante que o Make seja acionado. A trava PROCESSANDO expira em 15 s.\n  */\n  await garantirProcessamentoAtual(\n    session,\n    allPurchases,\n    client\n  );\n\n  const result =`;
  delivery = replaceOnce(delivery, anchor, replacement, 'chamada do reprocessamento');
}

write(DELIVERY, delivery);

// -----------------------------------------------------------------------------
// Cartão e Pix: enviar telefone no formato E.164 documentado pela ValidaPay.
// Também encurtamos a trava de reprocessamento do cartão para 15 s.
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

if (!pix.includes('assuntoEmail: `Pagamento confirmado com sucesso! ✅ ${decodeTitle(session.produto)}`')) {
  pix = pix.replace(
    `    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:`,
    `    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    assuntoEmail: \`Pagamento confirmado com sucesso! ✅ \${decodeTitle(session.produto)}\`,\n    tituloEmail: decodeTitle(session.produto),\n    botaoTexto: normalizeType(session.tipoProduto) === "GRAFICOS"\n      ? "BAIXAR GRÁFICOS"\n      : normalizeType(session.tipoProduto) === "PROJETO_COMPLETO"\n        ? "BAIXAR PROJETO COMPLETO"\n        : "BAIXAR MEDIDAS",\n    botaoUrl: \`${SITE_BASE}/entregaprojetosprontos?checkout_id=\${encodeURIComponent(checkoutId)}\`,\n    deliveryUrl:`
  );
}
write(PIX, pix);

// -----------------------------------------------------------------------------
// Notificação Pelego Box: payload explícito para o cenário de e-mail.
// -----------------------------------------------------------------------------
let notify = read(NOTIFY);
if (!notify.includes('assuntoEmail: `Pagamento confirmado com sucesso! ✅ ${safe(session.produto)}`')) {
  notify = notify.replace(
    `    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:`,
    `    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    assuntoEmail: \`Pagamento confirmado com sucesso! ✅ \${safe(session.produto)}\`,\n    tituloEmail: safe(session.produto),\n    botaoTexto: type(session.tipoProduto) === "GRAFICOS"\n      ? "BAIXAR GRÁFICOS"\n      : type(session.tipoProduto) === "PROJETO_COMPLETO"\n        ? "BAIXAR PROJETO COMPLETO"\n        : "BAIXAR MEDIDAS",\n    botaoUrl: \`${SITE_BASE}/entregaprojetosprontos?checkout_id=\${encodeURIComponent(safe(session.checkoutId))}\`,\n    deliveryUrl:`
  );
}
write(NOTIFY, notify);

// -----------------------------------------------------------------------------
// Webhook geral: corrige variável de notificação do fluxo legado e reduz a
// janela que considera PROCESSANDO como intocável.
// -----------------------------------------------------------------------------
let http = read(HTTP);
http = http.replace(
  /\) > 10 \* 60 \* 1000;/g,
  ') > 15 * 1000;'
);

const oldMpReturn = `    const makeResult =\n      await triggerMake({\n        session,\n        purchase:\n          purchaseResult.purchase,\n        paymentId,\n        client\n      });\n\n    return ok({`;
const newMpReturn = `    const makeResult =\n      await triggerMake({\n        session,\n        purchase:\n          purchaseResult.purchase,\n        paymentId,\n        client\n      });\n\n    const notificationResult =\n      await notificarVendaProjetoProntoAprovada({\n        checkoutId,\n        chargeId: paymentId,\n        paymentMethod: \"MERCADO_PAGO\"\n      });\n\n    return ok({`;
if (http.includes(oldMpReturn)) {
  http = http.replace(oldMpReturn, newMpReturn);
}
write(HTTP, http);

console.log('Hotfix aplicado: impressora até arquivo pronto, charme de 3,5s nos downloads, reenvio Make em 15s, telefone E.164 e notificações de venda.');
