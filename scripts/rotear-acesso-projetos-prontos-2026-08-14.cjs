const fs = require("fs");

const DELIVERY = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";

function fail(message) {
  throw new Error(message);
}

function replaceExact(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

let delivery = fs.readFileSync(DELIVERY, "utf8");

// Página simples de recados criada no Wix pelo PELEGO.
if (!delivery.includes('const PAGINA_ACESSO_PROJETOS =\n  "/semprodutonaologao";')) {
  const anchor = 'const EMAIL_PROCESSAMENTO_MS =\n  5000;';
  if (!delivery.includes(anchor)) fail("Constante EMAIL_PROCESSAMENTO_MS não encontrada.");
  delivery = delivery.replace(
    anchor,
    `${anchor}\n\nconst PAGINA_ACESSO_PROJETOS =\n  "/semprodutonaologao";`
  );
}

if (!delivery.includes("function urlPaginaAcessoProjetos(")) {
  const anchor = `function firstValue(\n  ...valores\n) {\n  for (\n    const valor of\n    valores\n  ) {\n    const texto =\n      safe(valor);\n\n    if (texto) {\n      return texto;\n    }\n  }\n\n  return \"\";\n}\n`;

  const helper = `\nfunction urlPaginaAcessoProjetos({\n  checkoutId = \"\",\n  token = \"\",\n  via = \"\",\n  motivo = \"\"\n} = {}) {\n  const partes = [];\n\n  if (safe(checkoutId)) {\n    partes.push(\`checkout_id=\${encodeURIComponent(safe(checkoutId))}\`);\n  }\n\n  if (safe(token)) {\n    partes.push(\`token=\${encodeURIComponent(safe(token))}\`);\n  }\n\n  if (safe(via)) {\n    partes.push(\`via=\${encodeURIComponent(safe(via))}\`);\n  }\n\n  if (safe(motivo)) {\n    partes.push(\`motivo=\${encodeURIComponent(safe(motivo))}\`);\n  }\n\n  return partes.length\n    ? \`\${PAGINA_ACESSO_PROJETOS}?\${partes.join(\"&\")}\`\n    : PAGINA_ACESSO_PROJETOS;\n}\n\nfunction redirecionarPaginaAcessoProjetos(dados = {}) {\n  wixLocation.to(\n    urlPaginaAcessoProjetos(dados)\n  );\n}\n`;

  if (!delivery.includes(anchor)) fail("Helper firstValue não encontrado.");
  delivery = delivery.replace(anchor, anchor + helper);
}

// Avatar sem login: sai da página pesada de entrega e vai para a página simples.
delivery = replaceExact(
  delivery,
  `    if (!resultado?.ok) {\n      await mostrarDadosRepeater([\n        itemRepeaterMensagem(\n          \"SEUS PROJETOS PRONTOS\",\n          resultado?.error === \"LOGIN_NECESSARIO\"\n            ? \"Entre na sua conta para consultar seus Projetos Prontos.\"\n            : \"Não foi possível consultar seus projetos agora.\"\n        )\n      ]);\n      return;\n    }`,
  `    if (!resultado?.ok) {\n      if (resultado?.error === \"LOGIN_NECESSARIO\") {\n        redirecionarPaginaAcessoProjetos({\n          motivo: \"login\"\n        });\n        return;\n      }\n\n      await mostrarDadosRepeater([\n        itemRepeaterMensagem(\n          \"SEUS PROJETOS PRONTOS\",\n          \"Não foi possível consultar seus projetos agora.\"\n        )\n      ]);\n      return;\n    }`,
  "Central sem login"
);

// Avatar logado, mas sem nenhuma compra: recado na página nova.
delivery = replaceExact(
  delivery,
  `    if (!projetosSegundaVia.length) {\n      await mostrarDadosRepeater([\n        itemRepeaterMensagem(\n          \"SEUS PROJETOS PRONTOS\",\n          \"Nenhum Projeto Pronto comprado foi encontrado nesta conta.\"\n        )\n      ]);\n      return;\n    }`,
  `    if (!projetosSegundaVia.length) {\n      redirecionarPaginaAcessoProjetos({\n        motivo: \"sem_produtos\"\n      });\n      return;\n    }`,
  "Central sem produtos"
);

// Link direto do e-mail sem login: não abre modal e não deixa mensagem dentro do repeater.
delivery = replaceExact(
  delivery,
  `        if (\n          resultado?.error ===\n          \"LOGIN_NECESSARIO\"\n        ) {\n          await encerrarProcessamentoPendente(\n            \"ACESSO PROTEGIDO\",\n            \"Entre na sua conta usando o mesmo e-mail informado na compra para acessar este produto.\"\n          );\n\n          solicitarLoginDaCompra();\n          return;\n        }`,
  `        if (\n          resultado?.error ===\n          \"LOGIN_NECESSARIO\"\n        ) {\n          redirecionarPaginaAcessoProjetos({\n            checkoutId,\n            token,\n            via: origemViaEmail ? \"email\" : \"\",\n            motivo: \"login_compra\"\n          });\n          return;\n        }`,
  "Entrega sem login"
);

// Link do e-mail aberto em conta diferente: também usa a página nova.
delivery = replaceExact(
  delivery,
  `        if (\n          resultado?.error ===\n          \"COMPRA_DE_OUTRA_CONTA\"\n        ) {\n          await encerrarProcessamentoPendente(\n            \"ACESSO PROTEGIDO\",\n            \"Esta compra pertence a outra conta. Saia da conta atual e entre com o mesmo e-mail usado no pagamento.\"\n          );\n\n          return;\n        }`,
  `        if (\n          resultado?.error ===\n          \"COMPRA_DE_OUTRA_CONTA\"\n        ) {\n          redirecionarPaginaAcessoProjetos({\n            checkoutId,\n            token,\n            via: origemViaEmail ? \"email\" : \"\",\n            motivo: \"conta_errada\"\n          });\n          return;\n        }`,
  "Entrega em outra conta"
);

fs.writeFileSync(DELIVERY, delivery, "utf8");

// O e-mail passa primeiro pela página simples. Ela valida a conta e só então
// encaminha o comprador correto para a página de entrega.
let notify = fs.readFileSync(NOTIFY, "utf8");
notify = replaceExact(
  notify,
  '    botaoUrl: SITE_BASE + "/entregaprojetosprontos?checkout_id=" + encodeURIComponent(safe(session.checkoutId)),\n    deliveryUrl: `${SITE_BASE}/entregaprojetosprontos?checkout_id=${encodeURIComponent(safe(session.checkoutId))}`,',
  '    botaoUrl: SITE_BASE + "/semprodutonaologao?checkout_id=" + encodeURIComponent(safe(session.checkoutId)),\n    deliveryUrl: `${SITE_BASE}/semprodutonaologao?checkout_id=${encodeURIComponent(safe(session.checkoutId))}`,',
  "Links do e-mail"
);
fs.writeFileSync(NOTIFY, notify, "utf8");

// Validações anti-regressão.
const deliveryFinal = fs.readFileSync(DELIVERY, "utf8");
const notifyFinal = fs.readFileSync(NOTIFY, "utf8");

for (const marker of [
  'const PAGINA_ACESSO_PROJETOS =\n  "/semprodutonaologao";',
  'motivo: "sem_produtos"',
  'motivo: "login_compra"',
  'motivo: "conta_errada"'
]) {
  if (!deliveryFinal.includes(marker)) fail(`Marcador ausente na entrega: ${marker}`);
}

if (!notifyFinal.includes('/semprodutonaologao?checkout_id=')) {
  fail("O e-mail ainda não aponta para a página nova.");
}

console.log("Roteamento de acesso aos Projetos Prontos aplicado com sucesso.");
