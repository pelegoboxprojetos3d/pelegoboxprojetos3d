const fs = require('fs');

const CLIENTES = 'src/backend/clientes.web.js';
const PAGE = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const CARD = 'src/backend/validaPayCartaoProjetosProntos.jsw';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value, 'utf8'); }
function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  return text.replace(from, to);
}

let clientes = read(CLIENTES);
let page = read(PAGE);
let card = read(CARD);

// 1) A leitura autenticada do membro passa a vincular o checkout à conta Wix.
clientes = replaceOnce(
  clientes,
  `export const buscarClienteDoMembroAtual =\n  webMethod(\n    Permissions.SiteMember,\n\n    async () => {`,
  `export const buscarClienteDoMembroAtual =\n  webMethod(\n    Permissions.SiteMember,\n\n    async (input = {}) => {`,
  'assinatura buscarClienteDoMembroAtual'
);

const anchorMemberCheck = `      if (!memberId || !memberEmail) {\n        return {\n          memberId,\n          email: memberEmail,\n          nome: memberName,\n          cliente: null,\n          ambiguo: false\n        };\n      }\n\n      const encontrados = [];`;

const memberCheckReplacement = `      if (!memberId || !memberEmail) {\n        return {\n          memberId,\n          email: memberEmail,\n          nome: memberName,\n          cliente: null,\n          ambiguo: false\n        };\n      }\n\n      // CHECKOUT_MEMBRO_VERIFICADO_V1\n      // Este método exige SiteMember. Quando ele consegue ler a conta, grava\n      // no checkout uma prova curta de que memberId + e-mail vieram do Wix,\n      // permitindo que o cartão continue no mobile mesmo se uma chamada\n      // posterior do currentMemberBackend perder momentaneamente o contexto.\n      const checkoutIdAutenticado = safe(input?.checkoutId);\n      if (checkoutIdAutenticado) {\n        try {\n          const agoraAutenticacao = new Date();\n          const existenteSessao = await wixData\n            .query(SESSIONS_COLLECTION)\n            .eq(\"checkoutId\", checkoutIdAutenticado)\n            .limit(1)\n            .find({ ...DB_OPTS, consistentRead: true });\n\n          if (existenteSessao.items.length) {\n            const sessao = {\n              ...existenteSessao.items[0],\n              checkoutId: checkoutIdAutenticado,\n              memberId,\n              email: memberEmail,\n              authMemberVerified: true,\n              authVerifiedAt: agoraAutenticacao,\n              updatedAtDate: agoraAutenticacao\n            };\n            delete sessao.whatsApp;\n            delete sessao.whatsappE164;\n            await wixData.update(SESSIONS_COLLECTION, sessao, DB_OPTS);\n          } else {\n            await wixData.insert(SESSIONS_COLLECTION, {\n              checkoutId: checkoutIdAutenticado,\n              memberId,\n              email: memberEmail,\n              authMemberVerified: true,\n              authVerifiedAt: agoraAutenticacao,\n              status: \"identified\",\n              updatedAtDate: agoraAutenticacao\n            }, DB_OPTS);\n          }\n        } catch (erroSessao) {\n          console.warn(\n            \"Não foi possível vincular checkout ao membro autenticado:\",\n            erroSessao?.message || erroSessao\n          );\n        }\n      }\n\n      const encontrados = [];`;

clientes = replaceOnce(
  clientes,
  anchorMemberCheck,
  memberCheckReplacement,
  'vinculação checkout/membro'
);

// 2) O checkout sempre passa o checkoutId na consulta que já é SiteMember.
page = replaceOnce(
  page,
  'const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 1800, "");',
  'const perfil = await waitTimeout(buscarClienteDoMembroAtual({ checkoutId }), 1800, "");',
  'retry autenticado com checkoutId'
);

// 3) Não fazemos uma segunda autorização SiteMember no clique do cartão.
// A cobrança já valida a identidade no backend e, em caso de falha transitória
// do Wix no mobile, usa apenas a sessão previamente marcada como verificada.
page = replaceOnce(
  page,
  'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual, autorizarPagamentoCartaoMembro } from "backend/clientes.web";',
  'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";',
  'remover import autorização redundante'
);

const oldAuthBlock = `  try {\n    const auth=await waitTimeout(autorizarPagamentoCartaoMembro({checkoutId}),7000,\"Não foi possível confirmar sua conta Wix.\");\n    if(!auth?.ok){\n      return post({type:\"CARD_RESULT\",ok:false,approved:false,accepted:false,error:safe(auth?.error)||\"Faça login novamente para pagar com cartão.\"});\n    }\n    if(auth?.email){ctx.email=email(auth.email);saveIdentity({email:ctx.email});}\n\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({`;

const newAuthBlock = `  try {\n    // CARTAO_SESSAO_MEMBRO_VERIFICADA_V1\n    // A identidade já foi confirmada no preflight SiteMember e vinculada ao\n    // checkout. A cobrança faz a validação final no backend; não repetimos\n    // aqui uma chamada de membro que no Chrome mobile pode perder o contexto.\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({`;

page = replaceOnce(
  page,
  oldAuthBlock,
  newAuthBlock,
  'retirar bloqueio redundante do cartão'
);

// 4) Fallback do backend só aceita sessão explicitamente criada por uma leitura
// SiteMember bem-sucedida e dentro de uma janela curta.
const oldFallback = `    const memberId = safe(sessao?.memberId);\n    const email = safe(sessao?.email).toLowerCase();\n    const timestamp = new Date(sessao?.updatedAtDate || sessao?._updatedDate || 0).getTime();\n    const age = Date.now() - timestamp;\n    const autorizacaoRecente = Number.isFinite(age) && age >= 0 && age <= 2 * 60 * 1000;\n\n    if (memberId && email && autorizacaoRecente) {\n      return { memberId, email };\n    }`;

const newFallback = `    const memberId = safe(sessao?.memberId);\n    const email = safe(sessao?.email).toLowerCase();\n    const autenticacaoConfirmada = sessao?.authMemberVerified === true;\n    const timestamp = new Date(sessao?.authVerifiedAt || 0).getTime();\n    const age = Date.now() - timestamp;\n    const autorizacaoRecente =\n      Number.isFinite(age) &&\n      age >= 0 &&\n      age <= 30 * 60 * 1000;\n\n    if (memberId && email && autenticacaoConfirmada && autorizacaoRecente) {\n      return { memberId, email };\n    }`;

card = replaceOnce(
  card,
  oldFallback,
  newFallback,
  'fallback seguro da sessão'
);

if (!clientes.includes('CHECKOUT_MEMBRO_VERIFICADO_V1')) throw new Error('marker clientes ausente');
if (!page.includes('CARTAO_SESSAO_MEMBRO_VERIFICADA_V1')) throw new Error('marker página ausente');
if (!card.includes('authMemberVerified === true')) throw new Error('marker cartão ausente');
if (page.includes('autorizarPagamentoCartaoMembro')) throw new Error('autorização redundante ainda presente na página');

write(CLIENTES, clientes);
write(PAGE, page);
write(CARD, card);
console.log('Hotfix pronto: checkout autenticado vincula sessão e cartão usa somente fallback verificado.');