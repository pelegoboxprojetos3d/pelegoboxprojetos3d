import wixData from "wix-data";

import {
  webMethod,
  Permissions
} from "wix-web-module";

const COLLECTION =
  "Videosprojetos";

const DB_OPTS = {
  suppressAuth: true
};

const PAGE_SIZE = 1000;
const MAX_ITEMS = 5000;
const CACHE_TTL_MS =
  5 * 60 * 1000;

const RESULT_LIMIT_DEFAULT = 24;
const RESULT_LIMIT_MAX = 60;

const SEARCH_FIELDS = [
  "_id",
  "_createdDate",
  "ordem_video",
  "ordemVideo",
  "codigoProjeto",
  "codigo_checkout",
  "codigoCheckout",
  "titulo_video",
  "title",
  "nome",
  "descricao",
  "description",
  "tags",
  "categoria",
  "tipo",
  "modelo",
  "finalidade",
  "observacoes",
  "alto_falante",
  "altoFalante",
  "marca_1",
  "marca_2",
  "marca_3",
  "thumbnail",
  "imagem",
  "image",
  "link_video",
  "valor_medidas",
  "valor_etapa_1",
  "valor_graficos",
  "valor_etapa_2",
  "valor_projeto",
  "valor_etapa_3"
];

const STOP_WORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "pra",
  "pro",
  "que",
  "um",
  "uma"
]);

const WORD_ALIASES = {
  chaixa: "caixa",
  caicha: "caixa",
  caxa: "caixa",
  caisa: "caixa",
  sub: "subwoofer",
  subwofer: "subwoofer",
  subwoofer: "subwoofer",
  autofalante: "altofalante",
  falante: "altofalante",
  auto: "automotivo",
  profissional: "profissional",
  paredao: "paredao",
  pancadao: "pancadao"
};

const CONCEPTS = [
  [
    "grave",
    "graves",
    "grave forte",
    "subgrave",
    "subwoofer",
    "low bass",
    "bass reflex",
    "band pass",
    "spl",
    "pancadao",
    "paredao"
  ],
  [
    "automotivo",
    "carro",
    "carretinha",
    "paredao",
    "trio"
  ],
  [
    "profissional",
    "pa",
    "line array",
    "linearray",
    "array",
    "vertical"
  ],
  [
    "medio",
    "medio grave",
    "mid bass",
    "midbass",
    "cornetada",
    "corneta"
  ],
  [
    "compacta",
    "pequena",
    "mini",
    "portatil"
  ]
];

let cachedProjects = [];
let cacheExpiresAt = 0;
let cachePromise = null;

function safe(value) {
  return String(
    value ?? ""
  ).trim();
}

function onlyDigits(value) {
  return safe(value)
    .replace(/\D/g, "");
}

function normalizeText(value) {
  return safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;quot;|&quot;|&#34;|&#x22;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalWord(word) {
  return (
    WORD_ALIASES[word] ||
    word
  );
}

function searchTokens(value) {
  return normalizeText(value)
    .split(" ")
    .map(canonicalWord)
    .filter((word) => (
      word.length > 1 &&
      !STOP_WORDS.has(word)
    ));
}

function canonicalQuery(value) {
  return searchTokens(value)
    .join(" ");
}

function mediaUrl(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return safe(
      value.src ||
      value.url ||
      value.fileUrl ||
      value.mediaUrl ||
      value.image
    );
  }

  return "";
}

function numberValue(...values) {
  for (const value of values) {
    if (
      value === undefined ||
      value === null ||
      safe(value) === ""
    ) {
      continue;
    }

    const number =
      Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function projectCode(item) {
  const direct = onlyDigits(
    item?.ordem_video ||
    item?.ordemVideo ||
    item?.codigoProjeto
  );

  if (direct) {
    return direct;
  }

  const title =
    safe(item?.titulo_video);

  const match =
    title.match(
      /^\s*#?\s*(\d+)/
    );

  return match
    ? match[1]
    : "";
}

function projectTitle(item) {
  return safe(
    item?.titulo_video ||
    item?.title ||
    item?.nome ||
    (
      projectCode(item)
        ? `Projeto #${projectCode(item)}`
        : "Projeto pronto"
    )
  )
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function itemSearchText(item) {
  const tags = Array.isArray(
    item?.tags
  )
    ? item.tags.join(" ")
    : safe(item?.tags);

  return canonicalQuery([
    projectCode(item),
    projectTitle(item),
    item?.descricao,
    item?.description,
    tags,
    item?.categoria,
    item?.tipo,
    item?.modelo,
    item?.finalidade,
    item?.observacoes,
    item?.alto_falante,
    item?.altoFalante,
    item?.marca_1,
    item?.marca_2,
    item?.marca_3
  ].join(" "));
}

function expandedTerms(
  normalizedQuery
) {
  const expanded = new Set(
    searchTokens(normalizedQuery)
  );

  for (const concept of CONCEPTS) {
    const normalizedConcept =
      concept.map(canonicalQuery);

    const matches =
      normalizedConcept.some(
        (term) => (
          normalizedQuery.includes(term)
        )
      );

    if (!matches) {
      continue;
    }

    for (const term of normalizedConcept) {
      for (
        const token of
        searchTokens(term)
      ) {
        expanded.add(token);
      }
    }
  }

  return [
    ...expanded
  ];
}

function includesWord(
  haystack,
  needle
) {
  if (!needle) {
    return false;
  }

  const exactWord =
    ` ${haystack} `
      .includes(
        ` ${needle} `
      );

  if (needle.length <= 3) {
    return exactWord;
  }

  return (
    exactWord ||
    haystack.includes(needle)
  );
}

function scoreProject(
  item,
  rawQuery
) {
  const normalizedQuery =
    canonicalQuery(rawQuery);

  const code =
    projectCode(item);

  const queryCode =
    onlyDigits(rawQuery);

  const title =
    canonicalQuery(
      projectTitle(item)
    );

  const haystack =
    itemSearchText(item);

  const directTokens =
    searchTokens(rawQuery);

  const expanded =
    expandedTerms(
      normalizedQuery
    );

  let score = 0;
  let directMatches = 0;
  let expandedMatches = 0;

  if (
    queryCode &&
    code === queryCode
  ) {
    score += 2000;
  }

  if (
    normalizedQuery &&
    title === normalizedQuery
  ) {
    score += 900;
  } else if (
    normalizedQuery &&
    title.startsWith(
      normalizedQuery
    )
  ) {
    score += 450;
  } else if (
    normalizedQuery &&
    title.includes(
      normalizedQuery
    )
  ) {
    score += 300;
  }

  for (const token of directTokens) {
    if (
      includesWord(
        title,
        token
      )
    ) {
      score += 80;
      directMatches += 1;
    } else if (
      includesWord(
        haystack,
        token
      )
    ) {
      score += 45;
      directMatches += 1;
    }
  }

  for (const token of expanded) {
    if (
      directTokens.includes(token)
    ) {
      continue;
    }

    if (
      includesWord(
        title,
        token
      )
    ) {
      score += 18;
      expandedMatches += 1;
    } else if (
      includesWord(
        haystack,
        token
      )
    ) {
      score += 8;
      expandedMatches += 1;
    }
  }

  if (
    directTokens.length > 1 &&
    directMatches ===
      directTokens.length
  ) {
    score += 180;
  }

  if (
    directMatches === 0 &&
    expandedMatches === 0 &&
    !(
      queryCode &&
      code === queryCode
    )
  ) {
    return 0;
  }

  return score;
}

async function fetchAllProjects() {
  const projects = [];

  let result =
    await wixData
      .query(COLLECTION)
      .fields(...SEARCH_FIELDS)
      .descending(
        "ordem_video"
      )
      .limit(PAGE_SIZE)
      .find(DB_OPTS);

  projects.push(
    ...(result.items || [])
  );

  while (
    result.hasNext() &&
    projects.length < MAX_ITEMS
  ) {
    result =
      await result.next();

    projects.push(
      ...(result.items || [])
    );
  }

  return projects.slice(
    0,
    MAX_ITEMS
  );
}

async function allProjects() {
  if (
    cachedProjects.length &&
    Date.now() < cacheExpiresAt
  ) {
    return cachedProjects;
  }

  if (cachePromise) {
    return cachePromise;
  }

  cachePromise =
    fetchAllProjects();

  try {
    cachedProjects =
      await cachePromise;

    cacheExpiresAt =
      Date.now() +
      CACHE_TTL_MS;

    return cachedProjects;
  } finally {
    cachePromise = null;
  }
}

function publicProject(
  item,
  score = 0
) {
  const code =
    projectCode(item);

  return {
    _id:
      safe(item?._id),

    codigoProjeto:
      code,

    codigoCheckout:
      safe(
        item?.codigo_checkout ||
        item?.codigoCheckout
      ),

    titulo:
      projectTitle(item),

    marcas: [
      safe(item?.marca_1),
      safe(item?.marca_2),
      safe(item?.marca_3)
    ].filter(Boolean),

    thumbnail:
      mediaUrl(
        item?.thumbnail ||
        item?.imagem ||
        item?.image
      ),

    linkVideo:
      safe(item?.link_video),

    valorMedidas:
      numberValue(
        item?.valor_medidas,
        item?.valor_etapa_1
      ),

    valorGraficos:
      numberValue(
        item?.valor_graficos,
        item?.valor_etapa_2
      ),

    valorProjeto:
      numberValue(
        item?.valor_projeto,
        item?.valor_etapa_3
      ),

    checkoutUrl:
      code
        ? (
          "/checkoutprojetosprontos" +
          `?codigo=${encodeURIComponent(code)}`
        )
        : "",

    score
  };
}

function normalizedLimit(value) {
  const limit =
    Number(value);

  if (!Number.isFinite(limit)) {
    return RESULT_LIMIT_DEFAULT;
  }

  return Math.max(
    1,
    Math.min(
      RESULT_LIMIT_MAX,
      Math.floor(limit)
    )
  );
}

export const buscarProjetosProntos =
  webMethod(
    Permissions.Anyone,

    async (
      termo,
      limite =
        RESULT_LIMIT_DEFAULT
    ) => {
      const rawQuery =
        safe(termo);

      const query =
        canonicalQuery(rawQuery);

      const maxResults =
        normalizedLimit(limite);

      const projects =
        await allProjects();

      if (!query) {
        return {
          ok: true,
          termo: rawQuery,
          normalizado: query,
          fallback: true,
          total: 0,

          resultados:
            projects
              .slice(
                0,
                maxResults
              )
              .map(
                (item) =>
                  publicProject(
                    item,
                    0
                  )
              )
        };
      }

      const scored =
        projects
          .map((item) => ({
            item,
            score:
              scoreProject(
                item,
                rawQuery
              )
          }))
          .filter(
            ({ score }) =>
              score > 0
          )
          .sort(
            (a, b) =>
              b.score -
              a.score
          );

      const fallback =
        scored.length === 0;

      const selected =
        fallback
          ? projects
              .slice(
                0,
                maxResults
              )
              .map((item) => ({
                item,
                score: 0
              }))
          : scored.slice(
              0,
              maxResults
            );

      return {
        ok: true,
        termo: rawQuery,
        normalizado: query,
        fallback,
        total:
          scored.length,

        resultados:
          selected.map(
            ({ item, score }) =>
              publicProject(
                item,
                score
              )
          )
      };
    }
  );
