const fs = require('fs');

const PAGE = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const CORE = 'src/backend/validaPayCartaoProjetosProntos.jsw';
const WEB = 'src/backend/salvarCartaoValidaPay.web.js';
const HTML = 'src/public/custom-elements/pelego-checkout-pronto.js';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text, 'utf8'); }
function replaceRequired(text, from, to, label) {
  if (text.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return text;
  }
  if (!text.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  console.log(`${label}: aplicado.`);
  return text.replace(from, to);
}
function replaceRegexRequired(text, regex, to, label) {
  if (!regex.test(text)) throw new Error(`${label}: padrão não encontrado.`);
  regex.lastIndex = 0;
  console.log(`${label}: aplicado.`);
  return text.replace(regex, to);
}

let page = read(PAGE);
let core = read(CORE);
const html = read(HTML);

// 1) O motor que cobra cartão volta a não conhecer o SDK de tokenização.
//    A tokenização fica em um webMethod separado, chamado somente depois do pagamento aprovado.
if (core.includes('// CARTAO_SALVO_POS_COBRANCA_ISOLADO_V1')) {
  core = replaceRegexRequired(
    core,
    /\/\/ CARTAO_SALVO_POS_COBRANCA_ISOLADO_V1[\s\S]*?(?=async function identidadeMembroAtualCartao)/,
    '',
    'remover tokenização do motor de cobrança'
  );
}

if (core.includes('// CARTAO_SALVO_NAO_BLOQUEIA_VENDA_V1')) {
  core = replaceRegexRequired(
    core,
    /\n\s*\/\/ CARTAO_SALVO_NAO_BLOQUEIA_VENDA_V1[\s\S]*?\n\s*return \{/,
    '\n\n    return {',
    'remover chamada de tokenização do retorno da cobrança'
  );
}

core = core.replace(
  /,\n\s*cartaoSalvo:\s*\{\s*ok:\s*cartaoSalvo\?\.ok === true,\s*saved:\s*cartaoSalvo\?\.saved === true,\s*tokenReady:\s*cartaoSalvo\?\.tokenReady === true,\s*reason:\s*safe\(cartaoSalvo\?\.reason\)\s*\}/m,
  ''
);

// 2) Novo módulo isolado. Mesmo que o SDK falhe, esta função falha sozinha e a cobrança já terminou.
const webModule = `import wixData from "wix-data";
import { getSecret } from "wix-secrets-backend";
import { currentMember as currentMemberBackend } from "wix-members-backend";
import { webMethod, Permissions } from "wix-web-module";
import { tokenize } from "@validapay/tokenize";
import { salvarMetodoPagamentoAprovado, metodoPagamentoPublico } from "backend/metodosPagamentoProjetosProntos";

const SESSIONS = "SessoesProjetosProntos2";
const DB = { suppressAuth: true };
const safe = value => String(value ?? "").trim();
const digits = value => safe(value).replace(/\\D/g, "");
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
    if (year.length === 2) year = `20${year}`;
    const holder = safe(card.name).replace(/\\s+/g, " ").toUpperCase();
    const document = digits(cardDocument || session.pendingCardDocument || session.cpfCnpj);

    if (number.length < 13 || number.length > 19 || !/^\\d{3,4}$/.test(cvv)) {
      return { ok:false, saved:false, reason:"dados_cartao_transitorios_ausentes" };
    }
    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year) || holder.length < 3 || document.length !== 11) {
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
          expiration: `${month}/${year}`
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
        cardHolderName: safe(result?.cardHolderName || holder).replace(/\\s+/g, " ").toUpperCase(),
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
`;
write(WEB, webModule);
console.log('webMethod isolado: escrito.');

// 3) Página: chama o webMethod somente após aprovação e mantém dados brutos só em memória RAM.
page = replaceRequired(
  page,
  'import { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\n',
  'import { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\nimport { salvarCartaoAprovadoDoMembroAtual } from "backend/salvarCartaoValidaPay.web";\n',
  'import do salvamento isolado'
);

page = replaceRequired(
  page,
  'let savedCardPayload = null;\n',
  'let savedCardPayload = null;\nlet cartaoPendenteParaTokenizar = null; // somente memória, nunca storage\nlet salvamentoCartaoEmAndamento = false;\n',
  'estado transitório do cartão'
);

if (!page.includes('async function salvarCartaoAprovadoSemBloquearVenda')) {
  const anchor = 'async function carregarMetodoPagamentoSalvo() {';
  if (!page.includes(anchor)) throw new Error('âncora carregarMetodoPagamentoSalvo não encontrada');
  const helper = `function memorizarCartaoSomenteNestaPagina(data = {}) {\n  if (data.useSavedPaymentMethod === true) {\n    cartaoPendenteParaTokenizar = null;\n    return;\n  }\n  const card = data.card || {};\n  cartaoPendenteParaTokenizar = {\n    card: {\n      number: digits(card.number),\n      cvv: digits(card.cvv),\n      month: digits(card.month),\n      year: digits(card.year),\n      name: safe(card.name)\n    },\n    cardDocument: digits(data.cardDocument || ctx.cpfCnpj)\n  };\n}\n\nasync function salvarCartaoAprovadoSemBloquearVenda(paymentId) {\n  if (salvamentoCartaoEmAndamento || !cartaoPendenteParaTokenizar) return;\n  const charge = safe(paymentId);\n  if (!checkoutId || !charge) return;\n  salvamentoCartaoEmAndamento = true;\n  const payload = cartaoPendenteParaTokenizar;\n  try {\n    const result = await waitTimeout(\n      salvarCartaoAprovadoDoMembroAtual({\n        checkoutId,\n        chargeId: charge,\n        card: payload.card,\n        cardDocument: payload.cardDocument\n      }),\n      7000,\n      \"\"\n    );\n    if (result?.saved === true && result?.metodo) {\n      savedCardPayload = { type:\"SAVED_CARD\", existe:true, ...result.metodo };\n      if (checkoutUiReady) post(savedCardPayload);\n      cartaoPendenteParaTokenizar = null;\n    } else {\n      console.warn(\"Cartão aprovado, mas token reutilizável não foi salvo:\", result?.reason || \"sem motivo\");\n    }\n  } catch (error) {\n    console.warn(\"Salvamento isolado do cartão não bloqueou a venda:\", error?.message || error);\n  } finally {\n    salvamentoCartaoEmAndamento = false;\n  }\n}\n\n`;
  page = page.replace(anchor, helper + anchor);
  console.log('helpers da página: aplicados.');
}

// Recarrega o cartão depois de a identidade Wix terminar de estabilizar.
page = replaceRequired(
  page,
  '  const contextoAutenticadoPromise = carregarContextoClienteAutenticado();\n  contextoAutenticadoPromise.catch(() => {});\n\n  carregarMetodoPagamentoSalvo().catch(console.error);\n',
  '  const contextoAutenticadoPromise = carregarContextoClienteAutenticado();\n  contextoAutenticadoPromise.catch(() => {});\n\n  // CARTAO_SALVO_RELEITURA_POS_AUTH_V1\n  // Tentativa rápida + releitura autoritativa depois que o login Wix estabilizar.\n  carregarMetodoPagamentoSalvo().catch(console.error);\n  contextoAutenticadoPromise\n    .then(() => carregarMetodoPagamentoSalvo())\n    .catch(() => {});\n',
  'releitura do cartão depois da autenticação'
);

// Memoriza o cartão novo antes da cobrança, sem persistir PAN/CVV em browser ou CMS.
page = replaceRequired(
  page,
  '  cardRequestBusy=true;\n  stopCardPoll();\n  post({type:"CARD_LOADING",checkoutId,message:"Processando cartão com segurança..."});\n',
  '  cardRequestBusy=true;\n  stopCardPoll();\n  memorizarCartaoSomenteNestaPagina(data);\n  post({type:"CARD_LOADING",checkoutId,message:"Processando cartão com segurança..."});\n',
  'captura transitória antes da cobrança'
);

// Aprovação imediata: dispara salvamento separado e segue abrindo a entrega normalmente.
page = replaceRequired(
  page,
  '    if(paymentApproved) {\n      post({\n',
  '    if(paymentApproved) {\n      salvarCartaoAprovadoSemBloquearVenda(chargeId).catch(console.error);\n      post({\n',
  'salvar após aprovação imediata'
);

// Aprovação via polling: mesma regra.
page = replaceRequired(
  page,
  '      stopCardPoll();\n      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});\n',
  '      stopCardPoll();\n      salvarCartaoAprovadoSemBloquearVenda(chargeId).catch(console.error);\n      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});\n',
  'salvar após aprovação por polling'
);

// O Custom Element já possui a experiência de cartão salvo. Não alteramos layout.
for (const marker of [
  'function applySavedCardMode(useSaved)',
  'saved.useSavedPaymentMethod=true',
  'if(type==="SAVED_CARD")'
]) {
  if (!html.includes(marker)) throw new Error(`UI de cartão salvo ausente: ${marker}`);
}

for (const [text, marker, label] of [
  [core, 'CARTAO_SALVO_POS_COBRANCA_ISOLADO_V1', 'core sem tokenização'],
  [core, '@validapay/tokenize', 'core sem SDK'],
]) {
  if (text.includes(marker)) throw new Error(`Validação falhou: ${label}`);
}
for (const marker of [
  'CARTAO_TOKEN_ISOLADO_WEBMETHOD_V1',
  'import { tokenize } from "@validapay/tokenize"',
  'salvarMetodoPagamentoAprovado(metadata)'
]) {
  if (!webModule.includes(marker)) throw new Error(`webMethod incompleto: ${marker}`);
}
for (const marker of [
  'CARTAO_SALVO_RELEITURA_POS_AUTH_V1',
  'salvarCartaoAprovadoSemBloquearVenda(chargeId)',
  'memorizarCartaoSomenteNestaPagina(data)'
]) {
  if (!page.includes(marker)) throw new Error(`página incompleta: ${marker}`);
}

write(CORE, core);
write(PAGE, page);
console.log('OK: tokenização totalmente isolada da cobrança e cartão salvo relido após autenticação.');
