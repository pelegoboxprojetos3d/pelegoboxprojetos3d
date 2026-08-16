const fs = require('fs');

const pagePath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const webPath = 'src/backend/metodosPagamentoProjetosProntos.web.js';

const marker = 'CARTAO_SALVO_LEITURA_RETRY_V2';

let page = fs.readFileSync(pagePath, 'utf8');

const oldFn = `async function carregarMetodoPagamentoSalvo() {
  try {
    const result = await waitTimeout(buscarMetodoPagamentoDoMembroAtual(), 5000, "");
    savedCardPayload = {
      type: "SAVED_CARD",
      existe: result?.metodo?.existe === true,
      ...(result?.metodo || {})
    };
    if (checkoutUiReady) post(savedCardPayload);
  } catch (_) {
    savedCardPayload = { type:"SAVED_CARD", existe:false };
    if (checkoutUiReady) post(savedCardPayload);
  }
}`;

const newFn = `async function carregarMetodoPagamentoSalvo() {
  // ${marker}
  // O login Wix pode aparecer no cabeçalho alguns instantes antes de o webMethod
  // receber o contexto do membro. Fazemos releituras curtas e só declaramos
  // "sem cartão" depois de esgotar as tentativas.
  let ultimo = null;

  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
    try {
      const result = await waitTimeout(
        buscarMetodoPagamentoDoMembroAtual({ checkoutId }),
        2400,
        ""
      );

      if (result && typeof result === "object") ultimo = result;

      if (result?.metodo?.existe === true) {
        savedCardPayload = {
          type: "SAVED_CARD",
          existe: true,
          ...result.metodo
        };
        if (checkoutUiReady) post(savedCardPayload);
        return savedCardPayload;
      }

      // Membro identificado e realmente sem cartão: não há motivo para esperar.
      if (safe(result?.memberId) && email(result?.email)) break;
    } catch (_) {}

    if (tentativa < 5) await waitMs(260);
  }

  savedCardPayload = {
    type: "SAVED_CARD",
    existe: ultimo?.metodo?.existe === true,
    ...(ultimo?.metodo || {})
  };
  if (checkoutUiReady) post(savedCardPayload);
  return savedCardPayload;
}`;

if (!page.includes(marker)) {
  if (!page.includes(oldFn)) {
    throw new Error('Bloco carregarMetodoPagamentoSalvo esperado não encontrado. Abortando sem alterar.');
  }
  page = page.replace(oldFn, newFn);
  fs.writeFileSync(pagePath, page);
}

const web = `import { currentMember as currentMemberBackend } from "wix-members-backend";
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
`;

const atualWeb = fs.readFileSync(webPath, 'utf8');
if (!atualWeb.includes('CARTAO_SALVO_BACKEND_RETRY_V2')) {
  fs.writeFileSync(webPath, web);
}

console.log('OK: leitura do cartão salvo recebeu retry no frontend e backend.');
