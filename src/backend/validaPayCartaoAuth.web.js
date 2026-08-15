import wixData from "wix-data";
import { members } from "wix-members.v2";
import { webMethod, Permissions } from "wix-web-module";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };

const safe = value => String(value ?? "").trim();
const email = value => safe(value).toLowerCase();

async function identidadeDoMembro() {
  const resposta = await members.getCurrentMember({ fieldsets: ["FULL"] });
  const membro = resposta?.member || resposta || {};
  const contato = membro?.contact || {};
  const detalhes = membro?.contactDetails || {};
  const emailsContato = Array.isArray(contato?.emails) ? contato.emails : [];
  const emailsDetalhes = Array.isArray(detalhes?.emails) ? detalhes.emails : [];

  return {
    memberId: safe(membro?._id || membro?.id),
    email: email(
      membro?.loginEmail ||
      emailsContato[0] ||
      emailsDetalhes[0] ||
      contato?.email ||
      detalhes?.email
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
      authMemberVerified: true,
      authVerifiedAt: now,
      cardAuthMemberId: identidade.memberId,
      cardAuthEmail: identidade.email,
      cardAuthAt: now,
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
      authMemberVerified: true,
      authVerifiedAt: now,
      cardAuthMemberId: identidade.memberId,
      cardAuthEmail: identidade.email,
      cardAuthAt: now,
      status: "pending_auth",
      updatedAtDate: now
    },
    DB
  );
}

export const autorizarPagamentoCartao = webMethod(
  Permissions.Anyone,
  async (input = {}) => {
    try {
      const checkoutId = safe(input.checkoutId);
      if (!checkoutId) {
        return {
          ok: false,
          error: "Checkout inválido. Atualize a página e tente novamente."
        };
      }

      const identidade = await identidadeDoMembro();
      if (!identidade.memberId || !identidade.email) {
        return {
          ok: false,
          error: "Faça login novamente para pagar com cartão."
        };
      }

      await gravarAutorizacao(checkoutId, identidade);

      return {
        ok: true,
        memberId: identidade.memberId,
        email: identidade.email
      };
    } catch (error) {
      console.error("AUTORIZACAO CARTAO V2:", error?.message || error);
      return {
        ok: false,
        error: "Não foi possível confirmar sua conta Wix para o pagamento."
      };
    }
  }
);
