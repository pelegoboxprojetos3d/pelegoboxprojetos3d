import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";

import {
  webMethod,
  Permissions
} from "wix-web-module";

const PROJECTS_COLLECTION = "Videosprojetos";
const HISTORY_COLLECTION = "BuscadorProjetosHistorico";

const DB_OPTS = {
  suppressAuth: true
};

const SEARCH_FIELDS = [
  "titulo_video",
  "title",
  "marca_1",
  "marca_2",
  "marca_3"
];

const STOP_WORDS = new Set([
  "a", "as", "o", "os",
  "um", "uma", "uns", "umas",
  "de", "da", "das", "do", "dos",
  "e", "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "por", "com", "sem",
  "eu", "me", "meu", "minha", "meus", "minhas",
  "quero", "queria", "gostaria", "preciso", "procurando",
  "caixa", "caixas", "projeto", "projetos", "som",
  "alto", "falante", "falantes"
]);

const TERM_ALIASES = {
  canhao: ["canhão", "canhao"],
  canhoes: ["canhões", "canhoes"],
  trio: ["trio"],
  bob: ["bob"],
  horn: ["horn"],
  bandpass: ["bandpass", "band pass"]
};

function safe(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value) {
  return safe(value).replace(/\D/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractTerms(searchText) {
  const normalized = normalize(searchText);

  if (!normalized) {
    return [];
  }

  const terms = normalized
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => !STOP_WORDS.has(term))
    .filter((term) => term.length >= 2 || /^\d+$/.test(term));

  const deduped = unique(terms);

  if (deduped.length) {
    return deduped;
  }

  return unique(normalized.split(" "));
}

function variantsFor(term) {
  const normalized = normalize(term);

  return unique([
    normalized,
    ...(TERM_ALIASES[normalized] || [])
  ]);
}

function projectCode(itemData) {
  const direct = onlyDigits(
    itemData?.ordem_video ||
    itemData?.ordemVideo ||
    itemData?.codigoProjeto
  );

  if (direct) {
    return direct;
  }

  const title = safe(
    itemData?.titulo_video ||
    itemData?.title
  );

  const match = title.match(/^\s*#?\s*(\d+)/);

  return match ? match[1] : "";
}

function publicProject(itemData) {
  return {
    _id: safe(itemData?._id),
    codigo: projectCode(itemData),
    titulo_video: safe(itemData?.titulo_video),
    title: safe(itemData?.title),
    thumbnail: itemData?.thumbnail || "",
    link_video: safe(itemData?.link_video),
    ordem_video: itemData?.ordem_video ?? "",
    marca_1: safe(itemData?.marca_1),
    marca_2: safe(itemData?.marca_2),
    marca_3: safe(itemData?.marca_3),
    ativo_checkout: itemData?.ativo_checkout,
    valor_etapa_1: itemData?.valor_etapa_1,
    valor_etapa_2: itemData?.valor_etapa_2,
    valor_etapa_3: itemData?.valor_etapa_3
  };
}

async function queryAcrossFields(value) {
  try {
    let query = wixData
      .query(PROJECTS_COLLECTION)
      .contains(SEARCH_FIELDS[0], value);

    for (const field of SEARCH_FIELDS.slice(1)) {
      query = query.or(
        wixData
          .query(PROJECTS_COLLECTION)
          .contains(field, value)
      );
    }

    const result = await query
      .limit(1000)
      .find(DB_OPTS);

    return result.items || [];
  } catch (error) {
    console.warn(
      `Buscador: falha ao pesquisar por ${value}:`,
      error?.message || error
    );

    return [];
  }
}

async function findProjectsForTerm(term) {
  const variants = variantsFor(term);
  const groups = await Promise.all(
    variants.map(queryAcrossFields)
  );

  const map = new Map();

  for (const group of groups) {
    for (const item of group) {
      const id = safe(item?._id);

      if (id) {
        map.set(id, item);
      }
    }
  }

  return map;
}

function intersection(termMaps) {
  if (!termMaps.length) {
    return new Map();
  }

  const [first, ...rest] = termMaps;
  const result = new Map();

  for (const [id, item] of first.entries()) {
    if (rest.every((map) => map.has(id))) {
      result.set(id, item);
    }
  }

  return result;
}

function union(termMaps) {
  const result = new Map();

  for (const map of termMaps) {
    for (const [id, item] of map.entries()) {
      result.set(id, item);
    }
  }

  return result;
}

function relevanceScore(item, terms) {
  const title = normalize(
    `${safe(item?.titulo_video)} ${safe(item?.title)}`
  );

  const brands = normalize(
    [item?.marca_1, item?.marca_2, item?.marca_3]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;

  for (const term of terms) {
    const variants = variantsFor(term).map(normalize);

    if (variants.some((variant) => title.includes(variant))) {
      score += 10;
    }

    if (variants.some((variant) => brands.includes(variant))) {
      score += 6;
    }
  }

  return score;
}

function memberName(member) {
  return safe(
    member?.profile?.nickname ||
    [
      member?.contactDetails?.firstName,
      member?.contactDetails?.lastName
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function memberEmail(member) {
  const emails = Array.isArray(member?.contactDetails?.emails)
    ? member.contactDetails.emails
    : [];

  const first = emails[0];

  return safe(
    member?.loginEmail ||
    (typeof first === "string" ? first : first?.email) ||
    member?.contactDetails?.email
  ).toLocaleLowerCase("pt-BR");
}

function makeSessionId(inputSessionId) {
  const supplied = safe(inputSessionId);

  if (supplied) {
    return supplied.slice(0, 120);
  }

  return `bpb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function saveHistory({
  member,
  searchText,
  normalizedSearch,
  brandContext,
  sessionId,
  projects
}) {
  const record = {
    busca: searchText,
    buscaNormalizada: normalizedSearch,
    quantidadeResultados: projects.length,
    marcaContexto: safe(brandContext),
    origem: "texto",
    sessionId,
    resultadosCodigos: unique(
      projects.map((item) => projectCode(item))
    ).slice(0, 500),
    memberId: safe(member?._id),
    email: memberEmail(member),
    nome: memberName(member)
  };

  try {
    await wixData.insert(HISTORY_COLLECTION, record);
  } catch (error) {
    console.warn(
      "Buscador: gravação do histórico com identidade do membro falhou; usando gravação administrativa:",
      error?.message || error
    );

    await wixData.insert(
      HISTORY_COLLECTION,
      record,
      DB_OPTS
    );
  }
}

export const buscarProjetosBasico =
  webMethod(
    Permissions.SiteMember,

    async (input = {}) => {
      const member = await currentMemberBackend.getMember();
      const memberId = safe(member?._id);

      if (!memberId) {
        throw new Error("LOGIN_REQUIRED");
      }

      const searchText = safe(
        typeof input === "string"
          ? input
          : input?.busca
      ).slice(0, 500);

      if (searchText.length < 2) {
        return {
          ok: false,
          motivo: "BUSCA_CURTA",
          total: 0,
          ids: [],
          projetos: []
        };
      }

      const normalizedSearch = normalize(searchText);
      const brandContext = safe(input?.marca);
      const terms = unique([
        ...extractTerms(searchText),
        ...extractTerms(brandContext)
      ]).slice(0, 6);

      const sessionId = makeSessionId(input?.sessionId);

      const termMaps = await Promise.all(
        terms.map(findProjectsForTerm)
      );

      let matched = intersection(termMaps);
      let matchMode = "todos_os_termos";

      // Se a frase ficou específica demais, ainda mostramos os candidatos que
      // bateram em pelo menos um termo. Depois a IA vai assumir essa decisão.
      if (!matched.size && termMaps.length > 1) {
        matched = union(termMaps);
        matchMode = "termos_parciais";
      }

      const items = [...matched.values()]
        .sort(
          (a, b) =>
            relevanceScore(b, terms) -
            relevanceScore(a, terms)
        )
        .slice(0, 500);

      await saveHistory({
        member,
        searchText,
        normalizedSearch,
        brandContext,
        sessionId,
        projects: items
      });

      const projects = items.map(publicProject);

      return {
        ok: true,
        busca: searchText,
        buscaNormalizada: normalizedSearch,
        termos: terms,
        modo: matchMode,
        total: projects.length,
        ids: projects.map((item) => item._id),
        projetos: projects,
        sessionId,
        membro: {
          id: memberId,
          nome: memberName(member)
        }
      };
    }
  );
