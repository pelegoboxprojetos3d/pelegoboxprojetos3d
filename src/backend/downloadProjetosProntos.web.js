import {
  Permissions,
  webMethod
} from "wix-web-module";

import {
  mediaManager
} from "wix-media-backend";


// ======================================================
// BACKEND: downloadProjetosProntos.web.js
//
// Responsabilidade:
//
// - Receber a URL original do arquivo.
// - Receber o nome desejado.
// - Gerar um link de download temporário.
// - Forçar o navegador a usar o nome informado.
//
// Funciona com:
//
// - Imagens do Wix.
// - Documentos PDF do Wix.
// - URLs externas públicas.
// ======================================================


const PASTA_DOWNLOADS =
  "/projetos-prontos/downloads";


// ======================================================
// HELPERS
// ======================================================

function safe(valor) {
  return String(
    valor ?? ""
  ).trim();
}


function esperar(ms) {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}


function extensaoDaUrl(
  valor
) {
  const texto =
    safe(valor)
      .split("#")[0]
      .split("?")[0];

  const resultado =
    texto.match(
      /\.([a-z0-9]{2,8})$/i
    );

  return resultado?.[1]
    ? resultado[1].toLowerCase()
    : "";
}


function limparNomeArquivo(
  nomeArquivo,
  urlOriginal
) {
  let nome =
    safe(nomeArquivo)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[<>:"/\\|?*\u0000-\u001F]/g,
        "-"
      )
      .replace(
        /\s+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ""
      );

  if (!nome) {
    nome =
      "arquivo-projeto";
  }

  const extensaoNome =
    extensaoDaUrl(
      nome
    );

  const extensaoOriginal =
    extensaoDaUrl(
      urlOriginal
    );

  if (
    !extensaoNome &&
    extensaoOriginal
  ) {
    nome +=
      `.${extensaoOriginal}`;
  }

  /*
    Evita nomes absurdamente grandes,
    porque aparentemente isso também
    precisa ser defendido por código.
  */

  if (
    nome.length > 180
  ) {
    const extensao =
      extensaoDaUrl(
        nome
      );

    const limiteBase =
      extensao
        ? 175 - extensao.length
        : 180;

    const base =
      extensao
        ? nome.slice(
          0,
          nome.length -
          extensao.length -
          1
        )
        : nome;

    nome =
      base.slice(
        0,
        limiteBase
      );

    if (extensao) {
      nome +=
        `.${extensao}`;
    }
  }

  return nome;
}


function urlWixMedia(
  valor
) {
  return /^wix:(image|document|video|audio):\/\//i.test(
    safe(valor)
  );
}


function validarUrlExterna(
  valor
) {
  const texto =
    safe(valor);

  if (!texto) {
    throw new Error(
      "URL do arquivo não informada."
    );
  }

  let url;

  try {
    url =
      new URL(texto);

  } catch (_) {
    throw new Error(
      "URL externa inválida."
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "Protocolo de arquivo não permitido."
    );
  }

  return url.toString();
}


// ======================================================
// TIPO DO ARQUIVO
// ======================================================

function informacoesArquivo(
  url,
  nomeArquivo
) {
  const extensao =
    extensaoDaUrl(
      nomeArquivo
    ) ||
    extensaoDaUrl(
      url
    );

  const mapa = {
    jpg: {
      mimeType:
        "image/jpeg",

      mediaType:
        "image"
    },

    jpeg: {
      mimeType:
        "image/jpeg",

      mediaType:
        "image"
    },

    png: {
      mimeType:
        "image/png",

      mediaType:
        "image"
    },

    webp: {
      mimeType:
        "image/webp",

      mediaType:
        "image"
    },

    gif: {
      mimeType:
        "image/gif",

      mediaType:
        "image"
    },

    bmp: {
      mimeType:
        "image/bmp",

      mediaType:
        "image"
    },

    tif: {
      mimeType:
        "image/tiff",

      mediaType:
        "image"
    },

    tiff: {
      mimeType:
        "image/tiff",

      mediaType:
        "image"
    },

    pdf: {
      mimeType:
        "application/pdf",

      mediaType:
        "document"
    },

    zip: {
      mimeType:
        "application/zip",

      mediaType:
        "document"
    }
  };

  return (
    mapa[extensao] ||
    null
  );
}


// ======================================================
// IMPORTAR URL EXTERNA PARA O WIX
// ======================================================

async function importarArquivoExterno(
  urlOriginal,
  nomeArquivo
) {
  const url =
    validarUrlExterna(
      urlOriginal
    );

  const info =
    informacoesArquivo(
      url,
      nomeArquivo
    );

  const options = {
    metadataOptions: {
      isPrivate:
        false,

      isVisitorUpload:
        false,

      context: {
        origem:
          "projetos-prontos",

        nomeDownload:
          nomeArquivo
      }
    }
  };

  /*
    Quando a extensão é conhecida,
    informa o MIME e o tipo ao Wix.

    Quando não é conhecida, o Wix
    tenta detectar pelo servidor.
  */

  if (info) {
    options.mediaOptions = {
      mimeType:
        info.mimeType,

      mediaType:
        info.mediaType
    };
  }

  const arquivoImportado =
    await mediaManager
      .importFile(
        PASTA_DOWNLOADS,
        url,
        options
      );

  const fileUrl =
    safe(
      arquivoImportado?.fileUrl
    );

  if (!fileUrl) {
    throw new Error(
      "O Wix não retornou a URL do arquivo importado."
    );
  }

  return fileUrl;
}


// ======================================================
// AGUARDAR O ARQUIVO FICAR PRONTO
// ======================================================

async function aguardarArquivo(
  fileUrl
) {
  /*
    Arquivos que já estavam no Wix
    geralmente estão prontos imediatamente.

    Arquivos externos podem precisar de
    alguns instantes para processamento.
  */

  for (
    let tentativa = 1;
    tentativa <= 12;
    tentativa += 1
  ) {
    try {
      const info =
        await mediaManager
          .getFileInfo(
            fileUrl
          );

      const status =
        safe(
          info?.opStatus
        ).toUpperCase();

      if (
        !status ||
        status === "READY"
      ) {
        return (
          safe(
            info?.fileUrl
          ) ||
          fileUrl
        );
      }

    } catch (_) {
      /*
        O arquivo pode ainda não estar
        disponível na primeira consulta.
      */
    }

    await esperar(
      500
    );
  }

  /*
    Mesmo sem confirmação, ainda tenta
    gerar o link com a URL recebida.
  */

  return fileUrl;
}


// ======================================================
// WEB METHOD
// ======================================================

export const gerarLinkDownloadImagem =
  webMethod(
    Permissions.Anyone,

    async (
      urlOriginal,
      nomeArquivo
    ) => {
      const origem =
        safe(
          urlOriginal
        );

      if (!origem) {
        throw new Error(
          "Arquivo não informado."
        );
      }

      const nomeFinal =
        limparNomeArquivo(
          nomeArquivo,
          origem
        );

      let fileUrl =
        origem;

      /*
        URLs wix:image, wix:document etc.
        já podem ser utilizadas diretamente.

        URLs https externas são primeiro
        importadas para o Media Manager.
      */

      if (
        !urlWixMedia(
          origem
        )
      ) {
        fileUrl =
          await importarArquivoExterno(
            origem,
            nomeFinal
          );
      }

      fileUrl =
        await aguardarArquivo(
          fileUrl
        );

      /*
        O terceiro parâmetro define exatamente
        o nome recebido pelo cliente.
      */

      const link =
        await mediaManager
          .getDownloadUrl(
            fileUrl,

            60,

            nomeFinal,

            null
          );

      if (!safe(link)) {
        throw new Error(
          "O Wix não gerou o link de download."
        );
      }

      return link;
    }
  );