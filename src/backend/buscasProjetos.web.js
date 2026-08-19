import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";

const COLLECTION = "BuscasProjetosProntos";
const DB_OPTS = { suppressAuth: true };
const MAX_ROWS = 1000;

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

export const registrarBuscaProjeto = webMethod(
  Permissions.Anyone,
  async (termoOriginal, termoNormalizado = "", pagina = "") => {
    const original = safe(termoOriginal).slice(0, 180);
    const normalizado = normalizeTerm(termoNormalizado || termoOriginal);

    if (!original || !normalizado) {
      return { ok: false };
    }

    const member = await memberInfo();

    await wixData.insert(
      COLLECTION,
      {
        termoOriginal: original,
        termoNormalizado: normalizado,
        dia: todayKey(),
        pagina: safe(pagina).slice(0, 120),
        membroId: member.membroId,
        email: member.email
      },
      DB_OPTS
    );

    return { ok: true };
  }
);

export const maisBuscadosHoje = webMethod(
  Permissions.Anyone,
  async (limit = 15) => {
    const wanted = Math.max(1, Math.min(15, Number(limit) || 15));

    const result = await wixData
      .query(COLLECTION)
      .eq("dia", todayKey())
      .descending("_createdDate")
      .limit(MAX_ROWS)
      .find(DB_OPTS);

    const grouped = new Map();

    for (const item of result.items || []) {
      const key = normalizeTerm(item?.termoNormalizado || item?.termoOriginal);
      if (!key) continue;

      const current = grouped.get(key) || {
        termo: safe(item?.termoOriginal) || key,
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
