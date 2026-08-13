const fs = require("fs");
const { execFileSync } = require("child_process");

const BACKEND = "src/backend/entregaProjetosProntos.jsw";
const DELIVERY = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const TRIGGER = "src/backend/http-functions.js";
const TRIGGER_MARKER = "// CENTRAL_PROJETOS_MEMBRO_REAL_V2";
const BACKEND_MARKER = "// CENTRAL_MEMBRO_REAL_V2";
const LOGOUT_MARKER = "// REDIRECT_HOME_AO_LOGOUT_V1";

function replaceFunction(code, signature, nextSignature, replacement, label) {
  const start = code.indexOf(signature);
  const end = code.indexOf(nextSignature, start);
  if (start < 0 || end < 0) {
    throw new Error(`${label}: limites não encontrados.`);
  }
  return code.slice(0, start) + replacement + "\n\n" + code.slice(end);
}

function patchBackend() {
  let code = fs.readFileSync(BACKEND, "utf8");
  if (code.includes(BACKEND_MARKER)) {
    console.log("Central por membro real já aplicada no backend.");
    return false;
  }

  const identityBlock = `async function identidadeMembroAtual() {
  ${BACKEND_MARKER}
  let membro = null;

  try {
    membro = await currentMember.getMember({ fieldsets: ["FULL"] });
  } catch (_) {
    return null;
  }

  const memberId = safe(membro?._id);
  if (!memberId) {
    return null;
  }

  const emailsContato = Array.isArray(membro?.contactDetails?.emails)
    ? membro.contactDetails.emails
    : [];

  const emailsMembro = new Set();
  const adicionarEmail = (value) => {
    const email = normalizeEmail(
      typeof value === "string"
        ? value
        : firstValue(value?.email, value?.value)
    );
    if (email) emailsMembro.add(email);
  };

  adicionarEmail(membro?.loginEmail);
  emailsContato.forEach(adicionarEmail);
  adicionarEmail(membro?.contactDetails?.email);

  const nomeMembro = firstValue(
    membro?.profile?.nickname,
    [
      safe(membro?.contactDetails?.firstName),
      safe(membro?.contactDetails?.lastName)
    ].filter(Boolean).join(" ")
  );

  const clientes = new Map();
  const sessoes = new Map();

  async function coletar(collection, field, value, target, limit = 100) {
    if (!safe(value)) return;
    try {
      const result = await wixData
        .query(collection)
        .eq(field, value)
        .limit(limit)
        .find(READ_OPTS);

      for (const item of result.items || []) {
        const id = safe(item?._id);
        if (id) target.set(id, item);
      }
    } catch (_) {}
  }

  /*
    O memberId/_owner é a ponte mais forte quando existe.
    Depois ampliamos pelos e-mails autenticados do próprio membro.
  */
  await Promise.all([
    coletar(CLIENTS_COLLECTION, "_owner", memberId, clientes, 100),
    coletar(SESSIONS_COLLECTION, "_owner", memberId, sessoes, 200)
  ]);

  for (const email of [...emailsMembro]) {
    await Promise.all([
      coletar(CLIENTS_COLLECTION, "email", email, clientes, 100),
      coletar(CLIENTS_COLLECTION, "Email", email, clientes, 100),
      coletar(SESSIONS_COLLECTION, "email", email, sessoes, 200),
      coletar(SESSIONS_COLLECTION, "Email", email, sessoes, 200)
    ]);
  }

  const clientIds = new Set();
  const whatsapps = new Set();

  for (const item of clientes.values()) {
    const id = firstValue(
      item?.clienteId,
      item?.clienteID,
      item?.["Cliente ID"],
      item?._id
    );
    if (id) clientIds.add(id);

    adicionarEmail(firstValue(item?.email, item?.Email, item?.["E-mail"]));

    const whats = normalizeWhatsapp(
      firstValue(item?.whatsapp, item?.whatsApp, item?.Whatsapp, item?.WhatsApp)
    );
    if (whats) whatsapps.add(whats);
  }

  for (const item of sessoes.values()) {
    const id = firstValue(
      item?.clienteId,
      item?.clienteID,
      item?.["Cliente ID"]
    );
    if (id) clientIds.add(id);

    adicionarEmail(firstValue(item?.email, item?.Email, item?.["E-mail"]));

    const whats = normalizeWhatsapp(sessionWhatsapp(item));
    if (whats) whatsapps.add(whats);
  }

  /*
    Uma sessão autenticada pode apontar para um cliente criado em outra visita.
    Carregamos esses clientes por ID para completar o grafo de identidade.
  */
  for (const id of [...clientIds]) {
    await coletar(CLIENTS_COLLECTION, "clienteId", id, clientes, 20);
    try {
      const item = await wixData.get(CLIENTS_COLLECTION, id, READ_OPTS);
      if (item?._id) clientes.set(safe(item._id), item);
    } catch (_) {}
  }

  for (const item of clientes.values()) {
    const id = firstValue(item?.clienteId, item?.clienteID, item?.["Cliente ID"], item?._id);
    if (id) clientIds.add(id);
    adicionarEmail(firstValue(item?.email, item?.Email, item?.["E-mail"]));
  }

  const cliente = newestFirst([...clientes.values()])[0] || null;
  const sessao = newestFirst([...sessoes.values()])[0] || null;
  const payloadCliente = clientPayload(cliente);
  const loginEmail = normalizeEmail(membro?.loginEmail);

  return {
    memberId,
    cliente,
    clienteId: firstValue(
      payloadCliente.clienteId,
      [...clientIds][0],
      sessao?.clienteId,
      cliente?._id
    ),
    clientIds: [...clientIds],
    nome: firstValue(
      payloadCliente.nome,
      sessao?.nomeCliente,
      sessao?.nome,
      nomeMembro
    ),
    loginEmail: firstValue(loginEmail, [...emailsMembro][0]),
    email: firstValue(loginEmail, [...emailsMembro][0], payloadCliente.email),
    emails: [...emailsMembro],
    whatsapp: firstValue(
      payloadCliente.whatsapp,
      sessionWhatsapp(sessao),
      [...whatsapps][0]
    ),
    whatsapps: [...whatsapps]
  };
}

function purchaseBelongsToMemberIdentity(purchase, identity = {}) {
  const emails = new Set(
    [
      ...(Array.isArray(identity?.emails) ? identity.emails : []),
      identity?.loginEmail,
      identity?.email
    ]
      .map(normalizeEmail)
      .filter(Boolean)
  );

  const clientIds = new Set(
    [
      ...(Array.isArray(identity?.clientIds) ? identity.clientIds : []),
      identity?.clienteId,
      identity?.cliente?._id
    ]
      .map(safe)
      .filter(Boolean)
  );

  const itemEmail = purchaseEmail(purchase);
  const itemClientId = purchaseClientId(purchase);

  return Boolean(
    (itemEmail && emails.has(itemEmail)) ||
    (itemClientId && clientIds.has(itemClientId))
  );
}`;

  code = replaceFunction(
    code,
    "async function identidadeMembroAtual() {",
    "async function queryPurchasesByIdentity(identity = {}) {",
    identityBlock,
    "Identidade do membro"
  );

  const queryBlock = `async function queryPurchasesByIdentity(identity = {}) {
  const emails = new Set(
    [
      ...(Array.isArray(identity?.emails) ? identity.emails : []),
      identity?.loginEmail,
      identity?.email
    ]
      .map(normalizeEmail)
      .filter(Boolean)
  );

  const clientIds = new Set(
    [
      ...(Array.isArray(identity?.clientIds) ? identity.clientIds : []),
      identity?.clienteId,
      identity?.cliente?._id
    ]
      .map(safe)
      .filter(Boolean)
  );

  if (!emails.size && !clientIds.size) {
    return [];
  }

  const found = new Map();

  async function consultar(field, value) {
    if (!safe(value)) return;
    try {
      const result = await wixData
        .query(PURCHASES_COLLECTION)
        .eq(field, value)
        .limit(1000)
        .find(READ_OPTS);

      for (const item of result.items || []) {
        const id = safe(item?._id);
        if (id) found.set(id, item);
      }
    } catch (error) {
      console.warn(
        \`Busca de compras do membro por \${field} falhou:\`,
        error?.message || error
      );
    }
  }

  for (const email of emails) {
    await consultar("email", email);
    await consultar("Email", email);
  }

  for (const clientId of clientIds) {
    await consultar("clienteId", clientId);
    await consultar("clienteID", clientId);
    await consultar("cliente", clientId);
  }

  /* Última rede de segurança para registros legados com IDs de campo diferentes. */
  if (!found.size) {
    try {
      let result = await wixData
        .query(PURCHASES_COLLECTION)
        .limit(1000)
        .find(READ_OPTS);

      while (result) {
        for (const item of result.items || []) {
          if (purchaseBelongsToMemberIdentity(item, identity)) {
            const id = safe(item?._id);
            if (id) found.set(id, item);
          }
        }

        if (typeof result.hasNext !== "function" || !result.hasNext()) break;
        result = await result.next();
      }
    } catch (error) {
      console.warn(
        "Varredura final das compras do membro falhou:",
        error?.message || error
      );
    }
  }

  return [...found.values()].filter((purchase) =>
    purchaseBelongsToMemberIdentity(purchase, identity)
  );
}`;

  code = replaceFunction(
    code,
    "async function queryPurchasesByIdentity(identity = {}) {",
    "function acessoDescricao(access = {}) {",
    queryBlock,
    "Consulta de compras do membro"
  );

  const oldSecondCopy = `  const loginEmail = normalizeEmail(\n    identity?.loginEmail || identity?.email\n  );\n\n  const purchases = allPurchases\n    .filter(approvedPurchase)\n    .filter((purchase) =>\n      Boolean(\n        loginEmail &&\n        purchaseEmail(purchase) === loginEmail\n      )\n    );`;

  const newSecondCopy = `  const purchases = allPurchases\n    .filter(approvedPurchase)\n    .filter((purchase) =>\n      purchaseBelongsToMemberIdentity(purchase, identity)\n    );`;

  if (code.includes(oldSecondCopy)) {
    code = code.replace(oldSecondCopy, newSecondCopy);
  } else if (!code.includes(newSecondCopy)) {
    throw new Error("Filtro da segunda via não encontrado.");
  }

  const oldClientEmail = `    email: loginEmail,`;
  const newClientEmail = `    email: firstValue(\n      purchaseEmail(compraMaisRecente),\n      identity?.loginEmail,\n      identity?.email\n    ),`;

  if (code.includes(oldClientEmail)) {
    code = code.replace(oldClientEmail, newClientEmail);
  }

  /* Devolve diagnóstico não sensível o bastante para o console da própria conta. */
  const oldReturn = `  return {\n    ok: true,\n    memberId: identity.memberId,\n    items\n  };`;
  const newReturn = `  return {\n    ok: true,\n    memberId: identity.memberId,\n    email: identity.loginEmail || identity.email || "",\n    emailsReconhecidos: identity.emails || [],\n    clienteIdsReconhecidos: identity.clientIds || [],\n    items\n  };`;
  if (code.includes(oldReturn)) code = code.replace(oldReturn, newReturn);

  fs.writeFileSync(BACKEND, code, "utf8");
  return true;
}

function patchDelivery() {
  let code = fs.readFileSync(DELIVERY, "utf8");
  if (code.includes(LOGOUT_MARKER)) {
    console.log("Redirecionamento ao logout já aplicado na entrega.");
    return false;
  }

  const importMarker = `import wixWindowFrontend from "wix-window-frontend";`;
  if (!code.includes(importMarker)) {
    throw new Error("Import principal da página de entrega não encontrado.");
  }

  code = code.replace(
    importMarker,
    `${importMarker}\nimport { authentication } from "wix-members-frontend";`
  );

  const onReadyMarker = `// ======================================================\n// ON READY\n// ======================================================\n\n$w.onReady(async function () {`;
  if (!code.includes(onReadyMarker)) {
    throw new Error("Bloco ON READY da entrega não encontrado.");
  }

  const logoutHelper = `// ======================================================\n// LOGOUT NA PÁGINA DE ENTREGA\n// ======================================================\n\nfunction redirecionarHomeAoDeslogar() {\n  ${LOGOUT_MARKER}\n  try {\n    authentication.onLogout(() => {\n      wixLocation.to("/");\n    });\n  } catch (erro) {\n    console.warn(\n      "Não foi possível registrar o redirecionamento após logout:",\n      erro?.message || erro\n    );\n  }\n}\n\n`;

  code = code.replace(
    onReadyMarker,
    `${logoutHelper}${onReadyMarker}`
  );

  code = code.replace(
    `$w.onReady(async function () {\n  checkoutEmAndamento = false;`,
    `$w.onReady(async function () {\n  checkoutEmAndamento = false;\n  redirecionarHomeAoDeslogar();`
  );

  /* Log útil para fechar o diagnóstico sem expor isso na interface do cliente. */
  code = code.replace(
    `    const resultado = await listarProjetosProntosDoMembroAtual();\n    await esconderProcessamento();`,
    `    const resultado = await listarProjetosProntosDoMembroAtual();\n    console.log("Central Projetos Prontos - identidade resolvida:", {\n      ok: resultado?.ok,\n      memberId: resultado?.memberId,\n      email: resultado?.email,\n      emails: resultado?.emailsReconhecidos,\n      clienteIds: resultado?.clienteIdsReconhecidos,\n      projetos: Array.isArray(resultado?.items) ? resultado.items.map((item) => item.codigoProjeto) : []\n    });\n    await esconderProcessamento();`
  );

  fs.writeFileSync(DELIVERY, code, "utf8");
  return true;
}

const backendChanged = patchBackend();
const deliveryChanged = patchDelivery();

if (backendChanged || deliveryChanged) {
  execFileSync("git", ["add", BACKEND, DELIVERY], { stdio: "inherit" });
}

/*
  O workflow testa git diff (unstaged) antes de commitar. Este marcador força
  uma pequena alteração em arquivo já incluído pelo workflow e garante que os
  dois arquivos staged acima entrem no commit automático.
*/
let triggerCode = fs.readFileSync(TRIGGER, "utf8");
if (!triggerCode.includes(TRIGGER_MARKER)) {
  triggerCode = triggerCode.replace(/\s*$/, "\n") + `\n${TRIGGER_MARKER}\n`;
  fs.writeFileSync(TRIGGER, triggerCode, "utf8");
}

console.log("Central Projetos Prontos V2: membro real -> e-mails/owners -> clienteIds -> ComprasProjetos; logout -> Home.");
