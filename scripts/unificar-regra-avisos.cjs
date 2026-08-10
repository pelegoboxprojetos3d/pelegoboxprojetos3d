const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceBlock(source, startMarkers, endMarker, replacement, label) {
  const markers = Array.isArray(startMarkers) ? startMarkers : [startMarkers];
  let start = -1;

  for (const marker of markers) {
    start = source.indexOf(marker);
    if (start >= 0) break;
  }

  const end = source.indexOf(endMarker, start);
  assert(start >= 0, `${label}: início não encontrado.`);
  assert(end > start, `${label}: fim não encontrado.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function patchCheckout() {
  const path = 'src/pages/checkout-projeto-pronto.i9aj1.js';
  let s = read(path);

  if (!s.includes('import wixWindowFrontend from "wix-window-frontend";')) {
    s = s.replace(
      'import wixLocation from "wix-location";\n',
      'import wixLocation from "wix-location";\nimport wixWindowFrontend from "wix-window-frontend";\n'
    );
  }

  const endMarker = '$w.onReady(function () {';

  const block = `function tipoVisualCheckout(contextoAtual = {}) {\n  const referencia = safe([\n    contextoAtual?.tipoProduto,\n    wixLocation.query?.tipo,\n    wixLocation.query?.tipoProduto,\n    contextoAtual?.produto\n  ].join(\" \"))\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\")\n    .toUpperCase();\n\n  if (referencia.includes(\"GRAFIC\")) {\n    return \"GRAFICOS\";\n  }\n\n  if (\n    referencia.includes(\"PROJETO_COMPLETO\") ||\n    referencia.includes(\"PROJETO COMPLETO\") ||\n    /(^|\\s)COMPLETO($|\\s)/.test(referencia)\n  ) {\n    return \"PROJETO_COMPLETO\";\n  }\n\n  return \"MEDIDAS\";\n}\n\nasync function mostrarSecaoEtapa(seletor, mostrar) {\n  try {\n    const elemento = $w(seletor);\n\n    if (mostrar) {\n      await Promise.allSettled([\n        typeof elemento.expand === \"function\" ? elemento.expand() : Promise.resolve(),\n        typeof elemento.show === \"function\" ? elemento.show() : Promise.resolve()\n      ]);\n    } else {\n      await Promise.allSettled([\n        typeof elemento.hide === \"function\" ? elemento.hide() : Promise.resolve(),\n        typeof elemento.collapse === \"function\" ? elemento.collapse() : Promise.resolve()\n      ]);\n    }\n  } catch (error) {\n    console.warn(\n      \`Falha ao alternar aviso \${seletor}:\`,\n      error?.message || error\n    );\n  }\n}\n\nfunction pintarAvisoEtapa(seletor, pago, etapaAtual) {\n  try {\n    const elemento = $w(seletor);\n\n    if (!elemento?.style) {\n      return;\n    }\n\n    /*\n      Verde de fundo significa SOMENTE pagamento confirmado.\n      A etapa atual, antes do pagamento, recebe no máximo borda verde.\n    */\n    elemento.style.backgroundColor = pago\n      ? \"#E8F5ED\"\n      : \"#FFFFFF\";\n\n    elemento.style.borderColor = (pago || etapaAtual)\n      ? \"#159447\"\n      : \"#E0E0E0\";\n\n    elemento.style.borderWidth = (pago || etapaAtual)\n      ? \"2px\"\n      : \"1px\";\n  } catch (_) {}\n}\n\nasync function configurarSecoesInformativas(\n  contextoAtual,\n  acessosInformados = null\n) {\n  /*\n    Nunca usa pp_acessos local para pintar o checkout.\n    Cache antigo não pode transformar uma compra nova em \"paga\".\n    Antes da confirmação do backend, tudo começa não pago.\n  */\n  const access =\n    acessosInformados &&\n    typeof acessosInformados === \"object\"\n      ? acessosInformados\n      : acessoVazio();\n\n  const mobile =\n    wixWindowFrontend.formFactor === \"Mobile\";\n\n  const tipoAtual =\n    tipoVisualCheckout(contextoAtual);\n\n  const secoes = [\n    { tipo: \"MEDIDAS\", seletor: \"#botao1baixarmedidas\", pago: access.medidas === true },\n    { tipo: \"GRAFICOS\", seletor: \"#botao2baixargraficos\", pago: access.graficos === true },\n    { tipo: \"PROJETO_COMPLETO\", seletor: \"#botao3projetocompleto\", pago: access.projeto === true }\n  ];\n\n  for (const etapa of secoes) {\n    pintarAvisoEtapa(\n      etapa.seletor,\n      etapa.pago,\n      !etapa.pago && etapa.tipo === tipoAtual\n    );\n\n    /*\n      Desktop: os três avisos aparecem sempre.\n      Mobile: só desaparecem as etapas realmente pagas.\n    */\n    await mostrarSecaoEtapa(\n      etapa.seletor,\n      mobile ? !etapa.pago : true\n    );\n  }\n\n  /* IMPORTANTE aparece sempre. */\n  await mostrarSecaoEtapa(\"#textoimportante\", true);\n}\n\n`;

  s = replaceBlock(
    s,
    [
      'function acessosLocaisDoCheckout(contextoAtual = {}) {',
      'function tipoDaSecaoInformativa(contextoAtual) {',
      'function tipoVisualCheckout(contextoAtual = {}) {'
    ],
    endMarker,
    block,
    'CHECKOUT: regra dos avisos'
  );

  /*
    Quando o backend devolver os acessos reais, atualiza os avisos.
    Se essa ligação já existir, não duplica.
  */
  const returnAccess = `    return (\n      result?.ok &&\n      result?.access\n    )\n      ? result.access\n      : acessoVazio();`;

  if (s.includes(returnAccess)) {
    s = s.replace(
      returnAccess,
      `    const access = (\n      result?.ok &&\n      result?.access\n    )\n      ? result.access\n      : acessoVazio();\n\n    configurarSecoesInformativas(\n      contexto,\n      access\n    ).catch(() => {});\n\n    return access;`
    );
  }

  write(path, s);
}

function patchDelivery() {
  const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
  let s = read(path);

  const startMarker = 'async function forcarElementoVisivel(id) {';
  const endMarker = '// ======================================================\n// VISUAL DOS BOTÕES\n// ======================================================';

  const block = `async function forcarElementoVisivel(id) {\n  try {\n    const elemento = $w(id);\n\n    if (typeof elemento.expand === \"function\") {\n      await elemento.expand();\n    }\n\n    if (typeof elemento.show === \"function\") {\n      await elemento.show();\n    }\n  } catch (erro) {\n    console.warn(\n      \`Elemento de aviso não encontrado \${id}:\`,\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderElementoAviso(id) {\n  try {\n    const elemento = $w(id);\n\n    if (typeof elemento.hide === \"function\") {\n      await elemento.hide();\n    }\n\n    if (typeof elemento.collapse === \"function\") {\n      await elemento.collapse();\n    }\n  } catch (erro) {\n    console.warn(\n      \`Não foi possível esconder o aviso \${id}:\`,\n      erro?.message || erro\n    );\n  }\n}\n\nfunction pintarBoxEtapa(id, pago) {\n  try {\n    const box = $w(id);\n    box.style.backgroundColor = pago ? \"#E8F5ED\" : \"#FFFFFF\";\n    box.style.borderColor = pago ? CORES.compradoBorda : \"#E0E0E0\";\n    box.style.borderWidth = pago ? \"2px\" : \"1px\";\n  } catch (_) {}\n}\n\nasync function mostrarAvisosEntrega() {\n  const acessos = entrega?.access || {};\n  const stages = entrega?.stages || {};\n  const mobile = wixWindowFrontend.formFactor === \"Mobile\";\n\n  const etapas = [\n    {\n      id: IDS.boxMedidas,\n      pago: acessos.medidas === true && stages.medidas?.pago === true\n    },\n    {\n      id: IDS.boxGraficos,\n      pago: acessos.graficos === true && stages.graficos?.pago === true\n    },\n    {\n      id: IDS.boxProjeto,\n      pago: acessos.projeto === true && stages.projeto?.pago === true\n    }\n  ];\n\n  await forcarElementoVisivel(IDS.avisosEtapas);\n\n  for (const etapa of etapas) {\n    pintarBoxEtapa(etapa.id, etapa.pago);\n\n    if (mobile && etapa.pago) {\n      await esconderElementoAviso(etapa.id);\n    } else {\n      await forcarElementoVisivel(etapa.id);\n    }\n  }\n\n  /* IMPORTANTE aparece sempre, em qualquer dispositivo. */\n  await forcarElementoVisivel(IDS.avisoImportante);\n  await forcarElementoVisivel(\"#box4\");\n}\n\n\n`;

  s = replaceBlock(
    s,
    startMarker,
    endMarker,
    block,
    'ENTREGA: regra dos avisos'
  );

  /*
    Corrige uma substituição antiga que escapou do renderizarBotoes()
    e atingiu imagensLiberadas(). A galeria deve usar os acessos dela.
  */
  const inicioImagens = s.indexOf('function imagensLiberadas(');
  const fimImagens = s.indexOf('async function mostrarGaleria()', inicioImagens);
  assert(inicioImagens >= 0 && fimImagens > inicioImagens, 'ENTREGA: imagensLiberadas não encontrada.');

  let blocoImagens = s.slice(inicioImagens, fimImagens);
  blocoImagens = blocoImagens.replace(
    '  if (\n    graficosPaga\n  ) {',
    '  if (\n    acessos.graficos\n  ) {'
  );
  s = s.slice(0, inicioImagens) + blocoImagens + s.slice(fimImagens);

  /*
    Verde nos botões/boxes somente quando access E stage confirmam pagamento.
    As substituições ficam restritas a renderizarBotoes().
  */
  const inicioBotoes = s.indexOf('async function renderizarBotoes() {');
  const fimBotoes = s.indexOf('// ======================================================\n// EVENTOS\n// ======================================================', inicioBotoes);
  assert(inicioBotoes >= 0 && fimBotoes > inicioBotoes, 'ENTREGA: renderizarBotoes não encontrado.');

  let botoes = s.slice(inicioBotoes, fimBotoes);

  if (!botoes.includes('const medidasPaga =')) {
    const oldPaidBoxes = `  if (acessos.medidas) {\n    marcarBoxComprado(IDS.boxMedidas);\n  }\n\n  if (acessos.graficos) {\n    marcarBoxComprado(IDS.boxGraficos);\n  }\n\n  if (acessos.projeto) {\n    marcarBoxComprado(IDS.boxProjeto);\n  }`;

    const strictPaid = `  const medidasPaga =\n    acessos.medidas === true &&\n    etapas.medidas?.pago === true;\n\n  const graficosPaga =\n    acessos.graficos === true &&\n    etapas.graficos?.pago === true;\n\n  const projetoPago =\n    acessos.projeto === true &&\n    etapas.projeto?.pago === true;\n\n  pintarBoxEtapa(IDS.boxMedidas, medidasPaga);\n  pintarBoxEtapa(IDS.boxGraficos, graficosPaga);\n  pintarBoxEtapa(IDS.boxProjeto, projetoPago);`;

    assert(botoes.includes(oldPaidBoxes), 'ENTREGA: bloco antigo de pagamento dos botões não encontrado.');
    botoes = botoes.replace(oldPaidBoxes, strictPaid);
  }

  botoes = botoes.replace(/acessos\.medidas\n\s*\?/g, 'medidasPaga\n      ?');
  botoes = botoes.replace(/acessos\.graficos\n\s*\?/g, 'graficosPaga\n      ?');
  botoes = botoes.replace(/acessos\.projeto\n\s*\?/g, 'projetoPago\n      ?');
  botoes = botoes.replace(/if \(\n\s*acessos\.medidas\n\s*\)/g, 'if (\n    medidasPaga\n  )');
  botoes = botoes.replace(/if \(\n\s*acessos\.graficos\n\s*\)/g, 'if (\n    graficosPaga\n  )');
  botoes = botoes.replace(/if \(\n\s*acessos\.projeto\n\s*\)/g, 'if (\n    projetoPago\n  )');

  s = s.slice(0, inicioBotoes) + botoes + s.slice(fimBotoes);

  write(path, s);
}

patchCheckout();
patchDelivery();
console.log('Regra visual corrigida: checkout sem cache local; desktop completo; mobile esconde pagos; verde só após pagamento.');
