const fs = require('fs');

const checkoutPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const deliveryPath = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1) Marca somente o retorno criado pelo checkout pós-pagamento.
let checkout = read(checkoutPath);

const oldDeliveryUrl = `function urlEntrega() {\n  return (\n    \"/entregaprojetosprontos\" +\n    \`?checkout_id=\${encodeURIComponent(checkoutId)}\`\n  );\n}`;

const newDeliveryUrl = `function urlEntrega() {\n  return (\n    \"/entregaprojetosprontos\" +\n    \`?checkout_id=\${encodeURIComponent(checkoutId)}\` +\n    \"&pos_pagamento=1\"\n  );\n}`;

if (!checkout.includes(newDeliveryUrl)) {
  assert(
    checkout.includes(oldDeliveryUrl),
    'CHECKOUT: função urlEntrega não encontrada no formato esperado.'
  );
  checkout = checkout.replace(oldDeliveryUrl, newDeliveryUrl);
}

write(checkoutPath, checkout);

// 2) Na entrega, a impressora aparece imediatamente apenas quando
// o link veio do checkout após aprovação do PIX.
let delivery = read(deliveryPath);

// Remove chamadas duplicadas acumuladas por hotfixes anteriores.
delivery = delivery.replace(
  /(\n\s*await mostrarProcessamento\(\);){2,}/g,
  '\n\n        await mostrarProcessamento();'
);

const oldReady = `    await esconderProcessamento();\n\n    await carregarEntrega();`;

const newReady = `    const retornoPosPagamento =\n      safe(\n        wixLocation.query?.pos_pagamento\n      ) === \"1\";\n\n    if (retornoPosPagamento) {\n      /*\n        O PIX já foi aprovado no checkout.\n        Mostra a impressora imediatamente, sem tela branca,\n        enquanto o backend/Make termina a entrega.\n      */\n      await mostrarProcessamento();\n    } else {\n      /*\n        Link antigo de e-mail ou acesso direto: não pisca a\n        impressora. A galeria abre quando a entrega pronta for lida.\n      */\n      await esconderProcessamento();\n    }\n\n    await carregarEntrega();`;

if (!delivery.includes(newReady)) {
  assert(
    delivery.includes(oldReady),
    'ENTREGA: inicialização do processamento não encontrada.'
  );
  delivery = delivery.replace(oldReady, newReady);
}

write(deliveryPath, delivery);
console.log('Impressora pós-pagamento corrigida: imediata após PIX, sem piscar em links antigos.');
