const fs = require("fs");

const path = "src/backend/validaPayCartaoProjetosProntos.jsw";
let code = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado`);
  code = code.replace(from, to);
}

// O SDK de tokenização estava sendo importado no backend Wix. Quando o runtime
// não consegue carregar esse pacote, a chamada .jsw morre antes do try/catch e
// o visitante recebe apenas "Unable to handle the request". O primeiro cartão
// volta a usar a rota oficial /v1/charges com objeto card. Cartão já salvo
// continua usando paymentMethodId.
code = code.replace('import { tokenize } from "@validapay/tokenize";\n', "");

code = code.replace(
  /async function tokenizarNovoCartao\([\s\S]*?\n}\n\nasync function persistirMetodoPagamentoAprovado/,
  "async function persistirMetodoPagamentoAprovado"
);

if (!code.includes("function campoProfundoCartao(")) {
  const anchor = "async function persistirMetodoPagamentoAprovado(session, chargeId) {";
  const helper = `function campoProfundoCartao(root, nomes, depth = 0, seen = new Set()) {\n  if (depth > 8 || root == null || typeof root !== \"object\" || seen.has(root)) return \"\";\n  seen.add(root);\n  const alvos = new Set(nomes.map(v => String(v).toLowerCase()));\n  for (const [key, value] of Object.entries(root)) {\n    if (alvos.has(String(key).toLowerCase()) && [\"string\", \"number\"].includes(typeof value)) {\n      const found = safe(value);\n      if (found) return found;\n    }\n  }\n  for (const value of Object.values(root)) {\n    const found = campoProfundoCartao(value, nomes, depth + 1, seen);\n    if (found) return found;\n  }\n  return \"\";\n}\n\nasync function recuperarTokenDaCobranca(session, chargeId) {\n  if (safe(session?.pendingPaymentMethodId) || !safe(chargeId)) return session;\n  try {\n    const response = await api(\"get\", \`/v1/charges/\${encodeURIComponent(chargeId)}\`);\n    if (!response.ok) return session;\n    const data = response.data?.data || response.data?.charge || response.data || {};\n    const paymentMethodId = campoProfundoCartao(data, [\"paymentMethodId\", \"tokenId\"]);\n    if (!paymentMethodId) return session;\n    return await saveSession(safe(session.checkoutId), {\n      pendingPaymentMethodId: paymentMethodId,\n      pendingValidaPayCustomerId: campoProfundoCartao(data, [\"customerId\"]),\n      pendingCardBrand: campoProfundoCartao(data, [\"cardBrand\", \"brand\"]),\n      pendingCardLastFour: digits(campoProfundoCartao(data, [\"cardLastFour\", \"lastFour\", \"last4\"])).slice(-4),\n      pendingCardExpirationMonth: digits(campoProfundoCartao(data, [\"cardExpirationMonth\", \"expirationMonth\", \"expMonth\"])).padStart(2, \"0\").slice(-2),\n      pendingCardExpirationYear: digits(campoProfundoCartao(data, [\"cardExpirationYear\", \"expirationYear\", \"expYear\"])).slice(-4),\n      pendingCardHolderName: safe(session?.pendingCardHolderName),\n      pendingCardDocument: digits(session?.pendingCardDocument || session?.cpfCnpj),\n      updatedAtDate: new Date()\n    });\n  } catch (error) {\n    console.warn(\"Cobrança aprovada sem token reutilizável exposto pela ValidaPay:\", error?.message || error);\n    return session;\n  }\n}\n\n`;
  if (!code.includes(anchor)) throw new Error("Âncora de persistência não encontrada");
  code = code.replace(anchor, helper + anchor);
}

replaceOnce(
`  let session = await findSession(checkoutId);\n  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n  await persistirMetodoPagamentoAprovado(session, chargeId);`,
`  let session = await findSession(checkoutId);\n  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n  session = await recuperarTokenDaCobranca(session, chargeId);\n  await persistirMetodoPagamentoAprovado(session, chargeId);`,
"Recuperação do token após aprovação"
);

const oldTokenBlock = `    let tokenInfo;\n    if (useSavedPaymentMethod) {\n      const savedMethod = await buscarMetodoPagamentoPrivadoPorEmail(email);\n      if (!savedMethod?.paymentMethodId || savedMethod.ativo === false) {\n        return { ok:false, error:"Seu cartão salvo não está mais disponível. Informe um novo cartão." };\n      }\n      tokenInfo = {\n        paymentMethodId: safe(savedMethod.paymentMethodId),\n        customerId: safe(savedMethod.validaPayCustomerId),\n        cardBrand: safe(savedMethod.cardBrand),\n        cardLastFour: safe(savedMethod.cardLastFour),\n        cardExpirationMonth: safe(savedMethod.cardExpirationMonth),\n        cardExpirationYear: safe(savedMethod.cardExpirationYear),\n        cardHolderName: safe(savedMethod.cardHolderName),\n        cardDocument: safe(savedMethod.cardDocument || cardDocument)\n      };\n    } else {\n      tokenInfo = await tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj: cardDocument, email });\n    }\n\n    const paymentMethodId = safe(tokenInfo?.paymentMethodId);\n    if (!paymentMethodId) return { ok:false, error:"Não foi possível preparar o cartão com segurança." };\n`;

const newTokenBlock = `    let tokenInfo = {};\n    let paymentMethodId = \"\";\n    if (useSavedPaymentMethod) {\n      const savedMethod = await buscarMetodoPagamentoPrivadoPorEmail(email);\n      if (!savedMethod?.paymentMethodId || savedMethod.ativo === false) {\n        return { ok:false, error:"Seu cartão salvo não está mais disponível. Informe um novo cartão." };\n      }\n      tokenInfo = {\n        paymentMethodId: safe(savedMethod.paymentMethodId),\n        customerId: safe(savedMethod.validaPayCustomerId),\n        cardBrand: safe(savedMethod.cardBrand),\n        cardLastFour: safe(savedMethod.cardLastFour),\n        cardExpirationMonth: safe(savedMethod.cardExpirationMonth),\n        cardExpirationYear: safe(savedMethod.cardExpirationYear),\n        cardHolderName: safe(savedMethod.cardHolderName),\n        cardDocument: safe(savedMethod.cardDocument || cardDocument)\n      };\n      paymentMethodId = safe(tokenInfo.paymentMethodId);\n    } else {\n      tokenInfo = {\n        cardBrand: brand(number),\n        cardLastFour: number.slice(-4),\n        cardExpirationMonth: month,\n        cardExpirationYear: year,\n        cardHolderName: holder,\n        cardDocument\n      };\n    }\n`;
replaceOnce(oldTokenBlock, newTokenBlock, "Fluxo de cartão novo/salvo");

replaceOnce(
`      paymentMethodId,\n      installments,`,
`      installments,`,
"Remover paymentMethodId obrigatório do payload base"
);

if (!code.includes("if (useSavedPaymentMethod) {\n      chargePayload.paymentMethodId")) {
  const anchor = `    chargePayload.items = [{ priceId, quantity: 1 }];`;
  const inject = `    if (useSavedPaymentMethod) {\n      chargePayload.paymentMethodId = paymentMethodId;\n    } else {\n      chargePayload.card = {\n        number,\n        cvv,\n        name: holder,\n        expiration: month + \"/\" + year\n      };\n    }\n\n`;
  if (!code.includes(anchor)) throw new Error("Âncora dos itens da cobrança não encontrada");
  code = code.replace(anchor, inject + anchor);
}

// Se a própria resposta da criação trouxer token, aproveitamos imediatamente.
if (!code.includes("const tokenRetornadoNaCriacao")) {
  const anchor = `    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});\n    const approved = response.data?.success !== false && isApprovedCardStatus(status);`;
  const replacement = `    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});\n    const approved = response.data?.success !== false && isApprovedCardStatus(status);\n    const tokenRetornadoNaCriacao = campoProfundoCartao(response.data || {}, [\"paymentMethodId\", \"tokenId\"]);\n    if (tokenRetornadoNaCriacao && !paymentMethodId) {\n      paymentMethodId = tokenRetornadoNaCriacao;\n      tokenInfo.paymentMethodId = tokenRetornadoNaCriacao;\n    }`;
  if (!code.includes(anchor)) throw new Error("Âncora do retorno da cobrança não encontrada");
  code = code.replace(anchor, replacement);
}

// Atualiza o token na sessão quando ele vier junto da criação da cobrança.
replaceOnce(
`    await saveSession(checkoutId, {\n      validaPayChargeId: id,\n      paymentId: id,\n      paymentMethod: "CARD",\n      cardAttempt,`,
`    await saveSession(checkoutId, {\n      validaPayChargeId: id,\n      paymentId: id,\n      paymentMethod: "CARD",\n      pendingPaymentMethodId: paymentMethodId || safe(previousSession?.pendingPaymentMethodId),\n      cardAttempt,`,
"Salvar token retornado junto da cobrança"
);

fs.writeFileSync(path, code, "utf8");
console.log("Hotfix do cartão aplicado em", path);
