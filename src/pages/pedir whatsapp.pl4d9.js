import wixWindowFrontend from "wix-window-frontend";

// POPUP: pedir whatsapp
// HTML EXISTENTE: #html1
//
// R3
//
// - A confirmação dupla acontece dentro do HTML do popup.
// - O Velo só fecha depois de receber VERIFY_WHATSAPP.
// - O resultado informa à página principal que o WhatsApp
//   já passou pela confirmação dupla.
// - A página principal continua consultando clientes e compras.

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

    if (
      text.startsWith("{") ||
      text.startsWith("[")
    ) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = {
          type: text
        };
      }
    } else {
      data = {
        type: text
      };
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

  return (
    data &&
    typeof data === "object"
      ? data
      : {}
  );
}

function enviarInit() {
  if (!htmlPronto) {
    return;
  }

  $w("#html1").postMessage({
    type: "INIT",

    whatsapp:
      safe(
        contexto.whatsapp
      ),

    ddi:
      safe(
        contexto.ddi
      ) || "55",

    country:
      safe(
        contexto.country
      ) || "br"
  });
}

function whatsappValido(data = {}) {
  const ddi =
    digits(
      data.ddi ||
      contexto.ddi ||
      "55"
    );

  let whatsapp =
    digits(
      data.whatsapp
    );

  const whatsappE164 =
    digits(
      data.whatsappE164
    );

  if (
    !whatsapp &&
    whatsappE164
  ) {
    whatsapp =
      (
        ddi &&
        whatsappE164.startsWith(ddi)
      )
        ? whatsappE164.slice(
          ddi.length
        )
        : whatsappE164;
  }

  if (
    ddi === "55" &&
    whatsapp.startsWith("55") &&
    whatsapp.length >= 12
  ) {
    whatsapp =
      whatsapp.slice(2);
  }

  if (ddi === "55") {
    return /^\d{10,11}$/.test(
      whatsapp
    );
  }

  return (
    whatsapp.length >= 8 &&
    whatsapp.length <= 15
  );
}

function fecharComWhatsapp(data = {}) {
  if (!whatsappValido(data)) {
    $w("#html1").postMessage({
      type: "VERIFY_ERROR",

      error:
        "Digite um número de WhatsApp válido."
    });

    return;
  }

  const ddi =
    digits(
      data.ddi ||
      contexto.ddi ||
      "55"
    ) || "55";

  let whatsapp =
    digits(
      data.whatsapp
    );

  const explicitE164 =
    digits(
      data.whatsappE164
    );

  if (
    !whatsapp &&
    explicitE164
  ) {
    whatsapp =
      explicitE164.startsWith(ddi)
        ? explicitE164.slice(
          ddi.length
        )
        : explicitE164;
  }

  if (
    ddi === "55" &&
    whatsapp.startsWith("55") &&
    whatsapp.length >= 12
  ) {
    whatsapp =
      whatsapp.slice(2);
  }

  const whatsappE164 =
    explicitE164
      ? `+${explicitE164}`
      : `+${ddi}${whatsapp}`;

  wixWindowFrontend
    .lightbox
    .close({
      action: "VERIFY",

      whatsapp,

      whatsappE164,

      ddi,

      country:
        safe(
          data.country ||
          contexto.country
        ).toLowerCase() ||
        "br",

      countryName:
        safe(
          data.countryName
        ) ||
        "Brasil",

      /*
        VERIFY_WHATSAPP só é enviado pelo novo HTML
        depois que as duas digitações forem iguais.
      */
      whatsappConfirmado: true,
      confirmacaoWhatsappVersao: 3,
      confirmadoEm:
        new Date().toISOString()
    });
}

$w.onReady(function () {
  contexto =
    wixWindowFrontend
      .lightbox
      .getContext() || {};

  const html =
    $w("#html1");

  html.onMessage((event) => {
    const data =
      normalizarMensagem(
        event.data
      );

    const type =
      safe(
        data.type ||
        data.tipo
      ).toUpperCase();

    if (!type) {
      return;
    }

    switch (type) {
      case "READY":
        htmlPronto = true;
        enviarInit();
        return;

      case "VERIFY_WHATSAPP":
        fecharComWhatsapp(data);
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