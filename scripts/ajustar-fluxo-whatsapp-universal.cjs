const fs = require('fs');

const mainPath = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
const checkoutPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 bloco, encontrado ${count}`);
  }
  return text.replace(before, after);
}

let main = fs.readFileSync(mainPath, 'utf8');

const beforeIdentity = `    countryName:\n      safe(\n        data.countryName\n      ) ||\n      identificacao.countryName ||\n      \"Brasil\"\n  };`;

const afterIdentity = `    countryName:\n      safe(\n        data.countryName\n      ) ||\n      identificacao.countryName ||\n      \"Brasil\",\n\n    whatsappConfirmado:\n      data.whatsappConfirmado === true ||\n      identificacao.whatsappConfirmado === true,\n\n    confirmacaoWhatsappVersao:\n      data.whatsappConfirmado === true\n        ? Number(\n          data.confirmacaoWhatsappVersao ||\n          CONFIRMACAO_FLUXO_VERSAO\n        )\n        : Number(\n          identificacao.confirmacaoWhatsappVersao ||\n          0\n        ),\n\n    confirmadoEm:\n      safe(data.confirmadoEm) ||\n      identificacao.confirmadoEm ||\n      (\n        data.whatsappConfirmado === true\n          ? new Date().toISOString()\n          : \"\"\n      )\n  };`;

if (main.includes(beforeIdentity)) {
  main = replaceOnce(main, beforeIdentity, afterIdentity, 'persistência da confirmação');
}

const beforeLookup = `    clienteAtual =\n      await comTimeout(\n        buscarCliente(\n          telefone.whatsapp\n        ),\n\n        12000,\n\n        \"A consulta do cliente não respondeu.\"\n      );`;

const afterLookup = `    const clienteDoPopup =\n      data.cliente &&\n      typeof data.cliente === \"object\"\n        ? data.cliente\n        : null;\n\n    clienteAtual =\n      clienteDoPopup ||\n      await comTimeout(\n        buscarCliente(\n          telefone.whatsapp\n        ),\n\n        12000,\n\n        \"A consulta do cliente não respondeu.\"\n      );`;

if (main.includes(beforeLookup)) {
  main = replaceOnce(main, beforeLookup, afterLookup, 'reuso do cliente localizado no popup');
}

const beforeReset = `    identificacao.whatsappConfirmado =\n      false;\n\n    identificacao.confirmacaoWhatsappVersao =\n      0;\n\n    identificacao.confirmadoEm =\n      \"\";`;

const afterReset = `    /*\n      O popup WhatsApp inicial já validou esta identificação.\n      Não desfazemos a confirmação ao retornar para a página.\n    */\n    identificacao.whatsappConfirmado =\n      resultado.whatsappConfirmado === true;\n\n    identificacao.confirmacaoWhatsappVersao =\n      Number(\n        resultado.confirmacaoWhatsappVersao ||\n        CONFIRMACAO_FLUXO_VERSAO\n      );\n\n    identificacao.confirmadoEm =\n      safe(resultado.confirmadoEm) ||\n      new Date().toISOString();`;

if (main.includes(beforeReset)) {
  main = replaceOnce(main, beforeReset, afterReset, 'remoção da desconfirmação');
}

fs.writeFileSync(mainPath, main, 'utf8');

let checkout = fs.readFileSync(checkoutPath, 'utf8');
checkout = checkout
  .replaceAll('#htmlIframeMP', '#htmlCheckoutValidaPay')
  .replace('// R21 — CONTRATO ANTIGO DO HTML + RECUPERAÇÃO DO PIX', '// R22 — ID OFICIAL + IDENTIFICAÇÃO UNIVERSAL + RECUPERAÇÃO DO PIX');

if (!checkout.includes('#htmlCheckoutValidaPay')) {
  throw new Error('checkout: ID oficial não foi aplicado');
}
if (checkout.includes('#htmlIframeMP')) {
  throw new Error('checkout: ainda existe referência ao ID antigo');
}

fs.writeFileSync(checkoutPath, checkout, 'utf8');

console.log('Fluxo universal aplicado com sucesso.');