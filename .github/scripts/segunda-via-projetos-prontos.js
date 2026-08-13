const fs = require('fs');

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  }
  return source.replace(oldText, newText);
}

const backendFile = 'src/backend/entregaProjetosProntos.jsw';
let backend = fs.readFileSync(backendFile, 'utf8');

backend = replaceOnce(
  backend,
  'import { getSecret } from "wix-secrets-backend";\n',
  'import { getSecret } from "wix-secrets-backend";\nimport { currentMember } from "wix-members-backend";\n',
  'import currentMember backend'
);

const backendInsertMarker = 'export async function obterAcessosProjeto(\n';
const backendInsert = `async function identidadeMembroAtual() {
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

  const nomeMembro = firstValue(
    membro?.profile?.nickname,
    [
      safe(membro?.contactDetails?.firstName),
      safe(membro?.contactDetails?.lastName)
    ].filter(Boolean).join(" ")
  );

  let cliente = null;

  if (email) {
    cliente = await findOne(
      CLIENTS_COLLECTION,
      "email",
      email
    );
  }

  const payloadCliente = clientPayload(cliente);

  return {
    memberId: safe(membro._id),
    cliente,
    clienteId: firstValue(
      payloadCliente.clienteId,
      cliente?._id
    ),
    nome: firstValue(
      payloadCliente.nome,
      nomeMembro
    ),
    email: firstValue(
      payloadCliente.email,
      email
    ),
    whatsapp: firstValue(
      payloadCliente.whatsapp,
      cliente?.whatsapp,
      cliente?.whatsApp
    )
  };
}

async function queryPurchasesByIdentity(identity = {}) {
  const found = new Map();

  const clientId = safe(identity?.clienteId);
  const clientRef = safe(identity?.cliente?._id);
  const email = normalizeEmail(identity?.email);
  const whatsapp = normalizeWhatsapp(identity?.whatsapp);

  const attempts = [];

  if (clientId) attempts.push(["clienteId", clientId]);
  if (clientRef) attempts.push(["cliente", clientRef]);
  if (email) attempts.push(["email", email]);

  if (whatsapp) {
    attempts.push(["whatsapp", whatsapp]);
    attempts.push(["whatsApp", whatsapp]);

    const whatsappNumber = Number(whatsapp);
    if (Number.isSafeInteger(whatsappNumber)) {
      attempts.push(["whatsapp", whatsappNumber]);
      attempts.push(["whatsApp", whatsappNumber]);
    }
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
        \`Busca de compras do membro por \${field} falhou:\`,
        error?.message || error
      );
    }
  }

  return [...found.values()].filter((purchase) =>
    purchaseMatchesIdentity(purchase, identity)
  );
}

function acessoDescricao(access = {}) {
  if (access.projeto === true) {
    return "Medidas, gráficos e projeto completo";
  }

  if (access.graficos === true) {
    return "Medidas e gráficos";
  }

  return "Medidas";
}

export async function listarProjetosProntosDoMembroAtual() {
  const identity = await identidadeMembroAtual();

  if (!identity) {
    return {
      ok: false,
      error: "LOGIN_NECESSARIO",
      items: []
    };
  }

  const purchases = (await queryPurchasesByIdentity(identity))
    .filter(approvedPurchase);

  const grouped = new Map();

  for (const purchase of purchases) {
    const codigoProjeto = normalizeProjectCode(
      purchase?.codigoProjeto
    );

    if (!codigoProjeto) continue;

    const current = grouped.get(codigoProjeto) || [];
    current.push(purchase);
    grouped.set(codigoProjeto, current);
  }

  const items = (
    await Promise.all(
      [...grouped.entries()].map(
        async ([codigoProjeto, compras]) => {
          const project = await findProjectByOrder(codigoProjeto);
          if (!project) return null;

          const access = calculateAccess(compras);
          const newest = newestFirst(compras)[0] || {};

          const timestamp = new Date(
            newest?._updatedDate ||
            newest?.dataLiberacao ||
            newest?.dataCompra ||
            0
          ).getTime();

          return {
            codigoProjeto,
            titulo: canonicalProjectTitle(
              project,
              { codigoProjeto, produto: newest?.produto }
            ),
            thumbnail: mediaSource(
              project?.thumbnail ||
              newest?.thumbnail ||
              newest?.imagemMedidas
            ),
            access,
            acessoTexto: acessoDescricao(access),
            atualizadoEm: Number.isFinite(timestamp)
              ? timestamp
              : 0
          };
        }
      )
    )
  )
    .filter(Boolean)
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  return {
    ok: true,
    memberId: identity.memberId,
    items
  };
}

export async function buscarSegundaViaProjetoPronto(input = {}) {
  const codigoProjeto = normalizeProjectCode(
    input.codigoProjeto
  );

  if (!codigoProjeto) {
    return {
      ok: false,
      error: "CODIGO_PROJETO_AUSENTE"
    };
  }

  const identity = await identidadeMembroAtual();

  if (!identity) {
    return {
      ok: false,
      error: "LOGIN_NECESSARIO"
    };
  }

  const allPurchases = await queryPurchasesByProject(
    codigoProjeto
  );

  const purchases = allPurchases
    .filter(approvedPurchase)
    .filter((purchase) =>
      purchaseMatchesIdentity(purchase, identity)
    );

  if (!purchases.length) {
    return {
      ok: false,
      error: "COMPRA_NAO_ENCONTRADA"
    };
  }

  const project = await findProjectByOrder(
    codigoProjeto
  );

  if (!project) {
    return {
      ok: false,
      error: "PROJETO_NAO_ENCONTRADO"
    };
  }

  const access = calculateAccess(purchases);
  const client = {
    ...clientPayload(identity.cliente),
    clienteId: firstValue(
      identity.clienteId,
      identity.cliente?._id
    ),
    nome: identity.nome,
    email: identity.email,
    whatsapp: identity.whatsapp
  };

  const tipoProduto = access.projeto
    ? "PROJETO_COMPLETO"
    : access.graficos
      ? "GRAFICOS"
      : "MEDIDAS";

  const session = {
    checkoutId: "",
    status: "approved",
    paymentId: "",
    clienteId: client.clienteId,
    nomeCliente: client.nome,
    email: client.email,
    whatsapp: client.whatsapp,
    codigoProjeto,
    tipoProduto,
    produto: canonicalProjectTitle(project, { codigoProjeto }),
    img: mediaSource(project?.thumbnail),
    valor: 0,
    returnUrl: "",
    compraRegistrada: true,
    emailEnviado: true,
    tokenEntrega: ""
  };

  const projectData = projectPayload(
    project,
    session,
    purchases,
    client
  );

  return {
    ok: true,
    approved: true,
    segundaVia: true,
    session,
    client,
    access,
    stages: buildStages(
      access,
      purchases,
      project
    ),
    project: projectData
  };
}

`;

backend = replaceOnce(
  backend,
  backendInsertMarker,
  backendInsert + backendInsertMarker,
  'funções backend segunda via'
);

fs.writeFileSync(backendFile, backend, 'utf8');

const pageFile = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let page = fs.readFileSync(pageFile, 'utf8');

page = replaceOnce(
  page,
`import {
  buscarEntregaProjetoPronto
} from "backend/entregaProjetosProntos.jsw";`,
`import {
  buscarEntregaProjetoPronto,
  listarProjetosProntosDoMembroAtual,
  buscarSegundaViaProjetoPronto
} from "backend/entregaProjetosProntos.jsw";`,
  'imports frontend segunda via'
);

page = replaceOnce(
  page,
`let videoCarregando =
  false;
`,
`let videoCarregando =
  false;

let centralSegundasViasAtiva =
  false;

let projetosSegundaVia =
  [];

let codigoSegundaViaAtual =
  "";
`,
  'estado frontend segunda via'
);

const centralMarker = `// ======================================================
// RENDERIZAR ENTREGA
// ======================================================
`;

const centralFunctions = `// ======================================================
// CENTRAL DE SEGUNDAS VIAS
// ======================================================

function descricaoAcessoCentral(item = {}) {
  return firstValue(
    item?.acessoTexto,
    item?.access?.projeto === true
      ? "Medidas, gráficos e projeto completo"
      : item?.access?.graficos === true
        ? "Medidas e gráficos"
        : "Medidas"
  );
}

async function esconderEtapasNaCentral() {
  const ids = [
    IDS.medidas,
    IDS.valorMedidas,
    IDS.graficos,
    IDS.valorGraficos,
    IDS.projeto,
    IDS.valorProjeto,
    IDS.boxMedidas,
    IDS.boxGraficos,
    IDS.boxProjeto,
    IDS.avisosEtapas,
    IDS.avisoImportante,
    "#box4"
  ];

  await Promise.allSettled(
    ids.map(async (id) => {
      try {
        const elemento = $w(id);
        if (typeof elemento.hide === "function") {
          await elemento.hide();
        }
        if (typeof elemento.collapse === "function") {
          await elemento.collapse();
        }
      } catch (_) {}
    })
  );
}

async function carregarCentralSegundasVias() {
  centralSegundasViasAtiva = true;
  codigoSegundaViaAtual = "";
  entrega = null;
  projetosSegundaVia = [];

  alterarDescricao(
    "Localizando os projetos comprados na sua conta..."
  );

  try {
    const resultado =
      await listarProjetosProntosDoMembroAtual();

    await esconderProcessamento();
    await esconderBotaoVideo();
    await esconderEtapasNaCentral();

    try {
      $w(IDS.titulo).text =
        "SEUS PROJETOS PRONTOS";
      await $w(IDS.titulo).show();
    } catch (_) {}

    if (!resultado?.ok) {
      alterarDescricao(
        resultado?.error === "LOGIN_NECESSARIO"
          ? "Entre na sua conta para consultar seus Projetos Prontos."
          : "Não foi possível consultar seus projetos agora."
      );

      try {
        await $w(IDS.galeria).hide();
        await $w(IDS.galeria).collapse();
      } catch (_) {}

      return;
    }

    projetosSegundaVia =
      Array.isArray(resultado.items)
        ? resultado.items
        : [];

    if (!projetosSegundaVia.length) {
      alterarDescricao(
        "Nenhum Projeto Pronto comprado foi encontrado nesta conta."
      );

      try {
        await $w(IDS.galeria).hide();
        await $w(IDS.galeria).collapse();
      } catch (_) {}

      return;
    }

    alterarDescricao(
      "Clique no projeto que deseja abrir novamente."
    );

    const itensGaleria = projetosSegundaVia
      .filter((item) => safe(item?.thumbnail))
      .map((item) => ({
        type: "image",
        src: safe(item.thumbnail),
        title:
          `#${digits(item.codigoProjeto)} ${safe(item.titulo)}`,
        description:
          descricaoAcessoCentral(item)
      }));

    $w(IDS.galeria).items =
      itensGaleria;

    try {
      $w(IDS.galeria).clickAction = "none";
    } catch (_) {}

    await $w(IDS.galeria).expand();
    await $w(IDS.galeria).show();

  } catch (erro) {
    console.error(
      "Erro ao carregar central de segundas vias:",
      erro?.message || erro
    );

    await esconderProcessamento();
    alterarDescricao(
      "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
    );
  }
}

async function abrirProjetoDaCentral(event) {
  if (!centralSegundasViasAtiva) {
    return;
  }

  const indice = Number(event?.itemIndex);
  const item = projetosSegundaVia[indice];

  if (!item?.codigoProjeto) {
    return;
  }

  try {
    await mostrarProcessamento();

    alterarDescricao(
      `Abrindo novamente o projeto #${digits(item.codigoProjeto)}...`
    );

    const resultado =
      await buscarSegundaViaProjetoPronto({
        codigoProjeto:
          item.codigoProjeto
      });

    if (!resultado?.ok || !resultado?.approved) {
      await esconderProcessamento();
      alterarDescricao(
        resultado?.error === "COMPRA_NAO_ENCONTRADA"
          ? "Esta compra não foi encontrada para a conta atual."
          : "Não foi possível abrir este projeto agora."
      );
      return;
    }

    centralSegundasViasAtiva = false;
    codigoSegundaViaAtual =
      digits(item.codigoProjeto);

    await renderizarEntrega(
      resultado
    );

  } catch (erro) {
    console.error(
      "Erro ao abrir segunda via:",
      erro?.message || erro
    );

    await esconderProcessamento();
    alterarDescricao(
      "Não foi possível abrir este projeto agora. Tente novamente."
    );
  }
}

`;

page = replaceOnce(
  page,
  centralMarker,
  centralFunctions + centralMarker,
  'funções frontend central segunda via'
);

page = replaceOnce(
  page,
`  /*
    O botão do vídeo não usa onClick.

    O próprio link do botão, configurado em
    prepararBotaoVideo(), abre a nova aba.
  */
}`,
`  try {
    $w(IDS.galeria).onItemClicked(
      (event) => {
        abrirProjetoDaCentral(event)
          .catch(console.error);
      }
    );
  } catch (erro) {
    console.warn(
      "Não foi possível ligar a seleção da central de projetos:",
      erro?.message || erro
    );
  }

  /*
    O botão do vídeo não usa onClick.

    O próprio link do botão, configurado em
    prepararBotaoVideo(), abre a nova aba.
  */
}`,
  'evento galeria central'
);

page = replaceOnce(
  page,
`  if (
    !checkoutId &&
    !token
  ) {
    alterarDescricao(
      "Link de entrega inválido: identificação da compra não encontrada."
    );

    await $w(
      IDS.galeria
    ).hide();

    await esconderBotaoVideo();

    return;
  }
`,
`  if (
    !checkoutId &&
    !token
  ) {
    await carregarCentralSegundasVias();
    return;
  }

  centralSegundasViasAtiva = false;
  codigoSegundaViaAtual = "";
`,
  'entrada sem checkout vira central'
);

page = replaceOnce(
  page,
`        const atualizado =
          await buscarEntregaProjetoPronto({
            checkoutId,
            token
          });`,
`        const atualizado =
          codigoSegundaViaAtual
            ? await buscarSegundaViaProjetoPronto({
              codigoProjeto:
                codigoSegundaViaAtual
            })
            : await buscarEntregaProjetoPronto({
              checkoutId,
              token
            });`,
  'refresh do projeto completo em segunda via'
);

fs.writeFileSync(pageFile, page, 'utf8');
