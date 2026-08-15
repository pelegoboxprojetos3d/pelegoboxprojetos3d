const fs = require('fs');

const arquivo = 'src/backend/entregaProjetosProntos.jsw';
const original = fs.readFileSync(arquivo, 'utf8');

const novo = String.raw`async function identidadeMembroAtual() {
  // CENTRAL_MEMBRO_REAL_V3_EMAIL_AUTENTICADO
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

  const emailsAutenticados = new Set();

  const adicionarEmailAutenticado = (value) => {
    const email = normalizeEmail(
      typeof value === "string"
        ? value
        : firstValue(value?.email, value?.value)
    );

    if (email) {
      emailsAutenticados.add(email);
    }
  };

  adicionarEmailAutenticado(membro?.loginEmail);
  emailsContato.forEach(adicionarEmailAutenticado);
  adicionarEmailAutenticado(membro?.contactDetails?.email);

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

  await Promise.all([
    coletar(CLIENTS_COLLECTION, "_owner", memberId, clientes, 100),
    coletar(SESSIONS_COLLECTION, "_owner", memberId, sessoes, 200)
  ]);

  for (const email of [...emailsAutenticados]) {
    await Promise.all([
      coletar(CLIENTS_COLLECTION, "email", email, clientes, 100),
      coletar(CLIENTS_COLLECTION, "Email", email, clientes, 100),
      coletar(SESSIONS_COLLECTION, "email", email, sessoes, 200),
      coletar(SESSIONS_COLLECTION, "Email", email, sessoes, 200)
    ]);
  }

  const emailCliente = (item) => normalizeEmail(
    firstValue(item?.email, item?.Email, item?.["E-mail"])
  );

  const emailSessao = (item) => normalizeEmail(
    firstValue(item?.email, item?.Email, item?.["E-mail"])
  );

  const pertenceAoEmailAutenticado = (email) =>
    Boolean(email && emailsAutenticados.has(email));

  /*
    _owner sozinho não concede acesso a compras.
    Cliente e sessão precisam trazer o mesmo e-mail autenticado da conta.
  */
  for (const [id, item] of [...clientes.entries()]) {
    if (!pertenceAoEmailAutenticado(emailCliente(item))) {
      clientes.delete(id);
    }
  }

  for (const [id, item] of [...sessoes.entries()]) {
    if (!pertenceAoEmailAutenticado(emailSessao(item))) {
      sessoes.delete(id);
    }
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

    const whats = normalizeWhatsapp(sessionWhatsapp(item));
    if (whats) whatsapps.add(whats);
  }

  for (const id of [...clientIds]) {
    await coletar(CLIENTS_COLLECTION, "clienteId", id, clientes, 20);

    try {
      const item = await wixData.get(CLIENTS_COLLECTION, id, READ_OPTS);
      if (item?._id) {
        clientes.set(safe(item._id), item);
      }
    } catch (_) {}
  }

  for (const [id, item] of [...clientes.entries()]) {
    if (!pertenceAoEmailAutenticado(emailCliente(item))) {
      clientes.delete(id);
    }
  }

  clientIds.clear();

  for (const item of clientes.values()) {
    const id = firstValue(
      item?.clienteId,
      item?.clienteID,
      item?.["Cliente ID"],
      item?._id
    );

    if (id) clientIds.add(id);
  }

  for (const item of sessoes.values()) {
    const id = firstValue(
      item?.clienteId,
      item?.clienteID,
      item?.["Cliente ID"]
    );

    if (id) clientIds.add(id);
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
    loginEmail: firstValue(loginEmail, [...emailsAutenticados][0]),
    email: firstValue(loginEmail, [...emailsAutenticados][0], payloadCliente.email),
    emails: [...emailsAutenticados],
    whatsapp: firstValue(
      payloadCliente.whatsapp,
      sessionWhatsapp(sessao),
      [...whatsapps][0]
    ),
    whatsapps: [...whatsapps]
  };
}
`;

const padrao = /async function identidadeMembroAtual\(\) \{[\s\S]*?\n\}\n\nfunction purchaseBelongsToMemberIdentity/;

if (!padrao.test(original)) {
  throw new Error('Não encontrei identidadeMembroAtual para corrigir.');
}

const atualizado = original.replace(
  padrao,
  novo + '\nfunction purchaseBelongsToMemberIdentity'
);

fs.writeFileSync(arquivo, atualizado.replace(/\s+$/, '') + '\n', 'utf8');
console.log('Identidade de Projetos Prontos blindada por e-mail autenticado.');
