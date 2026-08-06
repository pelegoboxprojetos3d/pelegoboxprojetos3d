// backend/processarImagensProjetosProntos.js
// FLUXO DO CATÁLOGO: grava somente em Videosprojetos.

import wixData from "wix-data";
import { mediaManager } from "wix-media-backend";

const COLLECTION = "Videosprojetos";
const DB_OPTS = { suppressAuth: true };
const PAGE_SIZE = 1000;

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

function isHttpUrl(value) {
  const url = safe(value).toLowerCase();

  return (
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}

function decodeBasicHtml(value) {
  return safe(value)
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&amp;quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function slugify(value) {
  return decodeBasicHtml(value)
    .replace(/^#\s*/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/["'`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 180)
    .replace(/-+$/g, "");
}

function normalizeCheckoutCode(value) {
  const raw = safe(value).toUpperCase();
  const match = raw.match(/^PRJ(\d{1,5})$/);

  if (!match) {
    return "";
  }

  return `PRJ${String(Number(match[1])).padStart(5, "0")}`;
}

function checkoutCodeNumber(value) {
  const normalized = normalizeCheckoutCode(value);

  if (!normalized) {
    return null;
  }

  return Number(normalized.slice(3));
}

function formatCheckoutCode(number) {
  return `PRJ${String(number).padStart(5, "0")}`;
}

function newestFirst(items = []) {
  return [...items].sort((a, b) => {
    const dateA = new Date(
      a?._createdDate ||
      a?.["Created Date"] ||
      0
    ).getTime();

    const dateB = new Date(
      b?._createdDate ||
      b?.["Created Date"] ||
      0
    ).getTime();

    return dateB - dateA;
  });
}

async function findProjectRows(ordemVideo) {
  const normalized = onlyDigits(ordemVideo);

  if (!normalized) {
    return [];
  }

  const unique = new Map();
  const numeric = Number(normalized);

  if (Number.isSafeInteger(numeric)) {
    const numericResult = await wixData
      .query(COLLECTION)
      .eq("ordem_video", numeric)
      .limit(1000)
      .find(DB_OPTS);

    for (const item of numericResult.items || []) {
      unique.set(item._id, item);
    }
  }

  const textResult = await wixData
    .query(COLLECTION)
    .eq("ordem_video", normalized)
    .limit(1000)
    .find(DB_OPTS);

  for (const item of textResult.items || []) {
    unique.set(item._id, item);
  }

  return newestFirst(
    Array.from(unique.values())
  );
}

async function getAllUsedCheckoutNumbers() {
  const numbers = new Set();

  let result = await wixData
    .query(COLLECTION)
    .isNotEmpty("codigo_checkout")
    .limit(PAGE_SIZE)
    .find(DB_OPTS);

  while (result) {
    for (const item of result.items || []) {
      const number = checkoutCodeNumber(
        item.codigo_checkout
      );

      if (
        Number.isInteger(number) &&
        number > 0 &&
        number <= 99999
      ) {
        numbers.add(number);
      }
    }

    if (
      typeof result.hasNext === "function" &&
      result.hasNext()
    ) {
      result = await result.next();
    } else {
      result = null;
    }
  }

  return numbers;
}

async function generateNextCheckoutCode() {
  const used = await getAllUsedCheckoutNumbers();

  for (let number = 1; number <= 99999; number += 1) {
    if (!used.has(number)) {
      return formatCheckoutCode(number);
    }
  }

  throw new Error(
    "Não existe codigo_checkout disponível"
  );
}

async function resolveCheckoutCode(
  targetProject,
  projectRows
) {
  const targetCode = normalizeCheckoutCode(
    targetProject?.codigo_checkout
  );

  if (targetCode) {
    return targetCode;
  }

  for (const row of projectRows) {
    const reusable = normalizeCheckoutCode(
      row?.codigo_checkout
    );

    if (reusable) {
      return reusable;
    }
  }

  return generateNextCheckoutCode();
}

function resolveCheckoutSlug(
  targetProject,
  projectRows
) {
  const targetSlug = safe(
    targetProject?.slug_checkout
  );

  if (targetSlug) {
    return targetSlug;
  }

  for (const row of projectRows) {
    const reusable = safe(
      row?.slug_checkout
    );

    if (reusable) {
      return reusable;
    }
  }

  const generated = slugify(
    targetProject?.titulo_video
  );

  if (!generated) {
    throw new Error(
      "Não foi possível gerar slug_checkout"
    );
  }

  return generated;
}

async function patchProject(projectId, patch) {
  const current = await wixData.get(
    COLLECTION,
    projectId,
    DB_OPTS
  );

  if (!current) {
    throw new Error(
      `Projeto ${projectId} não encontrado durante a atualização`
    );
  }

  return wixData.update(
    COLLECTION,
    {
      ...current,
      ...patch
    },
    DB_OPTS
  );
}

function imageSourcesFromInput(input = {}) {
  return [
    {
      field: "imagemMedidas",
      url: safe(
        firstValue(
          input.imagemMedidas,
          input?.imagens?.imagemMedidas,
          input?.imagens?.medidas
        )
      )
    },
    {
      field: "imagemGrafico1",
      url: safe(
        firstValue(
          input.imagemGrafico1,
          input?.imagens?.imagemGrafico1,
          input?.imagens?.grafico1
        )
      )
    },
    {
      field: "imagemGrafico2",
      url: safe(
        firstValue(
          input.imagemGrafico2,
          input?.imagens?.imagemGrafico2,
          input?.imagens?.grafico2
        )
      )
    },
    {
      field: "imagemGrafico3",
      url: safe(
        firstValue(
          input.imagemGrafico3,
          input?.imagens?.imagemGrafico3,
          input?.imagens?.grafico3
        )
      )
    }
  ];
}

async function importImageToWix({
  ordemVideo,
  field,
  sourceUrl
}) {
  if (!isHttpUrl(sourceUrl)) {
    throw new Error(
      `URL inválida em ${field}`
    );
  }

  const imported = await mediaManager.importFile(
    `/projetos-prontos/${ordemVideo}/${field}`,
    sourceUrl,
    {
      mediaOptions: {
        mimeType: "image/webp",
        mediaType: "image"
      },

      metadataOptions: {
        isPrivate: false,
        isVisitorUpload: false,

        context: {
          fluxo: "projetos-prontos-catalogo",
          ordem_video: ordemVideo,
          campo: field
        }
      }
    }
  );

  const fileUrl = safe(imported?.fileUrl);

  if (!fileUrl) {
    throw new Error(
      `O Wix não devolveu fileUrl para ${field}`
    );
  }

  return {
    field,
    fileUrl,
    fileName: safe(
      imported?.originalFileName ||
      imported?.fileName
    )
  };
}

export async function importarImagensProjetoPronto(
  input = {}
) {
  const ordemVideo = onlyDigits(
    firstValue(
      input.ordem_video,
      input.ordemVideo,
      input.codigoProjeto
    )
  );

  if (!ordemVideo) {
    throw new Error(
      "ordem_video não informado"
    );
  }

  const projectRows = await findProjectRows(
    ordemVideo
  );

  if (!projectRows.length) {
    throw new Error(
      `Projeto ${ordemVideo} não encontrado em ${COLLECTION}`
    );
  }

  const targetProject = projectRows[0];

  const codigoCheckout = await resolveCheckoutCode(
    targetProject,
    projectRows
  );

  const slugCheckout = resolveCheckoutSlug(
    targetProject,
    projectRows
  );

  const arquivoProjeto = safe(
    firstValue(
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
      "arquivo_projeto precisa ser uma URL HTTP ou HTTPS"
    );
  }

  const basePatch = {
    codigo_checkout: codigoCheckout,
    slug_checkout: slugCheckout,
    ativo_checkout:
      safe(input.ativo_checkout) ||
      safe(targetProject.ativo_checkout) ||
      "SIM"
  };

  if (arquivoProjeto) {
    basePatch.arquivo_projeto =
      arquivoProjeto;
  }

  await patchProject(
    targetProject._id,
    basePatch
  );

  const receivedImages = imageSourcesFromInput(input)
    .filter((item) => item.url);

  const savedImages = [];
  const failures = [];

  for (const image of receivedImages) {
    try {
      const imported = await importImageToWix({
        ordemVideo,
        field: image.field,
        sourceUrl: image.url
      });

      await patchProject(
        targetProject._id,
        {
          [image.field]: imported.fileUrl
        }
      );

      savedImages.push(imported);
    } catch (error) {
      const failure = {
        field: image.field,
        error: safe(
          error?.message ||
          error
        )
      };

      failures.push(failure);

      console.error(
        "PROJETOS PRONTOS CATÁLOGO: falha ao salvar imagem",
        {
          ordem_video: ordemVideo,
          projectId: targetProject._id,
          ...failure
        }
      );
    }
  }

  const result = {
    ok: failures.length === 0,
    parcial: failures.length > 0,
    colecao: COLLECTION,
    projectId: safe(targetProject._id),
    ordem_video: ordemVideo,
    codigo_checkout: codigoCheckout,
    slug_checkout: slugCheckout,
    ativo_checkout: basePatch.ativo_checkout,
    arquivo_projeto: arquivoProjeto,
    imagens_recebidas: receivedImages.length,
    imagens_salvas: savedImages.length,
    imagens: savedImages,
    falhas: failures
  };

  console.log(
    "PROJETOS PRONTOS CATÁLOGO: concluído",
    result
  );

  return result;
}