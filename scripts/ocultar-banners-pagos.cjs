const fs = require('fs');

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 bloco, encontrado ${count}`);
  return text.replace(before, after);
}

const files = {
  principal: 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js',
  checkout: 'src/pages/checkout-projeto-pronto.i9aj1.js',
  entrega: 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js'
};

let principal = fs.readFileSync(files.principal, 'utf8');
principal = replaceOnce(
  principal,
  `async function aplicarRegraVisualAvisosPaginaPrincipal() {\n  const mobile = wixWindowFrontend.formFactor === \"Mobile\";\n\n  const etapas = [`,
  `async function aplicarRegraVisualAvisosPaginaPrincipal() {\n  const etapas = [`,
  'principal: remover regra por dispositivo'
);
principal = replaceOnce(
  principal,
  `    /*\n      REGRA ÚNICA:\n      - Desktop: os três avisos ficam visíveis.\n      - Mobile: aviso de etapa paga some e recolhe espaço.\n      - Mobile: etapas ainda não pagas continuam visíveis.\n      - IMPORTANTE não é tocado por esta função e permanece sempre.\n    */\n    await alternarAvisoPaginaPrincipal(\n      etapa.id,\n      mobile ? !etapa.pago : true\n    );`,
  `    /*\n      REGRA ÚNICA EM QUALQUER DISPOSITIVO:\n      - etapa paga: aviso some e recolhe espaço;\n      - etapa não paga: aviso permanece visível;\n      - IMPORTANTE permanece sempre visível.\n    */\n    await alternarAvisoPaginaPrincipal(\n      etapa.id,\n      !etapa.pago\n    );`,
  'principal: ocultar pago em desktop e mobile'
);
fs.writeFileSync(files.principal, principal, 'utf8');

let checkout = fs.readFileSync(files.checkout, 'utf8');
checkout = replaceOnce(
  checkout,
  `  const mobile =\n    wixWindowFrontend.formFactor === \"Mobile\";\n\n  const tipoAtual =`,
  `  const tipoAtual =`,
  'checkout: remover regra por dispositivo'
);
checkout = replaceOnce(
  checkout,
  `    /*\n      Desktop: os três avisos aparecem sempre.\n      Mobile: só desaparecem as etapas realmente pagas.\n    */\n    await mostrarSecaoEtapa(\n      etapa.seletor,\n      mobile ? !etapa.pago : true\n    );`,
  `    /*\n      REGRA ÚNICA EM DESKTOP E MOBILE:\n      etapa paga desaparece; etapa não paga permanece visível.\n    */\n    await mostrarSecaoEtapa(\n      etapa.seletor,\n      !etapa.pago\n    );`,
  'checkout: ocultar pago em desktop e mobile'
);
fs.writeFileSync(files.checkout, checkout, 'utf8');

let entrega = fs.readFileSync(files.entrega, 'utf8');
entrega = replaceOnce(
  entrega,
  `  const stages = entrega?.stages || {};\n  const mobile = wixWindowFrontend.formFactor === \"Mobile\";\n\n  const etapas = [`,
  `  const stages = entrega?.stages || {};\n\n  const etapas = [`,
  'entrega: remover regra por dispositivo'
);
entrega = replaceOnce(
  entrega,
  `    if (mobile && etapa.pago) {\n      await esconderElementoAviso(etapa.id);\n    } else {\n      await forcarElementoVisivel(etapa.id);\n    }`,
  `    if (etapa.pago) {\n      await esconderElementoAviso(etapa.id);\n    } else {\n      await forcarElementoVisivel(etapa.id);\n    }`,
  'entrega: ocultar pago em desktop e mobile'
);
fs.writeFileSync(files.entrega, entrega, 'utf8');

console.log('Banners pagos ocultos em todas as páginas e dispositivos.');