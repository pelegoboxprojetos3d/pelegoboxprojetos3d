const fs = require("fs");

const FILE = "src/backend/validaPayCartaoProjetosProntos.jsw";

function fail(message) {
  throw new Error(message);
}

let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function insertAfter(anchor, addition, label) {
  if (code.includes(addition.trim())) return;
  const index = code.indexOf(anchor);
  if (index < 0) fail(`${label}: âncora não encontrada.`);
  const end = index + anchor.length;
  code = code.slice(0, end) + addition + code.slice(end);
  changed = true;
}

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

function replaceRegex(regex, replacement, alreadyMarker, label) {
  if (alreadyMarker && code.includes(alreadyMarker)) return;
  if (!regex.test(code)) fail(`${label}: padrão não encontrado.`);
  code = code.replace(regex, replacement);
  changed = true;
}

// 1) Dependências do fluxo de cartão salvo/tokenizado.
insertAfter(
  'import { getSecret } from "wix-secrets-backend";\n',
  'import { currentMember as currentMemberBackend } from "wix-members-backend";\nimport { tokenize } from "@validapay/tokenize";\nimport { buscarMetodoPagamentoPrivadoPorEmail, salvarMetodoPagamentoAprovado } from "backend/metodosPagamentoProjetosProntos";\n',
  "Imports do cartão salvo"
);

// 2) Helpers de identidade, tokenização e persistência. PAN/CVV nunca são gravados.
const helpers = `

async function identidadeMembroAtualCartao() {
  const membro = await currentMemberBackend.getMember();
  const emails = Array.isArray(membro?.contactDetails?.emails)
    ? membro.contactDetails.emails
    : [];
  const memberId = safe(membro?._id);
  const email = safe(
    membro?.loginEmail ||
    emails[0] ||
    membro?.contactDetails?.email
  ).toLowerCase();
  return { memberId, email };
}

async function tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj, email }) {
  const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));
  const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais ValidaPay não configuradas para tokenização.");
  }

  const result = await tokenize({
    clientId,
    clientSecret,
    card: {
      number,
      cardHolderName: holder,
      cvv,
      expiration: \`${'${month}'}\/${'${year}'}\`
    },
    customer: {
      name: nome,
      document: cpfCnpj,
      email
    }
  });

  if (!safe(result?.paymentMethodId)) {
    throw new Error("A ValidaPay não retornou o token seguro do cartão.");
  }

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

if (!code.includes("async function tokenizarNovoCartao(")) {
  insertAfter(
    'const digits = v => safe(v).replace(/\\D/g, "");\n',
    helpers,
    "Helpers do cartão salvo"
  );
}

// 3) Só grava o método quando a operadora confirmou o pagamento.
replaceExact(
  '  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n',
  '  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n  await persistirMetodoPagamentoAprovado(session, chargeId);\n',
  "Persistência após aprovação"
);

// 4) Habilita chamada usando cartão já salvo.
replaceExact(
  'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n  const number = digits(card.number);',
  'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n  const useSavedPaymentMethod = input.useSavedPaymentMethod === true;\n  const number = digits(card.number);',
  "Flag do cartão salvo"
);

// 5) O método salvo pertence obrigatoriamente ao membro Wix autenticado.
replaceExact(
  '    const email = safe(input.email || ctx.email).toLowerCase();\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);',
  '    const emailInformado = safe(input.email || ctx.email).toLowerCase();\n    const identidadeMembro = await identidadeMembroAtualCartao();\n    if (!identidadeMembro.memberId || !identidadeMembro.email) return { ok:false, error:"Faça login novamente para pagar com cartão." };\n    if (emailInformado && emailInformado !== identidadeMembro.email) return { ok:false, error:"O e-mail do checkout não corresponde ao login atual." };\n    const email = identidadeMembro.email;\n    const memberId = identidadeMembro.memberId;\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);',
  "Identidade do membro no cartão"
);

// 6) Novo cartão exige PAN/CVV; cartão tokenizado não pede os dados sensíveis novamente.
replaceRegex(
  /    if \(!luhn\(number\)\) return \{ ok: false, error: "Número do cartão inválido\." \};\n    if \(!\/\^\(0\[1-9\]\|1\[0-2\]\)\$\/\.test\(month\) \|\| !\/\^20\\d\{2\}\$\/\.test\(year\)\) return \{ ok: false, error: "Validade do cartão inválida\." \};\n    if \(!\/\^\\d\{3,4\}\$\/\.test\(cvv\)\) return \{ ok: false, error: "CVV inválido\." \};\n    if \(holder\.length < 3\) return \{ ok: false, error: "Nome impresso no cartão inválido\." \};/,
  '    if (!useSavedPaymentMethod) {\n      if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };\n      if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };\n      if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };\n      if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };\n    }',
  "if (!useSavedPaymentMethod)",
  "Validação condicional do cartão"
);

// 7) Obtém token novo ou reutiliza o token associado ao login.
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
      tokenInfo = await tokenizarNovoCartao({
        number,
        cvv,
        month,
        year,
        holder,
        nome,
        cpfCnpj: cardDocument,
        email
      });
    }

    const paymentMethodId = safe(tokenInfo?.paymentMethodId);
    if (!paymentMethodId) {
      return { ok:false, error:"Não foi possível preparar o cartão com segurança." };
    }
`;

if (!code.includes("let tokenInfo;")) {
  replaceExact(
    '    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {\n      cardAttempt += 1;\n    }\n\n    await saveSession(checkoutId, {',
    '    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {\n      cardAttempt += 1;\n    }' + tokenBlock + '\n    await saveSession(checkoutId, {',
    "Tokenização antes da cobrança"
  );
}

// 8) Guarda apenas token + metadados seguros durante a tentativa. Nunca PAN/CVV.
replaceExact(
  '      compraRegistrada: false,\n      cardAttempt,\n      updatedAtDate: new Date()',
  '      compraRegistrada: false,\n      cardAttempt,\n      memberId,\n      pendingPaymentMethodId: paymentMethodId,\n      pendingValidaPayCustomerId: safe(tokenInfo?.customerId),\n      pendingCardBrand: safe(tokenInfo?.cardBrand) || brand(number),\n      pendingCardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),\n      pendingCardExpirationMonth: safe(tokenInfo?.cardExpirationMonth) || month,\n      pendingCardExpirationYear: safe(tokenInfo?.cardExpirationYear) || year,\n      pendingCardHolderName: safe(tokenInfo?.cardHolderName) || holder,\n      pendingCardDocument: digits(tokenInfo?.cardDocument || cardDocument),\n      updatedAtDate: new Date()',
  "Metadados temporários do token"
);

// 9) A cobrança recebe paymentMethodId. O bloco com PAN/CVV sai do payload da cobrança.
replaceExact(
  '        phone: whatsapp\n      },\n      installments,',
  '        phone: whatsapp\n      },\n      paymentMethodId,\n      installments,',
  "Token no payload da cobrança"
);

replaceRegex(
  /\n    chargePayload\.card = \{\n      number,\n      cvv,\n      name: holder,\n      expiration: month \+ "\\/" \+ year\n    \};\n/,
  '\n',
  null,
  "Remoção de PAN/CVV do payload final"
);

// 10) Resposta ao checkout usa os metadados do token, inclusive no cartão salvo.
replaceExact(
  '      cardBrand: safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: number.slice(-4),',
  '      cardBrand: safe(tokenInfo?.cardBrand) || safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),',
  "Metadados do cartão na resposta"
);

// Garantias explícitas para evitar regressão silenciosa.
const required = [
  'import { tokenize } from "@validapay/tokenize";',
  'salvarMetodoPagamentoAprovado',
  'useSavedPaymentMethod',
  'paymentMethodId,',
  'await persistirMetodoPagamentoAprovado(session, chargeId);'
];
for (const marker of required) {
  if (!code.includes(marker)) fail(`Validação final falhou: ${marker}`);
}

if (/chargePayload\.card\s*=\s*\{/.test(code)) {
  fail("Validação final falhou: PAN/CVV ainda seriam enviados no payload final da cobrança.");
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Cartão salvo restaurado com tokenização: token + últimos 4/validade/titular, sem armazenar PAN ou CVV.");
} else {
  console.log("Fluxo de cartão salvo tokenizado já está aplicado.");
}
