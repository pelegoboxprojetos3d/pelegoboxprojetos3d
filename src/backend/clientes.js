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
 *
 * Exemplos aceitos:
 * 47988419261
 * 5547988419261
 * +5547988419261
 *
 * Resultado:
 * +5547988419261
 */
export function normalizarWhatsapp(numero) {
  const original = texto(numero);
  let numeros = somenteNumeros(original);

  if (!numeros) return "";

  // E164 explícito: preserva qualquer DDI válido.
  if (original.startsWith("+") && numeros.length >= 7 && numeros.length <= 15) {
    return `+${numeros}`;
  }

  // Compatibilidade com o Brasil legado.
  if (numeros.startsWith(DDI_BRASIL) && (numeros.length === 12 || numeros.length === 13)) {
    return `+${numeros}`;
  }
  if (numeros.length === 10 || numeros.length === 11) {
    return `+${DDI_BRASIL}${numeros}`;
  }

  // Número internacional sem o sinal +, já contendo DDI.
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

/**
 * Procura um cliente aceitando registros antigos:
 *
 * +5547988419261
 * 5547988419261
 * 47988419261
 *
 * Quando encontra formato antigo, atualiza para o padrão oficial.
 */
function primeiroValor(...valores) {
  for (const valor of valores) {
    const resultado = texto(valor);

    if (resultado) {
      return resultado;
    }
  }

  return "";
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

  encontrados.sort((a, b) => {
    const dataA = new Date(
      a?._updatedDate ||
      a?._createdDate ||
      0
    ).getTime();

    const dataB = new Date(
      b?._updatedDate ||
      b?._createdDate ||
      0
    ).getTime();

    return dataB - dataA;
  });

  return encontrados[0] || null;
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
  } catch (error) {
    // O valor pode ser um clienteId legado, e não o _id.
  }

  try {
    const resultado = await wixData
      .query(COLECAO_CLIENTES)
      .eq("clienteId", id)
      .limit(1)
      .find();

    return resultado.items[0] || null;
  } catch (error) {
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
    _id:
      primeiroValor(
        cliente?._id,
        clienteId
      ),
    clienteId,
    nome,
    title:
      primeiroValor(
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
 * Procura primeiro na coleção oficial de clientes.
 * Se o registro estiver incompleto ou ausente, recupera os dados
 * mais recentes da sessão do checkout sem criar colunas novas.
 */
export async function buscarCliente(whatsapp) {
  const whatsappPadrao =
    normalizarWhatsapp(whatsapp);

  if (!whatsappPadrao) {
    return null;
  }

  const variantes =
    criarVariantesWhatsapp(whatsappPadrao);

  const clienteDireto =
    await buscarPorWhatsapp(
      COLECAO_CLIENTES,
      variantes
    );

  const sessao =
    await buscarPorWhatsapp(
      COLECAO_SESSOES,
      variantes
    );

  if (!clienteDireto && !sessao) {
    return null;
  }

  let cliente = clienteDireto;

  if (!cliente && sessao) {
    cliente =
      await buscarClientePorId(
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

export async function criarCliente(dados = {}) {
  const whatsapp =
    normalizarWhatsapp(dados.whatsapp);

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

  const existente =
    await buscarCliente(whatsapp);

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

    if (!texto(existente.status)) {
      existente.status = "NOVO";
    }

    if (!texto(existente.origem)) {
      existente.origem =
        "CHECKOUT_PROJETOS_PRONTOS";
    }

    if (
      typeof existente.ativo !== "boolean"
    ) {
      existente.ativo = true;
    }

    const atualizado = await wixData.update(
      COLECAO_CLIENTES,
      existente
    );

    return atualizado;
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

  return await wixData.update(
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

  return await wixData.update(
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

  return await wixData.update(
    COLECAO_CLIENTES,
    cliente
  );
}