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

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
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

  const startMarker = 'function tipoDaSecaoInformativa(contextoAtual) {';
  const endMarker = '$w.onReady(function () {';

  const block = `function acessosLocaisDoCheckout(contextoAtual = {}) {\n  const codigo = digits(contextoAtual.codigoProjeto);\n\n  if (!codigo) {\n    return acessoVazio();\n  }\n\n  try {\n    const raw = local.getItem(\`pp_acessos_\${codigo}\`);\n    const data = raw ? JSON.parse(raw) : {};\n\n    return {\n      medidas: data.medidas === true,\n      graficos: data.graficos === true,\n      projeto: data.projeto === true\n    };\n  } catch (_) {\n    return acessoVazio();\n  }\n}\n\nasync function mostrarSecaoEtapa(seletor, mostrar) {\n  try {\n    const elemento = $w(seletor);\n\n    if (mostrar) {\n      await Promise.allSettled([\n        typeof elemento.expand === \"function\" ? elemento.expand() : Promise.resolve(),\n        typeof elemento.show === \"function\" ? elemento.show() : Promise.resolve()\n      ]);\n    } else {\n      await Promise.allSettled([\n        typeof elemento.hide === \"function\" ? elemento.hide() : Promise.resolve(),\n        typeof elemento.collapse === \"function\" ? elemento.collapse() : Promise.resolve()\n      ]);\n    }\n  } catch (error) {\n    console.warn(\n      \`Falha ao alternar aviso \${seletor}:\`,\n      error?.message || error\n    );\n  }\n}\n\nfunction pintarAvisoEtapa(seletor, pago) {\n  try {\n    const elemento = $w(seletor);\n\n    if (elemento?.style) {\n      elemento.style.backgroundColor = pago\n        ? \"#E8F5ED\"\n        : \"#FFFFFF\";\n\n      if (pago) {\n        elemento.style.borderColor = \"#159447\";\n        elemento.style.borderWidth = \"2px\";\n      }\n    }\n  } catch (_) {}\n}\n\nasync function configurarSecoesInformativas(\n  contextoAtual,\n  acessosInformados = null\n) {\n  const access =\n    acessosInformados ||\n    acessosLocaisDoCheckout(contextoAtual);\n\n  const mobile =\n    wixWindowFrontend.formFactor === \"Mobile\";\n\n  const secoes = [\n    { seletor: \"#botao1baixarmedidas\", pago: access.medidas === true },\n    { seletor: \"#botao2baixargraficos\", pago: access.graficos === true },\n    { seletor: \"#botao3projetocompleto\", pago: access.projeto === true }\n  ];\n\n  for (const etapa of secoes) {\n    pintarAvisoEtapa(etapa.seletor, etapa.pago);\n\n    /*\n      Desktop: todos os avisos ficam visíveis; os pagos ficam verdes.\n      Mobile: avisos pagos desaparecem; faltantes continuam visíveis.\n    */\n    await mostrarSecaoEtapa(\n      etapa.seletor,\n      mobile ? !etapa.pago : true\n    );\n  }\n\n  /* IMPORTANTE aparece sempre. */\n  await mostrarSecaoEtapa(\"#textoimportante\", true);\n}\n\n`;

  s = replaceBlock(
    s,
    startMarker,
    endMarker,
    block,
    'CHECKOUT: regra dos avisos'
  );

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

  const block = `async function forcarElementoVisivel(id) {\n  try {\n    const elemento = $w(id);\n\n    if (typeof elemento.expand === \"function\") {\n      await elemento.expand();\n    }\n\n    if (typeof elemento.show === \"function\") {\n      await elemento.show();\n    }\n  } catch (erro) {\n    console.warn(\n      \`Elemento de aviso não encontrado \${id}:\`,\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderElementoAviso(id) {\n  try {\n    const elemento = $w(id);\n\n    if (typeof elemento.hide === \"function\") {\n      await elemento.hide();\n    }\n\n    if (typeof elemento.collapse === \"function\") {\n      await elemento.collapse();\n    }\n  } catch (erro) {\n    console.warn(\n      \`Não foi possível esconder o aviso \${id}:\`,\n      erro?.message || erro\n    );\n  }\n}\n\nfunction pintarBoxEtapa(id, pago) {\n  try {\n    const box = $w(id);\n    box.style.backgroundColor = pago ? \"#E8F5ED\" : \"#FFFFFF\";\n    box.style.borderColor = pago ? CORES.compradoBorda : \"#E0E0E0\";\n    box.style.borderWidth = pago ? \"2px\" : \"1px\";\n  } catch (_) {}\n}\n\nasync function mostrarAvisosEntrega() {\n  const acessos = entrega?.access || {};\n  const mobile = wixWindowFrontend.formFactor === \"Mobile\";\n\n  const etapas = [\n    { id: IDS.boxMedidas, pago: acessos.medidas === true },\n    { id: IDS.boxGraficos, pago: acessos.graficos === true },\n    { id: IDS.boxProjeto, pago: acessos.projeto === true }\n  ];\n\n  await forcarElementoVisivel(IDS.avisosEtapas);\n\n  for (const etapa of etapas) {\n    pintarBoxEtapa(etapa.id, etapa.pago);\n\n    if (mobile && etapa.pago) {\n      await esconderElementoAviso(etapa.id);\n    } else {\n      await forcarElementoVisivel(etapa.id);\n    }\n  }\n\n  /* IMPORTANTE aparece sempre, em qualquer dispositivo. */\n  await forcarElementoVisivel(IDS.avisoImportante);\n  await forcarElementoVisivel(\"#box4\");\n}\n\n\n`;

  s = replaceBlock(
    s,
    startMarker,
    endMarker,
    block,
    'ENTREGA: regra dos avisos'
  );

  /*\n    Botão verde somente quando a etapa realmente consta como paga\n    tanto em access quanto em stages. Isso evita estado verde precoce.\n  */
  s = s.replace(
    `  if (acessos.medidas) {\n    marcarBoxComprado(IDS.boxMedidas);\n  }\n\n  if (acessos.graficos) {\n    marcarBoxComprado(IDS.boxGraficos);\n  }\n\n  if (acessos.projeto) {\n    marcarBoxComprado(IDS.boxProjeto);\n  }`,
    `  const medidasPaga =\n    acessos.medidas === true &&\n    etapas.medidas?.pago === true;\n\n  const graficosPaga =\n    acessos.graficos === true &&\n    etapas.graficos?.pago === true;\n\n  const projetoPago =\n    acessos.projeto === true &&\n    etapas.projeto?.pago === true;\n\n  pintarBoxEtapa(IDS.boxMedidas, medidasPaga);\n  pintarBoxEtapa(IDS.boxGraficos, graficosPaga);\n  pintarBoxEtapa(IDS.boxProjeto, projetoPago);`
  );

  s = s.replace(/acessos\.medidas\n\s*\?/g, 'medidasPaga\n      ?');
  s = s.replace(/acessos\.graficos\n\s*\?/g, 'graficosPaga\n      ?');
  s = s.replace(/acessos\.projeto\n\s*\?/g, 'projetoPago\n      ?');

  s = s.replace(/if \(\n\s*acessos\.medidas\n\s*\)/g, 'if (\n    medidasPaga\n  )');
  s = s.replace(/if \(\n\s*acessos\.graficos\n\s*\)/g, 'if (\n    graficosPaga\n  )');
  s = s.replace(/if \(\n\s*acessos\.projeto\n\s*\)/g, 'if (\n    projetoPago\n  )');

  /* Disponibilidade continua sequencial, mas nunca pinta como pago. */
  s = s.replace(
    `  } else if (\n    acessos.medidas\n  ) {`,
    `  } else if (\n    medidasPaga\n  ) {`
  );
  s = s.replace(
    `  } else if (\n    acessos.graficos\n  ) {`,
    `  } else if (\n    graficosPaga\n  ) {`
  );

  write(path, s);
}

patchCheckout();
patchDelivery();
console.log('Regra visual unificada: desktop mantém histórico; mobile esconde pagos; verde somente após pagamento.');
