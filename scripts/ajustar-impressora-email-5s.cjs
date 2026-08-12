const fs = require("fs");

const PAGE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const PIX = "src/backend/validaPayPixProjetosProntosCore.jsw";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, text) {
  fs.writeFileSync(path, `${text.trimEnd()}\n`, "utf8");
}

function replaceRequired(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

// -----------------------------------------------------------------------------
// PÁGINA DE ENTREGA
// A regra de 7 segundos existe SOMENTE para a primeira abertura originada do
// botão do e-mail. Pagamento normal, atualização comum e cliques internos
// continuam com o comportamento atual.
// -----------------------------------------------------------------------------
let page = read(PAGE);

if (!page.includes("const EMAIL_PROCESSAMENTO_MS =")) {
  page = replaceRequired(
    page,
    "const MIN_PROCESSAMENTO_VISIVEL =\n  500;",
    "const MIN_PROCESSAMENTO_VISIVEL =\n  500;\n\nconst EMAIL_PROCESSAMENTO_MS =\n  7000;",
    "constante de 7s do e-mail"
  );
} else {
  page = page.replace(
    /const EMAIL_PROCESSAMENTO_MS =\s*\n?\s*\d+;/,
    "const EMAIL_PROCESSAMENTO_MS =\n  7000;"
  );
}

if (!page.includes("let processamentoEmailPendente =")) {
  page = replaceRequired(
    page,
    "let processamentoVisualEncerrado =\n  false;",
    "let processamentoVisualEncerrado =\n  false;\n\n/*\n  Só a primeira retirada da impressora usa os 7 s quando a URL veio do e-mail.\n  Depois disso a flag é desligada, evitando contaminar os cliques da página.\n*/\nlet processamentoEmailPendente =\n  String(wixLocation?.query?.via ?? \"\")\n    .trim()\n    .toLowerCase() === \"email\";",
    "flag de acesso pelo e-mail"
  );
}

page = replaceRequired(
  page,
  "      const restante =\n        MIN_PROCESSAMENTO_VISIVEL - tempoVisivel;",
  "      const minimoVisivel =\n        processamentoEmailPendente\n          ? EMAIL_PROCESSAMENTO_MS\n          : MIN_PROCESSAMENTO_VISIVEL;\n\n      const restante =\n        minimoVisivel - tempoVisivel;",
  "tempo mínimo dinâmico da impressora"
);

if (!page.includes("processamentoEmailPendente = false;")) {
  page = replaceRequired(
    page,
    "    await $w(IDS.processando).collapse();\n    processamentoVisivelDesde = 0;",
    "    await $w(IDS.processando).collapse();\n    processamentoVisivelDesde = 0;\n    processamentoEmailPendente = false;",
    "desligamento da regra de e-mail após a primeira exibição"
  );
}

write(PAGE, page);

// -----------------------------------------------------------------------------
// E-MAIL PELEGO BOX
// O marcador via=email é acrescentado somente ao payload enviado ao cenário
// de e-mail. O payload do chatbot continua intacto.
// -----------------------------------------------------------------------------
let notify = read(NOTIFY);

if (!notify.includes("const emailPayload = {")) {
  notify = replaceRequired(
    notify,
    "  const patch = { ...session, updatedAtDate: new Date() };",
    "  const emailPayload = {\n    ...payload,\n    botaoUrl: payload.botaoUrl + \"&via=email\",\n    deliveryUrl: payload.deliveryUrl + \"&via=email\"\n  };\n\n  const patch = { ...session, updatedAtDate: new Date() };",
    "payload exclusivo do e-mail"
  );

  notify = replaceRequired(
    notify,
    "        await postJson(url, payload);\n        patch.emailEnviadoEm = new Date();",
    "        await postJson(url, emailPayload);\n        patch.emailEnviadoEm = new Date();",
    "envio do payload de e-mail"
  );
}

write(NOTIFY, notify);

// -----------------------------------------------------------------------------
// PIX
// O Pix possui um caminho próprio de notificação. Aplicamos a mesma separação:
// somente o cenário de e-mail recebe via=email; chatbot permanece normal.
// -----------------------------------------------------------------------------
let pix = read(PIX);

if (!pix.includes("const emailPayload = {\n    ...payload,")) {
  pix = replaceRequired(
    pix,
    "  const patch = { updatedAtDate: new Date() };",
    "  const emailPayload = {\n    ...payload,\n    botaoUrl: payload.botaoUrl + \"&via=email\",\n    deliveryUrl: payload.deliveryUrl + \"&via=email\"\n  };\n\n  const patch = { updatedAtDate: new Date() };",
    "payload exclusivo do e-mail do Pix"
  );

  pix = replaceRequired(
    pix,
    "      try { await postJson(makeUrl, payload); patch.emailEnviadoEm = new Date(); }",
    "      try { await postJson(makeUrl, emailPayload); patch.emailEnviadoEm = new Date(); }",
    "envio do payload de e-mail do Pix"
  );
}

write(PIX, pix);

console.log("Regra aplicada: link do e-mail mantém a impressora por no mínimo 7 s; demais acessos não mudam.");
