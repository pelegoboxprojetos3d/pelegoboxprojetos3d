const fs = require('fs');

function replaceOnce(text, regex, replacement, label) {
  let count = 0;
  const next = text.replace(regex, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 bloco, encontrado ${count}`);
  }
  return next;
}

const mainPath = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
let main = fs.readFileSync(mainPath, 'utf8');
main = replaceOnce(
  main,
  /async function aplicarRegraVisualAvisosPaginaPrincipal\(\) \{[\s\S]*?\n\}\n\nasync function mostrarValoresEAcessos/,
  `async function aplicarRegraVisualAvisosPaginaPrincipal() {\n  const mobile = wixWindowFrontend.formFactor === "Mobile";\n\n  const etapas = [\n    { id: IDS.avisoMedidas, pago: acessos.medidas === true },\n    { id: IDS.avisoGraficos, pago: acessos.graficos === true },\n    { id: IDS.avisoProjeto, pago: acessos.projeto === true }\n  ];\n\n  for (const etapa of etapas) {\n    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);\n\n    /*\n      REGRA DA PÁGINA /checkoutprojetosprontos:\n      - Desktop: os três banners aparecem sempre.\n      - Desktop: pago recebe borda verde; a sombra configurada no Editor é preservada.\n      - Mobile: o banner referente à etapa paga some e recolhe o espaço.\n      - Estado vem de acessos + IDs dos banners, nunca de sessão visual.\n    */\n    await alternarAvisoPaginaPrincipal(\n      etapa.id,\n      mobile ? !etapa.pago : true\n    );\n  }\n}\n\nasync function mostrarValoresEAcessos`,
  'regra visual checkout projetos prontos'
);
fs.writeFileSync(mainPath, main);

const entregaPath = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let entrega = fs.readFileSync(entregaPath, 'utf8');

entrega = replaceOnce(
  entrega,
  /async function mostrarProcessamento\(\) \{[\s\S]*?\n\}\n\nasync function esconderProcessamento/,
  `async function mostrarProcessamento() {\n  /*\n    A impressora fica visível enquanto o Make ainda prepara a imagem.\n    Não escondemos nem recolhemos a galeria por código: quando o arquivo\n    chegar à coleção, mostrarGaleria() preenche e exibe a galeria.\n  */\n  try {\n    await $w(IDS.processando).expand();\n    await $w(IDS.processando).show();\n  } catch (erro) {\n    console.warn(\n      "Falha ao mostrar o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderProcessamento`,
  'impressora sem recolher galeria'
);

entrega = replaceOnce(
  entrega,
  /function pintarBoxEtapa\(id, pago\) \{[\s\S]*?\n\}\n\nasync function mostrarAvisosEntrega\(\) \{[\s\S]*?\n\}\n\n\n\/\/ ======================================================\n\/\/ VISUAL DOS BOTÕES/,
  `function pintarBoxEtapa(id, pago) {\n  try {\n    const box = $w(id);\n\n    /*\n      Na entrega desktop todos os banners continuam brancos.\n      Etapa paga recebe borda verde e mantém a sombra configurada no Editor.\n    */\n    box.style.backgroundColor = "#FFFFFF";\n    box.style.borderColor = pago ? CORES.compradoBorda : "#E0E0E0";\n    box.style.borderWidth = pago ? "2px" : "1px";\n  } catch (_) {}\n}\n\nasync function mostrarAvisosEntrega() {\n  const acessos = entrega?.access || {};\n  const mobile = wixWindowFrontend.formFactor === "Mobile";\n\n  const etapas = [\n    { id: IDS.boxMedidas, pago: acessos.medidas === true },\n    { id: IDS.boxGraficos, pago: acessos.graficos === true },\n    { id: IDS.boxProjeto, pago: acessos.projeto === true }\n  ];\n\n  await forcarElementoVisivel(IDS.avisosEtapas);\n\n  for (const etapa of etapas) {\n    pintarBoxEtapa(etapa.id, etapa.pago);\n\n    /*\n      REGRA DA ENTREGA:\n      - Desktop: todos os banners aparecem; pago fica com borda verde.\n      - Mobile: o banner referente à etapa paga some e recolhe espaço.\n      - Visibilidade é aplicada diretamente pelos IDs dos boxes.\n    */\n    if (mobile && etapa.pago) {\n      await esconderElementoAviso(etapa.id);\n    } else {\n      await forcarElementoVisivel(etapa.id);\n    }\n  }\n\n  /* IMPORTANTE aparece sempre, em qualquer dispositivo. */\n  await forcarElementoVisivel(IDS.avisoImportante);\n  await forcarElementoVisivel("#box4");\n}\n\n\n// ======================================================\n// VISUAL DOS BOTÕES`,
  'regra visual entrega'
);

entrega = replaceOnce(
  entrega,
  /const medidasPaga =\n    acessos\.medidas === true &&\n    etapas\.medidas\?\.pago === true;\n\n  const graficosPaga =\n    acessos\.graficos === true &&\n    etapas\.graficos\?\.pago === true;\n\n  const projetoPago =\n    acessos\.projeto === true &&\n    etapas\.projeto\?\.pago === true;/,
  `const medidasPaga =\n    acessos.medidas === true;\n\n  const graficosPaga =\n    acessos.graficos === true;\n\n  const projetoPago =\n    acessos.projeto === true;`,
  'estado pago dos botoes entrega'
);

entrega = replaceOnce(
  entrega,
  /\$w\.onReady\([\s\S]*?\n\);\s*$/,
  `$w.onReady(\n  async function () {\n    checkoutEmAndamento =\n      false;\n\n    await esconderBotaoVideo();\n\n    ligarEventos();\n\n    await $w(\n      IDS.medidas\n    ).disable();\n\n    await $w(\n      IDS.graficos\n    ).disable();\n\n    await $w(\n      IDS.projeto\n    ).disable();\n\n    /*\n      A impressora nostálgica começa visível em qualquer entrada válida\n      da página de entrega e permanece até o arquivo aparecer na coleção.\n      A galeria não é escondida nem recolhida por esta rotina.\n      Assim que o Make termina, renderizarEntrega() mostra a imagem e\n      esconderProcessamento() remove a impressora.\n    */\n    await mostrarProcessamento();\n\n    await carregarEntrega();\n  }\n);\n`,
  'onReady entrega'
);

fs.writeFileSync(entregaPath, entrega);

const checkoutPagamentoPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const checkoutPagamento = fs.readFileSync(checkoutPagamentoPath, 'utf8');
if (!checkoutPagamento.includes('await mostrarSecaoEtapa(\n      etapa.seletor,\n      !etapa.pago\n    );')) {
  throw new Error('checkout pagamento perdeu a regra de esconder banner pago');
}

console.log('Regras aplicadas: checkout principal, checkout pagamento validado e entrega corrigida.');
