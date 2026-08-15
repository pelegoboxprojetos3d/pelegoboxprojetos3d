const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(FILE, 'utf8');

const helper = `
async function esconderSecaoMantendoEspaco(id) {
  try {
    const e = $w(id);
    if (typeof e.expand === 'function') await e.expand();
    if (typeof e.hide === 'function') await e.hide();
  } catch (_) {}
}`;

code = code.replace(helper, '');

const prepararAtual = `async function prepararSecoesEntrega() {
  // PB_PREFLIGHT_PRESERVA_LAYOUT_V7
  // Banners e aviso ficam invisíveis, mas continuam ocupando espaço.
  // Assim o rodapé não sobe enquanto a impressora/repeater estão carregando.
  await esconderSecaoMantendoEspaco(SECOES_ENTREGA.banners);
  await esconderSecaoMantendoEspaco(SECOES_ENTREGA.final);

  // A seção 1 e o espaçador permanecem abertos.
  for (const id of [SECOES_ENTREGA.principal, SECOES_ENTREGA.vazia]) {
    try {
      const secao = $w(id);
      if (typeof secao.expand === "function") await secao.expand();
      if (typeof secao.show === "function") await secao.show();
    } catch (_) {}
  }
}`;

const prepararAnterior = `async function prepararSecoesEntrega() {
  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  // A área de processamento só é liberada DEPOIS que a rota foi validada.
  // Isso vale tanto para acesso pelo avatar quanto para link de compra/e-mail.
  for (const id of [SECOES_ENTREGA.principal, SECOES_ENTREGA.vazia]) {
    try {
      const secao = $w(id);
      if (typeof secao.expand === "function") await secao.expand();
      if (typeof secao.show === "function") await secao.show();
    } catch (_) {}
  }
}`;

if (!code.includes(prepararAtual)) throw new Error('Bloco prepararSecoesEntrega atual não encontrado.');
code = code.replace(prepararAtual, prepararAnterior);

const preflightAtual = `// PB_ROTEAMENTO_AVATAR_PREFLIGHT_V4
async function blindarPreflightEntrega() {
  // PB_PREFLIGHT_PRESERVA_LAYOUT_V7
  // Regra visual: seção 1 primeiro; seções 2/3/4 ficam escondidas, mas NÃO recolhidas.
  // Isso preserva o corpo da página e impede o rodapé de saltar para o topo.
  processamentoVisivelDesde = 0;
  processamentoVisualEncerrado = false;

  try {
    const repetidor = $w(IDS.repetidor);
    repetidor.data = [];
    if (typeof repetidor.hide === 'function') await repetidor.hide();
  } catch (_) {}

  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === 'function') await processando.hide();
    if (typeof processando.collapse === 'function') await processando.collapse();
  } catch (_) {}

  // Seção 1 aberta de verdade ANTES de consultar a coleção.
  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === 'function') await principal.expand();
    if (typeof principal.show === 'function') await principal.show();
  } catch (_) {}

  // Seção 2 e demais: invisíveis, porém expandidas para preservar o layout.
  for (const id of [
    SECOES_ENTREGA.banners,
    SECOES_ENTREGA.final,
    SECOES_ENTREGA.vazia
  ]) {
    await esconderSecaoMantendoEspaco(id);
  }

  blindarGaleriaPadrao();
}`;

const preflightAnterior = `// PB_ROTEAMENTO_AVATAR_PREFLIGHT_V4
function blindarPreflightEntrega() {
  /*
    REGRA DE ROTEAMENTO:
    - Avatar sem parâmetros: consulta primeiro a coleção do membro.
    - Link de compra/e-mail: valida primeiro login e titularidade.
    Enquanto essa decisão não terminou, a página de entrega fica 100% fechada.
  */
  processamentoVisivelDesde = 0;
  processamentoVisualEncerrado = false;

  try {
    const repetidor = $w(IDS.repetidor);
    repetidor.data = [];
    if (typeof repetidor.hide === "function") repetidor.hide();
  } catch (_) {}

  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}

  // PB_SESSAO1_ANTES_SESSAO2_V6
  // Mantém somente a seção 1 aberta durante a decisão.
  // Repeater e impressora continuam escondidos até a regra confirmar o acesso.
  // Assim o rodapé não sobe e a seção 2 não aparece antes da hora.
  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") principal.expand();
    if (typeof principal.show === "function") principal.show();
  } catch (_) {}

  // As seções inferiores continuam totalmente recolhidas.
  for (const id of [
    SECOES_ENTREGA.banners,
    SECOES_ENTREGA.final,
    SECOES_ENTREGA.vazia
  ]) {
    try {
      const secao = $w(id);
      if (typeof secao.hide === "function") secao.hide();
      if (typeof secao.collapse === "function") secao.collapse();
    } catch (_) {}
  }

  blindarGaleriaPadrao();
}`;

if (!code.includes(preflightAtual)) throw new Error('Bloco blindarPreflightEntrega atual não encontrado.');
code = code.replace(preflightAtual, preflightAnterior);

const aberturaAtual = `  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {
    esconderSecaoMantendoEspaco(id).catch(() => {});
  }`;

const aberturaAnterior = `  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {
    try {
      const secao = $w(id);
      if (typeof secao.hide === "function") secao.hide();
      if (typeof secao.collapse === "function") secao.collapse();
    } catch (_) {}
  }`;

if (!code.includes(aberturaAtual)) throw new Error('Bloco blindarAberturaEntrega atual não encontrado.');
code = code.replace(aberturaAtual, aberturaAnterior);

const readyAtual = `  // PRIMEIRO PASSO: abre a seção 1 e preserva o layout antes de consultar a coleção.
  await blindarPreflightEntrega();`;
const readyAnterior = `  // PRIMEIRO PASSO, sem exceção: nada da entrega pode aparecer antes da decisão.
  blindarPreflightEntrega();`;

if (!code.includes(readyAtual)) throw new Error('Trecho onReady atual não encontrado.');
code = code.replace(readyAtual, readyAnterior);

if (code.includes('PB_PREFLIGHT_PRESERVA_LAYOUT_V7')) {
  throw new Error('Rollback incompleto: marcador V7 ainda presente.');
}
if (code.includes('esconderSecaoMantendoEspaco')) {
  throw new Error('Rollback incompleto: helper ainda presente.');
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: rollback visual aplicado; página voltou ao estado anterior ao V7.');
