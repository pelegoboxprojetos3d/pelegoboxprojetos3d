const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(FILE, 'utf8');

const MARKER = 'PB_PREFLIGHT_PRESERVA_LAYOUT_V7';

if (code.includes(MARKER)) {
  console.log('Correção já aplicada.');
  process.exit(0);
}

// 1) Helper: esconder sem recolher, preservando a altura da seção.
const anchorHelper = `async function mostrarSecao(id) {\n  try { const e=$w(id); if(typeof e.expand==='function') await e.expand(); if(typeof e.show==='function') await e.show(); } catch (_) {}\n}\n`;

const helperNovo = `${anchorHelper}\nasync function esconderSecaoMantendoEspaco(id) {\n  try {\n    const e = $w(id);\n    if (typeof e.expand === 'function') await e.expand();\n    if (typeof e.hide === 'function') await e.hide();\n  } catch (_) {}\n}\n`;

if (!code.includes(anchorHelper)) {
  throw new Error('Helper mostrarSecao não encontrado.');
}
code = code.replace(anchorHelper, helperNovo);

// 2) Durante processamento, seção 2/3 ficam ocultas, mas sem collapse.
const prepararAntigo = `async function prepararSecoesEntrega() {\n  await esconderSecao(SECOES_ENTREGA.banners);\n  await esconderSecao(SECOES_ENTREGA.final);\n\n  // A área de processamento só é liberada DEPOIS que a rota foi validada.\n  // Isso vale tanto para acesso pelo avatar quanto para link de compra/e-mail.\n  for (const id of [SECOES_ENTREGA.principal, SECOES_ENTREGA.vazia]) {\n    try {\n      const secao = $w(id);\n      if (typeof secao.expand === \"function\") await secao.expand();\n      if (typeof secao.show === \"function\") await secao.show();\n    } catch (_) {}\n  }\n}`;

const prepararNovo = `async function prepararSecoesEntrega() {\n  // ${MARKER}\n  // Banners e aviso ficam invisíveis, mas continuam ocupando espaço.\n  // Assim o rodapé não sobe enquanto a impressora/repeater estão carregando.\n  await esconderSecaoMantendoEspaco(SECOES_ENTREGA.banners);\n  await esconderSecaoMantendoEspaco(SECOES_ENTREGA.final);\n\n  // A seção 1 e o espaçador permanecem abertos.\n  for (const id of [SECOES_ENTREGA.principal, SECOES_ENTREGA.vazia]) {\n    try {\n      const secao = $w(id);\n      if (typeof secao.expand === \"function\") await secao.expand();\n      if (typeof secao.show === \"function\") await secao.show();\n    } catch (_) {}\n  }\n}`;

if (!code.includes(prepararAntigo)) {
  throw new Error('prepararSecoesEntrega esperado não encontrado.');
}
code = code.replace(prepararAntigo, prepararNovo);

// 3) Preflight real: await na seção 1; seções 2/3/4 ocultas sem recolher.
const startBlind = `// PB_ROTEAMENTO_AVATAR_PREFLIGHT_V4\nfunction blindarPreflightEntrega() {`;
const endBlind = `\n  blindarGaleriaPadrao();\n}\n\nfunction blindarAberturaEntrega() {`;
const i1 = code.indexOf(startBlind);
const i2 = code.indexOf(endBlind, i1);
if (i1 < 0 || i2 < 0) throw new Error('Bloco blindarPreflightEntrega não encontrado.');

const blindNovo = `// PB_ROTEAMENTO_AVATAR_PREFLIGHT_V4\nasync function blindarPreflightEntrega() {\n  // ${MARKER}\n  // Regra visual: seção 1 primeiro; seções 2/3/4 ficam escondidas, mas NÃO recolhidas.\n  // Isso preserva o corpo da página e impede o rodapé de saltar para o topo.\n  processamentoVisivelDesde = 0;\n  processamentoVisualEncerrado = false;\n\n  try {\n    const repetidor = $w(IDS.repetidor);\n    repetidor.data = [];\n    if (typeof repetidor.hide === 'function') await repetidor.hide();\n  } catch (_) {}\n\n  try {\n    const processando = $w(IDS.processando);\n    if (typeof processando.hide === 'function') await processando.hide();\n    if (typeof processando.collapse === 'function') await processando.collapse();\n  } catch (_) {}\n\n  // Seção 1 aberta de verdade ANTES de consultar a coleção.\n  try {\n    const principal = $w(SECOES_ENTREGA.principal);\n    if (typeof principal.expand === 'function') await principal.expand();\n    if (typeof principal.show === 'function') await principal.show();\n  } catch (_) {}\n\n  // Seção 2 e demais: invisíveis, porém expandidas para preservar o layout.\n  for (const id of [\n    SECOES_ENTREGA.banners,\n    SECOES_ENTREGA.final,\n    SECOES_ENTREGA.vazia\n  ]) {\n    await esconderSecaoMantendoEspaco(id);\n  }\n\n  blindarGaleriaPadrao();\n}\n\nfunction blindarAberturaEntrega() {`;

code = code.slice(0, i1) + blindNovo + code.slice(i2 + endBlind.length);

// 4) Abertura autorizada: não recolher seção 2/3; só esconder mantendo espaço.
const aberturaAntiga = `  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {\n    try {\n      const secao = $w(id);\n      if (typeof secao.hide === \"function\") secao.hide();\n      if (typeof secao.collapse === \"function\") secao.collapse();\n    } catch (_) {}\n  }`;
const aberturaNova = `  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {\n    esconderSecaoMantendoEspaco(id).catch(() => {});\n  }`;
if (!code.includes(aberturaAntiga)) throw new Error('Trecho de blindarAberturaEntrega não encontrado.');
code = code.replace(aberturaAntiga, aberturaNova);

// 5) O onReady precisa aguardar a seção 1 estar aberta antes de seguir.
const onReadyAntigo = `  // PRIMEIRO PASSO, sem exceção: nada da entrega pode aparecer antes da decisão.\n  blindarPreflightEntrega();`;
const onReadyNovo = `  // PRIMEIRO PASSO: abre a seção 1 e preserva o layout antes de consultar a coleção.\n  await blindarPreflightEntrega();`;
if (!code.includes(onReadyAntigo)) throw new Error('Chamada blindarPreflightEntrega no onReady não encontrada.');
code = code.replace(onReadyAntigo, onReadyNovo);

if (!code.includes(MARKER)) throw new Error('Marcador final não inserido.');
if (!code.includes('await blindarPreflightEntrega();')) throw new Error('onReady não está aguardando o preflight.');
if (!code.includes('await esperar(280);')) throw new Error('Atraso da seção 2 foi removido sem querer.');

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: seção 1 abre primeiro; seção 2 fica oculta sem recolher e entra depois, sem salto do rodapé.');
