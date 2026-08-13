import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import {
  buscarMetodoPagamentoPrivadoPorEmail,
  metodoPagamentoPublico
} from "backend/metodosPagamentoProjetosProntos";

const safe = value => String(value ?? "").trim();
const limparEmail = value => safe(value).toLowerCase();

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

export const buscarMetodoPagamentoDoMembroAtual = webMethod(
  Permissions.SiteMember,
  async () => {
    const membro = await currentMemberBackend.getMember();
    const memberId = safe(membro?._id);
    const email = emailDoMembro(membro);

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
