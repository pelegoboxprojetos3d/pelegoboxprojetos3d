const fs = require("fs");

const BACKEND = "src/backend/entregaProjetosProntos.jsw";
const PAGE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeIfChanged(file, before, after) {
  if (before === after) {
    console.log(`${file}: já estava correto.`);
    return false;
  }
  fs.writeFileSync(file, after, "utf8");
  console.log(`${file}: corrigido.`);
  return true;
}

function insertBefore(code, anchor, insertion, label) {
  if (code.includes(insertion.trim())) return code;
  const index = code.indexOf(anchor);
  if (index < 0) throw new Error(`${label}: ponto de inserção não encontrado.`);
  return code.slice(0, index) + insertion + code.slice(index);
}

function insertAfter(code, anchor, insertion, label) {
  if (code.includes(insertion.trim())) return code;
  const index = code.indexOf(anchor);
  if (index < 0) throw new Error(`${label}: ponto de inserção não encontrado.`);
  const end = index + anchor.length;
  return code.slice(0, end) + insertion + code.slice(end);
}

function patchBackend() {
  const before = read(BACKEND);
  let code = before;

  const helperAnchor = "function normalizeWhatsapp(value) {";
  const helper = `// ENTREGA_PROTEGIDA_POR_EMAIL_V1\nasync function autorizarSessaoParaMembroAtual(session) {\n  let membro = null;\n\n  try {\n    membro = await currentMember.getMember({ fieldsets: [\"FULL\"] });\n  } catch (_) {\n    membro = null;\n  }\n\n  const memberId = safe(membro?._id);\n  if (!memberId) {\n    return { ok: false, error: \"LOGIN_NECESSARIO\" };\n  }\n\n  const emails = new Set();\n  const adicionarEmail = (value) => {\n    const email = normalizeEmail(\n      typeof value === \"string\"\n        ? value\n        : firstValue(value?.email, value?.value)\n    );\n    if (email) emails.add(email);\n  };\n\n  adicionarEmail(membro?.loginEmail);\n  adicionarEmail(membro?.contactDetails?.email);\n\n  const contatos = Array.isArray(membro?.contactDetails?.emails)\n    ? membro.contactDetails.emails\n    : [];\n\n  contatos.forEach(adicionarEmail);\n\n  const emailCompra = normalizeEmail(session?.email);\n  if (!emailCompra) {\n    return { ok: false, error: \"EMAIL_DA_COMPRA_AUSENTE\" };\n  }\n\n  if (!emails.has(emailCompra)) {\n    return { ok: false, error: \"COMPRA_DE_OUTRA_CONTA\" };\n  }\n\n  return { ok: true, memberId, emailCompra };\n}\n\n`;

  if (!code.includes("ENTREGA_PROTEGIDA_POR_EMAIL_V1")) {
    code = insertBefore(code, helperAnchor, helper, "Backend / helper de autorização");
  }

  const authAnchor = `  const safeSession =\n    publicSession(session);`;
  const authBlock = `  const autorizacaoEntrega =\n    await autorizarSessaoParaMembroAtual(session);\n\n  if (!autorizacaoEntrega.ok) {\n    return {\n      ok: false,\n      error: autorizacaoEntrega.error\n    };\n  }\n\n`;

  if (!code.includes("const autorizacaoEntrega =")) {
    code = insertBefore(code, authAnchor, authBlock, "Backend / bloqueio da sessão");
  }

  writeIfChanged(BACKEND, before, code);
}

function patchPage() {
  const before = read(PAGE);
  let code = before;

  const stateAnchor = `let centralSegundasViasAtiva =\n  false;`;
  const stateInsertion = `\n\nlet loginEntregaSolicitado =\n  false;`;
  if (!code.includes("let loginEntregaSolicitado")) {
    code = insertAfter(code, stateAnchor, stateInsertion, "Página / estado de login");
  }

  const helperAnchor = `// ======================================================\n// CARREGAR ENTREGA\n// ======================================================`;
  const helper = `// ACESSO_PROTEGIDO_EMAIL_V1\nfunction solicitarLoginDaCompra() {\n  if (loginEntregaSolicitado) {\n    return;\n  }\n\n  loginEntregaSolicitado = true;\n\n  authentication\n    .promptLogin({\n      mode: \"login\",\n      modal: true\n    })\n    .then(() => {\n      loginEntregaSolicitado = false;\n      carregarEntrega().catch((erro) => {\n        console.error(\n          \"Falha ao recarregar entrega após login:\",\n          erro?.message || erro\n        );\n      });\n    })\n    .catch(() => {\n      loginEntregaSolicitado = false;\n    });\n}\n\n`;

  if (!code.includes("ACESSO_PROTEGIDO_EMAIL_V1")) {
    code = insertBefore(code, helperAnchor, helper, "Página / prompt de login");
  }

  const errorAnchor = `      if (\n        !resultado?.ok\n      ) {`;
  const errorInsertion = `\n        if (\n          resultado?.error ===\n          \"LOGIN_NECESSARIO\"\n        ) {\n          await encerrarProcessamentoPendente(\n            \"ACESSO PROTEGIDO\",\n            \"Entre na sua conta usando o mesmo e-mail informado na compra para acessar este produto.\"\n          );\n\n          solicitarLoginDaCompra();\n          return;\n        }\n\n        if (\n          resultado?.error ===\n          \"COMPRA_DE_OUTRA_CONTA\"\n        ) {\n          await encerrarProcessamentoPendente(\n            \"ACESSO PROTEGIDO\",\n            \"Esta compra pertence a outra conta. Saia da conta atual e entre com o mesmo e-mail usado no pagamento.\"\n          );\n\n          return;\n        }\n\n        if (\n          resultado?.error ===\n          \"EMAIL_DA_COMPRA_AUSENTE\"\n        ) {\n          await encerrarProcessamentoPendente(\n            \"ACESSO PROTEGIDO\",\n            \"Não foi possível validar o titular desta compra. Entre em contato com o suporte.\"\n          );\n\n          return;\n        }\n`;

  if (!code.includes('resultado?.error ===\n          "COMPRA_DE_OUTRA_CONTA"')) {
    code = insertAfter(code, errorAnchor, errorInsertion, "Página / tratamento de acesso negado");
  }

  writeIfChanged(PAGE, before, code);
}

function patchNotify() {
  const before = read(NOTIFY);
  let code = before;

  code = code.replace(
    `    botaoUrl: payload.botaoUrl + "&via=email",\n    deliveryUrl: payload.deliveryUrl + "&via=email"`,
    `    // O cenário do Make recebe a URL limpa e adiciona a origem uma única vez.\n    // Assim evitamos links com &via=email&via=email.\n    botaoUrl: payload.botaoUrl,\n    deliveryUrl: payload.deliveryUrl`
  );

  writeIfChanged(NOTIFY, before, code);
}

function validate() {
  const backend = read(BACKEND);
  const page = read(PAGE);
  const notify = read(NOTIFY);

  for (const required of [
    "ENTREGA_PROTEGIDA_POR_EMAIL_V1",
    "autorizarSessaoParaMembroAtual",
    "LOGIN_NECESSARIO",
    "COMPRA_DE_OUTRA_CONTA",
    "EMAIL_DA_COMPRA_AUSENTE",
    "const autorizacaoEntrega ="
  ]) {
    if (!backend.includes(required)) {
      throw new Error(`Backend: validação ausente: ${required}`);
    }
  }

  for (const required of [
    "ACESSO_PROTEGIDO_EMAIL_V1",
    "promptLogin",
    "COMPRA_DE_OUTRA_CONTA",
    "mesmo e-mail informado na compra"
  ]) {
    if (!page.includes(required)) {
      throw new Error(`Página: validação ausente: ${required}`);
    }
  }

  if (notify.includes('payload.botaoUrl + "&via=email"') ||
      notify.includes('payload.deliveryUrl + "&via=email"')) {
    throw new Error("E-mail: duplicação de via=email ainda presente.");
  }

  console.log("OK: entrega por e-mail protegida pela conta do comprador.");
  console.log("OK: links de e-mail sem duplicação de via=email no backend.");
}

patchBackend();
patchPage();
patchNotify();
validate();
