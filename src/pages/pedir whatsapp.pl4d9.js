import wixWindowFrontend from "wix-window-frontend";

// POPUP: pedir whatsapp
// HTML OFICIAL: #htmlWhatsappInicial
//
// R5
//
// - A confirmação dupla acontece dentro do HTML do popup.
// - O Velo só confirma depois de receber VERIFY_WHATSAPP.
// - CLOSE/FECHAR encerra o popup sem identificar.
// - A página principal continua consultando clientes e compras.

const HTML_WHATSAPP_INICIAL = "#htmlWhatsappInicial";

let contexto = {};
let htmlPronto = false;

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
    if (text.startsWith("{") || text.startsWith("[")) {
      try { data = JSON.parse(text); }
      catch (error) { data = { type: text }; }
    } else {
      data = { type: text };
    }
  }

  if (data && typeof data === "object" && data.data && typeof data.data === "object" && !data.type) {
    data = data.data;
  }

  return data && typeof data === "object" ? data : {};
}

function enviarInit() {
  if (!htmlPronto) return;

  $w(HTML_WHATSAPP_INICIAL).postMessage({
    type: "INIT",
    whatsapp: safe(contexto.whatsapp),
    ddi: safe(contexto.ddi) || "55",
    country: safe(contexto.country) || "br",
    closeLabel: "FECHAR"
  });
}

function whatsappValido(data = {}) {
  const ddi = digits(data.ddi || contexto.ddi || "55");
  let whatsapp = digits(data.whatsapp);
  const whatsappE164 = digits(data.whatsappE164);

  if (!whatsapp && whatsappE164) {
    whatsapp = ddi && whatsappE164.startsWith(ddi)
      ? whatsappE164.slice(ddi.length)
      : whatsappE164;
  }

  if (ddi === "55" && whatsapp.startsWith("55") && whatsapp.length >= 12) {
    whatsapp = whatsapp.slice(2);
  }

  if (ddi === "55") return /^\d{10,11}$/.test(whatsapp);
  return whatsapp.length >= 8 && whatsapp.length <= 15;
}

function fecharComWhatsapp(data = {}) {
  if (!whatsappValido(data)) {
    $w(HTML_WHATSAPP_INICIAL).postMessage({
      type: "VERIFY_ERROR",
      error: "Digite um número de WhatsApp válido."
    });
    return;
  }

  const ddi = digits(data.ddi || contexto.ddi || "55") || "55";
  let whatsapp = digits(data.whatsapp);
  const explicitE164 = digits(data.whatsappE164);

  if (!whatsapp && explicitE164) {
    whatsapp = explicitE164.startsWith(ddi)
      ? explicitE164.slice(ddi.length)
      : explicitE164;
  }

  if (ddi === "55" && whatsapp.startsWith("55") && whatsapp.length >= 12) {
    whatsapp = whatsapp.slice(2);
  }

  const whatsappE164 = explicitE164
    ? `+${explicitE164}`
    : `+${ddi}${whatsapp}`;

  wixWindowFrontend.lightbox.close({
    action: "VERIFY",
    whatsapp,
    whatsappE164,
    ddi,
    country: safe(data.country || contexto.country).toLowerCase() || "br",
    countryName: safe(data.countryName) || "Brasil",
    whatsappConfirmado: true,
    confirmacaoWhatsappVersao: 3,
    confirmadoEm: new Date().toISOString()
  });
}

function fecharPopup() {
  wixWindowFrontend.lightbox.close({
    action: "CLOSE",
    closed: true
  });
}

$w.onReady(function () {
  contexto = wixWindowFrontend.lightbox.getContext() || {};
  const html = $w(HTML_WHATSAPP_INICIAL);

  html.onMessage((event) => {
    const data = normalizarMensagem(event.data);
    const type = safe(data.type || data.tipo || data.action).toUpperCase();
    if (!type) return;

    switch (type) {
      case "READY":
        htmlPronto = true;
        enviarInit();
        return;

      case "VERIFY_WHATSAPP":
        fecharComWhatsapp(data);
        return;

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