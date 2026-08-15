import wixData from "wix-data";
import { getSecret } from "wix-secrets-backend";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import { tokenize } from "@validapay/tokenize";
import { salvarMetodoPagamentoAprovado, metodoPagamentoPublico } from "backend/metodosPagamentoProjetosProntos";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };
const safe = value => String(value ?? "").trim();
const digits = value => safe(value).replace(/\D/g, "");
const mail = value => safe(value).toLowerCase();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function emailDoMembro(membro) {
  const emails = Array.isArray(membro?.contactDetails?.emails) ? membro.contactDetails.emails : [];
  return mail(membro?.loginEmail || emails[0] || membro?.contactDetails?.email);
}

async function sessaoPorCheckout(checkoutId) {
  const result = await wixData
    .query(SESSIONS)
    .eq("checkoutId", safe(checkoutId))
    .limit(1)
    .find({ ...DB, consistentRead: true });
  return result.items?.[0] || null;
}

function erroSeguro(error) {
  return safe(error?.code || error?.name || error?.message || "TOKENIZATION_FAILED").slice(0, 160);
}

async function tokenizarComRetry(payload) {
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    try {
      return await tokenize(payload);
    } catch (error) {
      ultimoErro = error;
      const code = safe(error?.code).toUpperCase();
      if (tentativa < 2 && (code === "ACCOUNT_NOT_FOUND" || code === "FORBIDDEN")) {
        await wait(550);
        continue;
      }
      throw error;
    }
  }
  throw ultimoErro || new Error("TOKENIZATION_FAILED");
}

// CARTAO_TOKEN_ISOLADO_WEBMETHOD_V1
export const salvarCartaoAprovadoDoMembroAtual = webMethod(
  Permissions.SiteMember,
  async ({ checkoutId, chargeId, card = {}, cardDocument } = {}) => {
    const id = safe(checkoutId);
    const paymentId = safe(chargeId);
    if (!id || !paymentId) return { ok:false, saved:false, reason:"checkout_ou_pagamento_ausente" };

    const membro = await currentMemberBackend.getMember();
    const memberId = safe(membro?._id);
    const email = emailDoMembro(membro);
    if (!memberId || !email) return { ok:false, saved:false, reason:"membro_nao_autenticado" };

    const session = await sessaoPorCheckout(id);
    if (!session) return { ok:false, saved:false, reason:"sessao_nao_encontrada" };

    const sessionEmail = mail(session.email);
    const sessionMemberId = safe(session.memberId || session.cardAuthMemberId);
    const sessionPaymentId = safe(session.validaPayChargeId || session.paymentId);
    const status = safe(session.status).toLowerCase();
    const method = safe(session.paymentMethod).toUpperCase();

    if (sessionEmail !== email || (sessionMemberId && sessionMemberId !== memberId)) {
      return { ok:false, saved:false, reason:"conta_wix_divergente" };
    }
    if (sessionPaymentId !== paymentId || status !== "approved" || method !== "CARD") {
      return { ok:false, saved:false, reason:"pagamento_ainda_nao_aprovado" };
    }

    const number = digits(card.number);
    const cvv = digits(card.cvv);
    const month = digits(card.month).padStart(2, "0").slice(-2);
    let year = digits(card.year);
    if (year.length === 2) year = "20" + year;
    const holder = safe(card.name).replace(/\s+/g, " ").toUpperCase();
    const document = digits(cardDocument || session.pendingCardDocument || session.cpfCnpj);

    if (number.length < 13 || number.length > 19 || !/^\d{3,4}$/.test(cvv)) {
      return { ok:false, saved:false, reason:"dados_cartao_transitorios_ausentes" };
    }
    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\d{2}$/.test(year) || holder.length < 3 || document.length !== 11) {
      return { ok:false, saved:false, reason:"dados_cartao_invalidos" };
    }

    try {
      const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));
      const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));
      if (!clientId || !clientSecret) return { ok:false, saved:false, reason:"credenciais_ausentes" };

      const result = await tokenizarComRetry({
        clientId,
        clientSecret,
        card: {
          number,
          cardHolderName: holder,
          cvv,
          expiration: month + "/" + year
        },
        customer: {
          name: safe(session.nomeCliente || holder),
          document,
          email
        }
      });

      const paymentMethodId = safe(result?.paymentMethodId);
      if (!paymentMethodId) return { ok:false, saved:false, reason:"payment_method_id_ausente" };

      const metadata = {
        email,
        memberId,
        clienteId: safe(session.clienteId),
        paymentMethodId,
        validaPayCustomerId: safe(result?.customerId || session.pendingValidaPayCustomerId),
        cardBrand: safe(result?.cardBrand || session.pendingCardBrand).toUpperCase(),
        cardLastFour: digits(result?.cardLastFour || session.pendingCardLastFour || number.slice(-4)).slice(-4),
        cardExpirationMonth: digits(result?.cardExpirationMonth || month).padStart(2, "0").slice(-2),
        cardExpirationYear: digits(result?.cardExpirationYear || year).slice(-4),
        cardHolderName: safe(result?.cardHolderName || holder).replace(/\s+/g, " ").toUpperCase(),
        cardDocument: document,
        ultimoPagamentoId: paymentId
      };

      const salvo = await salvarMetodoPagamentoAprovado(metadata);

      await wixData.update(SESSIONS, {
        ...session,
        pendingPaymentMethodId: paymentMethodId,
        pendingValidaPayCustomerId: metadata.validaPayCustomerId,
        pendingCardBrand: metadata.cardBrand,
        pendingCardLastFour: metadata.cardLastFour,
        pendingCardExpirationMonth: metadata.cardExpirationMonth,
        pendingCardExpirationYear: metadata.cardExpirationYear,
        pendingCardHolderName: metadata.cardHolderName,
        pendingCardDocument: metadata.cardDocument,
        updatedAtDate: new Date()
      }, DB);

      return {
        ok: true,
        saved: true,
        metodo: metodoPagamentoPublico(salvo)
      };
    } catch (error) {
      console.warn("Tokenizacao isolada do cartao falhou:", erroSeguro(error));
      return { ok:false, saved:false, reason:erroSeguro(error) };
    }
  }
);
