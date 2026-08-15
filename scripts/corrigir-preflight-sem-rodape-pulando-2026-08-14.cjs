const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(FILE, 'utf8');

const MARCADOR = 'PB_PREFLIGHT_MANTER_ALTURA_V5';

if (code.includes(MARCADOR)) {
  console.log('Correção visual V5 já aplicada.');
  process.exit(0);
}

const antigo = `  for (const id of [
    SECOES_ENTREGA.principal,
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

  blindarGaleriaPadrao();`;

const novo = `  // PB_PREFLIGHT_MANTER_ALTURA_V5
  // A seção principal fica invisível, mas mantém sua altura durante a decisão.
  // Assim o rodapé não sobe para o topo enquanto consultamos a coleção.
  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") principal.expand();
    if (typeof principal.hide === "function") principal.hide();
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

  blindarGaleriaPadrao();`;

if (!code.includes(antigo)) {
  throw new Error('Trecho do preflight V4 não encontrado. Nada foi alterado.');
}

code = code.replace(antigo, novo);

if (!code.includes(MARCADOR)) {
  throw new Error('Marcador V5 não inserido.');
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: seção principal mantém altura invisível durante o preflight; rodapé não salta para o topo.');
