const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let text = fs.readFileSync(path, 'utf8');

const oldHelper = `async function esconderSecao(id) {
  /*
    MOBILE: esconder sem recolher preserva a posição real das seções
    inferiores enquanto o Repeater termina de calcular sua altura.
    Isso impede os banners de subirem por cima do botão 3 e da linha
    tracejada quando o HTML da impressora é recolhido.
  */
  try {
    const e = $w(id);
    if (typeof e.hide === "function") {
      await e.hide();
    }
  } catch (_) {}
}`;

const newHelper = `async function esconderSecao(id) {
  /*
    Na abertura da entrega, as seções inferiores precisam ficar realmente
    desligadas enquanto a impressora está visível. Hide sozinho deixa o espaço
    da seção reservado e produz a faixa vazia/branca (e o rodapé preto) antes
    de o Repeater terminar. Recolher aqui remove esse espaço temporariamente.
    Depois que a impressora encerra e o Repeater está pronto,
    liberarSecoesPosRepeater() expande e mostra tudo novamente.
  */
  try {
    const e = $w(id);
    if (typeof e.hide === "function") {
      await e.hide();
    }
    if (typeof e.collapse === "function") {
      await e.collapse();
    }
  } catch (_) {}
}`;

const oldReady = `  try { $w(IDS.repetidor).hide(); } catch (_) {}
  try { $w(SECOES_ENTREGA.banners).hide(); } catch (_) {}
  try { $w(SECOES_ENTREGA.final).hide(); } catch (_) {}
`;

const newReady = `  try { $w(IDS.repetidor).hide(); } catch (_) {}
  try {
    const banners = $w(SECOES_ENTREGA.banners);
    if (typeof banners.hide === "function") banners.hide();
    if (typeof banners.collapse === "function") banners.collapse();
  } catch (_) {}
  try {
    const final = $w(SECOES_ENTREGA.final);
    if (typeof final.hide === "function") final.hide();
    if (typeof final.collapse === "function") final.collapse();
  } catch (_) {}
`;

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

if (count(text, oldHelper) !== 1) {
  throw new Error(`Bloco esconderSecao esperado 1x; encontrado ${count(text, oldHelper)}x`);
}
if (count(text, oldReady) !== 1) {
  throw new Error(`Bloco inicial das seções esperado 1x; encontrado ${count(text, oldReady)}x`);
}

text = text.replace(oldHelper, newHelper).replace(oldReady, newReady);
fs.writeFileSync(path, text, 'utf8');

console.log('OK: seções 2 e 3 ficam ocultas e recolhidas durante a impressora.');
console.log('OK: a liberação existente continua depois de esconderProcessamento().');
