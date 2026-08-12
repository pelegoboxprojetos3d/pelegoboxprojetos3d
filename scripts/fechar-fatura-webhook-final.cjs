const fs = require('fs');

const NOTIFY = 'src/backend/notificarVendaProjetoPronto.js';
const CARD = 'src/backend/validaPayCartaoProjetosProntos.jsw';
const PIX = 'src/backend/validaPayPixProjetosProntosCore.jsw';
const HTTP = 'src/backend/http-functions.js';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, `${text.trimEnd()}\n`, 'utf8'); }
function mustReplace(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  return text.replace(from, to);
}

// -----------------------------------------------------------------------------
// 1) NOTIFICADOR ÚNICO: captura HTTP/status/body do RespondeChat e tenta de novo
//    apenas em falha transitória. Também persiste o diagnóstico na sessão.
// -----------------------------------------------------------------------------
let notify = read(NOTIFY);

const oldPostJson = `async function postJson(url, payload) {\n  const response = await fetch(url, {\n    method: \"post\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify(payload)\n  });\n  if (!response.ok) throw new Error(\`Webhook respondeu HTTP \${response.status}.\`);\n}`;

const newPostJson = `async function postJson(url, payload) {\n  const response = await fetch(url, {\n    method: \"post\",\n    headers: {\n      \"Content-Type\": \"application/json\",\n      \"Accept\": \"application/json, text/plain, */*\"\n    },\n    body: JSON.stringify(payload)\n  });\n\n  let responseText = \"\";\n  try { responseText = safe(await response.text()).slice(0, 800); } catch (_) {}\n\n  if (!response.ok) {\n    const error = new Error(\`Webhook respondeu HTTP \${response.status}\${responseText ? `: \${responseText}` : \"\"}.\`);\n    error.statusCode = Number(response.status || 0);\n    error.responseText = responseText;\n    throw error;\n  }\n\n  return { statusCode: Number(response.status || 0), responseText };\n}\n\nasync function postJsonRetry(url, payload) {\n  const delays = [0, 700, 1600];\n  let lastError = null;\n\n  for (let attempt = 0; attempt < delays.length; attempt += 1) {\n    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));\n    try {\n      const result = await postJson(url, payload);\n      return { ...result, attempt: attempt + 1 };\n    } catch (error) {\n      lastError = error;\n      const status = Number(error?.statusCode || 0);\n      const transient = !status || status === 408 || status === 425 || status === 429 || status >= 500;\n      if (!transient) break;\n    }\n  }\n\n  throw lastError || new Error(\"Falha ao enviar webhook.\");\n}`;

notify = mustReplace(notify, oldPostJson, newPostJson, 'postJson detalhado');

// aliases simples para máxima compatibilidade do gatilho do RespondeChat
notify = mustReplace(
  notify,
  `    whatsapp: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),\n    cpfCnpj: digits(session.cpfCnpj),`,
  `    whatsapp: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),\n    telefone: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),\n    phone: phone(session.whatsapp || session.whatsappE164 || session.whatsApp),\n    cpfCnpj: digits(session.cpfCnpj),`,
  'aliases telefone'
);

const oldChatbotBlock = `  if (session.chatbotVendaEnviado !== true) {\n    const url = await optionalSecret(CHATBOT_SECRET);\n    if (url) {\n      try {\n        await postJson(url, payload);\n        patch.chatbotVendaEnviado = true;\n        changed = true;\n        result.chatbot = \"sent\";\n      } catch (error) {\n        result.chatbot = \"error\";\n        console.error(\"Falha ao disparar chatbot da venda:\", error?.message || error);\n      }\n    } else {\n      result.chatbot = \"secret_missing\";\n    }\n  }`;

const newChatbotBlock = `  if (session.chatbotVendaEnviado !== true) {\n    const url = await optionalSecret(CHATBOT_SECRET);\n    patch.chatbotVendaUltimaTentativaEm = new Date();\n    changed = true;\n\n    if (url) {\n      try {\n        const envio = await postJsonRetry(url, payload);\n        patch.chatbotVendaEnviado = true;\n        patch.chatbotVendaStatusCode = Number(envio?.statusCode || 0);\n        patch.chatbotVendaResposta = safe(envio?.responseText);\n        patch.chatbotVendaErro = \"\";\n        patch.chatbotVendaTentativa = Number(envio?.attempt || 1);\n        result.chatbot = \"sent\";\n        result.chatbotStatusCode = Number(envio?.statusCode || 0);\n      } catch (error) {\n        patch.chatbotVendaEnviado = false;\n        patch.chatbotVendaStatusCode = Number(error?.statusCode || 0);\n        patch.chatbotVendaResposta = safe(error?.responseText);\n        patch.chatbotVendaErro = safe(error?.message || error).slice(0, 800);\n        result.chatbot = \"error\";\n        result.chatbotStatusCode = Number(error?.statusCode || 0);\n        result.chatbotError = patch.chatbotVendaErro;\n        console.error(\"Falha ao disparar chatbot da venda:\", error?.message || error);\n      }\n    } else {\n      patch.chatbotVendaEnviado = false;\n      patch.chatbotVendaErro = \"secret_missing\";\n      result.chatbot = \"secret_missing\";\n    }\n  }`;

notify = mustReplace(notify, oldChatbotBlock, newChatbotBlock, 'bloco chatbot detalhado');
write(NOTIFY, notify);

// -----------------------------------------------------------------------------
// 2) VALIDAPAY: descrição é opcional. Não repetir name em description.
//    E não reutilizar produto antigo cuja description já seja igual ao name.
// -----------------------------------------------------------------------------
for (const path of [CARD, PIX]) {
  let text = read(path);

  text = text.replace(/\n\s*description:\s*produto,/, '');

  const marker = `        if (respostaDetalhe.ok) detalhe = respostaDetalhe.data?.data || respostaDetalhe.data || detalhe;\n        prices = detalhe?.prices || detalhe?.data?.prices || [];\n      }\n\n      const preco =`;
  const replacement = `        if (respostaDetalhe.ok) detalhe = respostaDetalhe.data?.data || respostaDetalhe.data || detalhe;\n        prices = detalhe?.prices || detalhe?.data?.prices || [];\n      }\n\n      // Produtos antigos gravavam description igual ao name. A fatura concatena\n      // esses dois textos e exibe TÍTULO - TÍTULO. Não reutilizar esses cadastros.\n      const descricaoProduto = normalizarTituloProduto(detalhe?.description).toLowerCase();\n      if (descricaoProduto && descricaoProduto === nomeEsperado) continue;\n\n      const preco =`;

  text = mustReplace(text, marker, replacement, `invalidar descrição duplicada em ${path}`);
  write(path, text);
}

// -----------------------------------------------------------------------------
// 3) PIX usa o mesmo notificador central do cartão. Uma regra só para todas as
//    vendas de Projetos Prontos.
// -----------------------------------------------------------------------------
let pix = read(PIX);
const importMarker = `import { tituloEtapaProjetoPronto, normalizarTituloProduto, extrairCodigoQuestionarioTitulo } from \"backend/projetosProntosNormalizacao\";`;
const importWithNotify = `${importMarker}\nimport { notificarVendaProjetoProntoAprovada } from \"backend/notificarVendaProjetoPronto\";`;
pix = mustReplace(pix, importMarker, importWithNotify, 'import notificador no Pix');

pix = mustReplace(
  pix,
  `        await notifyApproved(checkoutId, chargeId, response.data || {});`,
  `        await notificarVendaProjetoProntoAprovada({\n          checkoutId,\n          chargeId,\n          paymentMethod: \"PIX\"\n        });`,
  'notificador central no Pix'
);
write(PIX, pix);

// -----------------------------------------------------------------------------
// 4) ENDPOINT TEMPORÁRIO, restrito ao checkout já pago das 00:18, para reenviar
//    apenas o webhook faltante e capturar a resposta antes de outro teste pago.
// -----------------------------------------------------------------------------
let http = read(HTTP);
const endpointMarker = 'export async function get_diagnosticoRespondeChatPP';
if (!http.includes(endpointMarker)) {
  http += `\n\n// TEMPORÁRIO: diagnóstico do webhook da venda Pix já paga em 12/08/2026 00:18.\nexport async function get_diagnosticoRespondeChatPP(request) {\n  const checkoutId = safe(request?.query?.checkoutId);\n  const checkoutTeste = \"ckpro_mspipf5y_b81ebde8\";\n\n  if (checkoutId !== checkoutTeste) {\n    return forbidden({ body: { ok: false, error: \"forbidden\" } });\n  }\n\n  try {\n    const result = await notificarVendaProjetoProntoAprovada({\n      checkoutId,\n      chargeId: \"cha_1786504677536_km2wxmld3\",\n      paymentMethod: \"PIX\"\n    });\n    return ok({ body: result });\n  } catch (error) {\n    return ok({ body: { ok: false, error: safe(error?.message || error) } });\n  }\n}\n`;
}
write(HTTP, http);

console.log('Hotfix final aplicado: fatura sem descrição duplicada + webhook diagnosticável e unificado.');
