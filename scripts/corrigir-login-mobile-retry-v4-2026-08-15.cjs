const fs = require('fs');

const pagePath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
let page = fs.readFileSync(pagePath, 'utf8');

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  return text.replace(from, to);
}

page = replaceOnce(
  page,
  'const waitTimeout = (p, ms, m) => Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error(m)),ms))]);',
  `const waitTimeout = (p, ms, m) => Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error(m)),ms))]);\nconst waitMs = ms => new Promise(resolve => setTimeout(resolve, ms));\n\n// LOGIN_MEMBRO_RETRY_MOBILE_V4\n// No celular, logo depois do login social, o cabeçalho pode mostrar o membro\n// antes de o webMethod receber o contexto autenticado. Repetimos a leitura\n// por poucos segundos e só aceitamos o perfil quando vier com memberId+email.\nasync function buscarPerfilMembroAutenticadoComRetry() {\n  let ultimo = null;\n  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {\n    try {\n      const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 1800, "");\n      if (perfil && typeof perfil === "object") ultimo = perfil;\n      if (safe(perfil?.memberId) && email(perfil?.email)) return perfil;\n    } catch (_) {}\n    if (tentativa < 5) await waitMs(220);\n  }\n  return ultimo;\n}`,
  'helper retry'
);

page = replaceOnce(
  page,
  '    const perfil = await waitTimeout(buscarClienteDoMembroAtual(), AUTH_CONTEXT_PREFLIGHT_MAX, "");',
  '    const perfil = await waitTimeout(buscarPerfilMembroAutenticadoComRetry(), AUTH_CONTEXT_PREFLIGHT_MAX, "");',
  'preflight autenticado'
);

page = replaceOnce(
  page,
  `    const perfil =\n      await waitTimeout(\n        buscarClienteDoMembroAtual(),\n        7000,\n        "Não foi possível confirmar sua conta Wix."\n      );`,
  `    const perfil =\n      await waitTimeout(\n        buscarPerfilMembroAutenticadoComRetry(),\n        11000,\n        "Não foi possível confirmar sua conta Wix."\n      );`,
  'saveCustomer autenticado'
);

if (!page.includes('LOGIN_MEMBRO_RETRY_MOBILE_V4')) throw new Error('marker retry ausente');
if (!page.includes('buscarPerfilMembroAutenticadoComRetry()')) throw new Error('helper não utilizado');

fs.writeFileSync(pagePath, page);
console.log('Hotfix aplicado: retry real da conta Wix no mobile antes de liberar identificação.');
