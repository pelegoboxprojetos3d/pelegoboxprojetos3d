const fs = require('fs');

const PAGE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
const DELIVERY = 'src/backend/entregaProjetosProntos.jsw';
const CARD = 'src/backend/validaPayCartaoProjetosProntos.jsw';
const PIX = 'src/backend/validaPayPixProjetosProntosCore.jsw';
const NOTIFY = 'src/backend/notificarVendaProjetoPronto.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, text) {
  fs.writeFileSync(path, `${text.trimEnd()}\n`, 'utf8');
}

function replaceRequired(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  return text.replace(from, to);
}

function insertBefore(text, marker, block, label) {
  if (text.includes(block.trim())) return text;
  if (!text.includes(marker)) throw new Error(`Marcador não encontrado: ${label}`);
  return text.replace(marker, `${block}${marker}`);
}

// =============================================================================
// PÁGINA DE ENTREGA
// =============================================================================
let page = read(PAGE);

page = page.replace(
  /\n\/\* Nunca deixar a impressora dominar a pagina por mais de 5 segundos\. \*\/\nconst MAX_PROCESSAMENTO_VISIVEL =\n  5000;\n/,
  '\n'
);

if (!page.includes('const CHARME_DOWNLOAD_MS =')) {
  page = page.replace(
    /const MIN_PROCESSAMENTO_VISIVEL =\n  \d+;/,
    (match) => `${match}\n\nconst CHARME_DOWNLOAD_MS =\n  3500;`
  );
}

const oldProcessingBlock = [
  '        if (!processamentoVisualEncerrado) {',
  '          await mostrarProcessamento();',
  '',
  '          const tempoProcessando =',
  '            processamentoVisivelDesde',
  '              ? Date.now() - processamentoVisivelDesde',
  '              : 0;',
  '',
  '          if (',
  '            tempoProcessando >=',
  '            MAX_PROCESSAMENTO_VISIVEL',
  '          ) {',
  '            processamentoVisualEncerrado = true;',
  '',
  '            try {',
  '              await $w(IDS.processando).hide();',
  '              await $w(IDS.processando).collapse();',
  '            } catch (_) {}',
  '',
  '            processamentoVisivelDesde = 0;',
  '          }',
  '        }',
  '',
  '        alterarDescricao(',
  '          processamentoVisualEncerrado',
  '            ? "Pagamento aprovado. Seus acessos já estão disponíveis; finalizando os arquivos..."',
  '            : "Pagamento aprovado. Estamos preparando seus arquivos..."',
  '        );'
].join('\n');

const newProcessingBlock = [
  '        /*',
  '          Após pagamento, a impressora permanece até o arquivo real da etapa',
  '          existir. Ela não desaparece por cronômetro e não deixa tela vazia.',
  '        */',
  '        await mostrarProcessamento();',
  '',
  '        alterarDescricao(',
  '          "Pagamento aprovado. Estamos preparando seus arquivos..."',
  '        );'
].join('\n');

if (page.includes(oldProcessingBlock)) {
  page = page.replace(oldProcessingBlock, newProcessingBlock);
}

if (page.includes('MAX_PROCESSAMENTO_VISIVEL')) {
  throw new Error('A regra antiga MAX_PROCESSAMENTO_VISIVEL ainda está presente.');
}

if (!page.includes('function blindarGaleriaPadrao()')) {
  const marker = [
    '// ======================================================',
    '// PROCESSAMENTO VISUAL DA ENTREGA',
    '// ======================================================',
    ''
  ].join('\n');

  const block = [
    'function blindarGaleriaPadrao() {',
    '  /* Nunca permitir que a mídia de demonstração do Editor apareça. */',
    '  try {',
    '    const galeria = $w(IDS.galeria);',
    '    galeria.items = [];',
    '    galeria.hide();',
    '  } catch (_) {}',
    '}',
    '',
    ''
  ].join('\n');

  page = insertBefore(page, marker, block, 'blindagem da galeria');
}

if (!page.includes('async function mostrarCharmeDownload()')) {
  const marker = 'async function baixarMedidas() {';
  const block = [
    'async function mostrarCharmeDownload() {',
    '  /* Arquivo já pronto: impressora por 3,5 s apenas como transição visual. */',
    '  const estadoAnterior = processamentoVisualEncerrado;',
    '  processamentoVisualEncerrado = false;',
    '',
    '  try {',
    '    await mostrarProcessamento();',
    '    await esperar(CHARME_DOWNLOAD_MS);',
    '    await esconderProcessamento();',
    '    await mostrarGaleria();',
    '  } catch (erro) {',
    '    console.warn(',
    '      "Falha no charme visual do download:",',
    '      erro?.message || erro',
    '    );',
    '  } finally {',
    '    processamentoVisualEncerrado = estadoAnterior;',
    '  }',
    '}',
    '',
    ''
  ].join('\n');

  page = insertBefore(page, marker, block, 'charme de download');
}

page = replaceRequired(
  page,
  '        await baixarMedidas();',
  '        await mostrarCharmeDownload();\n        await baixarMedidas();',
  'clique baixar medidas'
);

page = replaceRequired(
  page,
  '        await baixarProximoGrafico();',
  '        await mostrarCharmeDownload();\n        await baixarProximoGrafico();',
  'clique baixar gráficos'
);

page = replaceRequired(
  page,
  '        await baixarProjetoCompleto();',
  '        await mostrarCharmeDownload();\n        await baixarProjetoCompleto();',
  'clique baixar projeto'
);

if (!page.includes('    blindarGaleriaPadrao();')) {
  page = replaceRequired(
    page,
    '    checkoutEmAndamento =\n      false;\n\n    /*\n      PRIMEIRO A IMPRESSORA.',
    '    checkoutEmAndamento =\n      false;\n\n    blindarGaleriaPadrao();\n\n    /*\n      PRIMEIRO A IMPRESSORA.',
    'blindagem no onReady'
  );
}

write(PAGE, page);

// =============================================================================
// BACKEND DA ENTREGA: SE O MAKE NÃO RODAR, A PÁGINA REACIONA O FLUXO
// =============================================================================
let delivery = read(DELIVERY);

if (!delivery.includes('import { fetch } from "wix-fetch";')) {
  delivery = delivery.replace(
    'import wixData from "wix-data";',
    'import wixData from "wix-data";\nimport { fetch } from "wix-fetch";\nimport { getSecret } from "wix-secrets-backend";'
  );
}

if (!delivery.includes('const MAKE_PROCESS_SECRET =')) {
  delivery = replaceRequired(
    delivery,
    'const PROJECTS_COLLECTION =\n  "Videosprojetos";',
    'const PROJECTS_COLLECTION =\n  "Videosprojetos";\n\nconst MAKE_PROCESS_SECRET =\n  "MAKE_WEBHOOK_PROJETOS_PRONTOS";\n\nconst PROCESS_RETRY_MS =\n  15000;',
    'constantes Make'
  );
}

if (!delivery.includes('async function garantirProcessamentoAtual(')) {
  const marker = 'function stagePaymentValue(';
  const block = [
    'function arquivoAtualPronto(session, purchases, project) {',
    '  const tipo = normalizeType(session?.tipoProduto);',
    '',
    '  if (tipo === "PROJETO_COMPLETO") {',
    '    return Boolean(',
    '      firstMediaFromPurchases(',
    '        purchases,',
    '        "arquivoProjeto",',
    '        "arquivo_projeto",',
    '        "pdfProjeto"',
    '      ) ||',
    '      mediaSource(',
    '        project?.arquivoProjeto ||',
    '        project?.arquivo_projeto ||',
    '        project?.pdfProjeto',
    '      )',
    '    );',
    '  }',
    '',
    '  if (tipo === "GRAFICOS") {',
    '    const compra = [',
    '      "imagemGrafico1",',
    '      "imagemGrafico2",',
    '      "imagemGrafico3",',
    '      "imagemGrafico4"',
    '    ].some((field) => Boolean(firstMediaFromPurchases(purchases, field)));',
    '',
    '    const projeto = [',
    '      project?.imagemGrafico1,',
    '      project?.imagemGrafico2,',
    '      project?.imagemGrafico3,',
    '      project?.imagemGrafico4',
    '    ].some((value) => Boolean(mediaSource(value)));',
    '',
    '    return compra || projeto;',
    '  }',
    '',
    '  return Boolean(',
    '    firstMediaFromPurchases(purchases, "imagemMedidas") ||',
    '    mediaSource(project?.imagemMedidas)',
    '  );',
    '}',
    '',
    'function processamentoAtrasado(purchase) {',
    '  const stamp = new Date(',
    '    purchase?.dataProcessamento ||',
    '    purchase?._updatedDate ||',
    '    0',
    '  ).getTime();',
    '',
    '  return !stamp || (Date.now() - stamp) >= PROCESS_RETRY_MS;',
    '}',
    '',
    'async function garantirProcessamentoAtual(session, purchases, client, project) {',
    '  const paymentId = safe(session?.paymentId);',
    '  const purchase =',
    '    purchases.find((item) => purchaseMatchesPayment(item, paymentId)) ||',
    '    newestFirst(purchases)[0] ||',
    '    null;',
    '',
    '  if (!purchase) {',
    '    return { sent: false, reason: "purchase_not_found" };',
    '  }',
    '',
    '  if (arquivoAtualPronto(session, purchases, project)) {',
    '    return { sent: false, reason: "asset_ready" };',
    '  }',
    '',
    '  const status = safe(purchase?.statusProcessamento).toUpperCase();',
    '',
    '  if (status === "PROCESSANDO" && !processamentoAtrasado(purchase)) {',
    '    return { sent: false, reason: "already_processing" };',
    '  }',
    '',
    '  let url = "";',
    '  try {',
    '    url = safe(await getSecret(MAKE_PROCESS_SECRET));',
    '  } catch (_) {',
    '    url = "";',
    '  }',
    '',
    '  if (!url) {',
    '    return { sent: false, reason: "make_secret_missing" };',
    '  }',
    '',
    '  let processingPurchase = {',
    '    ...purchase,',
    '    statusProcessamento: "PROCESSANDO",',
    '    dataProcessamento: new Date()',
    '  };',
    '',
    '  try {',
    '    processingPurchase = await wixData.update(',
    '      PURCHASES_COLLECTION,',
    '      processingPurchase,',
    '      DB_OPTS',
    '    );',
    '  } catch (_) {}',
    '',
    '  const payload = {',
    '    event: "pagamento_aprovado_projeto_pronto",',
    '    clienteId: firstValue(client?.clienteId, session?.clienteId),',
    '    nomeCliente: firstValue(client?.nome, session?.nomeCliente),',
    '    email: normalizeEmail(firstValue(client?.email, session?.email)),',
    '    whatsapp: normalizarWhatsappBrasil(',
    '      firstValue(client?.whatsapp, sessionWhatsapp(session))',
    '    ),',
    '    cpfCnpj: safe(session?.cpfCnpj).replace(/\\D/g, ""),',
    '    codigoProjeto: normalizeProjectCode(session?.codigoProjeto),',
    '    produto: safe(session?.produto),',
    '    tipoProduto: normalizeType(session?.tipoProduto),',
    '    valor: Number(session?.valor || processingPurchase?.valor || 0),',
    '    pagamento: "approved",',
    '    statusCompra: "approved",',
    '    idPagamento: paymentId,',
    '    checkoutId: safe(session?.checkoutId),',
    '    tokenDeEntrega: sessionToken(session),',
    '    chaveCompra: safe(processingPurchase?.chaveCompra)',
    '  };',
    '',
    '  try {',
    '    const response = await fetch(url, {',
    '      method: "post",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify(payload)',
    '    });',
    '',
    '    if (!response.ok) {',
    '      try {',
    '        await wixData.update(',
    '          PURCHASES_COLLECTION,',
    '          {',
    '            ...processingPurchase,',
    '            statusProcessamento: "PENDENTE",',
    '            dataProcessamento: new Date()',
    '          },',
    '          DB_OPTS',
    '        );',
    '      } catch (_) {}',
    '',
    '      return { sent: false, reason: "make_http_error", status: response.status };',
    '    }',
    '',
    '    return { sent: true };',
    '  } catch (error) {',
    '    try {',
    '      await wixData.update(',
    '        PURCHASES_COLLECTION,',
    '        {',
    '          ...processingPurchase,',
    '          statusProcessamento: "PENDENTE",',
    '          dataProcessamento: new Date()',
    '        },',
    '        DB_OPTS',
    '      );',
    '    } catch (_) {}',
    '',
    '    console.error(',
    '      "Falha ao reenviar processamento para o Make:",',
    '      error?.message || error',
    '    );',
    '',
    '    return { sent: false, reason: "make_fetch_error" };',
    '  }',
    '}',
    '',
    ''
  ].join('\n');

  delivery = insertBefore(delivery, marker, block, 'garantia de processamento');
}

if (!delivery.includes('await garantirProcessamentoAtual(\n    session,\n    allPurchases,\n    client,\n    project\n  );')) {
  delivery = replaceRequired(
    delivery,
    '  client =\n    await findClientProfile(\n      session,\n      allPurchases\n    );\n\n  const result =',
    '  client =\n    await findClientProfile(\n      session,\n      allPurchases\n    );\n\n  await garantirProcessamentoAtual(\n    session,\n    allPurchases,\n    client,\n    project\n  );\n\n  const result =',
    'chamada garantia Make'
  );
}

write(DELIVERY, delivery);

// =============================================================================
// VALIDAPAY CARTÃO: PHONE EM E.164 CONFORME A DOCUMENTAÇÃO OFICIAL
// =============================================================================
let card = read(CARD);
card = card.replace(
  /return !stamp \|\| \(Date\.now\(\) - stamp\) > \(10 \* 60 \* 1000\);/,
  'return !stamp || (Date.now() - stamp) > 15000;'
);
card = card.replace('phone: validaPayPhone(whatsapp)', 'phone: whatsapp');
card = card.replace(
  /\nfunction validaPayPhone\(v\) \{\n  let n = digits\(v\);\n  if \(n\.startsWith\("55"\) && \(n\.length === 12 \|\| n\.length === 13\)\) n = n\.slice\(2\);\n  return n\.length === 10 \|\| n\.length === 11 \? n : "";\n\}\n/,
  '\n'
);
write(CARD, card);

// =============================================================================
// VALIDAPAY PIX: PHONE EM E.164 + PAYLOAD DE E-MAIL
// =============================================================================
let pix = read(PIX);
pix = pix.replace(
  'customer: { name: nome, email, phone: validaPayPhone(whatsapp), documentNumber: cpfCnpj }',
  'customer: { name: nome, email, phone: whatsapp, documentNumber: cpfCnpj }'
);
pix = pix.replace(
  /\nfunction validaPayPhone\(value\) \{\n  let number = digits\(value\);\n  if \(number\.startsWith\("55"\) && \(number\.length === 12 \|\| number\.length === 13\)\) number = number\.slice\(2\);\n  return number\.length === 10 \|\| number\.length === 11 \? number : "";\n\}\n/,
  '\n'
);

if (!pix.includes('assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + decodeTitle(session.produto)')) {
  pix = replaceRequired(
    pix,
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:',
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + decodeTitle(session.produto),\n    tituloEmail: decodeTitle(session.produto),\n    botaoTexto: normalizeType(session.tipoProduto) === "GRAFICOS"\n      ? "BAIXAR GRÁFICOS"\n      : normalizeType(session.tipoProduto) === "PROJETO_COMPLETO"\n        ? "BAIXAR PROJETO COMPLETO"\n        : "BAIXAR MEDIDAS",\n    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(checkoutId),\n    deliveryUrl:',
    'payload email Pix'
  );
}
write(PIX, pix);

// =============================================================================
// E-MAIL PELEGO BOX: ASSUNTO E BOTÃO EXPLÍCITOS
// =============================================================================
let notify = read(NOTIFY);
if (!notify.includes('assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + safe(session.produto)')) {
  notify = replaceRequired(
    notify,
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    deliveryUrl:',
    '    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),\n    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + safe(session.produto),\n    tituloEmail: safe(session.produto),\n    botaoTexto: type(session.tipoProduto) === "GRAFICOS"\n      ? "BAIXAR GRÁFICOS"\n      : type(session.tipoProduto) === "PROJETO_COMPLETO"\n        ? "BAIXAR PROJETO COMPLETO"\n        : "BAIXAR MEDIDAS",\n    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(safe(session.checkoutId)),\n    deliveryUrl:',
    'payload email Pelego Box'
  );
}
write(NOTIFY, notify);

console.log('Hotfix final aplicado: impressora até arquivo real, charme 3,5s, galeria blindada, Make auto-recuperável, WhatsApp E.164 e e-mails enriquecidos.');
