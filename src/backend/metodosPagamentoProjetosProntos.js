import wixData from "wix-data";

const COLLECTION = "MetodosPagamentoProjetosProntos";
const DB = { suppressAuth: true };

const safe = value => String(value ?? "").trim();
const email = value => safe(value).toLowerCase();
const digits = value => safe(value).replace(/\D/g, "");

export function metodoPagamentoPublico(item) {
  if (!item) return null;
  const idPagamentoSeguro = safe(item.paymentMethodId);
  const reutilizavel = item.ativo !== false && idPagamentoSeguro && !idPagamentoSeguro.startsWith("SEM_TOKEN:");
  return {
    existe: Boolean(reutilizavel),
    cardBrand: safe(item.cardBrand),
    cardLastFour: digits(item.cardLastFour).slice(-4),
    cardExpirationMonth: digits(item.cardExpirationMonth).padStart(2, "0").slice(-2),
    cardExpirationYear: digits(item.cardExpirationYear).slice(-4),
    cardHolderName: safe(item.cardHolderName),
    cardDocument: digits(item.cardDocument),
    ativo: reutilizavel === true
  };
}

async function buscarRegistroPagamentoPrivadoPorEmail(value) {
  const mail = email(value);
  if (!mail) return null;

  const result = await wixData
    .query(COLLECTION)
    .eq("email", mail)
    .descending("_updatedDate")
    .limit(1)
    .find({ ...DB, consistentRead: true });

  return result.items?.[0] || null;
}

export async function buscarMetodoPagamentoPrivadoPorEmail(value) {
  const mail = email(value);
  if (!mail) return null;

  const result = await wixData
    .query(COLLECTION)
    .eq("email", mail)
    .eq("ativo", true)
    .descending("_updatedDate")
    .limit(1)
    .find({ ...DB, consistentRead: true });

  return result.items?.[0] || null;
}

export async function salvarMetodoPagamentoAprovado({
  email: emailLogin,
  memberId,
  clienteId,
  paymentMethodId,
  validaPayCustomerId,
  cardBrand,
  cardLastFour,
  cardExpirationMonth,
  cardExpirationYear,
  cardHolderName,
  cardDocument,
  ultimoPagamentoId
} = {}) {
  const mail = email(emailLogin);
  const token = safe(paymentMethodId);
  if (!mail) return null;

  const pagamentoId = safe(ultimoPagamentoId);
  const idPersistido = token || `SEM_TOKEN:${pagamentoId || Date.now()}`;
  const atual = await buscarRegistroPagamentoPrivadoPorEmail(mail);
  const now = new Date();
  const record = {
    ...(atual || {}),
    title: mail,
    email: mail,
    memberId: safe(memberId),
    clienteId: safe(clienteId),
    paymentMethodId: idPersistido,
    validaPayCustomerId: safe(validaPayCustomerId),
    cardBrand: safe(cardBrand).toUpperCase(),
    cardLastFour: digits(cardLastFour).slice(-4),
    cardExpirationMonth: digits(cardExpirationMonth).padStart(2, "0").slice(-2),
    cardExpirationYear: digits(cardExpirationYear).slice(-4),
    cardHolderName: safe(cardHolderName).replace(/\s+/g, " ").toUpperCase(),
    cardDocument: digits(cardDocument),
    ativo: Boolean(token),
    criadoEm: atual?.criadoEm || now,
    atualizadoEm: now,
    ultimoPagamentoId: pagamentoId
  };

  if (atual?._id) return wixData.update(COLLECTION, record, DB);
  return wixData.insert(COLLECTION, record, DB);
}
