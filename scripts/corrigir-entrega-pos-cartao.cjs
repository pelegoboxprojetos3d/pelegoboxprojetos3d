const fs = require('fs');

const pagePath = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
const backendPath = 'src/backend/entregaProjetosProntos.jsw';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) {
    if (text.includes(to)) return text;
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(
  /(const\s+MIN_PROCESSAMENTO_VISIVEL\s*=\s*)\d+(\s*;)/,
  '$1500$2'
);
if (!/const\s+MIN_PROCESSAMENTO_VISIVEL\s*=\s*500\s*;/.test(page)) {
  throw new Error('Não foi possível configurar a impressora mínima para 0,5 segundo.');
}
if (!/const\s+MAX_PROCESSAMENTO_VISIVEL\s*=\s*5000\s*;/.test(page)) {
  page = page.replace(
    /const\s+MIN_PROCESSAMENTO_VISIVEL\s*=\s*500\s*;/,
    'const MIN_PROCESSAMENTO_VISIVEL =\n  500;\n\nconst MAX_PROCESSAMENTO_VISIVEL =\n  5000;'
  );
}
fs.writeFileSync(pagePath, `${page.trimEnd()}\n`, 'utf8');

let backend = fs.readFileSync(backendPath, 'utf8');

const dbMarker = `const DB_OPTS = {\n  suppressAuth: true\n};`;
const readMarker = `${dbMarker}\n\nconst READ_OPTS = {\n  ...DB_OPTS,\n  consistentRead: true\n};`;
if (!backend.includes('const READ_OPTS = {')) {
  backend = replaceOnce(backend, dbMarker, readMarker, 'READ_OPTS');
}
backend = backend.replace(/\.find\(DB_OPTS\)/g, '.find(READ_OPTS)');

backend = replaceOnce(
  backend,
  `    firstMediaFromPurchases(\n      purchases,\n      "arquivoProjeto",\n      "pdfProjeto"\n    ) ||`,
  `    firstMediaFromPurchases(\n      purchases,\n      "arquivoProjeto",\n      "arquivo_projeto",\n      "pdfProjeto"\n    ) ||`,
  'arquivo_projeto em ComprasProjetos'
);

backend = replaceOnce(
  backend,
  `    mediaSource(\n      project?.arquivoProjeto ||\n      project?.pdfProjeto\n    );`,
  `    mediaSource(\n      project?.arquivoProjeto ||\n      project?.arquivo_projeto ||\n      project?.pdfProjeto\n    );`,
  'arquivo_projeto em Videosprojetos'
);

if (!backend.includes('project?.arquivo_projeto')) {
  throw new Error('Alias arquivo_projeto não foi aplicado.');
}
if (!backend.includes('consistentRead: true')) {
  throw new Error('Leitura consistente não foi aplicada.');
}

fs.writeFileSync(backendPath, `${backend.trimEnd()}\n`, 'utf8');
console.log('Entrega pós-cartão corrigida: arquivo_projeto, leitura consistente e impressora mínima de 0,5s e máxima de 5s.');
