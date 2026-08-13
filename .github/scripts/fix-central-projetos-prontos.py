from pathlib import Path

BACKEND = Path("src/backend/entregaProjetosProntos.jsw")
PAGE = Path("src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js")


def replace_between(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"Início não encontrado: {label}")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"Fim não encontrado: {label}")
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Esperava 1 ocorrência em {label}, achei {count}")
    return text.replace(old, new, 1)


backend = BACKEND.read_text(encoding="utf-8")

backend = replace_between(
    backend,
    "function sessionWhatsapp(item) {",
    "function sessionToken(item) {",
    '''function sessionWhatsapp(item) {
  return firstValue(
    item?.whatsappE164,
    item?.whatsapp,
    item?.whatsApp,
    item?.Whatsapp,
    item?.WhatsApp
  );
}''',
    "sessionWhatsapp"
)

backend = replace_between(
    backend,
    "function purchaseWhatsapp(item) {",
    "function purchaseClientId(item) {",
    '''function purchaseWhatsapp(item) {
  return firstValue(
    item?.whatsapp,
    item?.whatsApp,
    item?.Whatsapp,
    item?.WhatsApp,
    item?.["WhatsApp na compra"]
  );
}

function purchaseEmail(item) {
  return normalizeEmail(
    firstValue(
      item?.email,
      item?.Email,
      item?.["E-mail"],
      item?.emailCliente,
      item?.["E-mail da compra"]
    )
  );
}''',
    "purchaseWhatsapp"
)

backend = replace_between(
    backend,
    "function purchaseClientId(item) {",
    "function approvedPurchase(item) {",
    '''function purchaseClientId(item) {
  return firstValue(
    item?.clienteId,
    item?.clienteID,
    item?.["Cliente ID"],
    item?.["ID do cliente"],
    referenceId(item?.cliente)
  );
}''',
    "purchaseClientId"
)

backend = replace_between(
    backend,
    "function approvedPurchase(item) {",
    "function purchaseMatchesPayment(",
    '''function approvedPurchase(item) {
  const payment =
    safe(
      firstValue(
        item?.pagamento,
        item?.Pagamento,
        item?.formaPagamento
      )
    ).toLowerCase();

  const status =
    safe(
      firstValue(
        item?.statusCompra,
        item?.StatusCompra,
        item?.["Status Compra"],
        item?.["Status da compra"]
      )
    ).toLowerCase();

  return [
    "approved",
    "aprovada",
    "aprovado",
    "liberada",
    "liberado",
    "pago",
    "paga",
    "paid"
  ].includes(payment) || [
    "approved",
    "aprovada",
    "aprovado",
    "liberada",
    "liberado",
    "pago",
    "paga",
    "paid"
  ].includes(status);
}''',
    "approvedPurchase"
)

backend = replace_between(
    backend,
    "function purchaseMatchesIdentity(",
    "function publicSession(item) {",
    '''function purchaseMatchesIdentity(
  purchase,
  identity
) {
  const clientId = safe(identity?.clienteId);
  const clientRef = safe(identity?.cliente?._id);
  const email = normalizeEmail(identity?.email);
  const whatsapp = normalizeWhatsapp(identity?.whatsapp);

  const itemClientId = purchaseClientId(purchase);
  const itemEmail = purchaseEmail(purchase);
  const itemWhatsapp = normalizeWhatsapp(
    purchaseWhatsapp(purchase)
  );

  if (
    clientId &&
    itemClientId &&
    clientId === itemClientId
  ) {
    return true;
  }

  if (
    clientRef &&
    itemClientId &&
    clientRef === itemClientId
  ) {
    return true;
  }

  if (
    email &&
    itemEmail &&
    email === itemEmail
  ) {
    return true;
  }

  if (
    whatsapp &&
    itemWhatsapp &&
    whatsapp === itemWhatsapp
  ) {
    return true;
  }

  return false;
}''',
    "purchaseMatchesIdentity"
)

backend = replace_between(
    backend,
    "async function queryPurchasesByProject(",
    "function newestFirst(items = []) {",
    '''async function queryPurchasesByProject(
  codigoProjeto
) {
  const code = normalizeProjectCode(codigoProjeto);

  if (!code) {
    return [];
  }

  const found = new Map();
  const attempts = [code];
  const numericCode = Number(code);

  if (Number.isSafeInteger(numericCode)) {
    attempts.push(numericCode);
  }

  for (const value of attempts) {
    try {
      const result = await wixData
        .query(PURCHASES_COLLECTION)
        .eq("codigoProjeto", value)
        .limit(1000)
        .find(READ_OPTS);

      for (const item of result.items || []) {
        const id = safe(item?._id);
        if (id) found.set(id, item);
      }
    } catch (error) {
      console.warn(
        "Busca de compras falhou:",
        value,
        error?.message || error
      );
    }
  }

  if (!found.size) {
    try {
      let result = await wixData
        .query(PURCHASES_COLLECTION)
        .limit(1000)
        .find(READ_OPTS);

      while (result) {
        for (const item of result.items || []) {
          const itemCode = normalizeProjectCode(
            firstValue(
              item?.codigoProjeto,
              item?.codigo_projeto,
              item?.codigo,
              item?.["Código do projeto"]
            )
          );

          if (itemCode === code) {
            const id = safe(item?._id);
            if (id) found.set(id, item);
          }
        }

        if (
          typeof result.hasNext !== "function" ||
          !result.hasNext()
        ) {
          break;
        }

        result = await result.next();
      }
    } catch (error) {
      console.warn(
        "Varredura de compatibilidade das compras falhou:",
        error?.message || error
      );
    }
  }

  return [...found.values()];
}''',
    "queryPurchasesByProject"
)

backend = replace_between(
    backend,
    "function clientPayload(item) {",
    "function isEmailAliasName(",
    '''function clientPayload(item) {
  if (!item) {
    return {
      _id: "",
      clienteId: "",
      nome: "",
      email: "",
      whatsapp: ""
    };
  }

  return {
    _id: safe(item?._id),

    clienteId: firstValue(
      item?.clienteId,
      item?.clienteID,
      item?.["Cliente ID"],
      item?._id
    ),

    nome: firstValue(
      item?.nome,
      item?.nomeCliente,
      item?.Nomecliente,
      item?.title,
      item?.Title
    ),

    email: normalizeEmail(
      firstValue(
        item?.email,
        item?.Email,
        item?.["E-mail"]
      )
    ),

    whatsapp: firstValue(
      item?.whatsapp,
      item?.whatsApp,
      item?.Whatsapp,
      item?.WhatsApp
    )
  };
}''',
    "clientPayload"
)

backend = replace_between(
    backend,
    "async function identidadeMembroAtual() {",
    "async function queryPurchasesByIdentity(identity = {}) {",
    '''async function identidadeMembroAtual() {
  let membro = null;

  try {
    membro = await currentMember.getMember();
  } catch (_) {
    return null;
  }

  if (!membro?._id) {
    return null;
  }

  const emailsContato =
    Array.isArray(membro?.contactDetails?.emails)
      ? membro.contactDetails.emails
      : [];

  const emails = emailsContato
    .map((item) =>
      typeof item === "string"
        ? item
        : firstValue(item?.email, item?.value)
    )
    .filter(Boolean);

  const email = normalizeEmail(
    firstValue(
      membro?.loginEmail,
      emails[0],
      membro?.contactDetails?.email
    )
  );

  const phonesContato =
    Array.isArray(membro?.contactDetails?.phones)
      ? membro.contactDetails.phones
      : [];

  const telefones = phonesContato
    .map((item) =>
      typeof item === "string"
        ? item
        : firstValue(
          item?.phone,
          item?.value,
          item?.number
        )
    )
    .map(normalizeWhatsapp)
    .filter(Boolean);

  const nomeMembro = firstValue(
    membro?.profile?.nickname,
    [
      safe(membro?.contactDetails?.firstName),
      safe(membro?.contactDetails?.lastName)
    ].filter(Boolean).join(" ")
  );

  const phoneVariants = new Set();

  for (const phone of telefones) {
    if (!phone) continue;
    phoneVariants.add(phone);
    phoneVariants.add(`+${phone}`);

    if (phone.startsWith("55") && phone.length >= 12) {
      phoneVariants.add(phone.slice(2));
    } else if (phone.length === 10 || phone.length === 11) {
      phoneVariants.add(`55${phone}`);
      phoneVariants.add(`+55${phone}`);
    }
  }

  const clientes = new Map();

  if (email) {
    for (const field of ["email", "Email"]) {
      try {
        const result = await wixData
          .query(CLIENTS_COLLECTION)
          .eq(field, email)
          .limit(20)
          .find(READ_OPTS);

        for (const item of result.items || []) {
          const id = safe(item?._id);
          if (id) clientes.set(id, item);
        }
      } catch (_) {}
    }
  }

  if (!clientes.size && phoneVariants.size) {
    for (const field of ["whatsapp", "whatsApp"]) {
      for (const value of phoneVariants) {
        try {
          const result = await wixData
            .query(CLIENTS_COLLECTION)
            .eq(field, value)
            .limit(20)
            .find(READ_OPTS);

          for (const item of result.items || []) {
            const id = safe(item?._id);
            if (id) clientes.set(id, item);
          }
        } catch (_) {}
      }
    }
  }

  let cliente = newestFirst(
    [...clientes.values()]
  )[0] || null;

  const sessoes = new Map();

  if (email) {
    for (const field of ["email", "Email"]) {
      try {
        const result = await wixData
          .query(SESSIONS_COLLECTION)
          .eq(field, email)
          .limit(50)
          .find(READ_OPTS);

        for (const item of result.items || []) {
          const id = safe(item?._id);
          if (id) sessoes.set(id, item);
        }
      } catch (_) {}
    }
  }

  if (!sessoes.size && phoneVariants.size) {
    for (const field of ["whatsapp", "whatsApp", "whatsappE164"]) {
      for (const value of phoneVariants) {
        try {
          const result = await wixData
            .query(SESSIONS_COLLECTION)
            .eq(field, value)
            .limit(50)
            .find(READ_OPTS);

          for (const item of result.items || []) {
            const id = safe(item?._id);
            if (id) sessoes.set(id, item);
          }
        } catch (_) {}
      }
    }
  }

  const sessao = newestFirst(
    [...sessoes.values()]
  )[0] || null;

  if (!cliente && sessao) {
    const sessionClientId = firstValue(
      sessao?.clienteId,
      sessao?.["Cliente ID"]
    );

    if (sessionClientId) {
      cliente =
        await findOne(
          CLIENTS_COLLECTION,
          "clienteId",
          sessionClientId
        );

      if (!cliente) {
        try {
          cliente = await wixData.get(
            CLIENTS_COLLECTION,
            sessionClientId,
            READ_OPTS
          );
        } catch (_) {
          cliente = null;
        }
      }
    }
  }

  const payloadCliente = clientPayload(cliente);

  return {
    memberId: safe(membro._id),
    cliente,
    clienteId: firstValue(
      payloadCliente.clienteId,
      sessao?.clienteId,
      sessao?.["Cliente ID"],
      cliente?._id
    ),
    nome: firstValue(
      payloadCliente.nome,
      sessao?.nomeCliente,
      sessao?.nome,
      nomeMembro
    ),
    email: firstValue(
      payloadCliente.email,
      normalizeEmail(sessao?.email),
      normalizeEmail(sessao?.Email),
      email
    ),
    whatsapp: firstValue(
      payloadCliente.whatsapp,
      sessionWhatsapp(sessao),
      telefones[0]
    )
  };
}''',
    "identidadeMembroAtual"
)

backend = replace_between(
    backend,
    "async function queryPurchasesByIdentity(identity = {}) {",
    "function acessoDescricao(access = {}) {",
    '''async function queryPurchasesByIdentity(identity = {}) {
  const found = new Map();

  const clientId = safe(identity?.clienteId);
  const clientRef = safe(identity?.cliente?._id);
  const email = normalizeEmail(identity?.email);
  const whatsapp = normalizeWhatsapp(identity?.whatsapp);

  const attempts = [];

  if (clientId) attempts.push(["clienteId", clientId]);
  if (clientRef) attempts.push(["cliente", clientRef]);
  if (email) attempts.push(["email", email]);

  const phoneValues = new Set();
  if (whatsapp) {
    phoneValues.add(whatsapp);
    phoneValues.add(`+${whatsapp}`);

    if (whatsapp.startsWith("55") && whatsapp.length >= 12) {
      phoneValues.add(whatsapp.slice(2));
    } else if (whatsapp.length === 10 || whatsapp.length === 11) {
      phoneValues.add(`55${whatsapp}`);
      phoneValues.add(`+55${whatsapp}`);
    }

    const whatsappNumber = Number(whatsapp);
    if (Number.isSafeInteger(whatsappNumber)) {
      phoneValues.add(whatsappNumber);
    }
  }

  for (const value of phoneValues) {
    attempts.push(["whatsapp", value]);
    attempts.push(["whatsApp", value]);
  }

  for (const [field, value] of attempts) {
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
        `Busca de compras do membro por ${field} falhou:`,
        error?.message || error
      );
    }
  }

  let matched = [...found.values()].filter((purchase) =>
    purchaseMatchesIdentity(purchase, identity)
  );

  if (!matched.length) {
    try {
      const fallback = new Map();
      let result = await wixData
        .query(PURCHASES_COLLECTION)
        .limit(1000)
        .find(READ_OPTS);

      while (result) {
        for (const item of result.items || []) {
          if (purchaseMatchesIdentity(item, identity)) {
            const id = safe(item?._id);
            if (id) fallback.set(id, item);
          }
        }

        if (
          typeof result.hasNext !== "function" ||
          !result.hasNext()
        ) {
          break;
        }

        result = await result.next();
      }

      matched = [...fallback.values()];
    } catch (error) {
      console.warn(
        "Varredura de compatibilidade das compras do membro falhou:",
        error?.message || error
      );
    }
  }

  return matched;
}''',
    "queryPurchasesByIdentity"
)

backend = replace_once(
    backend,
    '''    const codigoProjeto = normalizeProjectCode(
      purchase?.codigoProjeto
    );''',
    '''    const codigoProjeto = normalizeProjectCode(
      firstValue(
        purchase?.codigoProjeto,
        purchase?.codigo_projeto,
        purchase?.codigo,
        purchase?.["Código do projeto"]
      )
    );''',
    "agrupamento por projeto"
)

BACKEND.write_text(backend, encoding="utf-8")

page = PAGE.read_text(encoding="utf-8")

page = replace_between(
    page,
    "async function mostrarDadosCarregados() {",
    "function blindarGaleriaPadrao() {",
    '''async function mostrarDadosCarregados() {
  await Promise.allSettled(
    IDS_DADOS_REAIS_ENTREGA.map(async (id) => {
      try {
        const elemento = $w(id);

        if (typeof elemento.expand === "function") {
          await elemento.expand();
        }

        if (typeof elemento.show === "function") {
          await elemento.show();
        }
      } catch (_) {}
    })
  );
}''',
    "mostrarDadosCarregados"
)

marker = "async function carregarCentralSegundasVias() {"
helper = '''async function manterAreaCentralVazia() {
  try {
    const galeria = $w(IDS.galeria);

    if (typeof galeria.expand === "function") {
      await galeria.expand();
    }

    if (typeof galeria.hide === "function") {
      await galeria.hide();
    }
  } catch (erro) {
    console.warn(
      "Não foi possível preservar a altura da central vazia:",
      erro?.message || erro
    );
  }
}

'''
if marker not in page:
    raise RuntimeError("Marcador carregarCentralSegundasVias não encontrado")
page = page.replace(marker, helper + marker, 1)

page = page.replace(
    '''      try {
        await $w(IDS.galeria).hide();
        await $w(IDS.galeria).collapse();
      } catch (_) {}

      return;''',
    '''      await manterAreaCentralVazia();

      return;'''
)

page = replace_once(
    page,
    '''    const itensGaleria = projetosSegundaVia
      .filter((item) => safe(item?.thumbnail))
      .map((item) => ({''',
    '''    projetosSegundaVia = projetosSegundaVia
      .filter((item) => safe(item?.thumbnail));

    if (!projetosSegundaVia.length) {
      alterarDescricao(
        "Seus projetos foram encontrados, mas as imagens ainda não estão disponíveis."
      );
      await manterAreaCentralVazia();
      return;
    }

    const itensGaleria = projetosSegundaVia
      .map((item) => ({''',
    "índices da galeria central"
)

page = replace_once(
    page,
    '''    await esconderProcessamento();
    alterarDescricao(
      "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
    );''',
    '''    await esconderProcessamento();
    await manterAreaCentralVazia();
    alterarDescricao(
      "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
    );''',
    "erro da central"
)

PAGE.write_text(page, encoding="utf-8")

print("Correção aplicada com sucesso.")
