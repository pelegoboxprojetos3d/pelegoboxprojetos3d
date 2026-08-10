const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let s = fs.readFileSync(path, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(search, replacement, label) {
  if (s.includes(replacement)) return;
  const count = s.split(search).length - 1;
  assert(count === 1, `${label}: esperado 1 trecho, encontrado ${count}.`);
  s = s.replace(search, replacement);
}

if (!s.includes('import wixWindowFrontend from "wix-window-frontend";')) {
  replaceOnce(
    'import wixData from "wix-data";\n',
    'import wixData from "wix-data";\nimport wixWindowFrontend from "wix-window-frontend";\n',
    'import do formFactor'
  );
}

replaceOnce(
  '  processando:\n    "#htmlProcessandoEntrega",\n',
  '  processando:\n    "#htmlProcessandoEntrega",\n\n  avisosEtapas:\n    "#textodobotaobaixaranalisegrafica",\n\n  avisoImportante:\n    "#action2",\n',
  'IDS das seções de avisos'
);

const inicioAvisos = s.indexOf('async function forcarElementoVisivel(id) {');
const marcadorVisual = '// ======================================================\n// VISUAL DOS BOTÕES\n// ======================================================';
const fimAvisos = s.indexOf(marcadorVisual, inicioAvisos);

assert(inicioAvisos >= 0, 'Função de avisos não encontrada.');
assert(fimAvisos > inicioAvisos, 'Fim da função de avisos não encontrado.');

const novaFuncao = `async function forcarElementoVisivel(id) {\n  let elemento;\n\n  try {\n    elemento = $w(id);\n  } catch (erro) {\n    console.warn(\n      \`Elemento de aviso não encontrado \${id}:\`,\n      erro?.message || erro\n    );\n    return;\n  }\n\n  const cadeia = [];\n  let atual = elemento;\n\n  for (let nivel = 0; nivel < 6 && atual; nivel += 1) {\n    cadeia.unshift(atual);\n\n    try {\n      atual = atual.parent || null;\n    } catch (_) {\n      atual = null;\n    }\n  }\n\n  for (const item of cadeia) {\n    try {\n      if (typeof item.expand === \"function\") {\n        await item.expand();\n      }\n    } catch (_) {}\n\n    try {\n      if (typeof item.show === \"function\") {\n        await item.show();\n      }\n    } catch (_) {}\n  }\n}\n\nasync function esconderElementoAviso(id) {\n  try {\n    const elemento = $w(id);\n\n    if (typeof elemento.hide === \"function\") {\n      await elemento.hide();\n    }\n\n    if (typeof elemento.collapse === \"function\") {\n      await elemento.collapse();\n    }\n  } catch (erro) {\n    console.warn(\n      \`Não foi possível esconder o aviso \${id}:\`,\n      erro?.message || erro\n    );\n  }\n}\n\nasync function mostrarAvisosEntrega() {\n  const mobile =\n    wixWindowFrontend.formFactor === \"Mobile\";\n\n  const boxes = [\n    IDS.boxMedidas,\n    IDS.boxGraficos,\n    IDS.boxProjeto\n  ];\n\n  if (mobile) {\n    const acessos =\n      entrega?.access || {};\n\n    let proximoAviso = \"\";\n\n    if (!acessos.medidas) {\n      proximoAviso = IDS.boxMedidas;\n    } else if (!acessos.graficos) {\n      proximoAviso = IDS.boxGraficos;\n    } else if (!acessos.projeto) {\n      proximoAviso = IDS.boxProjeto;\n    }\n\n    for (const id of boxes) {\n      await esconderElementoAviso(id);\n    }\n\n    if (proximoAviso) {\n      await forcarElementoVisivel(IDS.avisosEtapas);\n      await forcarElementoVisivel(proximoAviso);\n    } else {\n      await esconderElementoAviso(IDS.avisosEtapas);\n    }\n\n    /*\n      O aviso IMPORTANTE continua com o comportamento atual.\n      A alteração mobile afeta somente os três cartões das etapas.\n    */\n    await forcarElementoVisivel(IDS.avisoImportante);\n    await forcarElementoVisivel(\"#box4\");\n\n    return;\n  }\n\n  const idsDesktop = [\n    IDS.avisosEtapas,\n    IDS.boxMedidas,\n    IDS.boxGraficos,\n    IDS.boxProjeto,\n    IDS.avisoImportante,\n    \"#box4\"\n  ];\n\n  for (const id of idsDesktop) {\n    await forcarElementoVisivel(id);\n  }\n\n  await esperar(180);\n\n  for (const id of idsDesktop) {\n    await forcarElementoVisivel(id);\n  }\n}\n\n\n`;

s = s.slice(0, inicioAvisos) + novaFuncao + s.slice(fimAvisos);

const ordemAntiga = `  await renderizarBotoes();\n\n  await mostrarAvisosEntrega();\n\n  await mostrarGaleria();\n\n  await esconderProcessamento();`;
const ordemNova = `  await renderizarBotoes();\n\n  await mostrarGaleria();\n\n  await esconderProcessamento();\n\n  await mostrarAvisosEntrega();`;

if (s.includes(ordemAntiga)) {
  s = s.replace(ordemAntiga, ordemNova);
} else {
  assert(
    s.includes(ordemNova),
    'Ordem de renderização da entrega não encontrada.'
  );
}

fs.writeFileSync(path, s, 'utf8');
console.log('Avisos da entrega ajustados: desktop completo e mobile somente próxima etapa.');
