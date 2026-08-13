const fs = require("fs");

const FILE = "src/backend/validaPayCartaoProjetosProntos.jsw";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho atual não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

if (!code.includes("CARTAO_TOKENIZACAO_COM_FALLBACK_V1")) {
  replaceOnce(
`    const emailInformado = safe(input.email || ctx.email).toLowerCase();
    const identidadeMembro = await identidadeMembroAtualCartao();
    if (!identidadeMembro.memberId || !identidadeMembro.email) return { ok:false, error:"Faça login novamente para pagar com cartão." };
    if (emailInformado && emailInformado !== identidadeMembro.email) return { ok:false, error:"O e-mail do checkout não corresponde ao login atual." };
    const email = identidadeMembro.email;
    const memberId = identidadeMembro.memberId;`,
`    const emailInformado = safe(input.email || ctx.email).toLowerCase();
    let identidadeMembro = { memberId: "", email: "" };
    try {
      identidadeMembro = await identidadeMembroAtualCartao();
    } catch (error) {
      console.warn("Identidade Wix indisponível no cartão; usando cadastro já validado do checkout:", error?.message || error);
    }
    if (identidadeMembro.email && emailInformado && emailInformado !== identidadeMembro.email) {
      return { ok:false, error:"O e-mail do checkout não corresponde ao login atual." };
    }
    const email = identidadeMembro.email || emailInformado;
    const memberId = identidadeMembro.memberId;`,
    "Identidade do cartão sem bloqueio indevido"
  );

  replaceOnce(
`    let tokenInfo;
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
    if (!paymentMethodId) return { ok:false, error:"Não foi possível preparar o cartão com segurança." };`,
`    /* CARTAO_TOKENIZACAO_COM_FALLBACK_V1
       Cartão salvo exige token. Cartão novo tenta tokenizar por até 5 s;
       se a tokenização não responder, a cobrança segue pelo objeto card,
       formato oficialmente aceito pela mesma rota /v1/charges. */
    let tokenInfo = null;
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
      try {
        tokenInfo = await Promise.race([
          tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj: cardDocument, email }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("tokenization_timeout")), 5000))
        ]);
      } catch (error) {
        tokenInfo = null;
        console.warn("Tokenização ValidaPay indisponível; cobrança seguirá com cartão direto:", error?.message || error);
      }
    }

    const paymentMethodId = safe(tokenInfo?.paymentMethodId);
    if (useSavedPaymentMethod && !paymentMethodId) {
      return { ok:false, error:"Seu cartão salvo não pôde ser carregado. Informe um novo cartão." };
    }`,
    "Fallback da tokenização"
  );

  replaceOnce(
`    chargePayload.items = [{ priceId, quantity: 1 }];`,
`    if (paymentMethodId) {
      chargePayload.paymentMethodId = paymentMethodId;
    } else {
      chargePayload.card = {
        number,
        cvv,
        name: holder,
        expiration: month + "/" + year
      };
    }

    chargePayload.items = [{ priceId, quantity: 1 }];`,
    "Escolher token ou cartão direto"
  );
}

const tokenObrigatorioNoPayload = `      paymentMethodId,\n      installments,\n      passFeesToCustomer: false,`;
const payloadSemTokenObrigatorio = `      installments,\n      passFeesToCustomer: false,`;
if (code.includes(tokenObrigatorioNoPayload)) {
  code = code.replace(tokenObrigatorioNoPayload, payloadSemTokenObrigatorio);
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Cartão ValidaPay estabilizado: tokenização preferencial com fallback direto oficial.");
} else {
  console.log("Fallback seguro do cartão já está aplicado.");
}

require("./estado-final-projetos-prontos-2026-08-13.cjs");
