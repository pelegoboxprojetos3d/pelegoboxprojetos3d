// backend/processarCompraProjetoPronto.js
// FLUXO 034: grava somente em ComprasProjetos.
// PADRÃO DE IMAGENS: JPEG.
//
// PADRÕES:
// - WhatsApp salvo como +55DDDNÚMERO;
// - CPF/CNPJ salvo somente com números;
// - campo oficial de WhatsApp: whatsapp;
// - campo oficial de token: tokenDeEntrega;
// - suporta imagemGrafico4;
// - título PP com 3 dígitos até o projeto 100.

import wixData from "wix-data";
import { mediaManager } from "wix-media-backend";

const COLLECTION = "ComprasProjetos";

const DB_OPTS = {
  suppressAuth: true
};

const MEDIA_READY_ATTEMPTS = 20;
const MEDIA_READY_DELAY_MS = 1000;

const DDI_BRASIL = "55";


function safe(value) {
  return String(value ?? "").trim();
}


function firstValue(...values) {
  for (const value of values) {
    if (safe(value)) {
      return value;
    }
  }

  return "";
}


function onlyDigits(value) {
  return safe(value).replace(/\D/g, "");
}


function normalizeEmail(value) {
  return safe(value).toLowerCase();
}


function normalizeCpfCnpj(value) {
  const documento =
    onlyDigits(value);

  if (!documento) {
    return "";
  }

  if (
    documento.length !== 11 &&
    documento.length !== 14
  ) {
    throw new Error(
      "CPF/CNPJ precisa possuir 11 ou 14 dígitos."
    );
  }

  return documento;
}


/**
 * Padrão oficial salvo nas coleções:
 *
 * +55DDDNÚMERO
 *
 * Exemplos aceitos:
 * 47988419261
 * 5547988419261
 * +5547988419261
 *
 * Resultado:
 * +5547988419261
 */
function normalizeWhatsapp(value) {
  let numeros =
    onlyDigits(value);

  if (!numeros) {
    return "";
  }

  if (
    numeros.startsWith(DDI_BRASIL) &&
    (
      numeros.length === 12 ||
      numeros.length === 13
    )
  ) {
    numeros =
      numeros.slice(2);
  }

  if (
    numeros.length !== 10 &&
    numeros.length !== 11
  ) {
    throw new Error(
      "WhatsApp inválido. Informe DDD e número."
    );
  }

  return `+${DDI_BRASIL}${numeros}`;
}


/**
 * Título:
 *
 * 1    → 001
 * 26   → 026
 * 100  → 100
 * 1804 → 1804
 */
function formatCodigoTitulo(value) {
  const numeros =
    onlyDigits(value);

  if (!numeros) {
    return "";
  }

  const numero =
    Number(numeros);

  if (!Number.isFinite(numero)) {
    return numeros;
  }

  if (numero <= 100) {
    return String(numero).padStart(3, "0");
  }

  return String(numero);
}


function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}


function safeFilePart(value) {
  return safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}


function normalizeTipoProduto(value) {
  const tipo = safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    tipo === "MEDIDA" ||
    tipo === "MEDIDAS"
  ) {
    return "MEDIDAS";
  }

  if (
    tipo === "GRAFICO" ||
    tipo === "GRAFICOS"
  ) {
    return "GRAFICOS";
  }

  if (
    tipo === "PROJETO" ||
    tipo === "COMPLETO" ||
    tipo === "PROJETO_COMPLETO"
  ) {
    return "PROJETO_COMPLETO";
  }

  return "PROJETO_COMPLETO";
}


function normalizeNumber(value) {
  if (
    value === undefined ||
    value === null ||
    safe(value) === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  let texto = safe(value)
    .replace(/[^\d,.-]/g, "");

  if (
    texto.includes(",") &&
    texto.includes(".")
  ) {
    texto = texto
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (texto.includes(",")) {
    texto =
      texto.replace(",", ".");
  }

  const numero =
    Number(texto);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const data =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(data.getTime())
    ? null
    : data;
}


function isHttpUrl(value) {
  const url =
    safe(value).toLowerCase();

  return (
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}


async function localizarCompra(
  chaveCompra,
  clienteId,
  codigoProjeto
) {
  const porChave =
    await wixData
      .query(COLLECTION)
      .eq(
        "chaveCompra",
        chaveCompra
      )
      .limit(1)
      .find(DB_OPTS);

  if (porChave.items.length) {
    return porChave.items[0];
  }

  const porClienteProjeto =
    await wixData
      .query(COLLECTION)
      .eq(
        "clienteId",
        clienteId
      )
      .eq(
        "codigoProjeto",
        codigoProjeto
      )
      .limit(1)
      .find(DB_OPTS);

  return porClienteProjeto.items.length
    ? porClienteProjeto.items[0]
    : null;
}


function imageSourcesFromInput(
  input = {}
) {
  return [
    {
      field:
        "imagemMedidas",

      url:
        safe(
          firstValue(
            input.imagemMedidas,
            input?.imagens?.imagemMedidas,
            input?.imagens?.medidas
          )
        )
    },

    {
      field:
        "imagemGrafico1",

      url:
        safe(
          firstValue(
            input.imagemGrafico1,
            input?.imagens?.imagemGrafico1,
            input?.imagens?.grafico1
          )
        )
    },

    {
      field:
        "imagemGrafico2",

      url:
        safe(
          firstValue(
            input.imagemGrafico2,
            input?.imagens?.imagemGrafico2,
            input?.imagens?.grafico2
          )
        )
    },

    {
      field:
        "imagemGrafico3",

      url:
        safe(
          firstValue(
            input.imagemGrafico3,
            input?.imagens?.imagemGrafico3,
            input?.imagens?.grafico3
          )
        )
    },

    {
      field:
        "imagemGrafico4",

      url:
        safe(
          firstValue(
            input.imagemGrafico4,
            input?.imagens?.imagemGrafico4,
            input?.imagens?.grafico4
          )
        )
    }
  ].filter((item) => item.url);
}


function extractFileUrl(data = {}) {
  return safe(
    firstValue(
      data?.fileUrl,
      data?.file?.fileUrl,
      data?.fileInfo?.fileUrl,
      data?.media?.fileUrl,
      data?.media?.image?.image,
      data?.file?.media?.image?.image,
      data?.fileInfo?.media?.image?.image
    )
  );
}


function extractFileName(data = {}) {
  return safe(
    firstValue(
      data?.fileName,
      data?.originalFileName,
      data?.file?.fileName,
      data?.file?.originalFileName,
      data?.fileInfo?.fileName,
      data?.fileInfo?.originalFileName,
      data?.mediaId,
      data?._id,
      data?.id
    )
  );
}


function getFileIdentifiers(data = {}) {
  const values = [
    data?.fileName,
    data?.file?.fileName,
    data?.fileInfo?.fileName,
    data?.mediaId,
    data?._id,
    data?.id
  ]
    .map((value) => safe(value))
    .filter(Boolean);

  return [
    ...new Set(values)
  ];
}


async function waitForImportedFile(
  imported = {}
) {
  const immediateUrl =
    extractFileUrl(imported);

  if (immediateUrl) {
    return {
      ...imported,
      fileUrl:
        immediateUrl
    };
  }

  const identifiers =
    getFileIdentifiers(imported);

  if (!identifiers.length) {
    throw new Error(
      `O Wix não devolveu identificador do arquivo. Campos recebidos: ${
        Object.keys(imported || {}).join(", ") ||
        "nenhum"
      }`
    );
  }

  let lastError = "";

  for (
    let attempt = 1;
    attempt <= MEDIA_READY_ATTEMPTS;
    attempt += 1
  ) {
    for (
      const identifier of
      identifiers
    ) {
      try {
        const fileInfo =
          await mediaManager
            .getFileInfo(identifier);

        const fileUrl =
          extractFileUrl(fileInfo);

        if (fileUrl) {
          return {
            ...fileInfo,
            fileUrl
          };
        }
      } catch (error) {
        lastError =
          safe(
            error?.message ||
            error
          );
      }
    }

    await sleep(
      MEDIA_READY_DELAY_MS
    );
  }

  throw new Error(
    `O Wix importou o arquivo, mas não liberou o fileUrl. ${
      lastError
        ? `Último erro: ${lastError}`
        : ""
    }`
  );
}


async function importImageToWix({
  clienteId,
  codigoProjeto,
  field,
  sourceUrl
}) {
  if (!isHttpUrl(sourceUrl)) {
    throw new Error(
      `URL inválida em ${field}`
    );
  }

  const clientePasta =
    safeFilePart(clienteId) ||
    "cliente";

  const projetoPasta =
    safeFilePart(codigoProjeto) ||
    "projeto";

  const destination =
    `/compras-projetos/${clientePasta}/${projetoPasta}/${field}`;

  const imported =
    await mediaManager.importFile(
      destination,
      sourceUrl,
      {
        mediaOptions: {
          mimeType:
            "image/jpeg",

          mediaType:
            "image"
        },

        metadataOptions: {
          isPrivate:
            false,

          isVisitorUpload:
            false,

          context: {
            fluxo:
              "034-processar-pdf-projeto-pronto",

            clienteId,
            codigoProjeto,
            campo:
              field
          }
        }
      }
    );

  const ready =
    await waitForImportedFile(
      imported
    );

  const fileUrl =
    extractFileUrl(ready);

  if (!fileUrl) {
    throw new Error(
      `O Wix não liberou fileUrl para ${field}`
    );
  }

  return {
    field,
    fileUrl,

    fileName:
      extractFileName(ready)
  };
}


export async function processarCompraProjetoPronto(
  input = {}
) {
  const clienteId =
    safe(input.clienteId);

  const codigoProjeto =
    onlyDigits(
      firstValue(
        input.codigoProjeto,
        input.ordem_video,
        input.ordemVideo
      )
    );

  if (!clienteId) {
    throw new Error(
      "clienteId não informado"
    );
  }

  if (!codigoProjeto) {
    throw new Error(
      "codigoProjeto não informado"
    );
  }

  const codigoTitulo =
    formatCodigoTitulo(
      codigoProjeto
    );

  const nomeCliente =
    safe(
      firstValue(
        input.nomeCliente,
        input.nome
      )
    );

  const email =
    normalizeEmail(
      input.email
    );

  const checkoutId =
    safe(input.checkoutId);

  const tokenDeEntrega =
    safe(
      firstValue(
        input.tokenDeEntrega,
        input.tokenEntrega
      )
    );

  const idPagamento =
    safe(
      firstValue(
        input.idPagamento,
        input.paymentId
      )
    );

  const tipoProduto =
    normalizeTipoProduto(
      input.tipoProduto
    );

  const chaveCompra =
    `${clienteId}_${codigoProjeto}`;

  const existente =
    await localizarCompra(
      chaveCompra,
      clienteId,
      codigoProjeto
    );

  const whatsappRecebido =
    firstValue(
      input.whatsapp,
      input.whatsApp,
      existente?.whatsapp,
      existente?.whatsApp
    );

  const whatsapp =
    normalizeWhatsapp(
      whatsappRecebido
    );

  const cpfCnpjRecebido =
    firstValue(
      input.cpfCnpj,
      input.cpf,
      input.cnpj,
      existente?.cpfCnpj
    );

  const cpfCnpj =
    normalizeCpfCnpj(
      cpfCnpjRecebido
    );

  const agora =
    new Date();

  const valorRecebido =
    normalizeNumber(
      input.valor
    );

  const dataCompraRecebida =
    normalizeDate(
      firstValue(
        input.dataCompra,
        input.dataISO
      )
    );

  const arquivoProjeto =
    safe(
      firstValue(
        input.arquivoProjeto,
        input.arquivo_projeto,
        input.pdfProjetoUrl,
        input.pdfUrl
      )
    );

  if (
    arquivoProjeto &&
    !isHttpUrl(arquivoProjeto)
  ) {
    throw new Error(
      "arquivoProjeto precisa ser uma URL HTTP ou HTTPS"
    );
  }

  const downloadMedidas =
    existente?.downloadMedidas === true ||
    tipoProduto === "MEDIDAS" ||
    tipoProduto === "GRAFICOS" ||
    tipoProduto === "PROJETO_COMPLETO";

  const downloadGraficos =
    existente?.downloadGraficos === true ||
    tipoProduto === "GRAFICOS" ||
    tipoProduto === "PROJETO_COMPLETO";

  const downloadProjeto =
    existente?.downloadProjeto === true ||
    tipoProduto === "PROJETO_COMPLETO";

  const registro = {
    ...(existente || {}),

    title:
      `PP-${codigoTitulo} - ${
        nomeCliente ||
        existente?.nomeCliente ||
        clienteId
      }`,

    chaveCompra,
    clienteId,
    codigoProjeto,
    tipoProduto,

    nomeCliente:
      nomeCliente ||
      existente?.nomeCliente ||
      "",

    email:
      email ||
      existente?.email ||
      "",

    /*
      Campo oficial.
      Não grava mais em whatsApp.
    */
    whatsapp:
      whatsapp ||
      "",

    cpfCnpj:
      cpfCnpj ||
      "",

    checkoutId:
      checkoutId ||
      existente?.checkoutId ||
      "",

    tokenDeEntrega:
      tokenDeEntrega ||
      existente?.tokenDeEntrega ||
      "",

    idPagamento:
      idPagamento ||
      existente?.idPagamento ||
      "",

    pagamento:
      safe(input.pagamento) ||
      existente?.pagamento ||
      "approved",

    statusCompra:
      safe(input.statusCompra) ||
      existente?.statusCompra ||
      "approved",

    valor:
      valorRecebido !== null
        ? valorRecebido
        : Number(
            existente?.valor ||
            0
          ),

    dataCompra:
      dataCompraRecebida ||
      existente?.dataCompra ||
      agora,

    dataLiberacao:
      existente?.dataLiberacao ||
      agora,

    downloadMedidas,
    downloadGraficos,
    downloadProjeto,

    arquivoProjeto:
      arquivoProjeto ||
      existente?.arquivoProjeto ||
      "",

    statusProcessamento:
      "PROCESSANDO",

    dataProcessamento:
      agora
  };

  /*
    Remove o campo antigo do objeto antes
    de atualizar a coleção.
  */
  delete registro.whatsApp;

  const clienteReferencia =
    safe(
      firstValue(
        input.cliente,
        input.clienteItemId
      )
    );

  if (clienteReferencia) {
    registro.cliente =
      clienteReferencia;
  }

  let salvo;

  if (existente) {
    salvo =
      await wixData.update(
        COLLECTION,
        registro,
        DB_OPTS
      );
  } else {
    salvo =
      await wixData.insert(
        COLLECTION,
        registro,
        DB_OPTS
      );
  }

  const imagensRecebidas =
    imageSourcesFromInput(
      input
    );

  const imagensSalvas = [];
  const falhas = [];

  for (
    const image of
    imagensRecebidas
  ) {
    try {
      const imported =
        await importImageToWix({
          clienteId,
          codigoProjeto,
          field:
            image.field,
          sourceUrl:
            image.url
        });

      salvo[image.field] =
        imported.fileUrl;

      imagensSalvas.push(
        imported
      );
    } catch (error) {
      const falha = {
        field:
          image.field,

        error:
          safe(
            error?.message ||
            error
          )
      };

      falhas.push(
        falha
      );

      console.error(
        "FLUXO 034: falha ao importar imagem",
        {
          clienteId,
          codigoProjeto,
          ...falha
        }
      );
    }
  }

  salvo.statusProcessamento =
    falhas.length
      ? "PARCIAL"
      : "PROCESSADO";

  salvo.dataProcessamento =
    new Date();

  delete salvo.whatsApp;

  salvo =
    await wixData.update(
      COLLECTION,
      salvo,
      DB_OPTS
    );

  return {
    ok:
      falhas.length === 0,

    parcial:
      falhas.length > 0,

    criado:
      !existente,

    atualizado:
      Boolean(existente),

    colecao:
      COLLECTION,

    compraId:
      safe(salvo?._id),

    chaveCompra,
    clienteId,
    codigoProjeto,
    tipoProduto,
    whatsapp,
    cpfCnpj,

    arquivoProjeto:
      safe(
        salvo?.arquivoProjeto
      ),

    imagensRecebidas:
      imagensRecebidas.length,

    imagensSalvas:
      imagensSalvas.length,

    imagens:
      imagensSalvas,

    falhas
  };
}