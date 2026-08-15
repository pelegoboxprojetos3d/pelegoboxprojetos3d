const fs = require('fs');

const FILE = 'src/backend/validaPayCartaoProjetosProntos.jsw';
let code = fs.readFileSync(FILE, 'utf8');

function replaceOnce(from, to, label) {
  if (code.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return;
  }
  const count = code.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  code = code.replace(from, to);
  console.log(`${label}: aplicado.`);
}

const anchorHelper = `const safe = v => String(v ?? "").trim();\nconst digits = v => safe(v).replace(/\\D/g, "");`;
const helper = `const safe = v => String(v ?? "").trim();\nconst digits = v => safe(v).replace(/\\D/g, "");\n\n// CARTAO_SALVO_POS_COBRANCA_ISOLADO_V1\n// REGRA DE SEGURANCA DA VENDA:\n// 1) a cobranca normal com card bruto acontece primeiro e continua intocada;\n// 2) somente DEPOIS de a ValidaPay aceitar/criar a cobranca tentamos tokenizar;\n// 3) qualquer falha de tokenizacao vira apenas log e nunca altera ok/approved da venda;\n// 4) PAN e CVV nunca sao persistidos no Wix. Somente paymentMethodId e metadados.\nasync function tentarSalvarCartaoDepoisDaCobranca({\n  checkoutId, chargeId, approved, email, memberId, clienteId, customerId,\n  number, cvv, month, year, holder, customerName, cardDocument\n} = {}) {\n  try {\n    const modulo = await import("@validapay/tokenize");\n    const tokenize = modulo?.tokenize || modulo?.default?.tokenize || modulo?.default;\n    if (typeof tokenize !== "function") {\n      return { ok: false, saved: false, reason: "sdk_tokenize_indisponivel" };\n    }\n\n    const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));\n    const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));\n    if (!clientId || !clientSecret) {\n      return { ok: false, saved: false, reason: "credenciais_tokenizacao_ausentes" };\n    }\n\n    const tokenPromise = tokenize({\n      clientId,\n      clientSecret,\n      card: {\n        number: digits(number),\n        cardHolderName: safe(holder).replace(/\\s+/g, " ").toUpperCase(),\n        cvv: digits(cvv),\n        expiration: digits(month).padStart(2, "0").slice(-2) + "/" + digits(year).slice(-4)\n      },\n      customer: {\n        name: safe(customerName),\n        document: digits(cardDocument),\n        email: safe(email).toLowerCase()\n      }\n    });\n\n    const timeoutPromise = new Promise((_, reject) =>\n      setTimeout(() => reject(new Error("TOKENIZE_TIMEOUT_5000MS")), 5000)\n    );\n    const result = await Promise.race([tokenPromise, timeoutPromise]);\n    const paymentMethodId = safe(result?.paymentMethodId);\n    if (!paymentMethodId) {\n      return { ok: false, saved: false, reason: "payment_method_id_ausente" };\n    }\n\n    const metadata = {\n      paymentMethodId,\n      validaPayCustomerId: safe(result?.customerId || customerId),\n      cardBrand: safe(result?.cardBrand).toUpperCase() || brand(number),\n      cardLastFour: digits(result?.cardLastFour).slice(-4) || digits(number).slice(-4),\n      cardExpirationMonth: digits(result?.cardExpirationMonth).padStart(2, "0").slice(-2) || digits(month).padStart(2, "0").slice(-2),\n      cardExpirationYear: digits(result?.cardExpirationYear).slice(-4) || digits(year).slice(-4),\n      cardHolderName: safe(result?.cardHolderName || holder).replace(/\\s+/g, " ").toUpperCase(),\n      cardDocument: digits(cardDocument)\n    };\n\n    // A sessao guarda apenas o token/metadados seguros. Se a cobranca estiver\n    // pending, o finalize posterior conseguira salvar o mesmo cartao ao aprovar.\n    await saveSession(checkoutId, {\n      pendingPaymentMethodId: metadata.paymentMethodId,\n      pendingValidaPayCustomerId: metadata.validaPayCustomerId,\n      pendingCardBrand: metadata.cardBrand,\n      pendingCardLastFour: metadata.cardLastFour,\n      pendingCardExpirationMonth: metadata.cardExpirationMonth,\n      pendingCardExpirationYear: metadata.cardExpirationYear,\n      pendingCardHolderName: metadata.cardHolderName,\n      pendingCardDocument: metadata.cardDocument,\n      updatedAtDate: new Date()\n    });\n\n    // Se ja aprovou, atualiza imediatamente o cartao salvo do e-mail Wix.\n    // Se ainda esta pending, persistirMetodoPagamentoAprovado fara isso depois.\n    if (approved === true) {\n      await salvarMetodoPagamentoAprovado({\n        email: safe(email).toLowerCase(),\n        memberId: safe(memberId),\n        clienteId: safe(clienteId),\n        paymentMethodId: metadata.paymentMethodId,\n        validaPayCustomerId: metadata.validaPayCustomerId,\n        cardBrand: metadata.cardBrand,\n        cardLastFour: metadata.cardLastFour,\n        cardExpirationMonth: metadata.cardExpirationMonth,\n        cardExpirationYear: metadata.cardExpirationYear,\n        cardHolderName: metadata.cardHolderName,\n        cardDocument: metadata.cardDocument,\n        ultimoPagamentoId: safe(chargeId)\n      });\n    }\n\n    return {\n      ok: true,\n      saved: approved === true,\n      tokenReady: true,\n      cardBrand: metadata.cardBrand,\n      cardLastFour: metadata.cardLastFour\n    };\n  } catch (error) {\n    // ABSOLUTAMENTE NADA daqui pode transformar uma venda aprovada em erro.\n    console.warn("Cartao salvo pos-cobranca ignorado:", error?.message || error);\n    return {\n      ok: false,\n      saved: false,\n      reason: "tokenizacao_pos_cobranca_falhou"\n    };\n  }\n}`;
replaceOnce(anchorHelper, helper, 'helper isolado pós-cobrança');

const anchorCall = `    if (approved) {\n      finalization = await finalizeApprovedCard({ checkoutId, chargeId: id });\n    }\n\n    return {\n      ok: response.data?.success !== false,`;
const call = `    if (approved) {\n      finalization = await finalizeApprovedCard({ checkoutId, chargeId: id });\n    }\n\n    // CARTAO_SALVO_NAO_BLOQUEIA_VENDA_V1\n    // A cobranca e toda a finalizacao critica ja aconteceram. Somente agora\n    // tentamos gerar o token reutilizavel. O resultado nunca muda ok/approved.\n    let cartaoSalvo = { ok: true, saved: false, skipped: true };\n    if (!useSavedPaymentMethod) {\n      cartaoSalvo = await tentarSalvarCartaoDepoisDaCobranca({\n        checkoutId,\n        chargeId: id,\n        approved,\n        email,\n        memberId,\n        clienteId,\n        customerId: customerIdRetornado,\n        number,\n        cvv,\n        month,\n        year,\n        holder,\n        customerName: nome,\n        cardDocument\n      });\n    }\n\n    return {\n      ok: response.data?.success !== false,`;
replaceOnce(anchorCall, call, 'chamada isolada após a venda');

const anchorReturn = `      make: finalization.make\n    };`;
const newReturn = `      make: finalization.make,\n      cartaoSalvo: {\n        ok: cartaoSalvo?.ok === true,\n        saved: cartaoSalvo?.saved === true,\n        tokenReady: cartaoSalvo?.tokenReady === true,\n        reason: safe(cartaoSalvo?.reason)\n      }\n    };`;
// O trecho aparece em mais de um retorno; precisamos do ultimo, dentro da criacao nova.
if (!code.includes('cartaoSalvo: {')) {
  const idx = code.lastIndexOf(anchorReturn);
  if (idx < 0) throw new Error('retorno final da cobrança não encontrado');
  code = code.slice(0, idx) + newReturn + code.slice(idx + anchorReturn.length);
  console.log('retorno diagnóstico não-bloqueante: aplicado.');
} else {
  console.log('retorno diagnóstico não-bloqueante: já aplicado.');
}

const required = [
  'CARTAO_SALVO_POS_COBRANCA_ISOLADO_V1',
  'CARTAO_SALVO_NAO_BLOQUEIA_VENDA_V1',
  'await import("@validapay/tokenize")',
  'chargePayload.card = {',
  'cartaoSalvo: {'
];
for (const marker of required) {
  if (!code.includes(marker)) throw new Error(`Validação final falhou: ${marker}`);
}
if (code.includes('import { tokenize as tokenizeValidaPayCard } from "@validapay/tokenize"')) {
  throw new Error('Import estático regressivo ainda existe.');
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: cobrança estável preservada; tokenização ocorre só depois e não bloqueia venda.');
