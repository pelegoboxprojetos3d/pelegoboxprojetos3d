const fs = require('fs');

const checkoutPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const principalPath = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';

let checkout = fs.readFileSync(checkoutPath, 'utf8');
let principal = fs.readFileSync(principalPath, 'utf8');

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

checkout = replaceOnce(
  checkout,
`const CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst CHECKOUT_AUTH_TTL_MS =`,
`const CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst ACTIVE_PIX_SESSION_KEY =\n  "pp_checkout_pix_ativo";\n\nconst CHECKOUT_AUTH_TTL_MS =`,
  'chave de checkout PIX ativo'
);

checkout = replaceOnce(
  checkout,
`function gerarCheckoutId() {\n  return (\n    \`ckpro_\${Date.now().toString(36)}_\` +\n    Math.random().toString(16).slice(2, 12)\n  );\n}\n\nfunction normalizarMensagem(raw) {`,
`function gerarCheckoutId() {\n  return (\n    \`ckpro_\${Date.now().toString(36)}_\` +\n    Math.random().toString(16).slice(2, 12)\n  );\n}\n\nfunction marcarCheckoutPixAtivo(value) {\n  try {\n    session.setItem(\n      ACTIVE_PIX_SESSION_KEY,\n      safe(value)\n    );\n  } catch (_) {}\n}\n\nfunction checkoutPixAindaAtivo() {\n  try {\n    return (\n      Boolean(checkoutId) &&\n      safe(\n        session.getItem(\n          ACTIVE_PIX_SESSION_KEY\n        )\n      ) === safe(checkoutId)\n    );\n  } catch (_) {\n    return true;\n  }\n}\n\nfunction normalizarMensagem(raw) {`,
  'helpers de checkout ativo'
);

checkout = replaceOnce(
  checkout,
`function voltarParaPaginaAnterior(\n  tipo = ""\n) {\n  pararPollingPix();\n`,
`function voltarParaPaginaAnterior(\n  tipo = ""\n) {\n  pararPollingPix();\n\n  if (checkoutPixAindaAtivo()) {\n    marcarCheckoutPixAtivo("");\n  }\n`,
  'limpeza ao voltar pelo botão'
);

checkout = replaceOnce(
  checkout,
`async function executarPollingPix(\n  tentativa = 1\n) {\n  if (\n    !pollingPix ||`,
`async function executarPollingPix(\n  tentativa = 1\n) {\n  /*\n    Se o comprador voltou e iniciou outra tentativa, este checkout antigo\n    perde a posse do polling. Assim uma página preservada pelo histórico\n    não continua consultando o backend e a ValidaPay em segundo plano.\n  */\n  if (!checkoutPixAindaAtivo()) {\n    pararPollingPix();\n    return;\n  }\n\n  if (\n    !pollingPix ||`,
  'corte de polling antigo'
);

checkout = replaceOnce(
  checkout,
`function iniciarPollingPix(chargeId) {\n  pararPollingPix();\n\n  chargeIdAtual = safe(`,
`function iniciarPollingPix(chargeId) {\n  pararPollingPix();\n\n  if (!checkoutPixAindaAtivo()) {\n    return;\n  }\n\n  chargeIdAtual = safe(`,
  'não iniciar polling de checkout antigo'
);

checkout = replaceOnce(
  checkout,
`async function abrirPixTransparente(\n  data = {}\n) {\n  if (criandoCheckout) {\n    return;\n  }\n\n  criandoCheckout = true;`,
`async function abrirPixTransparente(\n  data = {}\n) {\n  if (\n    criandoCheckout ||\n    !checkoutPixAindaAtivo()\n  ) {\n    return;\n  }\n\n  criandoCheckout = true;`,
  'bloqueio de criação antiga'
);

checkout = replaceOnce(
  checkout,
`    if (respostaPixPronta(resposta)) {\n      enviarResultadoPix(resposta);`,
`    if (!checkoutPixAindaAtivo()) {\n      return;\n    }\n\n    if (respostaPixPronta(resposta)) {\n      enviarResultadoPix(resposta);`,
  'ignorar resposta atrasada de checkout antigo'
);

checkout = replaceOnce(
  checkout,
`  checkoutId =\n    safe(wixLocation.query.checkoutId) ||\n    gerarCheckoutId();\n\n  const html =`,
`  checkoutId =\n    safe(wixLocation.query.checkoutId) ||\n    gerarCheckoutId();\n\n  /*\n    Esta tentativa passa a ser a única autorizada a manter polling ativo\n    nesta aba. Uma tentativa anterior restaurada pelo botão Voltar deixa\n    de consumir backend assim que enxergar esta nova chave.\n  */\n  marcarCheckoutPixAtivo(\n    checkoutId\n  );\n\n  const html =`,
  'marcar checkout atual no onReady'
);

principal = replaceOnce(
  principal,
`const CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst MANUTENCAO_ATIVA =`,
`const CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst ACTIVE_PIX_SESSION_KEY =\n  "pp_checkout_pix_ativo";\n\nconst MANUTENCAO_ATIVA =`,
  'chave ativa na página principal'
);

principal = replaceOnce(
  principal,
`  const checkoutId =\n    \`ckpro_\${Date.now().toString(36)}_\` +\n    Math.random().toString(16).slice(2, 12);\n\n  const parametros = {`,
`  const checkoutId =\n    \`ckpro_\${Date.now().toString(36)}_\` +\n    Math.random().toString(16).slice(2, 12);\n\n  /*\n    O novo clique invalida imediatamente qualquer polling deixado pela\n    tentativa anterior no histórico do navegador.\n  */\n  try {\n    session.setItem(\n      ACTIVE_PIX_SESSION_KEY,\n      checkoutId\n    );\n  } catch (_) {}\n\n  const parametros = {`,
  'invalidar checkout anterior no novo clique'
);

fs.writeFileSync(checkoutPath, checkout);
fs.writeFileSync(principalPath, principal);

console.log('PIX R25 aplicado: uma única tentativa ativa por aba e polling antigo encerrado.');
