const fs = require("fs");

const FILE = "src/backend/validaPayCartaoProjetosProntos.jsw";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

function insertAfter(anchor, addition, marker, label) {
  if (marker && code.includes(marker)) return;
  const i = code.indexOf(anchor);
  if (i < 0) throw new Error(`${label}: âncora não encontrada.`);
  code = code.slice(0, i + anchor.length) + addition + code.slice(i + anchor.length);
  changed = true;
}

insertAfter(
  'import { getSecret } from "wix-secrets-backend";\n',
  'import { currentMember as currentMemberBackend } from "wix-members-backend";\nimport { tokenize } from "@validapay/tokenize";\nimport { buscarMetodoPagamentoPrivadoPorEmail, salvarMetodoPagamentoAprovado } from "backend/metodosPagamentoProjetosProntos";\n',
  'import { tokenize } from "@validapay/tokenize";',
  "imports"
);

const helpers = `

async function identidadeMembroAtualCartao() {
  const membro = await currentMemberBackend.getMember();
  const emails = Array.isArray(membro?.contactDetails?.emails) ? membro.contactDetails.emails : [];
  const memberId = safe(membro?._id);
  const email = safe(membro?.loginEmail || emails[0] || membro?.contactDetails?.email).toLowerCase();
  return { memberId, email };
}

async function tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj, email }) {
  const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));
  const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));
  if (!clientId || !clientSecret) throw new Error("Credenciais ValidaPay não configuradas para tokenização.");

  const result = await tokenize({
    clientId,
    clientSecret,
    card: {
      number,
      cardHolderName: holder,
      cvv,
      expiration: month + "/" + year
    },
    customer: {
      name: nome,
      document: cpfCnpj,
      email
    }
  });

  if (!safe(result?.paymentMethodId)) throw new Error("A ValidaPay não retornou o token seguro do cartão.");
  return result;
}

async function persistirMetodoPagamentoAprovado(session, chargeId) {
  const paymentMethodId = safe(session?.pendingPaymentMethodId);
  const email = safe(session?.email).toLowerCase();
  if (!paymentMethodId || !email) return null;

  try {
    return await salvarMetodoPagamentoAprovado({
      email,
      memberId: safe(session?.memberId),
      clienteId: safe(session?.clienteId),
      paymentMethodId,
      validaPayCustomerId: safe(session?.pendingValidaPayCustomerId),
      cardBrand: safe(session?.pendingCardBrand),
      cardLastFour: safe(session?.pendingCardLastFour),
      cardExpirationMonth: safe(session?.pendingCardExpirationMonth),
      cardExpirationYear: safe(session?.pendingCardExpirationYear),
      cardHolderName: safe(session?.pendingCardHolderName),
      cardDocument: safe(session?.pendingCardDocument || session?.cpfCnpj),
      ultimoPagamentoId: safe(chargeId)
    });
  } catch (error) {
    console.warn("Falha ao salvar método de pagamento tokenizado:", error?.message || error);
    return null;
  }
}
`;

insertAfter(
  'const digits = v => safe(v).replace(/\\D/g, "");\n',
  helpers,
  'async function tokenizarNovoCartao(',
  "helpers"
);

replaceExact(
  '  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n',
  '  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n  await persistirMetodoPagamentoAprovado(session, chargeId);\n',
  "persistência após aprovação"
);

replaceExact(
  'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n  const number = digits(card.number);',
  'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n  const useSavedPaymentMethod = input.useSavedPaymentMethod === true;\n  const number = digits(card.number);',
  "flag cartão salvo"
);

replaceExact(
  '    const email = safe(input.email || ctx.email).toLowerCase();\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);',
  '    const emailInformado = safe(input.email || ctx.email).toLowerCase();\n    const identidadeMembro = await identidadeMembroAtualCartao();\n    if (!identidadeMembro.memberId || !identidadeMembro.email) return { ok:false, error:"Faça login novamente para pagar com cartão." };\n    if (emailInformado && emailInformado !== identidadeMembro.email) return { ok:false, error:"O e-mail do checkout não corresponde ao login atual." };\n    const email = identidadeMembro.email;\n    const memberId = identidadeMembro.memberId;\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);',
  "vínculo ao login"
);

replaceExact(
  '    if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };\n    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };\n    if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };\n    if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };',
  '    if (!useSavedPaymentMethod) {\n      if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };\n      if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };\n      if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };\n      if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };\n    }',
  "validação condicional"
);

const tokenBlock = `

    let tokenInfo;
    if (useSavedPaymentMethod) {
      const savedMethod = await buscarMetodoPagamentoPrivadoPorEmail(email);
      if (!savedMethod?.paymentMethodId || savedMethod.ativo === false) {
        return { ok:false, error:"Seu cartão salvo não está mais disponível. Informe um novo cartão." };
      }
      tokenInfo = {
        paymentMethodId: safe(savedMethod.paymentMethodId),
        customerId: safe(savedMethod.validaPayCustomerId),
        cardBrand: safe(savedMethod.cardBrand),
        cardLastFour: safe(savedMethod.cardLastFour),
        cardExpirationMonth: safe(savedMethod.cardExpirationMonth),
        cardExpirationYear: safe(savedMethod.cardExpirationYear),
        cardHolderName: safe(savedMethod.cardHolderName),
        cardDocument: safe(savedMethod.cardDocument || cardDocument)
      };
    } else {
      tokenInfo = await tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj: cardDocument, email });
    }

    const paymentMethodId = safe(tokenInfo?.paymentMethodId);
    if (!paymentMethodId) return { ok:false, error:"Não foi possível preparar o cartão com segurança." };
`;

if (!code.includes("let tokenInfo;")) {
  replaceExact(
    '    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {\n      cardAttempt += 1;\n    }\n\n    await saveSession(checkoutId, {',
    '    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {\n      cardAttempt += 1;\n    }' + tokenBlock + '\n    await saveSession(checkoutId, {',
    "token antes da cobrança"
  );
}

replaceExact(
  '      compraRegistrada: false,\n      cardAttempt,\n      updatedAtDate: new Date()',
  '      compraRegistrada: false,\n      cardAttempt,\n      memberId,\n      pendingPaymentMethodId: paymentMethodId,\n      pendingValidaPayCustomerId: safe(tokenInfo?.customerId),\n      pendingCardBrand: safe(tokenInfo?.cardBrand) || brand(number),\n      pendingCardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),\n      pendingCardExpirationMonth: safe(tokenInfo?.cardExpirationMonth) || month,\n      pendingCardExpirationYear: safe(tokenInfo?.cardExpirationYear) || year,\n      pendingCardHolderName: safe(tokenInfo?.cardHolderName) || holder,\n      pendingCardDocument: digits(tokenInfo?.cardDocument || cardDocument),\n      updatedAtDate: new Date()',
  "metadados seguros"
);

replaceExact(
  '        phone: whatsapp\n      },\n      installments,',
  '        phone: whatsapp\n      },\n      paymentMethodId,\n      installments,',
  "paymentMethodId na cobrança"
);

replaceExact(
  '    chargePayload.card = {\n      number,\n      cvv,\n      name: holder,\n      expiration: month + "/" + year\n    };\n\n',
  '',
  "remover PAN/CVV do payload final"
);

replaceExact(
  '      cardBrand: safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: number.slice(-4),',
  '      cardBrand: safe(tokenInfo?.cardBrand) || safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),',
  "metadados retornados"
);

const required = [
  'import { tokenize } from "@validapay/tokenize";',
  'async function persistirMetodoPagamentoAprovado(',
  'useSavedPaymentMethod',
  'pendingPaymentMethodId: paymentMethodId',
  'paymentMethodId,',
  'await persistirMetodoPagamentoAprovado(session, chargeId);'
];
for (const marker of required) {
  if (!code.includes(marker)) throw new Error(`Validação final falhou: ${marker}`);
}
if (code.includes('chargePayload.card = {')) {
  throw new Error("Validação final falhou: PAN/CVV ainda estão no payload final da cobrança.");
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Cartão salvo tokenizado aplicado com sucesso. Nenhum PAN completo ou CVV é persistido.");
} else {
  console.log("Cartão salvo tokenizado já está aplicado.");
}
