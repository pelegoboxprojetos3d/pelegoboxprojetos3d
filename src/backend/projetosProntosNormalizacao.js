// Padrões únicos dos Projetos Prontos.
// Centraliza WhatsApp e títulos sem depender de SKU ou codigo_checkout.

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

const PALAVRAS_MENORES = new Set([
  "a", "as", "o", "os", "e", "de", "da", "das", "do", "dos",
  "em", "na", "nas", "no", "nos", "para", "por", "com", "sem"
]);

const SIGLAS = new Set([
  "dsp", "eros", "jbl", "kc", "mdf", "pdf", "pix", "rms", "sds"
]);

function decodificarTitulo(value) {
  return safe(value)
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizarToken(token, index) {
  if (!token) {
    return token;
  }

  const prefixo =
    token.match(/^[^A-Za-zÀ-ÿ0-9#]*/)?.[0] || "";

  const sufixo =
    token.match(/[^A-Za-zÀ-ÿ0-9\"'#]*$/)?.[0] || "";

  const fim =
    sufixo.length
      ? token.length - sufixo.length
      : token.length;

  const core =
    token.slice(prefixo.length, fim);

  if (!core) {
    return token;
  }

  if (/\d/.test(core)) {
    return `${prefixo}${core.toUpperCase()}${sufixo}`;
  }

  const minusculo =
    core.toLocaleLowerCase("pt-BR");

  if (SIGLAS.has(minusculo)) {
    return `${prefixo}${minusculo.toUpperCase()}${sufixo}`;
  }

  if (
    index > 0 &&
    PALAVRAS_MENORES.has(minusculo)
  ) {
    return `${prefixo}${minusculo}${sufixo}`;
  }

  const natural =
    minusculo.charAt(0).toLocaleUpperCase("pt-BR") +
    minusculo.slice(1);

  return `${prefixo}${natural}${sufixo}`;
}

export function extrairCodigoQuestionarioTitulo(value) {
  const titulo =
    decodificarTitulo(value);

  const match =
    titulo.match(
      /\b(00[1-9]|01[0-4])\b\s*$/i
    );

  return match ? match[1] : "";
}

export function normalizarTituloProduto(value) {
  const original =
    decodificarTitulo(value);

  const codigoQuestionario =
    extrairCodigoQuestionarioTitulo(original);

  /*
    PELEGO BOX marca o começo do sufixo que não pertence
    ao nome comercial do projeto. O código 001–014 é lido
    antes do corte e recolocado no final.
  */
  const antesDaMarca =
    original
      .replace(
        /\s*\bPELEGO\s+BOX\b[\s\S]*$/i,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

  const natural =
    antesDaMarca
      .split(" ")
      .filter(Boolean)
      .map(capitalizarToken)
      .join(" ")
      .trim();

  if (!codigoQuestionario) {
    return natural;
  }

  if (
    new RegExp(
      `\\b${codigoQuestionario}\\b\\s*$`
    ).test(natural)
  ) {
    return natural;
  }

  return `${natural} ${codigoQuestionario}`.trim();
}

function normalizarTipoProduto(value) {
  const tipo =
    safe(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  if (
    tipo === "GRAFICO" ||
    tipo === "GRAFICOS"
  ) {
    return "GRAFICOS";
  }

  if (
    tipo === "PROJETO" ||
    tipo === "COMPLETO" ||
    tipo === "PROJETO_COMPLETO"
  ) {
    return "PROJETO_COMPLETO";
  }

  return "MEDIDAS";
}

export function tituloEtapaProjetoPronto(
  value,
  tipoProduto,
  codigoProjeto = ""
) {
  const base =
    normalizarTituloProduto(value) ||
    "Projeto Pronto";

  const codigoQuestionario =
    extrairCodigoQuestionarioTitulo(base);

  let semQuestionario = base;

  if (codigoQuestionario) {
    semQuestionario =
      semQuestionario
        .replace(
          new RegExp(
            `\\s+${codigoQuestionario}\\s*$`
          ),
          ""
        )
        .trim();
  }

  const encontrado =
    semQuestionario.match(
      /^\s*#?\s*(\d+)\s+(.*)$/
    );

  const codigo =
    encontrado
      ? encontrado[1]
      : somenteDigitos(codigoProjeto);

  let corpo =
    encontrado
      ? encontrado[2]
      : semQuestionario;

  corpo =
    corpo
      .replace(
        /^(?:Medidas\s+Projeto\s+Pronto|Gráficos\s+Projeto\s+Pronto|Graficos\s+Projeto\s+Pronto|Projeto\s+Pronto\s+Completo)\s+/i,
        ""
      )
      .trim();

  const tipo =
    normalizarTipoProduto(tipoProduto);

  const prefixo =
    tipo === "GRAFICOS"
      ? "Gráficos Projeto Pronto"
      : tipo === "PROJETO_COMPLETO"
        ? "Projeto Pronto Completo"
        : "Medidas Projeto Pronto";

  return [
    codigo ? `#${codigo}` : "",
    prefixo,
    corpo,
    codigoQuestionario
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
