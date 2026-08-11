import wixWindowFrontend from "wix-window-frontend";

import {
  buscarCliente
} from "backend/clientes.web";

// POPUP: pedir whatsapp
// HTML OFICIAL: #htmlWhatsappInicial
// R7 — DUPLA CONFIRMAÇÃO SEM EXCEÇÃO
// 1) Digita WhatsApp.
// 2) Consulta cadastro em paralelo.
// 3) Digita o MESMO WhatsApp novamente.
// 4) Só então fecha o Pega Zap.

const HTML_WHATSAPP_INICIAL = "#htmlWhatsappInicial";
const CONFIRMACAO_FLUXO_VERSAO = 4;

let contexto = {};
let htmlPronto = false;
let consultando = false;
let primeiroTelefone = null;
let clienteLocalizado = null;

function safe(value) {
  return String(value ?? "").trim();
}

function digits(value) {
  return safe(value).replace(/\D/g, "");
}

function normalizarMensagem(raw) {
  let data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); }
    catch (_) { data = { type: data }; }
  }
  if (data && typeof data === "object" && data.data && typeof data.data === "object" && !data.type) {
    data = data.data;
  }
  return data && typeof data === "object" ? data : {};
}

function enviar(message) {
  try {
    $w(HTML_WHATSAPP_INICIAL).postMessage(message);
  } catch (error) {
    console.error("Falha ao enviar mensagem ao Pega Zap:", error?.message || error);
  }
}

function enviarInit() {
  if (!htmlPronto) return;
  enviar({
    type: "INIT",
    whatsapp: safe(contexto.whatsapp),
    ddi: safe(contexto.ddi) || "55",
    country: safe(contexto.country) || "br",
    projectCode: safe(contexto.codigoProjeto),
    projectTitle: safe(contexto.tituloProjeto),
    closeLabel: "FECHAR",
    lookupBeforeConfirm: true,
    alwaysConfirmTwice: true
  });
}

function telefoneNormalizado(data = {}) {
  const ddi = digits(data.ddi || contexto.ddi || "55") || "55";
  let whatsapp = digits(data.whatsapp || data.telefone || data.whatsappDigits);
  const explicitE164 = digits(data.whatsappE164);

  if (!whatsapp && explicitE164) {
    whatsapp = explicitE164.startsWith(ddi)
      ? explicitE164.slice(ddi.length)
      : explicitE164;
  }

  if (ddi === "55" && whatsapp.startsWith("55") && whatsapp.length >= 12) {
    whatsapp = whatsapp.slice(2);
  }

  const valido = ddi === "55"
    ? /^\d{10,11}$/.test(whatsapp)
    : whatsapp.length >= 8 && whatsapp.length <= 15;

  return {
    valido,
    whatsapp,
    whatsappE164: valido ? `+${ddi}${whatsapp}` : "",
    ddi,
    country: safe(data.country || contexto.country || "br").toLowerCase(),
    countryName: safe(data.countryName) || "Brasil"
  };
}

async function consultarPrimeiraEntrada(data = {}) {
  if (consultando) return;

  const telefone = telefoneNormalizado(data);
  if (!telefone.valido) {
    enviar({ type: "LOOKUP_ERROR", error: "Digite um número de WhatsApp válido." });
    return;
  }

  consultando = true;
  primeiroTelefone = telefone;
  clienteLocalizado = null;

  try {
    clienteLocalizado = await buscarCliente(telefone.whatsappE164);
    enviar({
      type: "LOOKUP_RESULT",
      ok: true,
      exists: Boolean(clienteLocalizado),
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,
      countryName: telefone.countryName,
      requireSecondEntry: true
    });
  } catch (error) {
    console.error("Falha ao consultar WhatsApp inicial:", error?.message || error);
    primeiroTelefone = null;
    enviar({ type: "LOOKUP_ERROR", error: "Não foi possível consultar seu cadastro agora. Tente novamente." });
  } finally {
    consultando = false;
  }
}

function confirmarSegundaEntrada(data = {}) {
  const telefone = telefoneNormalizado(data);

  if (!telefone.valido || !primeiroTelefone?.valido) {
    enviar({ type: "VERIFY_ERROR", error: "Digite novamente um WhatsApp válido." });
    return;
  }

  if (
    telefone.ddi !== primeiroTelefone.ddi ||
    telefone.whatsapp !== primeiroTelefone.whatsapp
  ) {
    enviar({ type: "VERIFY_ERROR", error: "Os números não são iguais. Digite novamente com atenção." });
    return;
  }

  wixWindowFrontend.lightbox.close({
    action: "VERIFY",
    whatsapp: primeiroTelefone.whatsapp,
    whatsappE164: primeiroTelefone.whatsappE164,
    ddi: primeiroTelefone.ddi,
    country: primeiroTelefone.country,
    countryName: primeiroTelefone.countryName,
    whatsappConfirmado: true,
    confirmacaoWhatsappVersao: CONFIRMACAO_FLUXO_VERSAO,
    confirmadoEm: new Date().toISOString(),
    clienteExiste: Boolean(clienteLocalizado),
    cliente: clienteLocalizado && typeof clienteLocalizado === "object"
      ? clienteLocalizado
      : null
  });
}

function fecharPopup() {
  wixWindowFrontend.lightbox.close({ action: "CLOSE", closed: true });
}

$w.onReady(function () {
  contexto = wixWindowFrontend.lightbox.getContext() || {};
  const html = $w(HTML_WHATSAPP_INICIAL);

  html.onMessage((event) => {
    const data = normalizarMensagem(event.data);
    const type = safe(data.type || data.tipo || data.action).toUpperCase();

    switch (type) {
      case "READY":
        htmlPronto = true;
        enviarInit();
        return;
      case "LOOKUP_WHATSAPP":
      case "CHECK_WHATSAPP":
        consultarPrimeiraEntrada(data).catch(console.error);
        return;
      case "VERIFY_WHATSAPP":
        confirmarSegundaEntrada(data);
        return;
      case "CLOSE_WITHOUT_IDENTIFY":
      case "CLOSE":
      case "FECHAR":
      case "CANCEL":
      case "CANCELAR":
        fecharPopup();
        return;
      default:
        return;
    }
  });

  setTimeout(() => {
    htmlPronto = true;
    enviarInit();
  }, 300);
});
