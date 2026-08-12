const fs = require("fs");

const PAGE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const CARD = "src/backend/validaPayCartaoProjetosProntos.jsw";
const PIX = "src/backend/validaPayPixProjetosProntosCore.jsw";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, text) {
  fs.writeFileSync(path, `${text.trimEnd()}\n`, "utf8");
}

function replaceRequired(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

function patchPriceLabels(text, normalizerName, sourceLabel) {
  if (!text.includes("function priceTitleForType(")) {
    const marker = normalizerName === "productType"
      ? "function decodeTitle(v) {"
      : "function decodeTitle(value) {";

    const helper = `function priceTitleForType(value) {\n  const tipo = ${normalizerName}(value);\n  if (tipo === \"GRAFICOS\") return \"Botão 2\";\n  if (tipo === \"PROJETO_COMPLETO\") return \"Botão 3\";\n  return \"Botão 1\";\n}\n\n`;

    text = replaceRequired(
      text,
      marker,
      helper + marker,
      `${sourceLabel}: helper do título do preço`
    );
  }

  text = text.replace(
    "async function buscarPriceIdExistenteValidaPay({ produto, valor }) {",
    "async function buscarPriceIdExistenteValidaPay({ produto, valor, tipoProduto }) {"
  );

  if (!text.includes("const tituloPrecoEsperado = priceTitleForType(tipoProduto).toUpperCase();")) {
    text = replaceRequired(
      text,
      "  const nomeEsperado = normalizarTituloProduto(produto).toLowerCase();",
      "  const nomeEsperado = normalizarTituloProduto(produto).toLowerCase();\n  const tituloPrecoEsperado = priceTitleForType(tipoProduto).toUpperCase();",
      `${sourceLabel}: título esperado do preço`
    );
  }

  text = text.replace(
    '["ÚNICO", "UNICO"].includes(safe(price?.title).toUpperCase()) &&',
    'safe(price?.title).toUpperCase() === tituloPrecoEsperado &&'
  );

  if (!text.includes("const tituloPreco = priceTitleForType(tipoProduto);")) {
    text = replaceRequired(
      text,
      "async function ensurePriceId({ checkoutId, codigoProjeto, tipoProduto, produto, valor }) {\n  const current = await findSession(checkoutId);",
      "async function ensurePriceId({ checkoutId, codigoProjeto, tipoProduto, produto, valor }) {\n  const current = await findSession(checkoutId);\n  const tituloPreco = priceTitleForType(tipoProduto);",
      `${sourceLabel}: título do preço em ensurePriceId`
    );
  }

  if (sourceLabel === "cartão") {
    text = text.replace(
      '  if (safe(current?.validaPayPriceId) && normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()) return safe(current.validaPayPriceId);',
      '  if (safe(current?.validaPayPriceId) && safe(current?.validaPayPriceLabel) === tituloPreco && normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()) return safe(current.validaPayPriceId);'
    );
  } else {
    text = text.replace(
      "  if (\n    safe(current?.validaPayPriceId) &&\n    normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()\n  ) {\n    return safe(current.validaPayPriceId);\n  }",
      "  if (\n    safe(current?.validaPayPriceId) &&\n    safe(current?.validaPayPriceLabel) === tituloPreco &&\n    normalizarTituloProduto(current?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase()\n  ) {\n    return safe(current.validaPayPriceId);\n  }"
    );
  }

  text = text.replace(
    "const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor });",
    "const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor, tipoProduto });"
  );

  text = text.replace(
    "await saveSession(checkoutId, { validaPayPriceId: providerReused, updatedAtDate: new Date() });",
    "await saveSession(checkoutId, { validaPayPriceId: providerReused, validaPayPriceLabel: tituloPreco, updatedAtDate: new Date() });"
  );

  text = text.replace(
    '      title: "Único",',
    "      title: tituloPreco,"
  );

  text = text.replace(
    "await saveSession(checkoutId, { validaPayPriceId: priceId, updatedAtDate: new Date() });",
    "await saveSession(checkoutId, { validaPayPriceId: priceId, validaPayPriceLabel: tituloPreco, updatedAtDate: new Date() });"
  );

  return text;
}

// -----------------------------------------------------------------------------
// PÁGINA DE ENTREGA
// - aceita via=email mesmo que o parâmetro venha duplicado pelo Make;
// - botão 3 força download do link permanente do OneDrive.
// -----------------------------------------------------------------------------
let page = read(PAGE);

page = replaceRequired(
  page,
  `let processamentoEmailPendente =\n  String(wixLocation?.query?.via ?? \"\")\n    .trim()\n    .toLowerCase() === \"email\";`,
  `const origemViaEmail =\n  (Array.isArray(wixLocation?.query?.via)\n    ? wixLocation.query.via\n    : String(wixLocation?.query?.via ?? \"\").split(\",\"))\n    .map((valor) => String(valor ?? \"\").trim().toLowerCase())\n    .includes(\"email\");\n\nlet processamentoEmailPendente =\n  origemViaEmail;`,
  "detecção robusta de via=email"
);

if (!page.includes("function linkDownloadDiretoOneDrive(")) {
  page = replaceRequired(
    page,
    "async function baixarProjetoCompleto() {",
    `function linkDownloadDiretoOneDrive(url) {\n  const arquivo = safe(url);\n  if (!arquivo) return \"\";\n\n  if (/[?&]download=1(?:&|$)/i.test(arquivo)) {\n    return arquivo;\n  }\n\n  return arquivo + (arquivo.includes(\"?\") ? \"&\" : \"?\") + \"download=1\";\n}\n\n\nasync function baixarProjetoCompleto() {`,
    "helper de download direto do OneDrive"
  );
}

page = replaceRequired(
  page,
  `  /* Abre o compartilhamento original do OneDrive para visualizar o PDF online. */\n  wixLocation.to(\n    arquivo\n  );`,
  `  /* Projeto Completo: baixa diretamente do compartilhamento permanente do OneDrive. */\n  const downloadDireto =\n    linkDownloadDiretoOneDrive(arquivo);\n\n  wixLocation.to(\n    downloadDireto\n  );`,
  "download direto do Projeto Completo"
);

write(PAGE, page);

// -----------------------------------------------------------------------------
// CARTÃO VALIDAPAY
// - preço deixa de aparecer como “Único” e passa a Botão 1/2/3;
// - não reutiliza priceId antigo com rótulo Único;
// - reenvio de fatura pode ser tentado novamente com cooldown se falhar.
// -----------------------------------------------------------------------------
let card = patchPriceLabels(read(CARD), "productType", "cartão");

if (!card.includes("async function garantirFaturaValidaPay(")) {
  card = replaceRequired(
    card,
    "async function findSession(checkoutId) {",
    `async function garantirFaturaValidaPay(checkoutId, chargeId, knownSession = null) {\n  const session = knownSession || await findSession(checkoutId);\n\n  if (session?.faturaValidaPayEnviada === true) {\n    return { sent: true, skipped: true, reason: \"already_sent\" };\n  }\n\n  const ultimaTentativa = new Date(\n    session?.faturaValidaPayUltimaTentativaEm || 0\n  ).getTime();\n\n  if (ultimaTentativa && Date.now() - ultimaTentativa < 30000) {\n    return {\n      sent: false,\n      skipped: true,\n      reason: \"cooldown\",\n      statusCode: Number(session?.faturaValidaPayStatusCode || 0),\n      error: safe(session?.faturaValidaPayErro)\n    };\n  }\n\n  await saveSession(checkoutId, {\n    faturaValidaPayUltimaTentativaEm: new Date(),\n    updatedAtDate: new Date()\n  }, session || undefined);\n\n  const result = await reenviarNotificacaoValidaPay(chargeId);\n\n  await saveSession(checkoutId, {\n    faturaValidaPayEnviada: result?.sent === true,\n    faturaValidaPayStatusCode: Number(result?.statusCode || 0),\n    faturaValidaPayErro: safe(result?.error),\n    faturaValidaPayTentativa: Number(result?.attempt || 0),\n    faturaValidaPayUltimaTentativaEm: new Date(),\n    updatedAtDate: new Date()\n  });\n\n  return result;\n}\n\nasync function findSession(checkoutId) {`,
    "helper de reenvio da fatura do cartão"
  );
}

card = replaceRequired(
  card,
  "    return {compraRegistrada:true,purchaseId:safe(existente._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao};",
  "    const faturaValidaPay=await garantirFaturaValidaPay(checkoutId,chargeId,session);\n    return {compraRegistrada:true,purchaseId:safe(existente._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};",
  "retry da fatura em compra de cartão já registrada"
);

card = replaceRequired(
  card,
  `  const faturaValidaPay=await reenviarNotificacaoValidaPay(chargeId);\n  await saveSession(checkoutId,{\n    faturaValidaPayEnviada:faturaValidaPay?.sent===true,\n    faturaValidaPayStatusCode:Number(faturaValidaPay?.statusCode||0),\n    faturaValidaPayErro:safe(faturaValidaPay?.error),\n    faturaValidaPayTentativa:Number(faturaValidaPay?.attempt||0),\n    updatedAtDate:new Date()\n  });`,
  "  const faturaValidaPay=await garantirFaturaValidaPay(checkoutId,chargeId,session);",
  "fatura inicial do cartão com retry controlado"
);

write(CARD, card);

// -----------------------------------------------------------------------------
// PIX VALIDAPAY
// - mesmo rótulo Botão 1/2/3;
// - tenta o envio/reenvio da fatura oficial após aprovação, com cooldown.
// -----------------------------------------------------------------------------
let pix = patchPriceLabels(read(PIX), "normalizeType", "pix");

if (!pix.includes("async function reenviarNotificacaoValidaPay(")) {
  pix = replaceRequired(
    pix,
    "async function findSession(checkoutId) {",
    `async function reenviarNotificacaoValidaPay(chargeId) {\n  const id = safe(chargeId);\n  if (!id) return { sent: false, error: \"charge_id_missing\" };\n\n  const waits = [900, 1400, 2100];\n  let last = { sent: false, error: \"notification_resend_failed\" };\n\n  for (let attempt = 0; attempt < waits.length; attempt += 1) {\n    await sleep(waits[attempt]);\n\n    try {\n      const response = await requestValidaPay(\n        \"/v1/users/notifications/resend\",\n        \"post\",\n        { chargeId: id }\n      );\n\n      if (response.ok) {\n        return {\n          sent: true,\n          statusCode: response.statusCode,\n          event: safe(response.data?.event),\n          success: response.data?.success === true,\n          attempt: attempt + 1\n        };\n      }\n\n      last = {\n        sent: false,\n        statusCode: response.statusCode,\n        error: response.error || \"notification_resend_failed\",\n        attempt: attempt + 1\n      };\n    } catch (error) {\n      last = {\n        sent: false,\n        error: error?.message || \"notification_resend_error\",\n        attempt: attempt + 1\n      };\n    }\n  }\n\n  return last;\n}\n\nasync function garantirFaturaValidaPay(checkoutId, chargeId, knownSession = null) {\n  const session = knownSession || await findSession(checkoutId);\n\n  if (session?.faturaValidaPayEnviada === true) {\n    return { sent: true, skipped: true, reason: \"already_sent\" };\n  }\n\n  const ultimaTentativa = new Date(\n    session?.faturaValidaPayUltimaTentativaEm || 0\n  ).getTime();\n\n  if (ultimaTentativa && Date.now() - ultimaTentativa < 30000) {\n    return { sent: false, skipped: true, reason: \"cooldown\" };\n  }\n\n  await saveSession(checkoutId, {\n    faturaValidaPayUltimaTentativaEm: new Date(),\n    updatedAtDate: new Date()\n  }, session || undefined);\n\n  const result = await reenviarNotificacaoValidaPay(chargeId);\n\n  await saveSession(checkoutId, {\n    faturaValidaPayEnviada: result?.sent === true,\n    faturaValidaPayStatusCode: Number(result?.statusCode || 0),\n    faturaValidaPayErro: safe(result?.error),\n    faturaValidaPayTentativa: Number(result?.attempt || 0),\n    faturaValidaPayUltimaTentativaEm: new Date(),\n    updatedAtDate: new Date()\n  });\n\n  return result;\n}\n\nasync function findSession(checkoutId) {`,
    "reenvio da fatura oficial no Pix"
  );
}

if (!pix.includes("Falha ao reenviar fatura ValidaPay no Pix")) {
  pix = replaceRequired(
    pix,
    `      } catch (error) {\n        console.error(\"Falha ao notificar venda aprovada:\", error?.message || error);\n      }\n    }\n\n    return result;`,
    `      } catch (error) {\n        console.error(\"Falha ao notificar venda aprovada:\", error?.message || error);\n      }\n\n      try {\n        await garantirFaturaValidaPay(checkoutId, chargeId, current);\n      } catch (error) {\n        console.error(\"Falha ao reenviar fatura ValidaPay no Pix:\", error?.message || error);\n      }\n    }\n\n    return result;`,
    "chamada da fatura após Pix aprovado"
  );
}

write(PIX, pix);

console.log("Pré-teste real aplicado: Botão 1/2/3 na ValidaPay, fatura com retry, via=email robusto e Projeto Completo em download direto.");
