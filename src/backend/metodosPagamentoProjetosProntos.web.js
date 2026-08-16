import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import {
  buscarMetodoPagamentoPrivadoPorEmail,
  buscarMetodoPagamentoPrivadoPorMembroId,
  metodoPagamentoPublico
} from "backend/metodosPagamentoProjetosProntos";

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

async function membroAtualComRetry() {
  let ultimo = null;

  for (let tentativa = 1; tentativa <= 6; tentativa += 1) {
    try {
      const membro = await currentMemberBackend.getMember();
      if (membro) ultimo = membro;

      const memberId = safe(membro?._id);
      const email = emailDoMembro(membro);

      // CARTAO_SALVO_PRIORIZA_MEMBER_ID_V3
      // O memberId é a chave mais estável do login Wix e já está salvo na coleção.
      // Não dependemos mais do email estar disponível no mesmo instante.
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

export const buscarMetodoPagamentoDoMembroAtual = webMethod(
  Permissions.SiteMember,
  async (_input = {}) => {
    const identidade = await membroAtualComRetry();
    const memberId = safe(identidade?.memberId);
    const email = limparEmail(identidade?.email);

    if (!memberId && !email) {
      return { memberId, email, metodo: null };
    }

    let item = null;

    // Primeiro procura pela identidade imutável do membro Wix.
    if (memberId) {
      item = await buscarMetodoPagamentoPrivadoPorMembroId(memberId);
    }

    // Compatibilidade com registros antigos que possam não ter memberId.
    if (!item && email) {
      item = await buscarMetodoPagamentoPrivadoPorEmail(email);
    }

    return {
      memberId,
      email,
      metodo: metodoPagamentoPublico(item)
    };
  }
);