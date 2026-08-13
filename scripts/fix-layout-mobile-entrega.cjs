const fs = require('fs');
const file = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let s = fs.readFileSync(file, 'utf8');

function trocar(inicio, fim, novo, nome) {
  const a = s.indexOf(inicio);
  const b = s.indexOf(fim, a + inicio.length);
  if (a < 0 || b < 0) throw new Error(nome + ': trecho nao encontrado');
  s = s.slice(0, a) + novo + '\n\n' + s.slice(b);
}

if (!s.includes('async function aguardarMinimoProcessamentoInicial()')) {
  const marca = 'function entregaProcessada(resultado) {';
  const p = s.indexOf(marca);
  if (p < 0) throw new Error('entregaProcessada nao encontrado');
  const helper = [
    'async function aguardarMinimoProcessamentoInicial() {',
    '  if (!processamentoVisivelDesde) return;',
    '  const minimoVisivel = processamentoEmailPendente ? EMAIL_PROCESSAMENTO_MS : MIN_PROCESSAMENTO_VISIVEL;',
    '  const restante = minimoVisivel - (Date.now() - processamentoVisivelDesde);',
    '  if (restante > 0) await esperar(restante);',
    '}'
  ].join('\n');
  s = s.slice(0, p) + helper + '\n\n' + s.slice(p);
}

const preparar = [
  'async function prepararRepeaterParaCarregamento() {',
  '  try {',
  '    const repetidor = $w(IDS.repetidor);',
  '    repetidor.data = [];',
  '    if (typeof repetidor.show === "function") await repetidor.show();',
  '  } catch (erro) {',
  '    console.warn("Falha ao preparar repeater:", erro?.message || erro);',
  '  }',
  '}'
].join('\n');

trocar('async function prepararRepeaterParaCarregamento() {', 'function configurarRepeater() {', preparar, 'prepararRepeater');

const mostrar = [
  'async function mostrarDadosRepeater(itens) {',
  '  const repetidor = $w(IDS.repetidor);',
  '  const dados = Array.isArray(itens) ? itens : [];',
  '  const mobile = wixWindowFrontend.formFactor === "Mobile";',
  '  await aguardarMinimoProcessamentoInicial();',
  '  iniciarCicloRepeater(dados.length);',
  '  repetidor.data = dados;',
  '  await aguardarRepeaterPronto(5000);',
  '  await esperar(mobile ? 650 : 120);',
  '  await esconderProcessamento();',
  '  await esperar(mobile ? 450 : 120);',
  '  await liberarSecoesPosRepeater();',
  '}'
].join('\n');

trocar('async function mostrarDadosRepeater(itens) {', 'async function carregarDetalhesDaCentral(resumos) {', mostrar, 'mostrarDadosRepeater');

const liberar = [
  'async function liberarSecoesPosRepeater() {',
  '  const mobile = wixWindowFrontend.formFactor === "Mobile";',
  '  await mostrarSecao(SECOES_ENTREGA.banners);',
  '  await esperar(mobile ? 260 : 120);',
  '  await mostrarSecao(SECOES_ENTREGA.final);',
  '}'
].join('\n');

trocar('async function liberarSecoesPosRepeater() {', 'function dinheiro(', liberar, 'liberarSecoes');

fs.writeFileSync(file, s, 'utf8');
console.log('Ajuste mobile aplicado.');
