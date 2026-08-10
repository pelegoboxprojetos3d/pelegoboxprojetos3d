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

replaceOnce(
  '  processando:\n    "#htmlProcessandoEntrega",\n',
  '  processando:\n    "#htmlProcessandoEntrega",\n\n  avisosEtapas:\n    "#textodobotaobaixaranalisegrafica",\n\n  avisoImportante:\n    "#action2",\n',
  'IDS das seções de avisos'
);

const inicioAvisos = s.indexOf('async function mostrarAvisosEntrega() {');
const marcadorVisual = '// ======================================================\n// VISUAL DOS BOTÕES\n// ======================================================';
const fimAvisos = s.indexOf(marcadorVisual, inicioAvisos);

assert(inicioAvisos >= 0, 'Função mostrarAvisosEntrega não encontrada.');
assert(fimAvisos > inicioAvisos, 'Fim da função mostrarAvisosEntrega não encontrado.');

const novaFuncao = `async function forcarElementoVisivel(id) {\n  let elemento;\n\n  try {\n    elemento = $w(id);\n  } catch (erro) {\n    console.warn(\n      \`Elemento de aviso não encontrado \${id}:\`,\n      erro?.message || erro\n    );\n    return;\n  }\n\n  /*\n    Um filho pode estar com hidden/collapsed = false e ainda\n    assim não aparecer porque um ancestral está escondido ou\n    recolhido. Por isso a cadeia inteira é reaberta.\n  */\n  const cadeia = [];\n  let atual = elemento;\n\n  for (let nivel = 0; nivel < 6 && atual; nivel += 1) {\n    cadeia.unshift(atual);\n\n    try {\n      atual = atual.parent || null;\n    } catch (_) {\n      atual = null;\n    }\n  }\n\n  for (const item of cadeia) {\n    try {\n      if (typeof item.expand === \"function\") {\n        await item.expand();\n      }\n    } catch (_) {}\n\n    try {\n      if (typeof item.show === \"function\") {\n        await item.show();\n      }\n    } catch (_) {}\n  }\n}\n\nasync function mostrarAvisosEntrega() {\n  const ids = [\n    IDS.avisosEtapas,\n    IDS.boxMedidas,\n    IDS.boxGraficos,\n    IDS.boxProjeto,\n    IDS.avisoImportante,\n    \"#box4\"\n  ];\n\n  for (const id of ids) {\n    await forcarElementoVisivel(id);\n  }\n\n  /*\n    A Pro Gallery recalcula o layout ao expandir.\n    Repetimos uma vez depois desse reflow para impedir que\n    o estado visual antigo seja reaplicado pelo Wix.\n  */\n  await esperar(180);\n\n  for (const id of ids) {\n    await forcarElementoVisivel(id);\n  }\n}\n\n\n`;

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
console.log('Avisos da entrega forçados após estabilização da galeria.');
