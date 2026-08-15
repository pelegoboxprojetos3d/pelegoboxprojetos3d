import wixData from "wix-data";

const COLECAO_CLIENTES = "Campo";
const COLECAO_SESSOES = "SessoesProjetosProntos2";
const DDI_BRASIL = "55";

function texto(valor) {
  return String(valor ?? "").trim();
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, "");
}

function normalizarEmail(email) {
  return texto(email).toLowerCase();
}

function normalizarCpfCnpj(valor) {
  const numeros = somenteNumeros(valor);

  if (
    numeros.length !== 11 &&
    numeros.length !== 14
  ) {
    return "";
  }

  return numeros;
}

/**
 * Padrão oficial salvo na coleção:
 * +55 + DDD + número
 */
export function normalizarWhatsapp(numero) {
  const original = texto(numero);
  let numeros = somenteNumeros(original);

  if (!numeros) return "";

  if (
    original.startsWith("+") &&
    numeros.length >= 7 &&
    numeros.length <= 15
  ) {
    return `+${numeros}`;
  }

  if (
    numeros.startsWith(DDI_BRASIL) &&
    (numeros.length === 12 || numeros.length === 13)
  ) {
    return `+${numeros}`;
  }

  if (numeros.length === 10 || numeros.length === 11) {
    return `+${DDI_BRASIL}${numeros}`;
  }

  if (numeros.length >= 7 && numeros.length <= 15) {
    return `+${numeros}`;
  }

  return "";
}

function criarVariantesWhatsapp(numero) {
  const padrao = normalizarWhatsapp(numero);

  if (!padrao) {
    return [];
  }

  const completoSemMais = somenteNumeros(padrao);
  const numeroNacional = completoSemMais.slice(2);

  return [
    padrao,
    completoSemMais,
    numeroNacional
  ];
}

function primeiroValor(...valores) {
  for (const valor of valores) {
    const resultado = texto(valor);

    if (resultado) {
      return resultado;
    }
  }

  return "";
}

function timestampItem(item) {
  return new Date(
    item?._updatedDate ||
    item?._createdDate ||
    0
  ).getTime();
}

function ordenarClientesPreferindoAtivo(a, b) {
  const ativoA = a?.ativo !== false ? 1 : 0;
  const ativoB = b?.ativo !== false ? 1 : 0;

  if (ativoA !== ativoB) {
    return ativoB - ativoA;
  }

  return timestampItem(b) - timestampItem(a);
}

async function buscarPorWhatsapp(
  colecao,
  variantes
) {
  const consultas = variantes.map(
    async (variante) => {
      try {
        const resultado = await wixData
          .query(colecao)
          .eq("whatsapp", variante)
          .limit(50)
          .find();

        return resultado.items;
      } catch (error) {
        console.warn(
          `Falha ao consultar ${colecao} pelo WhatsApp:`,
          error?.message || error
        );

        return [];
      }
    }
  );

  const encontrados = (
    await Promise.all(consultas)
  ).flat();

  encontrados.sort(
    colecao === COLECAO_CLIENTES
      ? ordenarClientesPreferindoAtivo
      : (a, b) => timestampItem(b) - timestampItem(a)
  );

  return encontrados[0] || null;
}

async function buscarClientePorEmail(email) {
  const mail = normalizarEmail(email);

  if (!mail) {
    return null;
  }

  const encontrados = [];

  for (const campo of ["email", "Email"]) {
    try {
      const resultado = await wixData
        .query(COLECAO_CLIENTES)
        .eq(campo, mail)
        .limit(50)
        .find();

      encontrados.push(
        ...(resultado.items || [])
      );
    } catch (_) {}
  }

  const unicos = Array.from(
    new Map(
      encontrados
        .filter(Boolean)
        .map((item) => [texto(item?._id), item])
    ).values()
  ).filter((item) => texto(item?._id));

  unicos.sort(ordenarClientesPreferindoAtivo);

  return unicos[0] || null;
}

async function buscarClientePorId(clienteId) {
  const id = texto(clienteId);

  if (!id) {
    return null;
  }

  try {
    const cliente = await wixData.get(
      COLECAO_CLIENTES,
      id
    );

    if (cliente) {
      return cliente;
    }
  } catch (_) {
    // O valor pode ser um clienteId legado, e não o _id.
  }

  try {
    const resultado = await wixData
      .query(COLECAO_CLIENTES)
      .eq("clienteId", id)
      .limit(50)
      .find();

    const items = resultado.items || [];
    items.sort(ordenarClientesPreferindoAtivo);

    return items[0] || null;
  } catch (_) {
    return null;
  }
}

function mesclarClienteComSessao(
  cliente,
  sessao,
  whatsapp
) {
  const clienteId = primeiroValor(
    cliente?._id,
    cliente?.clienteId,
    sessao?.clienteId,
    sessao?.["Cliente ID"]
  );

  const nome = primeiroValor(
    cliente?.nome,
    cliente?.nomeCliente,
    cliente?.title,
    cliente?.Title,
    sessao?.nomeCliente,
    sessao?.Nomecliente,
    sessao?.title,
    sessao?.Title
  );

  const email = primeiroValor(
    cliente?.email,
    cliente?.Email,
    sessao?.email,
    sessao?.Email
  );

  const cpfCnpj = primeiroValor(
    cliente?.cpfCnpj,
    cliente?.cpfcnpj,
    cliente?.Cpfcnpj,
    cliente?.["CPF/CNPJ"],
    sessao?.cpfCnpj,
    sessao?.cpfcnpj,
    sessao?.Cpfcnpj,
    sessao?.["CPF/CNPJ"]
  );

  return {
    ...(cliente || {}),
    _id: primeiroValor(
      cliente?._id,
      clienteId
    ),
    clienteId,
    nome,
    title: primeiroValor(
      cliente?.title,
      cliente?.Title,
      nome
    ),
    whatsapp,
    email,
    cpfCnpj
  };
}

/**
 * Busca de compatibilidade por WhatsApp.
 * Registros ativos da coleção Clientes sempre têm prioridade.
 */
export async function buscarCliente(whatsapp) {
  const whatsappPadrao = normalizarWhatsapp(whatsapp);

  if (!whatsappPadrao) {
    return null;
  }

  const variantes = criarVariantesWhatsapp(whatsappPadrao);

  const clienteDireto = await buscarPorWhatsapp(
    COLECAO_CLIENTES,
    variantes
  );

  const sessao = await buscarPorWhatsapp(
    COLECAO_SESSOES,
    variantes
  );

  if (!clienteDireto && !sessao) {
    return null;
  }

  let cliente = clienteDireto;

  if (!cliente && sessao) {
    cliente = await buscarClientePorId(
      primeiroValor(
        sessao.clienteId,
        sessao["Cliente ID"]
      )
    );
  }

  return mesclarClienteComSessao(
    cliente,
    sessao,
    whatsappPadrao
  );
}

/**
 * IDENTIDADE_CLIENTE_EMAIL_CANONICO_V1
 *
 * Para criar/atualizar cliente, o e-mail autenticado é a chave principal.
 * WhatsApp é contato, não é autorização para transferir um cadastro de uma
 * conta para outra. Isso impede que testes em PC/celular cruzem Cliente IDs.
 */
export async function criarCliente(dados = {}) {
  const whatsapp = normalizarWhatsapp(dados.whatsapp);

  if (!whatsapp) {
    throw new Error(
      "WhatsApp inválido. Informe DDD e número."
    );
  }

  const nome = texto(dados.nome);
  const email = normalizarEmail(dados.email);
  const cpfCnpj = normalizarCpfCnpj(
    dados.cpfCnpj ||
    dados.cpf ||
    dados.cnpj
  );

  let existente = email
    ? await buscarClientePorEmail(email)
    : null;

  if (!existente) {
    const porWhatsapp = await buscarPorWhatsapp(
      COLECAO_CLIENTES,
      criarVariantesWhatsapp(whatsapp)
    );

    const emailExistente = normalizarEmail(
      primeiroValor(
        porWhatsapp?.email,
        porWhatsapp?.Email
      )
    );

    /*
      Só reaproveita cadastro localizado por telefone quando ele ainda não tem
      e-mail ou quando pertence ao MESMO e-mail. E-mails diferentes significam
      contas diferentes, mesmo que o telefone coincida.
    */
    if (
      porWhatsapp &&
      (
        !email ||
        !emailExistente ||
        emailExistente === email
      )
    ) {
      existente = porWhatsapp;
    }
  }

  if (existente) {
    existente.whatsapp = whatsapp;
    existente.ultimoAcesso = new Date();

    if (nome) {
      existente.nome = nome;
      existente.title = nome;
    }

    if (email) {
      existente.email = email;
    }

    if (cpfCnpj) {
      existente.cpfCnpj = cpfCnpj;
    }

    if (!texto(existente.clienteId)) {
      existente.clienteId = texto(existente._id);
    }

    if (!texto(existente.status)) {
      existente.status = "NOVO";
    }

    if (!texto(existente.origem)) {
      existente.origem =
        "CHECKOUT_PROJETOS_PRONTOS";
    }

    if (typeof existente.ativo !== "boolean") {
      existente.ativo = true;
    }

    return wixData.update(
      COLECAO_CLIENTES,
      existente
    );
  }

  const agora = new Date();

  const cliente = {
    title: nome || whatsapp,
    nome,
    whatsapp,
    email,
    cpfCnpj,
    dataCadastro: agora,
    ultimoAcesso: agora,
    status: "NOVO",
    observacoes: "",
    clienteId: "",
    origem:
      texto(dados.origem) ||
      "CHECKOUT_PROJETOS_PRONTOS",
    ativo: true
  };

  const inserido = await wixData.insert(
    COLECAO_CLIENTES,
    cliente
  );

  inserido.clienteId = inserido._id;

  return wixData.update(
    COLECAO_CLIENTES,
    inserido
  );
}

/**
 * Atualiza o último acesso do cliente.
 */
export async function atualizarUltimoAcesso(id) {
  const cliente = await wixData.get(
    COLECAO_CLIENTES,
    id
  );

  cliente.ultimoAcesso = new Date();

  return wixData.update(
    COLECAO_CLIENTES,
    cliente
  );
}

/**
 * Atualiza o e-mail do cliente.
 */
export async function atualizarEmail(
  id,
  email
) {
  const cliente = await wixData.get(
    COLECAO_CLIENTES,
    id
  );

  cliente.email = normalizarEmail(email);
  cliente.ultimoAcesso = new Date();

  return wixData.update(
    COLECAO_CLIENTES,
    cliente
  );
}
