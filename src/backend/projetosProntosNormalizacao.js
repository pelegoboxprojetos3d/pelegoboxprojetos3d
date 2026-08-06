// Padrões únicos dos Projetos Prontos.
// Centraliza WhatsApp, título e código de checkout para evitar campos duplicados.

function safe(value) {
  return String(value ?? "").trim();
}

export function somenteDigitos(value) {
  return safe(value).replace(/\D/g, "");
}

export function normalizarWhatsappBrasil(value) {
  let numero = somenteDigitos(value);

  if (
    numero.startsWith("55") &&
    (numero.length === 12 || numero.length === 13)
  ) {
    numero = numero.slice(2);
  }

  if (numero.length !== 10 && numero.length !== 11) {
    return "";
  }

  return `+55${numero}`;
}

export function telefoneNacionalBrasil(value) {
  const e164 = normalizarWhatsappBrasil(value);
  return e164 ? somenteDigitos(e164).slice(2) : "";
}

export function formatarCodigoCheckout(value) {
  const digitos = somenteDigitos(value);

  if (!digitos) {
    return "";
  }

  const numero = Number(digitos);

  if (!Number.isFinite(numero)) {
    return digitos;
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

  const minusculo = token.toLocaleLowerCase("pt-BR");

  if (SIGLAS.has(minusculo)) {
    return minusculo.toUpperCase();
  }

  if (index > 0 && PALAVRAS_MENORES.has(minusculo)) {
    return minusculo;
  }

  return (
    minusculo.charAt(0).toLocaleUpperCase("pt-BR") +
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

export function tituloProdutoComCodigoCheckout(
  produto,
  codigoCheckout
) {
  const titulo = normalizarTituloProduto(produto) || "Projeto Pronto";
  const codigo = formatarCodigoCheckout(codigoCheckout);

  if (!codigo) {
    return titulo;
  }

  const marcador = new RegExp(
    `(?:\\||-|–|—)\\s*(?:c[oó]digo\\s*)?${codigo}\\s*$`,
    "i"
  );

  if (marcador.test(titulo)) {
    return titulo;
  }

  return `${titulo} | Código ${codigo}`;
}
