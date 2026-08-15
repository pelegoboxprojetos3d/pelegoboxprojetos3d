const fs = require('fs');

const pagePath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const customPath = 'src/public/custom-elements/pelego-checkout-pronto.js';

let page = fs.readFileSync(pagePath, 'utf8');
let custom = fs.readFileSync(customPath, 'utf8');

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}`);
  return text.replace(from, to);
}

page = replaceOnce(
  page,
  'const AUTH_CONTEXT_PREFLIGHT_MAX = 5200; // LOGIN_LIMPO_REAPROVEITA_CADASTRO_V2',
  'const AUTH_CONTEXT_PREFLIGHT_MAX = 12000; // LOGIN_COLECOES_SEM_CORRIDA_V3',
  'timeout preflight'
);

page = replaceOnce(
  page,
  'const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 5000, "");',
  'const perfil = await waitTimeout(buscarClienteDoMembroAtual(), AUTH_CONTEXT_PREFLIGHT_MAX, "");',
  'consulta membro'
);

page = replaceOnce(
  page,
  `  Promise.race([\n    contextoAutenticadoPromise,\n    new Promise((resolve) => setTimeout(resolve, AUTH_CONTEXT_PREFLIGHT_MAX))\n  ])\n    .catch(() => {})\n    .finally(() => {\n      contextReady = true;\n      sendInit(true);\n    });`,
  `  // LOGIN_COLECOES_SEM_CORRIDA_V3\n  // Não libera o formulário por cronômetro. Primeiro deixa a conta Wix\n  // autenticada terminar a leitura das coleções. A própria consulta possui\n  // limite de segurança, portanto o checkout não fica preso indefinidamente.\n  contextoAutenticadoPromise\n    .catch(() => {})\n    .finally(() => {\n      contextReady = true;\n      sendInit(true);\n    });`,
  'race do boot'
);

custom = replaceOnce(
  custom,
  ' if(S.ctx.email){E.email.value=email(S.ctx.email);E.email2.value=email(S.ctx.email)}',
  ` if(S.ctx.email){\n   var lockedMail=email(S.ctx.email);\n   E.email.value=lockedMail;E.email2.value=lockedMail;\n   [E.email,E.email2].forEach(function(node){\n     if(!node)return;\n     node.readOnly=true;\n     node.setAttribute("readonly","readonly");\n     node.setAttribute("aria-readonly","true");\n     node.autocomplete="email";\n   });\n }`,
  'bloqueio email no hydrate'
);

custom = replaceOnce(
  custom,
  ' if(type==="CUSTOMER_CONTEXT"){\n   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);if(d.nome)S.ctx.nome=safe(d.nome);if(d.email)S.ctx.email=email(d.email);if(d.cpfCnpj)S.ctx.cpfCnpj=digits(d.cpfCnpj);hydrateCardIdentity(d);return\n }',
  ` if(type==="CUSTOMER_CONTEXT"){\n   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);\n   if(d.nome)S.ctx.nome=safe(d.nome);\n   if(d.email){\n     S.ctx.email=email(d.email);\n     E.email.value=S.ctx.email;E.email2.value=S.ctx.email;\n     [E.email,E.email2].forEach(function(node){if(node){node.readOnly=true;node.setAttribute("readonly","readonly");node.setAttribute("aria-readonly","true")}});\n   }\n   if(d.cpfCnpj){S.ctx.cpfCnpj=digits(d.cpfCnpj);E.cpf.value=formatCpf(S.ctx.cpfCnpj)}\n   if(d.whatsapp||d.whatsappE164){\n     var ciCtx=countryInfo(E.country),pCtx=phoneLocal(d.whatsappE164||d.whatsapp,ciCtx.ddi);\n     if(pCtx){S.ctx.whatsapp=pCtx;S.ctx.whatsappE164="+"+ciCtx.ddi+pCtx;E.phone.value=formatPhone(pCtx,ciCtx.ddi)}\n   }\n   hydrateCardIdentity(d);syncIdentityButton();return\n }`,
  'contexto cliente no custom'
);

if (!page.includes('LOGIN_COLECOES_SEM_CORRIDA_V3')) throw new Error('marker página ausente');
if (!custom.includes('aria-readonly')) throw new Error('bloqueio de e-mail ausente');

fs.writeFileSync(pagePath, page);
fs.writeFileSync(customPath, custom);
console.log('Hotfix aplicado: login aguarda coleções e e-mail autenticado fica bloqueado.');
