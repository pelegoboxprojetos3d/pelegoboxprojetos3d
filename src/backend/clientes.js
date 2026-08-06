import wixData from "wix-data";

const COLECAO_CLIENTES = "Campo";
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
  let numeros = somenteNumeros(numero);

  if (
    numeros.startsWith(DDI_BRASIL) &&
    (
      numeros.length === 12 ||
      numeros.length === 13
    )
  ) {
    numeros = numeros.slice(2);
  }

  if (
    numeros.length !== 10 &&
    numeros.length !== 11
  ) {
    return "";
  }

  return `+${DDI_BRASIL}${numeros}`;
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
export async function buscarCliente(whatsapp) {
  const whatsappPadrao =
    normalizarWhatsapp(whatsapp);

  if (!whatsappPadrao) {
    return null;
  }

  const variantes =
    criarVariantesWhatsapp(whatsapp);

  for (const variante of variantes) {
    const resultado = await wixData
      .query(COLECAO_CLIENTES)
      .eq("whatsapp", variante)
      .limit(1)
      .find();

    if (!resultado.items.length) {
      continue;
    }

    const cliente = resultado.items[0];

    if (cliente.whatsapp !== whatsappPadrao) {
      cliente.whatsapp = whatsappPadrao;

      return await wixData.update(
        COLECAO_CLIENTES,
        cliente
      );
    }

    return cliente;
  }

  return null;
}

/**
 * Cria um cliente novo ou atualiza o registro existente.
 * Impede duplicidade causada por formatos diferentes de WhatsApp.
 */
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