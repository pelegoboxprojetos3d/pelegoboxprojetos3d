import wixData from "wix-data";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };

const safe = value => String(value ?? "").trim();
const email = value => safe(value).toLowerCase();

async function identidadeDoMembro() {
  const membro = await currentMemberBackend.getMember();
  const emails = Array.isArray(membro?.contactDetails?.emails)
    ? membro.contactDetails.emails
    : [];

  return {
    memberId: safe(membro?._id),
    email: email(
      membro?.loginEmail ||
      emails[0] ||
      membro?.contactDetails?.email
    )
  };
}

async function gravarAutorizacao(checkoutId, identidade) {
  const resultado = await wixData
    .query(SESSIONS)
    .eq("checkoutId", checkoutId)
    .limit(1)
    .find({ ...DB, consistentRead: true });

  const now = new Date();

  if (resultado.items.length) {
    const sessao = {
      ...resultado.items[0],
      memberId: identidade.memberId,
      email: identidade.email,
      updatedAtDate: now
    };

    delete sessao.whatsApp;
    delete sessao.whatsappE164;

    await wixData.update(SESSIONS, sessao, DB);
    return;
  }

  await wixData.insert(
    SESSIONS,
    {
      checkoutId,
      memberId: identidade.memberId,
      email: identidade.email,
      status: "pending_auth",
      updatedAtDate: now
    },
    DB
  );
}

export const autorizarPagamentoCartao = webMethod(
  Permissions.SiteMember,
  async (input = {}) => {
    try {
      const checkoutId = safe(input.checkoutId);
      if (!checkoutId) {
        return { ok: false, error: "Checkout inválido. Atualize a página e tente novamente." };
      }

      const identidade = await identidadeDoMembro();
      if (!identidade.memberId || !identidade.email) {
        return { ok: false, error: "Faça login novamente para pagar com cartão." };
      }

      await gravarAutorizacao(checkoutId, identidade);

      return {
        ok: true,
        memberId: identidade.memberId,
        email: identidade.email
      };
    } catch (error) {
      console.error("AUTORIZACAO CARTAO:", error?.message || error);
      return {
        ok: false,
        error: "Não foi possível confirmar sua conta Wix para o pagamento."
      };
    }
  }
);
