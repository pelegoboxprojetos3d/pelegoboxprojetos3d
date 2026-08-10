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

if (!s.includes('async function mostrarAvisosEntrega()')) {
  const marker = '// ======================================================\n// VISUAL DOS BOTÕES\n// ======================================================';
  const block = `async function mostrarAvisosEntrega() {\n  const ids = [\n    IDS.avisosEtapas,\n    IDS.avisoImportante\n  ];\n\n  for (const id of ids) {\n    try {\n      const elemento = $w(id);\n\n      if (elemento.collapsed) {\n        await elemento.expand();\n      }\n\n      if (elemento.hidden) {\n        await elemento.show();\n      }\n    } catch (erro) {\n      console.warn(\n        \`Não foi possível restaurar a seção de aviso \${id}:\`,\n        erro?.message || erro\n      );\n    }\n  }\n}\n\n\n`;

  assert(s.includes(marker), 'Marcador VISUAL DOS BOTÕES não encontrado.');
  s = s.replace(marker, block + marker);
}

replaceOnce(
  '  await renderizarBotoes();\n\n  await mostrarGaleria();',
  '  await renderizarBotoes();\n\n  await mostrarAvisosEntrega();\n\n  await mostrarGaleria();',
  'Chamada dos avisos na entrega pronta'
);

fs.writeFileSync(path, s, 'utf8');
console.log('Seções de avisos da entrega restauradas.');
