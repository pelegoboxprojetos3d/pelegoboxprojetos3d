import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import {
  buscarMetodoPagamentoPrivadoPorEmail,
  buscarMetodoPagamentoPrivadoPorMembroId,
  metodoPagamentoPublico
} from "backend/metodosPagamentoProjetosProntos";

const SESSIONS_COLLECTION = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };
const PROVA_MAX_AGE_MS = 10 * 60 * 1000;

const safe = value => String(value ?? "").trim();
const limparEmail = value => safe(value).toLowerCase();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function emailDoMembro(membro) {
  const emails = Array.isArray(membro?.contactDetails?.emails)
    ? membro.contactDetails.emails
    : [];
  return limparEmail(
    membro?.loginEmail ||
    emails[0] ||
    membro?.contactDetails?.email
  );
}

function dataMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function membroAtualComRetry() {
  let ultimo = null;

  for (let tentativa = 1; tentativa <= 6; tentativa += 1) {
    try {
      const membro = await currentMemberBackend.getMember();
      if (membro) ultimo = membro;

      const memberId = safe(membro?._id);
      const email = emailDoMembro(membro);
      if (memberId) return { membro, memberId, email };
    } catch (_) {}

    if (tentativa < 6) await wait(180);
  }

  return {
    membro: ultimo,
    memberId: safe(ultimo?._id),
    email: emailDoMembro(ultimo)
  };
}

async function identidadePorProvaCheckout(checkoutId) {
  const id = safe(checkoutId);
  if (!id) return null;

  try {
    const result = await wixData
      .query(SESSIONS_COLLECTION)
      .eq("checkoutId", id)
      .eq("authMemberVerified", true)
      .descending("_updatedDate")
      .limit(1)
      .find({ ...DB, consistentRead: true });

    const sessao = result.items?.[0] || null;
    if (!sessao) return null;

    const verifiedAt = dataMs(sessao.authVerifiedAt || sessao.updatedAtDate || sessao._updatedDate);
    const idade = Date.now() - verifiedAt;
    if (!(verifiedAt > 0 && idade >= 0 && idade <= PROVA_MAX_AGE_MS)) return null;

    const memberId = safe(sessao.memberId || sessao.cardAuthMemberId);
    const email = limparEmail(sessao.email || sessao.cardAuthEmail);
    if (!memberId && !email) return null;

    return { memberId, email };
  } catch (_) {
    return null;
  }
}

async function localizarMetodo(memberId, email) {
  let item = null;

  if (memberId) {
    item = await buscarMetodoPagamentoPrivadoPorMembroId(memberId);
  }

  if (!item && email) {
    item = await buscarMetodoPagamentoPrivadoPorEmail(email);
  }

  return item;
}

export const buscarMetodoPagamentoDoMembroAtual = webMethod(
  Permissions.SiteMember,
  async (input = {}) => {
    // CARTAO_SALVO_PROVA_CHECKOUT_V4
    // 1) tenta a identidade direta do membro Wix;
    // 2) se o Members backend perder o contexto por alguns instantes,
    //    reutiliza a prova recente gravada no MESMO checkout por
    //    buscarClienteDoMembroAtual(), que também exige SiteMember.
    const identidadeDireta = await membroAtualComRetry();
    let memberId = safe(identidadeDireta?.memberId);
    let email = limparEmail(identidadeDireta?.email);

    let item = await localizarMetodo(memberId, email);

    if (!item) {
      const prova = await identidadePorProvaCheckout(input?.checkoutId);
      if (prova) {
        memberId = safe(prova.memberId) || memberId;
        email = limparEmail(prova.email) || email;
        item = await localizarMetodo(memberId, email);
      }
    }

    return {
      memberId,
      email,
      metodo: metodoPagamentoPublico(item)
    };
  }
);
