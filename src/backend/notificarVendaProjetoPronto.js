import wixData from "wix-data";
import { fetch } from "wix-fetch";
import { getSecret } from "wix-secrets-backend";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };
const SITE_BASE = "https://www.pelegobox.com.br";
const MAKE_SALE_SECRET = "MAKE_VENDA_PROJETOS_PRONTOS_WEBHOOK";
const CHATBOT_SECRET = "RESPONDECHAT_VENDA_PROJETOS_PRONTOS_WEBH";

const safe = value => String(value ?? "").trim();
const digits = value => safe(value).replace(/\D/g, "");

function phone(value) {
  let n = digits(value);
  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) return `+${n}`;
  if (n.length === 10 || n.length === 11) return `+55${n}`;
  return "";
}

function type(value) {
  const t = safe(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s-]+/g, "_");
  return ["MEDIDAS", "GRAFICOS", "PROJETO_COMPLETO"].includes(t) ? t : "MEDIDAS";
}

async function optionalSecret(name) {
  try { return safe(await getSecret(name)); } catch (_) { return ""; }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Webhook respondeu HTTP ${response.status}.`);
}

async function findSession(checkoutId) {
  const result = await wixData.query(SESSIONS).eq("checkoutId", safe(checkoutId)).limit(1).find({ ...DB, consistentRead: true });
  return result.items[0] || null;
}

export async function notificarVendaProjetoProntoAprovada({ checkoutId, chargeId, paymentMethod = "" } = {}) {
  const session = await findSession(checkoutId);
  if (!session) return { ok: false, error: "session_not_found" };

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
    deliveryUrl: `${SITE_BASE}/entregaprojetosprontos?checkout_id=${encodeURIComponent(safe(session.checkoutId))}`
  };

  const patch = { ...session, updatedAtDate: new Date() };
  let changed = false;
  const result = { ok: true, email: "skipped", chatbot: "skipped" };

  if (!session.emailEnviadoEm && session.emailEnviado !== true) {
    const url = await optionalSecret(MAKE_SALE_SECRET);
    if (url) {
      try {
        await postJson(url, payload);
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
    if (url) {
      try {
        await postJson(url, payload);
        patch.chatbotVendaEnviado = true;
        changed = true;
        result.chatbot = "sent";
      } catch (error) {
        result.chatbot = "error";
        console.error("Falha ao disparar chatbot da venda:", error?.message || error);
      }
    } else {
      result.chatbot = "secret_missing";
    }
  }

  if (changed) await wixData.update(SESSIONS, patch, DB);
  return result;
}
