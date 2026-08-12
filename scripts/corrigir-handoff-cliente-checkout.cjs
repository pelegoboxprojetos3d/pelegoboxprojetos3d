const fs = require("fs");

const buttonsPath = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const checkoutPath = "src/pages/checkout-projeto-pronto.i9aj1.js";

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    if (source.includes(replacement.trim().slice(0, 80))) {
      console.log(`${label}: já aplicado.`);
      return source;
    }
    throw new Error(`${label}: início não encontrado.`);
  }
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: fim não encontrado.`);
  console.log(`${label}: aplicado.`);
  return source.slice(0, start) + replacement + "\n\n" + source.slice(end);
}

function insertBeforeOnce(source, marker, insertion, uniqueMarker, label) {
  if (source.includes(uniqueMarker)) {
    console.log(`${label}: já aplicado.`);
    return source;
  }
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`${label}: marcador não encontrado.`);
  console.log(`${label}: aplicado.`);
  return source.slice(0, index) + insertion + "\n\n" + source.slice(index);
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`${label}: já aplicado.`);
    return source;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrados ${count}.`);
  console.log(`${label}: aplicado.`);
  return source.replace(oldText, newText);
}

// ======================================================
// 1) PÁGINA DOS BOTÕES
// ======================================================

let buttons = fs.readFileSync(buttonsPath, "utf8");

buttons = replaceBetween(
  buttons,
  "function lerIdentificacaoSalva() {",
  "function salvarWhatsappPrimeiroEstagio(",
`function pontuarIdentificacaoSalva(data) {
  const normalized = normalizarIdentificacaoSalva(data);

  if (!normalized) {
    return {
      score: -1,
      value: null
    };
  }

  let score = 0;

  if (normalized.whatsapp) score += 1;
  if (normalized.whatsappConfirmado === true) score += 5;
  if (Number(normalized.confirmacaoWhatsappVersao || 0) >= CONFIRMACAO_FLUXO_VERSAO) score += 5;
  if (safe(normalized.clienteId)) score += 12;
  if (safe(normalized.nome).replace(/\\s+/g, " ").length >= 3) score += 6;
  if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(normalizeEmail(normalized.email))) score += 6;
  if (onlyDigits(normalized.cpfCnpj).length === 11) score += 6;

  return {
    score,
    value: normalized
  };
}

function lerIdentificacaoSalva() {
  const fontes = [
    { storage: session, key: SESSION_KEY },
    { storage: local, key: LOCAL_KEY }
  ];

  let melhor = null;
  let melhorScore = -1;

  for (const fonte of fontes) {
    try {
      const raw = fonte.storage.getItem(fonte.key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const candidate = pontuarIdentificacaoSalva(parsed);

      if (candidate.value && candidate.score > melhorScore) {
        melhor = candidate.value;
        melhorScore = candidate.score;
      }
    } catch (_) {
      /* Ignora registro antigo inválido. */
    }
  }

  return melhor;
}`,
  "Botões: preferir identificação mais completa"
);

buttons = insertBeforeOnce(
  buttons,
  "async function identificarCliente(",
`function identificacaoCompletaParaCheckout(data = identificacao) {
  const telefone = normalizarTelefone(data);
  const nome = safe(data?.nome).replace(/\\s+/g, " ");
  const email = normalizeEmail(data?.email);
  const documento = onlyDigits(data?.cpfCnpj || data?.cpf);

  return Boolean(
    telefone.whatsapp &&
    safe(data?.clienteId) &&
    data?.whatsappConfirmado === true &&
    nome.length >= 3 &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email) &&
    documento.length === 11
  );
}

async function completarCadastroClienteRapido(data = {}) {
  if (identificacaoCompletaParaCheckout(identificacao)) {
    return true;
  }

  const telefone = normalizarTelefone({
    ...identificacao,
    ...data
  });

  if (!telefone.whatsapp) {
    return false;
  }

  try {
    const encontrado = await comTimeout(
      buscarCliente(telefone.whatsapp),
      4500,
      "A consulta rápida do cliente não respondeu."
    );

    if (!encontrado) {
      return false;
    }

    clienteAtual = encontrado;

    identificacao = {
      ...identificacao,
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,
      clienteId: firstValue(encontrado._id, encontrado.clienteId, identificacao.clienteId),
      nome: firstValue(encontrado.nome, encontrado.title, identificacao.nome),
      email: normalizeEmail(firstValue(encontrado.email, identificacao.email)),
      cpfCnpj: onlyDigits(
        encontrado.cpfCnpj ||
        encontrado.cpf ||
        encontrado.documentNumber ||
        encontrado.documento ||
        encontrado.cpfcnpj ||
        identificacao.cpfCnpj ||
        ""
      )
    };

    salvarIdentificacao();

    return identificacaoCompletaParaCheckout(identificacao);
  } catch (error) {
    console.warn(
      "Falha ao completar cadastro antes do checkout:",
      error?.message || error
    );

    return false;
  }
}`,
  "function identificacaoCompletaParaCheckout(",
  "Botões: hidratar cadastro conhecido antes do checkout"
);

buttons = replaceOnce(
  buttons,
`        clienteId:
          safe(identificacao.clienteId),

        criadoEm:
          Date.now()`,
`        clienteId:
          safe(identificacao.clienteId),

        nome:
          safe(identificacao.nome),

        email:
          normalizeEmail(identificacao.email),

        cpfCnpj:
          onlyDigits(identificacao.cpfCnpj),

        whatsapp:
          safe(identificacao.whatsapp),

        whatsappE164:
          safe(identificacao.whatsappE164),

        whatsappConfirmado:
          identificacao.whatsappConfirmado === true,

        confirmacaoWhatsappVersao:
          Number(identificacao.confirmacaoWhatsappVersao || 0),

        criadoEm:
          Date.now()`,
  "Botões: enviar identidade completa no handoff"
);

buttons = insertBeforeOnce(
  buttons,
`  /*
    A identificação já foi feita antes. Não repetimos consulta de cliente
    e acessos no clique, porque isso segurava a navegação para o checkout.
    O clique deve decidir com o estado já carregado e navegar imediatamente.
  */`,
`  /*
    Se o cache liberou os botões antes de termos nome/e-mail/CPF em memória,
    aproveitamos a consulta que já deveria ter ocorrido nesta página e fazemos
    uma última hidratação curta aqui. Cliente conhecido entra no checkout já
    completo; cliente novo continua vendo a etapa de cadastro normalmente.
  */
  if (!identificacaoCompletaParaCheckout(identificacao)) {
    await completarCadastroClienteRapido(identificacao);
  }

  /* Handoff direto botão -> checkout: persistimos a melhor identidade antes de navegar. */
  salvarIdentificacao();`,
  "Handoff direto botão -> checkout",
  "Botões: garantir identidade antes da navegação"
);

fs.writeFileSync(buttonsPath, buttons);

// ======================================================
// 2) PÁGINA DO CHECKOUT
// ======================================================

let checkout = fs.readFileSync(checkoutPath, "utf8");

checkout = replaceOnce(
  checkout,
  `const LOCAL_KEY = "pp_identificacao_persistente";\nconst VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";`,
  `const LOCAL_KEY = "pp_identificacao_persistente";\nconst VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";\nconst CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";`,
  "Checkout: chave do handoff do botão"
);

checkout = replaceBetween(
  checkout,
  "function savedIdentity() {",
  "function saveIdentity(patch) {",
`function identityStorageScore(value) {
  if (!value || typeof value !== "object") return -1;

  let score = 0;
  const n = phone(value.whatsappE164 || value.whatsapp);

  if (n) score += 1;
  if (value.whatsappConfirmado === true) score += 5;
  if (safe(value.clienteId)) score += 12;
  if (safe(value.nome || value.nomeCliente).replace(/\\s+/g, " ").length >= 3) score += 6;
  if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email(value.email))) score += 6;
  if (validCpf(value.cpfCnpj || value.cpf)) score += 6;

  return score;
}

function savedIdentity() {
  let best = {};
  let bestScore = -1;

  for (const [store, key] of [[session, SESSION_KEY], [local, LOCAL_KEY]]) {
    try {
      const raw = store.getItem(key);
      if (!raw) continue;

      const value = JSON.parse(raw);
      const score = identityStorageScore(value);

      if (score > bestScore) {
        best = value && typeof value === "object" ? value : {};
        bestScore = score;
      }
    } catch (_) {}
  }

  return best;
}`,
  "Checkout: preferir storage mais completo"
);

checkout = insertBeforeOnce(
  checkout,
  "function contextFromUrl() {",
`function checkoutHandoffIdentity(query = {}) {
  try {
    const raw = session.getItem(CHECKOUT_AUTH_KEY);
    if (!raw) return {};

    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return {};

    const createdAt = Number(value.criadoEm || 0);
    const age = Date.now() - createdAt;

    if (!createdAt || age < 0 || age > 5 * 60 * 1000) {
      return {};
    }

    const queryCode = digits(query.codigoProjeto || query.ordemVideo || query.codigo);
    const authCode = digits(value.codigoProjeto);

    if (queryCode && authCode && queryCode !== authCode) {
      return {};
    }

    const queryType = safe(query.tipoProduto || "MEDIDAS").toUpperCase();
    const authType = safe(value.tipoProduto || "").toUpperCase();

    if (authType && queryType !== authType) {
      return {};
    }

    const candidate = {
      clienteId: safe(value.clienteId),
      nome: safe(value.nome),
      email: email(value.email),
      cpfCnpj: cpf(value.cpfCnpj),
      whatsapp: phone(value.whatsappE164 || value.whatsapp),
      whatsappE164: phone(value.whatsappE164 || value.whatsapp)
        ? `+55${phone(value.whatsappE164 || value.whatsapp)}`
        : "",
      whatsappConfirmado: value.whatsappConfirmado === true
    };

    return (
      candidate.whatsappConfirmado === true &&
      safe(candidate.clienteId) &&
      identityComplete(candidate)
    ) ? candidate : {};
  } catch (_) {
    return {};
  }
}`,
  "function checkoutHandoffIdentity(",
  "Checkout: ler identidade entregue pelo botão"
);

checkout = replaceOnce(
  checkout,
`function contextFromUrl() {
  const q=wixLocation.query || {};
  const s=savedIdentity();
  const verifiedSession=sessionIdentityVerified(s);`,
`function contextFromUrl() {
  const q=wixLocation.query || {};
  const stored=savedIdentity();
  const handoff=checkoutHandoffIdentity(q);
  const s=identityComplete(handoff) ? { ...stored, ...handoff } : stored;
  const verifiedSession=sessionIdentityVerified(s);`,
  "Checkout: usar handoff antes do primeiro INIT"
);

fs.writeFileSync(checkoutPath, checkout);

console.log("Correção definitiva botão -> checkout concluída.");
