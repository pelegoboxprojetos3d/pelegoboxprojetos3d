const fs = require('fs');
const path = 'src/backend/validaPayCartaoProjetosProntos.jsw';
let code = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const count = code.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  code = code.replace(from, to);
}

replaceOnce(
  'import { tokenize as tokenizeValidaPayCard } from "@validapay/tokenize";\n',
  '',
  'Remover import de tokenização que derrubou o backend Wix'
);

const tokenStart = code.indexOf('// CARTAO_SALVO_TOKENIZADO_V1');
const tokenEnd = code.indexOf('async function identidadeMembroAtualCartao', tokenStart);
if (tokenStart < 0 || tokenEnd < 0 || tokenEnd <= tokenStart) {
  throw new Error('Bloco CARTAO_SALVO_TOKENIZADO_V1 não localizado.');
}
code = code.slice(0, tokenStart) + code.slice(tokenEnd);

replaceOnce(
  '  // METADADOS_CARTAO_APROVADO_V2\n  if (!email) return null;',
  '  if (!paymentMethodId || !email) return null;',
  'Restaurar proteção do método de pagamento'
);

replaceOnce(
`    } else {
      // Um cartão digitado pela primeira vez é tokenizado ANTES da cobrança.
      // Assim, se o pagamento aprovar, esse mesmo token pode ser reutilizado
      // nas próximas compras sem guardar o número completo ou o CVV no Wix.
      const tokenized = await tokenizarCartaoParaUsoFuturo({
        number,
        holder,
        cvv,
        month,
        year,
        customerName: nome,
        customerDocument: cardDocument,
        customerEmail: email
      });
      tokenInfo = {
        ...tokenized,
        cardBrand: safe(tokenized.cardBrand) || brand(number),
        cardLastFour: safe(tokenized.cardLastFour) || number.slice(-4),
        cardExpirationMonth: safe(tokenized.cardExpirationMonth) || month,
        cardExpirationYear: safe(tokenized.cardExpirationYear) || year,
        cardHolderName: safe(tokenized.cardHolderName) || holder,
        cardDocument
      };
      paymentMethodId = safe(tokenInfo.paymentMethodId);
    }`,
`    } else {
      tokenInfo = {
        cardBrand: brand(number),
        cardLastFour: number.slice(-4),
        cardExpirationMonth: month,
        cardExpirationYear: year,
        cardHolderName: holder,
        cardDocument
      };
    }`,
  'Restaurar preparação estável do cartão novo'
);

replaceOnce(
`    if (!paymentMethodId) {
      return { ok:false, error:"Não foi possível preparar o cartão de forma segura para pagamento." };
    }
    // Tanto o cartão recém-digitado quanto o cartão salvo pagam por token.
    // O objeto card bruto não é mais enviado para /v1/charges.
    chargePayload.paymentMethodId = paymentMethodId;`,
`    if (useSavedPaymentMethod) {
      chargePayload.paymentMethodId = paymentMethodId;
    } else {
      chargePayload.card = {
        number,
        cvv,
        name: holder,
        expiration: month + "/" + year
      };
    }`,
  'Restaurar cobrança estável do cartão digitado'
);

if (code.includes('@validapay/tokenize') || code.includes('tokenizarCartaoParaUsoFuturo')) {
  throw new Error('Ainda restou código da tokenização regressiva no backend.');
}
if (!code.includes('chargePayload.card = {') || !code.includes('chargePayload.paymentMethodId = paymentMethodId;')) {
  throw new Error('Validação final da cobrança estável falhou.');
}

fs.writeFileSync(path, code, 'utf8');
console.log('HOTFIX OK: cartão novo voltou ao fluxo estável; cartão salvo tokenizado ficou desativado.');
