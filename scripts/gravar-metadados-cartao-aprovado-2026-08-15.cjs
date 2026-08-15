const fs = require('fs');
const file = 'src/backend/validaPayCartaoProjetosProntos.jsw';
let code = fs.readFileSync(file, 'utf8');

function troca(de, para, nome) {
  if (code.includes(para)) {
    console.log(`${nome}: já aplicado.`);
    return;
  }
  if (!code.includes(de)) throw new Error(`Trecho não encontrado: ${nome}`);
  code = code.replace(de, para);
  console.log(`${nome}: aplicado.`);
}

troca(
`import { fetch } from "wix-fetch";\nimport { getSecret } from "wix-secrets-backend";`,
`import { fetch } from "wix-fetch";\nimport { getSecret } from "wix-secrets-backend";\nimport { tokenize as tokenizeValidaPayCard } from "@validapay/tokenize";`,
'import SDK oficial de tokenização'
);

troca(
`const safe = v => String(v ?? "").trim();\nconst digits = v => safe(v).replace(/\\D/g, "");`,
`const safe = v => String(v ?? "").trim();\nconst digits = v => safe(v).replace(/\\D/g, "");\n\n// CARTAO_SALVO_TOKENIZADO_V1\n// Regra: nunca persistir PAN completo nem CVV. O cartão novo é tokenizado\n// antes da cobrança; depois de aprovado salvamos somente paymentMethodId e\n// metadados seguros, ligados ao e-mail autenticado do membro Wix.\nasync function tokenizarCartaoParaUsoFuturo({\n  number, holder, cvv, month, year, customerName, customerDocument, customerEmail\n} = {}) {\n  const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));\n  const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));\n  if (!clientId || !clientSecret) throw new Error("Credenciais da ValidaPay não encontradas para tokenização.");\n\n  const result = await tokenizeValidaPayCard({\n    clientId,\n    clientSecret,\n    card: {\n      number: digits(number),\n      cardHolderName: safe(holder).replace(/\\s+/g, " ").toUpperCase(),\n      cvv: digits(cvv),\n      expiration: digits(month).padStart(2, "0").slice(-2) + "/" + digits(year).slice(-4)\n    },\n    customer: {\n      name: safe(customerName),\n      document: digits(customerDocument),\n      email: safe(customerEmail).toLowerCase()\n    }\n  });\n\n  const paymentMethodId = safe(result?.paymentMethodId);\n  if (!paymentMethodId) throw new Error("A ValidaPay não retornou o identificador seguro do cartão.");\n\n  return {\n    paymentMethodId,\n    customerId: safe(result?.customerId),\n    cardBrand: safe(result?.cardBrand).toUpperCase(),\n    cardLastFour: digits(result?.cardLastFour).slice(-4),\n    cardExpirationMonth: digits(result?.cardExpirationMonth).padStart(2, "0").slice(-2),\n    cardExpirationYear: digits(result?.cardExpirationYear).slice(-4),\n    cardHolderName: safe(result?.cardHolderName || holder).replace(/\\s+/g, " ").toUpperCase()\n  };\n}`,
'helper de tokenização segura'
);

troca(
`  const paymentMethodId = safe(session?.pendingPaymentMethodId);\n  const email = safe(session?.email).toLowerCase();\n  if (!paymentMethodId || !email) return null;`,
`  const paymentMethodId = safe(session?.pendingPaymentMethodId);\n  const email = safe(session?.email).toLowerCase();\n  // METADADOS_CARTAO_APROVADO_V2\n  if (!email) return null;`,
'persistência de metadados aprovados'
);

troca(
`    } else {\n      tokenInfo = {\n        cardBrand: brand(number),\n        cardLastFour: number.slice(-4),\n        cardExpirationMonth: month,\n        cardExpirationYear: year,\n        cardHolderName: holder,\n        cardDocument\n      };\n    }`,
`    } else {\n      // Um cartão digitado pela primeira vez é tokenizado ANTES da cobrança.\n      // Assim, se o pagamento aprovar, esse mesmo token pode ser reutilizado\n      // nas próximas compras sem guardar o número completo ou o CVV no Wix.\n      const tokenized = await tokenizarCartaoParaUsoFuturo({\n        number,\n        holder,\n        cvv,\n        month,\n        year,\n        customerName: nome,\n        customerDocument: cardDocument,\n        customerEmail: email\n      });\n      tokenInfo = {\n        ...tokenized,\n        cardBrand: safe(tokenized.cardBrand) || brand(number),\n        cardLastFour: safe(tokenized.cardLastFour) || number.slice(-4),\n        cardExpirationMonth: safe(tokenized.cardExpirationMonth) || month,\n        cardExpirationYear: safe(tokenized.cardExpirationYear) || year,\n        cardHolderName: safe(tokenized.cardHolderName) || holder,\n        cardDocument\n      };\n      paymentMethodId = safe(tokenInfo.paymentMethodId);\n    }`,
'tokenizar cartão novo antes da cobrança'
);

troca(
`    if (useSavedPaymentMethod) {\n      chargePayload.paymentMethodId = paymentMethodId;\n    } else {\n      chargePayload.card = {\n        number,\n        cvv,\n        name: holder,\n        expiration: month + "/" + year\n      };\n    }`,
`    if (!paymentMethodId) {\n      return { ok:false, error:"Não foi possível preparar o cartão de forma segura para pagamento." };\n    }\n    // Tanto o cartão recém-digitado quanto o cartão salvo pagam por token.\n    // O objeto card bruto não é mais enviado para /v1/charges.\n    chargePayload.paymentMethodId = paymentMethodId;`,
'cobrar sempre pelo paymentMethodId'
);

troca(
`    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});`,
`    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});\n    const customerIdRetornado = campoProfundoCartao(response.data || {}, ["customerId"]);`,
'customerId da cobrança'
);

troca(
`      pendingPaymentMethodId: paymentMethodId || safe(previousSession?.pendingPaymentMethodId),\n      cardAttempt,`,
`      pendingPaymentMethodId: paymentMethodId || safe(previousSession?.pendingPaymentMethodId),\n      pendingValidaPayCustomerId: customerIdRetornado || safe(tokenInfo?.customerId) || safe(previousSession?.pendingValidaPayCustomerId),\n      cardAttempt,`,
'gravação final do customerId'
);

for (const marker of [
  'CARTAO_SALVO_TOKENIZADO_V1',
  'tokenizeValidaPayCard',
  'METADADOS_CARTAO_APROVADO_V2',
  'chargePayload.paymentMethodId = paymentMethodId',
  'pendingValidaPayCustomerId: customerIdRetornado'
]) {
  if (!code.includes(marker)) throw new Error(`Validação falhou: ${marker}`);
}

fs.writeFileSync(file, code, 'utf8');
console.log('OK: cartão novo tokenizado; cartão aprovado salvo por e-mail; compras futuras usam o token salvo.');
