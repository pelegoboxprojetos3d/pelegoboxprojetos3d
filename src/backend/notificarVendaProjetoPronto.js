import wixData from "wix-data";
import { fetch } from "wix-fetch";
import { getSecret } from "wix-secrets-backend";

const SESSIONS = "SessoesProjetosProntos2";
const HISTORICO_COMPRAS = "HistoricoComprasProjetosProntos";
const DB = { suppressAuth: true };
const SITE_BASE = "https://www.pelegobox.com.br";
const MAKE_SALE_SECRET = "MAKE_VENDA_PROJETOS_PRONTOS_WEBHOOK";
const CHATBOT_SECRET = "RESPONDECHAT_VENDA_PROJETOS_PRONTOS_WEBH";

const safe = value => String(value ?? "").trim();
const digits = value => safe(value).replace(/\D/g, "");

function phone(value) {
  const original = safe(value);
  let number = digits(original);
  if (!number) return "";
  if (original.startsWith("+") && number.length >= 7 && number.length <= 15) return `+${number}`;
  if (number.startsWith("55") && (number.length === 12 || number.length === 13)) return `+${number}`;
  if (number.length === 10 || number.length === 11) return `+55${number}`;
  if (number.length >= 7 && number.length <= 15) return `+${number}`;
  return "";
}

function type(value) {
  const t = safe(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s-]+/g, "_");
  return ["MEDIDAS", "GRAFICOS", "PROJETO_COMPLETO"].includes(t) ? t : "MEDIDAS";
}

function gerarCodigoCompra() {
  const tempo = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PBX-PP-${tempo}-${aleatorio}`;
}

async function registrarHistoricoCompraAprovada({ session, chargeId, paymentMethod }) {
  const idPagamento = safe(chargeId || session?.paymentId || session?.validaPayChargeId);
  if (!idPagamento) return { ok: false, error: "payment_id_missing" };

  const existente = await wixData
    .query(HISTORICO_COMPRAS)
    .eq("idPagamento", idPagamento)
    .limit(1)
    .find({ ...DB, consistentRead: true });

  const itemExistente = existente.items?.[0];
  if (itemExistente) {
    return {
      ok: true,
      created: false,
      codigoCompra: safe(itemExistente.codigoCompra),
      historicoId: safe(itemExistente._id)
    };
  }

  const codigoCompra = gerarCodigoCompra();
  const produto = safe(session?.produto);
  const item = {
    title: codigoCompra,
    emailCompra: safe(session?.email).toLowerCase(),
    idPagamento,
    clienteId: safe(session?.clienteId),
    checkoutId: safe(session?.checkoutId),
    codigoProjeto: digits(session?.codigoProjeto),
    tipoProduto: type(session?.tipoProduto),
    produto,
    nomeCompra: safe(session?.nomeCliente || session?.nome),
    whatsappCompra: phone(session?.whatsapp || session?.whatsappE164 || session?.whatsApp),
    cpfCompra: digits(session?.cpfCnpj),
    dataCompra: new Date(),
    statusCompra: "approved",
    valorCompra: Number(session?.valor || 0),
    formaPagamento: safe(paymentMethod || session?.paymentMethod).toUpperCase(),
    codigoCompra
  };

  try {
    const salvo = await wixData.insert(HISTORICO_COMPRAS, item, DB);
    return {
      ok: true,
      created: true,
      codigoCompra,
      historicoId: safe(salvo?._id)
    };
  } catch (error) {
    // Proteção extra para duas confirmações chegando quase juntas.
    const repetido = await wixData
      .query(HISTORICO_COMPRAS)
      .eq("idPagamento", idPagamento)
      .limit(1)
      .find({ ...DB, consistentRead: true });

    const jaSalvo = repetido.items?.[0];
    if (jaSalvo) {
      return {
        ok: true,
        created: false,
        codigoCompra: safe(jaSalvo.codigoCompra),
        historicoId: safe(jaSalvo._id)
      };
    }
    throw error;
  }
}

async function optionalSecret(name) {
  try { return safe(await getSecret(name)); } catch (_) { return ""; }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/plain, */*"
    },
    body: JSON.stringify(payload)
  });

  let responseText = "";
  try { responseText = safe(await response.text()).slice(0, 800); } catch (_) {}

  if (!response.ok) {
    const error = new Error("Webhook respondeu HTTP " + response.status + (responseText ? ": " + responseText : "") + ".");
    error.statusCode = Number(response.status || 0);
    error.responseText = responseText;
    throw error;
  }

  return { statusCode: Number(response.status || 0), responseText };
}

async function postJsonRetry(url, payload) {
  const delays = [0, 700, 1600];
  let lastError = null;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    try {
      const result = await postJson(url, payload);
      return { ...result, attempt: attempt + 1 };
    } catch (error) {
      lastError = error;
      const status = Number(error?.statusCode || 0);
      const transient = !status || status === 408 || status === 425 || status === 429 || status >= 500;
      if (!transient) break;
    }
  }

  throw lastError || new Error("Falha ao enviar webhook.");
}

async function findSession(checkoutId) {
  const result = await wixData.query(SESSIONS).eq("checkoutId", safe(checkoutId)).limit(1).find({ ...DB, consistentRead: true });
  return result.items[0] || null;
}

export async function notificarVendaProjetoProntoAprovada({ checkoutId, chargeId, paymentMethod = "" } = {}) {
  const session = await findSession(checkoutId);
  if (!session) return { ok: false, error: "session_not_found" };

  let historico = { ok: false, error: "not_attempted" };
  try {
    historico = await registrarHistoricoCompraAprovada({ session, chargeId, paymentMethod });
  } catch (error) {
    historico = { ok: false, error: safe(error?.message || error).slice(0, 800) };
    console.error("Falha ao registrar histórico da compra:", error?.message || error);
  }

  const amount = Number(session.valor || 0);
  const payload = {
    event: "venda_aprovada_PROJETOS_PRONTOS",
    origem: "PELEGO_BOX_PROJETOS_PRONTOS",
    provider: "VALIDAPAY",
    paymentMethod: safe(paymentMethod || session.paymentMethod).toUpperCase(),
    status: "approved",
    dataISO: new Date().toISOString(),
    checkoutId: safe(session.checkoutId),
    chargeId: safe(chargeId || session.paymentId || session.validaPayChargeId),
    clienteId: safe(session.clienteId),
    nome: safe(session.nomeCliente || session.nome),
    email: safe(session.email).toLowerCase(),
    whatsapp: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),
    telefone: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),
    phone: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),
    cpfCnpj: digits(session.cpfCnpj),
    produto: safe(session.produto),
    tipoProduto: type(session.tipoProduto),
    codigoProjeto: digits(session.codigoProjeto),
    img: safe(session.img),
    valor: amount,
    valorFormatado: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + safe(session.produto),
    tituloEmail: safe(session.produto),
    botaoTexto: type(session.tipoProduto) === "GRAFICOS"
      ? "BAIXAR GRÁFICOS"
      : type(session.tipoProduto) === "PROJETO_COMPLETO"
        ? "BAIXAR PROJETO COMPLETO"
        : "BAIXAR MEDIDAS",
    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(safe(session.checkoutId)),
    deliveryUrl: `${SITE_BASE}/entregaprojetosprontos?checkout_id=${encodeURIComponent(safe(session.checkoutId))}`,
    codigoCompra: safe(historico?.codigoCompra)
  };

  const emailPayload = {
    ...payload,
    botaoUrl: payload.botaoUrl + "&via=email",
    deliveryUrl: payload.deliveryUrl + "&via=email"
  };

  const patch = { ...session, updatedAtDate: new Date() };
  let changed = false;
  const result = { ok: true, email: "skipped", chatbot: "skipped", historico };

  if (!session.emailEnviadoEm && session.emailEnviado !== true) {
    const url = await optionalSecret(MAKE_SALE_SECRET);
    if (url) {
      try {
        await postJson(url, emailPayload);
        patch.emailEnviadoEm = new Date();
        patch.emailEnviado = true;
        changed = true;
        result.email = "sent";
      } catch (error) {
        result.email = "error";
        console.error("Falha ao disparar email da venda:", error?.message || error);
      }
    } else {
      result.email = "secret_missing";
    }
  }

  if (session.chatbotVendaEnviado !== true) {
    const url = await optionalSecret(CHATBOT_SECRET);
    patch.chatbotVendaUltimaTentativaEm = new Date();
    changed = true;

    if (url) {
      try {
        const envio = await postJsonRetry(url, payload);
        patch.chatbotVendaEnviado = true;
        patch.chatbotVendaStatusCode = Number(envio?.statusCode || 0);
        patch.chatbotVendaResposta = safe(envio?.responseText);
        patch.chatbotVendaErro = "";
        patch.chatbotVendaTentativa = Number(envio?.attempt || 1);
        result.chatbot = "sent";
        result.chatbotStatusCode = Number(envio?.statusCode || 0);
      } catch (error) {
        patch.chatbotVendaEnviado = false;
        patch.chatbotVendaStatusCode = Number(error?.statusCode || 0);
        patch.chatbotVendaResposta = safe(error?.responseText);
        patch.chatbotVendaErro = safe(error?.message || error).slice(0, 800);
        result.chatbot = "error";
        result.chatbotStatusCode = Number(error?.statusCode || 0);
        result.chatbotError = patch.chatbotVendaErro;
        console.error("Falha ao disparar chatbot da venda:", error?.message || error);
      }
    } else {
      patch.chatbotVendaEnviado = false;
      patch.chatbotVendaErro = "secret_missing";
      result.chatbot = "secret_missing";
    }
  }

  if (changed) await wixData.update(SESSIONS, patch, DB);
  return result;
}
