import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";

const SEARCH_COLLECTION = "BuscasProjetosProntos";
const PROJECTS_COLLECTION = "Videosprojetos";
const DB_OPTS = { suppressAuth: true };
const MAX_SEARCH_ROWS = 1000;
const VOCAB_CACHE_MS = 10 * 60 * 1000;

const STOPWORDS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas",
  "de", "da", "das", "do", "dos", "e", "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "por", "com", "sem", "quero", "queria", "preciso",
  "procuro", "procurando", "gostaria", "me", "meu", "minha", "meus", "minhas",
  "eu", "que", "qual", "tipo", "tem", "ter", "caixa", "projeto", "projetos"
]);

let vocabCache = null;
let vocabCacheAt = 0;

function safe(value) {
  return String(value ?? "").trim();
}

function normalizeTerm(value) {
  return safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function memberInfo() {
  try {
    const member = await currentMemberBackend.getMember();
    const emails = Array.isArray(member?.contactDetails?.emails)
      ? member.contactDetails.emails
      : [];

    return {
      membroId: safe(member?._id),
      email: safe(
        member?.loginEmail ||
        emails[0] ||
        member?.contactDetails?.email
      ).toLowerCase()
    };
  } catch (_) {
    return { membroId: "", email: "" };
  }
}

function tokenize(value) {
  return normalizeTerm(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function maxDistanceFor(token) {
  const length = token.length;
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

async function loadProjectRows() {
  let result = await wixData
    .query(PROJECTS_COLLECTION)
    .limit(1000)
    .find(DB_OPTS);

  const items = [...(result.items || [])];

  while (result.hasNext() && items.length < 5000) {
    result = await result.next();
    items.push(...(result.items || []));
  }

  return items;
}

async function projectVocabulary() {
  const now = Date.now();
  if (vocabCache && now - vocabCacheAt < VOCAB_CACHE_MS) {
    return vocabCache;
  }

  const items = await loadProjectRows();
  const map = new Map();

  function add(value, priority = 1) {
    const display = safe(value);
    const normalized = normalizeTerm(display);
    if (!normalized || normalized.includes(" ")) return;
    if (normalized.length < 2 || STOPWORDS.has(normalized)) return;

    const existing = map.get(normalized);
    if (!existing || priority > existing.priority) {
      map.set(normalized, { normalized, display, priority });
    }
  }

  for (const item of items) {
    [item?.marca_1, item?.marca_2, item?.marca_3]
      .filter(Boolean)
      .forEach((brand) => {
        safe(brand)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((word) => add(word, 5));
      });

    safe(item?.titulo_video)
      .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9#]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => add(word, 2));
  }

  vocabCache = [...map.values()];
  vocabCacheAt = now;
  return vocabCache;
}

function bestVocabularyMatch(token, vocabulary) {
  const exact = vocabulary.find((entry) => entry.normalized === token);
  if (exact) return { ...exact, distance: 0, score: 1 };

  const baseAllowed = maxDistanceFor(token);
  if (!baseAllowed) return null;

  let best = null;

  for (const entry of vocabulary) {
    const candidate = entry.normalized;

    // Marcas têm prioridade 5 e recebem uma margem extra. É proposital:
    // clientes digitam Pioneer/Pioner/Paioner, Selenium/Selenio etc. com frequência.
    const brandLike = entry.priority >= 5;
    const allowed = brandLike
      ? Math.min(4, baseAllowed + 1)
      : baseAllowed;

    if (Math.abs(candidate.length - token.length) > allowed) continue;

    const distance = levenshtein(token, candidate);
    if (distance > allowed) continue;

    const score = 1 - distance / Math.max(token.length, candidate.length);
    const minScore = brandLike ? 0.55 : 0.66;
    if (score < minScore) continue;

    if (
      !best ||
      score > best.score ||
      (score === best.score && entry.priority > best.priority)
    ) {
      best = { ...entry, distance, score };
    }
  }

  return best;
}

async function resolveSearchInternal(value) {
  const original = safe(value).slice(0, 180);
  const tokens = tokenize(original).slice(0, 8);

  if (!tokens.length) {
    return {
      original,
      resolved: normalizeTerm(original),
      corrections: []
    };
  }

  const vocabulary = await projectVocabulary();
  const corrections = [];
  const resolvedTokens = [];

  for (const token of tokens) {
    const match = bestVocabularyMatch(token, vocabulary);

    if (match) {
      resolvedTokens.push(match.normalized);
      if (match.normalized !== token) {
        corrections.push({ from: token, to: match.normalized, score: match.score });
      }
      continue;
    }

    // Números e códigos são úteis mesmo quando não aparecem no vocabulário carregado.
    if (/\d/.test(token)) {
      resolvedTokens.push(token);
    }
  }

  const unique = [...new Set(resolvedTokens)].slice(0, 6);

  return {
    original,
    resolved: unique.length ? unique.join(" ") : normalizeTerm(original),
    corrections
  };
}

async function insertSearch(original, normalized, page) {
  const member = await memberInfo();

  await wixData.insert(
    SEARCH_COLLECTION,
    {
      termoOriginal: safe(original).slice(0, 180),
      termoNormalizado: normalizeTerm(normalized || original),
      dia: todayKey(),
      pagina: safe(page).slice(0, 120),
      membroId: member.membroId,
      email: member.email
    },
    DB_OPTS
  );
}

export const prepararBuscaProjeto = webMethod(
  Permissions.Anyone,
  async (termoOriginal, pagina = "") => {
    const resolved = await resolveSearchInternal(termoOriginal);

    if (!resolved.original || !resolved.resolved) {
      return { ok: false, termoResolvido: "", correcoes: [] };
    }

    await insertSearch(resolved.original, resolved.resolved, pagina);

    return {
      ok: true,
      termoResolvido: resolved.resolved,
      termoOriginal: resolved.original,
      correcoes: resolved.corrections
    };
  }
);

export const registrarBuscaProjeto = webMethod(
  Permissions.Anyone,
  async (termoOriginal, termoNormalizado = "", pagina = "") => {
    const original = safe(termoOriginal).slice(0, 180);
    const normalizado = normalizeTerm(termoNormalizado || termoOriginal);

    if (!original || !normalizado) {
      return { ok: false };
    }

    await insertSearch(original, normalizado, pagina);
    return { ok: true };
  }
);

export const resolverBuscaProjeto = webMethod(
  Permissions.Anyone,
  async (termoOriginal) => {
    const resolved = await resolveSearchInternal(termoOriginal);
    return {
      termoResolvido: resolved.resolved,
      termoOriginal: resolved.original,
      correcoes: resolved.corrections
    };
  }
);

export const maisBuscadosHoje = webMethod(
  Permissions.Anyone,
  async (limit = 15) => {
    const wanted = Math.max(1, Math.min(15, Number(limit) || 15));

    const result = await wixData
      .query(SEARCH_COLLECTION)
      .eq("dia", todayKey())
      .descending("_createdDate")
      .limit(MAX_SEARCH_ROWS)
      .find(DB_OPTS);

    const grouped = new Map();

    for (const item of result.items || []) {
      const key = normalizeTerm(item?.termoNormalizado || item?.termoOriginal);
      if (!key) continue;

      const current = grouped.get(key) || {
        termo: key,
        normalizado: key,
        quantidade: 0,
        ultimaBusca: item?._createdDate || null
      };

      current.quantidade += 1;
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .sort((a, b) => {
        const countDiff = b.quantidade - a.quantidade;
        if (countDiff) return countDiff;
        return new Date(b.ultimaBusca || 0).getTime() - new Date(a.ultimaBusca || 0).getTime();
      })
      .slice(0, wanted);
  }
);
