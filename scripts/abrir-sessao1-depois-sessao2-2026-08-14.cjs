const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(FILE, 'utf8');

const MARCADOR = 'PB_SESSAO1_ANTES_SESSAO2_V6';

if (code.includes(MARCADOR)) {
  console.log('Sequência visual V6 já aplicada.');
  process.exit(0);
}

const principalAntigo = `  // PB_PREFLIGHT_MANTER_ALTURA_V5
  // A seção principal fica invisível, mas mantém sua altura durante a decisão.
  // Assim o rodapé não sobe para o topo enquanto consultamos a coleção.
  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") principal.expand();
    if (typeof principal.hide === "function") principal.hide();
  } catch (_) {}`;

const principalNovo = `  // PB_SESSAO1_ANTES_SESSAO2_V6
  // Mantém somente a seção 1 aberta durante a decisão.
  // Repeater e impressora continuam escondidos até a regra confirmar o acesso.
  // Assim o rodapé não sobe e a seção 2 não aparece antes da hora.
  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") principal.expand();
    if (typeof principal.show === "function") principal.show();
  } catch (_) {}`;

if (!code.includes(principalAntigo)) {
  throw new Error('Trecho V5 da seção principal não encontrado. Nada foi alterado.');
}
code = code.replace(principalAntigo, principalNovo);

const liberarAntigo = `async function liberarSecoesPosRepeater() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  try {
    const banners = $w(SECOES_ENTREGA.banners);`;

const liberarNovo = `async function liberarSecoesPosRepeater() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  // A seção 1 entra primeiro. A seção 2 chega um instante depois, suavemente.
  await esperar(280);

  try {
    const banners = $w(SECOES_ENTREGA.banners);`;

if (!code.includes(liberarAntigo)) {
  throw new Error('Função liberarSecoesPosRepeater() não encontrada. Nada foi alterado.');
}
code = code.replace(liberarAntigo, liberarNovo);

if (!code.includes(MARCADOR)) {
  throw new Error('Marcador V6 não inserido.');
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: seção 1 abre primeiro; seção 2 permanece escondida e abre 280 ms depois.');
