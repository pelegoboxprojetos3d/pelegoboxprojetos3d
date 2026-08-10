const fs = require("fs");

const MAIN = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CHECKOUT = "src/pages/checkout-projeto-pronto.i9aj1.js";
const BACKEND = "src/backend/validaPayPixProjetosProntos.jsw";

function patchFile(path, transforms) {
  let content = fs.readFileSync(path, "utf8");
  let changed = false;

  for (const transform of transforms) {
    if (content.includes(transform.after)) {
      continue;
    }

    if (!content.includes(transform.before)) {
      throw new Error(`Trecho esperado não encontrado em ${path}: ${transform.name}`);
    }

    content = content.replace(transform.before, transform.after);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(path, content, "utf8");
    console.log(`Corrigido: ${path}`);
  } else {
    console.log(`Já corrigido: ${path}`);
  }
}

patchFile(MAIN, [
  {
    name: "checkoutId único por clique",
    before: `  const parametros = {\n    codigoProjeto,`,
    after: `  /*\n    Cada clique abre uma tentativa independente.\n    O checkoutId vai na URL para impedir que o histórico/BFCache\n    reaproveite a cobrança de uma navegação anterior.\n  */\n  const checkoutId =\n    \`ckpro_\${Date.now().toString(36)}_\` +\n    Math.random().toString(16).slice(2, 12);\n\n  const parametros = {\n    checkoutId,\n    codigoProjeto,`
  }
]);

patchFile(CHECKOUT, [
  {
    name: "usar checkoutId recebido e limpar estado transitório",
    before: `  checkoutId =\n    gerarCheckoutId();`,
    after: `  /*\n    Uma entrada nova nunca herda polling/cobrança da navegação anterior.\n    O ID recebido foi criado no clique da página de origem.\n  */\n  pararPollingPix();\n  chargeIdAtual = \"\";\n  pixConteudoEnviado = false;\n  pixPollingInicio = 0;\n  criandoCheckout = false;\n  fluxoAutomaticoIniciado = false;\n  checkoutAutorizado = false;\n\n  checkoutId =\n    safe(wixLocation.query.checkoutId) ||\n    gerarCheckoutId();`
  },
  {
    name: "evitar falso erro cedo demais durante recuperação",
    before: `const PIX_PRE_QR_LIMITE_MS = 18000;`,
    after: `const PIX_PRE_QR_LIMITE_MS = 30000;`
  }
]);

patchFile(BACKEND, [
  {
    name: "leitura consistente da sessão recém-atualizada",
    before: `      .limit(1)\n      .find(DB_OPTS);`,
    after: `      .limit(1)\n      .find({\n        ...DB_OPTS,\n        consistentRead: true\n      });`
  }
]);

console.log("Correção de reentrada do PIX aplicada com sucesso.");
