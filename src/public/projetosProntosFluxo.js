function safe(value) {
  return String(value ?? "").trim();
}

export function somenteDigitos(value) {
  return safe(value).replace(/\D/g, "");
}

export function normalizarWhatsappNacionalBrasil(value) {
  let numero = somenteDigitos(value);

  if (
    numero.startsWith("55") &&
    (numero.length === 12 || numero.length === 13)
  ) {
    numero = numero.slice(2);
  }

  return (
    numero.length === 10 ||
    numero.length === 11
  )
    ? numero
    : "";
}

export function confirmarWhatsappBrasil(
  primeiro,
  confirmacao
) {
  const whatsappOriginal =
    normalizarWhatsappNacionalBrasil(
      primeiro
    );

  const whatsappConfirmado =
    normalizarWhatsappNacionalBrasil(
      confirmacao
    );

  if (!whatsappOriginal) {
    return {
      ok: false,
      reason: "PRIMEIRO_WHATSAPP_AUSENTE",
      whatsapp: ""
    };
  }

  if (!whatsappConfirmado) {
    return {
      ok: false,
      reason: "CONFIRMACAO_INVALIDA",
      whatsapp: ""
    };
  }

  if (
    whatsappOriginal !==
    whatsappConfirmado
  ) {
    return {
      ok: false,
      reason: "WHATSAPP_NAO_CONFERE",
      whatsapp: ""
    };
  }

  return {
    ok: true,
    reason: "",
    whatsapp: whatsappOriginal,
    whatsappE164:
      `+55${whatsappOriginal}`
  };
}

export function resolverConfirmacaoWhatsappBrasil({
  primeiro,
  confirmacaoAnterior,
  confirmacaoAtual
} = {}) {
  const resultado =
    confirmarWhatsappBrasil(
      primeiro,
      confirmacaoAtual
    );

  return {
    ...resultado,
    divergente:
      resultado.reason ===
        "WHATSAPP_NAO_CONFERE"
        ? normalizarWhatsappNacionalBrasil(
          confirmacaoAtual
        )
        : normalizarWhatsappNacionalBrasil(
          confirmacaoAnterior
        ),
    corrigiuPrimeiro: false,
    reiniciar: false
  };
}

export function identificacaoTemWhatsappConfirmado(
  identificacao = {}
) {
  const whatsapp =
    normalizarWhatsappNacionalBrasil(
      identificacao.whatsappE164 ||
      identificacao.whatsapp
    );

  return Boolean(
    whatsapp &&
    (
      identificacao.whatsappConfirmado ===
        true ||
      safe(identificacao.clienteId)
    )
  );
}

export function formatarCodigoCheckout(value) {
  const codigo =
    somenteDigitos(value);

  if (!codigo) {
    return "";
  }

  const numero =
    Number(codigo);

  if (!Number.isFinite(numero)) {
    return codigo;
  }

  return numero <= 999
    ? String(numero).padStart(3, "0")
    : String(numero);
}

const PALAVRAS_MENORES = new Set([
  "a", "as", "o", "os", "e", "de", "da", "das", "do", "dos",
  "em", "na", "nas", "no", "nos", "para", "por", "com", "sem"
]);

const SIGLAS = new Set([
  "dsp", "eros", "jbl", "mdf", "pdf", "pix", "rms", "sds"
]);

function capitalizarToken(token, index) {
  if (!token) {
    return token;
  }

  if (/\d/.test(token)) {
    return token.toUpperCase();
  }

  const minusculo =
    token.toLocaleLowerCase("pt-BR");

  if (SIGLAS.has(minusculo)) {
    return minusculo.toUpperCase();
  }

  if (
    index > 0 &&
    PALAVRAS_MENORES.has(minusculo)
  ) {
    return minusculo;
  }

  return (
    minusculo.charAt(0)
      .toLocaleUpperCase("pt-BR") +
    minusculo.slice(1)
  );
}

export function normalizarTituloProduto(value) {
  return safe(value)
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .split(" ")
    .map(capitalizarToken)
    .join(" ")
    .trim();
}

function removerCodigoCheckoutFinal(value) {
  return safe(value)
    .replace(
      /\s*(?:\|\s*(?:c[oó]digo\s*)?\d{1,3}|[-–—]\s*c[oó]digo\s*\d{1,3})\s*$/i,
      ""
    )
    .trim();
}

export function tituloProdutoComCodigoCheckout(
  produto,
  codigoCheckout
) {
  const titulo =
    removerCodigoCheckoutFinal(
      normalizarTituloProduto(produto)
    ) || "Projeto Pronto";

  const codigo =
    formatarCodigoCheckout(
      codigoCheckout
    );

  return codigo
    ? `${titulo} | Código ${codigo}`
    : titulo;
}
