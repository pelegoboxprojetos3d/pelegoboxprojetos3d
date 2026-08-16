import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import {
  buscarMetodoPagamentoPrivadoPorEmail,
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
      if (memberId && email) return { membro, memberId, email };
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
    // CARTAO_SALVO_BACKEND_RETRY_V2
    const identidade = await membroAtualComRetry();
    const memberId = safe(identidade?.memberId);
    const email = limparEmail(identidade?.email);

    if (!memberId || !email) {
      return { memberId, email, metodo: null };
    }

    const item = await buscarMetodoPagamentoPrivadoPorEmail(email);
    return {
      memberId,
      email,
      metodo: metodoPagamentoPublico(item)
    };
  }
);
