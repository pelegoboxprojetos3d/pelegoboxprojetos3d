const fs = require('fs');

const PAGE = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const CLIENTES = 'src/backend/clientes.web.js';
const AUTH = 'src/backend/validaPayCartaoAuth.web.js';
const CARD = 'src/backend/validaPayCartaoProjetosProntos.jsw';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value, 'utf8'); }
function replaceOnce(text, from, to, label) {
  if (text.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return text;
  }
  const count = text.split(from).length - 1;
  if (count < 1) throw new Error(`${label}: trecho esperado não encontrado.`);
  console.log(`${label}: aplicado (${count} candidato(s)).`);
  return text.replace(from, to);
}

let page = read(PAGE);
let clientes = read(CLIENTES);
let auth = read(AUTH);
let card = read(CARD);

page = replaceOnce(
  page,
  'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";\nimport { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";',
  'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual, autorizarPagamentoCartaoMembro } from "backend/clientes.web";\nimport { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\nimport { autorizarPagamentoCartao } from "backend/validaPayCartaoAuth.web";',
  'imports de autenticação do cartão'
);

page = replaceOnce(
  page,
  `  try {\n    // CARTAO_SESSAO_MEMBRO_VERIFICADA_V1\n    // A identidade já foi confirmada no preflight SiteMember e vinculada ao\n    // checkout. A cobrança faz a validação final no backend; não repetimos\n    // aqui uma chamada de membro que no Chrome mobile pode perder o contexto.\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({`,
  `  try {\n    // CARTAO_AUTH_CONSOLIDADA_V2\n    // O preflight melhora a UX, mas não é mais pré-requisito para pagar.\n    // No clique, renovamos a prova da conta Wix. Primeiro usamos a rota\n    // SiteMember que estava funcionando na compra aprovada #1796; se ela\n    // falhar por contexto transitório, tentamos a API de Members v2.\n    let authResult = null;\n    try {\n      authResult = await waitTimeout(autorizarPagamentoCartaoMembro({ checkoutId }), 4500, \"\");\n    } catch (_) {}\n    if (!authResult?.ok) {\n      try {\n        authResult = await waitTimeout(autorizarPagamentoCartao({ checkoutId }), 4500, \"\");\n      } catch (_) {}\n    }\n    if (authResult?.ok && authResult?.email) {\n      ctx.email = email(authResult.email);\n      saveIdentity({ email: ctx.email });\n    }\n\n    // A cobrança continua sendo a autoridade final. Se as duas renovações\n    // acima falharem, ela ainda pode aceitar o membro atual ou uma prova\n    // recente já gravada, evitando falso \"faça login novamente\".\n    const r=await waitTimeout(criarCobrancaCartaoTransparente({`,
  'renovação da autenticação no clique do cartão'
);

page = replaceOnce(
  page,
  `  checkoutId=safe(wixLocation.query?.checkoutId) || \`ckpro_\${Date.now().toString(36)}_\${Math.random().toString(16).slice(2,10)}\`;\n  ctx=contextFromUrl();\n  configurarBannersPagamento(ctx.tipoProduto).catch(error => {`,
  `  checkoutId=safe(wixLocation.query?.checkoutId) || \`ckpro_\${Date.now().toString(36)}_\${Math.random().toString(16).slice(2,10)}\`;\n  ctx=contextFromUrl();\n  // CHECKOUT_FAST_BOOT_SEM_LOGIN_V4\n  // Título, produto e formulário podem abrir imediatamente. A leitura do\n  // membro segue em paralelo e atualiza os dados assim que responder.\n  contextReady=true;\n  configurarBannersPagamento(ctx.tipoProduto).catch(error => {`,
  'fast boot independente do preflight'
);

page = replaceOnce(
  page,
  `  // BOOT_CLIENTE_RECORRENTE_V2\n  // Depois de limpar histórico ou trocar de aparelho não existe storage local.\n  // Antes de mostrar Nome/CPF/WhatsApp, aguardamos a consulta da conta Wix\n  // autenticada. O próprio backend tem timeout de 5 s, então este preflight\n  // apenas impede o formulário errado de aparecer antes da resposta.\n  const contextoAutenticadoPromise =\n    carregarContextoClienteAutenticado();\n\n  // LOGIN_COLECOES_SEM_CORRIDA_V3\n  // Não libera o formulário por cronômetro. Primeiro deixa a conta Wix\n  // autenticada terminar a leitura das coleções. A própria consulta possui\n  // limite de segurança, portanto o checkout não fica preso indefinidamente.\n  contextoAutenticadoPromise\n    .catch(() => {})\n    .finally(() => {\n      contextReady = true;\n      sendInit(true);\n    });`,
  `  // BOOT_CLIENTE_RECORRENTE_V3\n  // A conta Wix e as coleções são carregadas em segundo plano. Elas podem\n  // completar o contexto do comprador, mas nunca mais seguram o INIT do\n  // checkout nem deixam a tela presa em \"Carregando checkout...\".\n  const contextoAutenticadoPromise = carregarContextoClienteAutenticado();\n  contextoAutenticadoPromise.catch(() => {});`,
  'preflight em segundo plano sem bloquear INIT'
);

clientes = replaceOnce(
  clientes,
  `          const sessao = {\n            ...resultado.items[0],\n            memberId,\n            email: memberEmail,\n            updatedAtDate: agora\n          };`,
  `          const sessao = {\n            ...resultado.items[0],\n            memberId,\n            email: memberEmail,\n            authMemberVerified: true,\n            authVerifiedAt: agora,\n            cardAuthMemberId: memberId,\n            cardAuthEmail: memberEmail,\n            cardAuthAt: agora,\n            updatedAtDate: agora\n          };`,
  'prova canônica na autorização SiteMember existente'
);

clientes = replaceOnce(
  clientes,
  `            {\n              checkoutId,\n              memberId,\n              email: memberEmail,\n              status: \"pending_auth\",\n              updatedAtDate: agora\n            },`,
  `            {\n              checkoutId,\n              memberId,\n              email: memberEmail,\n              authMemberVerified: true,\n              authVerifiedAt: agora,\n              cardAuthMemberId: memberId,\n              cardAuthEmail: memberEmail,\n              cardAuthAt: agora,\n              status: \"pending_auth\",\n              updatedAtDate: agora\n            },`,
  'prova canônica na nova sessão SiteMember'
);

auth = replaceOnce(
  auth,
  `      memberId: identidade.memberId,\n      email: identidade.email,\n      cardAuthMemberId: identidade.memberId,`,
  `      memberId: identidade.memberId,\n      email: identidade.email,\n      authMemberVerified: true,\n      authVerifiedAt: now,\n      cardAuthMemberId: identidade.memberId,`,
  'prova canônica na autorização Members v2 existente'
);

auth = replaceOnce(
  auth,
  `      checkoutId,\n      memberId: identidade.memberId,\n      email: identidade.email,\n      cardAuthMemberId: identidade.memberId,`,
  `      checkoutId,\n      memberId: identidade.memberId,\n      email: identidade.email,\n      authMemberVerified: true,\n      authVerifiedAt: now,\n      cardAuthMemberId: identidade.memberId,`,
  'prova canônica na nova sessão Members v2'
);

card = replaceOnce(
  card,
  `    const memberId = safe(sessao?.memberId);\n    const email = safe(sessao?.email).toLowerCase();\n    const autenticacaoConfirmada = sessao?.authMemberVerified === true;\n    const timestamp = new Date(sessao?.authVerifiedAt || 0).getTime();\n    const age = Date.now() - timestamp;\n    const autorizacaoRecente =\n      Number.isFinite(age) &&\n      age >= 0 &&\n      age <= 30 * 60 * 1000;\n\n    if (memberId && email && autenticacaoConfirmada && autorizacaoRecente) {\n      return { memberId, email };\n    }`,
  `    const memberId = safe(sessao?.memberId);\n    const email = safe(sessao?.email).toLowerCase();\n\n    const authTimestamp = new Date(sessao?.authVerifiedAt || 0).getTime();\n    const authAge = Date.now() - authTimestamp;\n    const provaCanonicaRecente =\n      sessao?.authMemberVerified === true &&\n      Number.isFinite(authAge) &&\n      authAge >= 0 &&\n      authAge <= 30 * 60 * 1000;\n\n    const cardAuthTimestamp = new Date(sessao?.cardAuthAt || 0).getTime();\n    const cardAuthAge = Date.now() - cardAuthTimestamp;\n    const provaCartaoRecente =\n      safe(sessao?.cardAuthMemberId) === memberId &&\n      safe(sessao?.cardAuthEmail).toLowerCase() === email &&\n      Number.isFinite(cardAuthAge) &&\n      cardAuthAge >= 0 &&\n      cardAuthAge <= 30 * 60 * 1000;\n\n    if (memberId && email && (provaCanonicaRecente || provaCartaoRecente)) {\n      return { memberId, email };\n    }`,
  'fallback compatível com as duas provas de autenticação'
);

for (const [text, marker, label] of [
  [page, 'CARTAO_AUTH_CONSOLIDADA_V2', 'página: auth consolidada'],
  [page, 'CHECKOUT_FAST_BOOT_SEM_LOGIN_V4', 'página: fast boot'],
  [clientes, 'authMemberVerified: true', 'clientes: prova canônica'],
  [auth, 'authVerifiedAt: now', 'auth v2: prova canônica'],
  [card, 'provaCartaoRecente', 'cartão: fallback compatível']
]) {
  if (!text.includes(marker)) throw new Error(`Validação final falhou: ${label}`);
}

write(PAGE, page);
write(CLIENTES, clientes);
write(AUTH, auth);
write(CARD, card);
console.log('OK: checkout abre sem esperar login e cartão renova/aceita autenticação consistente no clique.');
