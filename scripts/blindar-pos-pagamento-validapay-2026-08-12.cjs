const fs = require("fs");

const CORE = "src/backend/validaPayPixProjetosProntosCore.jsw";
const HTTP = "src/backend/http-functions.js";
const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";

function patchFile(file, patcher) {
  let code = fs.readFileSync(file, "utf8");
  const original = code;
  code = patcher(code);
  if (code !== original) {
    fs.writeFileSync(file, code, "utf8");
    console.log(`Atualizado: ${file}`);
  } else {
    console.log(`Sem alteração: ${file}`);
  }
}

function mustReplace(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

patchFile(CORE, code => {
  code = mustReplace(
    code,
    'if (["PAID", "APPROVED", "CONFIRMED", "SUCCEEDED"].includes(status)) return "approved";',
    'if (["PAID", "APPROVED", "CONFIRMED", "SUCCEEDED", "SUCCESS", "COMPLETED", "SETTLED", "CAPTURED"].includes(status)) return "approved";',
    "Status de aprovação ValidaPay"
  );

  if (!code.includes("export async function garantirPosPagamentoValidaPay")) {
    const anchor = "export async function criarCobrancaPixTransparente(input = {}) {";
    const helper = `export async function garantirPosPagamentoValidaPay({ checkoutId, chargeId, paymentMethod = "PIX" } = {}) {\n  const id = safe(checkoutId);\n  const charge = safe(chargeId);\n  if (!id || !charge) return { ok: false, error: "checkout_or_charge_missing" };\n\n  const current = await findSession(id);\n  if (!current) return { ok: false, error: "session_not_found" };\n\n  if (safe(current.status).toLowerCase() !== "approved") {\n    await saveSession(id, {\n      status: "approved",\n      paymentId: charge,\n      validaPayChargeId: charge,\n      updatedAtDate: new Date()\n    }, current);\n  }\n\n  let notification = { ok: false, error: "not_attempted" };\n  try {\n    notification = await notificarVendaProjetoProntoAprovada({\n      checkoutId: id,\n      chargeId: charge,\n      paymentMethod\n    });\n  } catch (error) {\n    notification = { ok: false, error: error?.message || "notification_error" };\n    console.error("Falha ao garantir notificações pós-pagamento:", error?.message || error);\n  }\n\n  let invoice = { sent: false, error: "not_attempted" };\n  try {\n    invoice = await garantirFaturaValidaPay(id, charge);\n  } catch (error) {\n    invoice = { sent: false, error: error?.message || "invoice_error" };\n    console.error("Falha ao garantir fatura ValidaPay:", error?.message || error);\n  }\n\n  return { ok: true, notification, invoice };\n}\n\n`;
    if (!code.includes(anchor)) throw new Error("Âncora do finalizador pós-pagamento não encontrada.");
    code = code.replace(anchor, helper + anchor);
  }

  // Usa paidAt como evidência adicional e lê mais formatos de status.
  code = mustReplace(
    code,
    'const status = normalizeStatus(first(data?.status, data?.charge?.status, data?.payment?.status, data?.data?.status));\n  const emv = extractEmv(data);\n  return {',
    'const status = normalizeStatus(first(data?.status, data?.charge?.status, data?.payment?.status, data?.data?.status, data?.transaction?.status, data?.paymentStatus, data?.chargeStatus));\n  const emv = extractEmv(data);\n  const paidAt = safe(first(data?.paidAt, data?.payment?.paidAt, data?.charge?.paidAt, data?.data?.paidAt));\n  const approved = status === "approved" || Boolean(paidAt);\n  return {',
    "Leitura ampliada do status"
  );
  code = mustReplace(
    code,
    'approved: status === "approved",',
    'approved,',
    "Aprovação por status ou paidAt"
  );
  code = mustReplace(
    code,
    'paidAt: safe(first(data?.paidAt, data?.payment?.paidAt))',
    'paidAt',
    "paidAt canônico"
  );

  // Centraliza as retentativas de e-mail/fatura em uma função idempotente.
  const oldBlock = `      try {\n        await notificarVendaProjetoProntoAprovada({\n          checkoutId,\n          chargeId,\n          paymentMethod: "PIX"\n        });\n      } catch (error) {\n        console.error("Falha ao notificar venda aprovada:", error?.message || error);\n      }\n\n      try {\n        await garantirFaturaValidaPay(checkoutId, chargeId, current);\n      } catch (error) {\n        console.error("Falha ao reenviar fatura ValidaPay no Pix:", error?.message || error);\n      }`;
  const newBlock = `      await garantirPosPagamentoValidaPay({\n        checkoutId,\n        chargeId,\n        paymentMethod: "PIX"\n      });`;
  code = mustReplace(code, oldBlock, newBlock, "Finalização Pix idempotente");
  return code;
});

patchFile(HTTP, code => {
  if (!code.includes('garantirPosPagamentoValidaPay')) {
    const anchor = 'import { notificarVendaProjetoProntoAprovada } from "backend/notificarVendaProjetoPronto";';
    const add = `${anchor}\nimport { garantirPosPagamentoValidaPay } from "backend/validaPayPixProjetosProntosCore.jsw";`;
    if (!code.includes(anchor)) throw new Error("Import do notificador não encontrado.");
    code = code.replace(anchor, add);
  }

  // Aceita nomes equivalentes de evento de sucesso sem relaxar eventos não pagos.
  code = mustReplace(
    code,
    `    if (\n      event !==\n      "payment.success"\n    ) {`,
    `    const eventosAprovados = new Set([\n      "payment.success",\n      "payment.approved",\n      "charge.paid",\n      "charge.success",\n      "checkout.paid"\n    ]);\n\n    if (!eventosAprovados.has(event)) {`,
    "Eventos aprovados ValidaPay"
  );

  // Em webhook duplicado, tenta novamente notificações/fatura antes de retornar.
  const duplicateNeedle = `    if (\n      session.compraRegistrada === true &&\n      safe(session.status)\n        .toLowerCase() ===\n        "approved" &&`;
  if (code.includes(duplicateNeedle) && !code.includes("duplicateRetryPosPagamento")) {
    const returnNeedle = `    if (\n      session.compraRegistrada === true &&\n      safe(session.status)\n        .toLowerCase() ===\n        "approved" &&\n      (\n        safe(session.paymentId) ===\n          paymentId ||\n        safe(session.validaPayChargeId) ===\n          chargeId\n      )\n    ) {\n      return ok({`;
    const replacement = `    if (\n      session.compraRegistrada === true &&\n      safe(session.status)\n        .toLowerCase() ===\n        "approved" &&\n      (\n        safe(session.paymentId) ===\n          paymentId ||\n        safe(session.validaPayChargeId) ===\n          chargeId\n      )\n    ) {\n      const duplicateRetryPosPagamento =\n        await garantirPosPagamentoValidaPay({\n          checkoutId: safe(session.checkoutId),\n          chargeId,\n          paymentMethod: safe(session.paymentMethod) || "VALIDAPAY"\n        });\n\n      return ok({`;
    code = mustReplace(code, returnNeedle, replacement, "Retentativa no webhook duplicado");
  }

  // Depois do processamento normal, garante também a fatura da ValidaPay.
  const notificationBlock = `    const notificationResult =\n      await notificarVendaProjetoProntoAprovada({\n        checkoutId: safe(session.checkoutId),\n        chargeId,\n        paymentMethod: safe(session.paymentMethod) || "VALIDAPAY"\n      });`;
  const finalBlock = `    const notificationResult =\n      await garantirPosPagamentoValidaPay({\n        checkoutId: safe(session.checkoutId),\n        chargeId,\n        paymentMethod: safe(session.paymentMethod) || "VALIDAPAY"\n      });`;
  code = mustReplace(code, notificationBlock, finalBlock, "Pós-pagamento completo no webhook");
  return code;
});

patchFile(PAGE, code => {
  if (!code.includes("function abrirEntregaComFallback")) {
    const anchor = `function deliveryUrl() {\n  return \`/entregaprojetosprontos?checkout_id=\${encodeURIComponent(checkoutId)}&pos_pagamento=1\`;\n}\n`;
    const replacement = `${anchor}\nfunction abrirEntregaComFallback(delay=650) {\n  const destino = deliveryUrl();\n  setTimeout(() => {\n    try { wixLocation.to(destino); } catch (_) {}\n  }, delay);\n  setTimeout(() => {\n    try {\n      if (safe(wixLocation.path?.[0]).toLowerCase() === "checkout-projeto-pronto") {\n        wixLocation.to(destino);\n      }\n    } catch (_) {}\n  }, delay + 1800);\n}\n`;
    if (!code.includes(anchor)) throw new Error("Âncora da URL de entrega não encontrada.");
    code = code.replace(anchor, replacement);
  }
  code = code.replace(/setTimeout\(\(\)=>wixLocation\.to\(deliveryUrl\(\)\),650\);/g, 'abrirEntregaComFallback(650);');
  code = code.replace(/setTimeout\(\(\)=>wixLocation\.to\(deliveryUrl\(\)\),850\);/g, 'abrirEntregaComFallback(850);');
  return code;
});
