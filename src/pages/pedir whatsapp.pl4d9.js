import wixWindowFrontend from "wix-window-frontend";

import {
  buscarCliente
} from "backend/clientes.web";

// POPUP: pedir whatsapp
// HTML OFICIAL: #htmlWhatsappInicial
//
// R6 — IDENTIFICAÇÃO UNIVERSAL
//
// - Primeira digitação consulta se o WhatsApp já é cliente.
// - Cliente existente segue sem segunda digitação.
// - Cliente novo confirma o mesmo WhatsApp no próprio popup.
// - O popup "Whatsapp projeto pronto" não participa deste fluxo.
// - CLOSE/FECHAR/CLOSE_WITHOUT_IDENTIFY encerram a lightbox.

const HTML_WHATSAPP_INICIAL =
  "#htmlWhatsappInicial";

const CONFIRMACAO_FLUXO_VERSAO = 3;

let contexto = {};
let htmlPronto = false;
let consultando = false;

function safe(value) {
  return String(value ?? "").trim();
}

function digits(value) {
  return safe(value).replace(/\D/g, "");
}

function normalizarMensagem(raw) {
  let data = raw;

  if (typeof data === "string") {
    const text = data.trim();

    if (
      text.startsWith("{") ||
      text.startsWith("[")
    ) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { type: text };
      }
    } else {
      data = { type: text };
    }
  }

  if (
    data &&
    typeof data === "object" &&
    data.data &&
    typeof data.data === "object" &&
    !data.type
  ) {
    data = data.data;
  }

  return data && typeof data === "object"
    ? data
    : {};
}

function enviar(message) {
  try {
    $w(HTML_WHATSAPP_INICIAL)
      .postMessage(message);
  } catch (error) {
    console.error(
      "Falha ao enviar mensagem ao WhatsApp inicial:",
      error?.message || error
    );
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
    lookupBeforeConfirm: true
  });
}

function telefoneNormalizado(data = {}) {
  const ddi =
    digits(
      data.ddi ||
      contexto.ddi ||
      "55"
    ) || "55";

  let whatsapp =
    digits(
      data.whatsapp ||
      data.telefone ||
      data.whatsappDigits
    );

  const explicitE164 =
    digits(data.whatsappE164);

  if (!whatsapp && explicitE164) {
    whatsapp =
      explicitE164.startsWith(ddi)
        ? explicitE164.slice(ddi.length)
        : explicitE164;
  }

  if (
    ddi === "55" &&
    whatsapp.startsWith("55") &&
    whatsapp.length >= 12
  ) {
    whatsapp = whatsapp.slice(2);
  }

  const valido =
    ddi === "55"
      ? /^\d{10,11}$/.test(whatsapp)
      : (
        whatsapp.length >= 8 &&
        whatsapp.length <= 15
      );

  return {
    valido,
    whatsapp,
    whatsappE164:
      valido
        ? `+${ddi}${whatsapp}`
        : "",
    ddi,
    country:
      safe(
        data.country ||
        contexto.country ||
        "br"
      ).toLowerCase(),
    countryName:
      safe(data.countryName) ||
      "Brasil"
  };
}

function fecharComWhatsapp(
  data = {},
  extra = {}
) {
  const telefone =
    telefoneNormalizado(data);

  if (!telefone.valido) {
    enviar({
      type: "VERIFY_ERROR",
      error:
        "Digite um número de WhatsApp válido."
    });
    return;
  }

  wixWindowFrontend.lightbox.close({
    action: "VERIFY",
    whatsapp: telefone.whatsapp,
    whatsappE164: telefone.whatsappE164,
    ddi: telefone.ddi,
    country: telefone.country,
    countryName: telefone.countryName,
    whatsappConfirmado: true,
    confirmacaoWhatsappVersao:
      CONFIRMACAO_FLUXO_VERSAO,
    confirmadoEm:
      new Date().toISOString(),
    clienteExiste:
      extra.clienteExiste === true,
    cliente:
      extra.cliente &&
      typeof extra.cliente === "object"
        ? extra.cliente
        : null
  });
}

async function consultarPrimeiraEntrada(
  data = {}
) {
  if (consultando) return;

  const telefone =
    telefoneNormalizado(data);

  if (!telefone.valido) {
    enviar({
      type: "LOOKUP_ERROR",
      error:
        "Digite um número de WhatsApp válido."
    });
    return;
  }

  consultando = true;

  try {
    const cliente =
      await buscarCliente(
        telefone.whatsappE164
      );

    if (cliente) {
      /*
        Cliente já conhecido: uma digitação basta.
        O número já existe na base e seguimos direto.
      */
      fecharComWhatsapp(
        {
          ...data,
          ...telefone
        },
        {
          clienteExiste: true,
          cliente
        }
      );
      return;
    }

    /*
      Cliente novo: o HTML permanece aberto e pede
      a segunda digitação para confirmar o WhatsApp.
    */
    enviar({
      type: "LOOKUP_RESULT",
      ok: true,
      exists: false,
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,
      countryName: telefone.countryName
    });

  } catch (error) {
    console.error(
      "Falha ao consultar WhatsApp inicial:",
      error?.message || error
    );

    enviar({
      type: "LOOKUP_ERROR",
      error:
        "Não foi possível consultar seu cadastro agora. Tente novamente."
    });
  } finally {
    consultando = false;
  }
}

function fecharPopup() {
  wixWindowFrontend.lightbox.close({
    action: "CLOSE",
    closed: true
  });
}

$w.onReady(function () {
  contexto =
    wixWindowFrontend.lightbox.getContext() ||
    {};

  const html =
    $w(HTML_WHATSAPP_INICIAL);

  html.onMessage((event) => {
    const data =
      normalizarMensagem(event.data);

    const type =
      safe(
        data.type ||
        data.tipo ||
        data.action
      ).toUpperCase();

    if (!type) return;

    switch (type) {
      case "READY":
        htmlPronto = true;
        enviarInit();
        return;

      case "LOOKUP_WHATSAPP":
      case "CHECK_WHATSAPP":
        consultarPrimeiraEntrada(data)
          .catch(console.error);
        return;

      case "VERIFY_WHATSAPP":
        /*
          Esta mensagem só deve chegar depois da segunda
          digitação de um cliente novo. Mantemos suporte ao
          HTML anterior para não quebrar a página durante a troca.
        */
        fecharComWhatsapp(
          data,
          {
            clienteExiste: false
          }
        );
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
  }, 350);

  setTimeout(() => {
    enviarInit();
  }, 900);
});