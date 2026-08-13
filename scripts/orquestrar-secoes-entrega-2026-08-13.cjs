const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
}

// 1) IDs das seções reais do Editor. A principal nunca é colapsada pelo código.
replaceOnce(
  'const CORES = {',
  `const SECOES_ENTREGA = {\n  principal: "#imagensdoprodutobotao1e2",\n  banners: "#textodobotaobaixaranalisegrafica",\n  final: "#section2"\n};\n\nconst CORES = {`,
  'Inserir IDs das seções'
);

// 2) Estado de renderização real do repeater.
replaceOnce(
  'const indiceImagemPorProjeto =\n  new Map();',
  `const indiceImagemPorProjeto =\n  new Map();\n\nlet cicloRepeater = null;\n\nfunction iniciarCicloRepeater(total) {\n  let resolver;\n  const pronto = new Promise((resolve) => { resolver = resolve; });\n  cicloRepeater = {\n    total: Math.max(0, Number(total) || 0),\n    prontos: 0,\n    resolver,\n    pronto\n  };\n\n  if (cicloRepeater.total === 0) resolver();\n  return pronto;\n}\n\nfunction marcarItemRepeaterPronto() {\n  if (!cicloRepeater) return;\n  cicloRepeater.prontos += 1;\n  if (cicloRepeater.prontos >= cicloRepeater.total) {\n    cicloRepeater.resolver();\n  }\n}\n\nasync function aguardarRepeaterPronto(timeoutMs = 5000) {\n  const ciclo = cicloRepeater;\n  if (!ciclo) return;\n  await Promise.race([\n    ciclo.pronto,\n    esperar(timeoutMs)\n  ]);\n}`,
  'Inserir ciclo do repeater'
);

// 3) Helpers de seção. Não mexem em altura/estilo. Só visibilidade das duas seções posteriores.
replaceOnce(
  'function dinheiro(\n  valor\n) {',
  `async function esconderSecao(id) {\n  try {\n    const secao = $w(id);\n    if (typeof secao.hide === "function") await secao.hide();\n    if (typeof secao.collapse === "function") await secao.collapse();\n  } catch (erro) {\n    console.warn(\n      \`Seção de entrega não encontrada para ocultar: \${id}\`,\n      erro?.message || erro\n    );\n  }\n}\n\nasync function mostrarSecao(id) {\n  try {\n    const secao = $w(id);\n    if (typeof secao.expand === "function") await secao.expand();\n    if (typeof secao.show === "function") await secao.show();\n  } catch (erro) {\n    console.warn(\n      \`Seção de entrega não encontrada para mostrar: \${id}\`,\n      erro?.message || erro\n    );\n  }\n}\n\nasync function prepararSecoesEntrega() {\n  /* A seção principal fica exatamente com o tamanho definido no Editor. */\n  try {\n    const principal = $w(SECOES_ENTREGA.principal);\n    if (typeof principal.show === "function") await principal.show();\n  } catch (_) {}\n\n  await esconderSecao(SECOES_ENTREGA.banners);\n  await esconderSecao(SECOES_ENTREGA.final);\n}\n\nasync function liberarSecoesPosRepeater() {\n  await mostrarSecao(SECOES_ENTREGA.banners);\n  await esperar(120);\n  await mostrarSecao(SECOES_ENTREGA.final);\n}\n\nfunction dinheiro(\n  valor\n) {`,
  'Inserir helpers das seções'
);

// 4) Não colapsar o repeater: o Editor continua mandando no tamanho da seção principal.
code = code.replace(
  `\n    if (typeof repetidor.collapse === "function") {\n      await repetidor.collapse();\n    }`,
  ''
);

// 5) Marcar renderização concluída de cada item.
replaceOnce(
  `  repetidor.onItemReady(($item, itemData) => {\n    renderizarItemRepeater($item, itemData).catch((erro) => {\n      console.error(\n        "Falha ao renderizar projeto no repeater:",\n        erro?.message || erro\n      );\n    });\n  });`,
  `  repetidor.onItemReady(($item, itemData) => {\n    renderizarItemRepeater($item, itemData)\n      .catch((erro) => {\n        console.error(\n          "Falha ao renderizar projeto no repeater:",\n          erro?.message || erro\n        );\n      })\n      .finally(() => {\n        marcarItemRepeaterPronto();\n      });\n  });`,
  'Sinalizar item pronto'
);

// 6) Ordem profissional: dados montam escondidos -> espera item pronto -> respeita mínimo da impressora -> mostra repeater -> libera seções.
const oldMostrar = `async function mostrarDadosRepeater(itens) {\n  const repetidor = $w(IDS.repetidor);\n\n  /*\n    ORQUESTRAÇÃO DA ENTREGA:\n    1. os dados entram no Repeater ainda escondido;\n    2. onItemReady tem um instante para montar imagem, título e botões;\n    3. a impressora cumpre o tempo mínimo real;\n    4. só então o conteúdo pronto aparece de uma vez.\n  */\n  repetidor.data = itens;\n  await esperar(120);\n  await esconderProcessamento();\n\n  if (typeof repetidor.expand === "function") {\n    await repetidor.expand();\n  }\n  if (typeof repetidor.show === "function") {\n    await repetidor.show();\n  }\n}`;

const newMostrar = `async function mostrarDadosRepeater(itens) {\n  const repetidor = $w(IDS.repetidor);\n  const dados = Array.isArray(itens) ? itens : [];\n\n  /*\n    ORDEM FINAL DA ENTREGA:\n    1. impressora domina a seção principal;\n    2. repeater recebe os dados ainda oculto;\n    3. espera o onItemReady terminar imagem, título, descrição e botões;\n    4. a impressora respeita 5 s mínimos e também espera o Make quando necessário;\n    5. repeater aparece completo;\n    6. somente depois entram as duas seções de banners.\n  */\n  iniciarCicloRepeater(dados.length);\n  repetidor.data = dados;\n  await aguardarRepeaterPronto(5000);\n  await esconderProcessamento();\n\n  if (typeof repetidor.show === "function") {\n    await repetidor.show();\n  }\n\n  await esperar(100);\n  await liberarSecoesPosRepeater();\n}`;

replaceOnce(oldMostrar, newMostrar, 'Reescrever mostrarDadosRepeater');

// 7) No primeiro frame, ocultar as duas seções posteriores antes de qualquer busca.
replaceOnce(
  `  /*\n    Primeiro frame controlado: nada de título, botão, box ou imagem padrão\n    vazando antes da hora. A impressora é o único conteúdo dinâmico inicial.\n  */\n  await ocultarDadosAteCarregamento();\n  blindarGaleriaPadrao();\n  await prepararRepeaterParaCarregamento();`,
  `  /*\n    Primeiro frame controlado: a seção principal mantém o tamanho do Editor.\n    As duas seções posteriores ficam recolhidas até o repeater estar pronto.\n  */\n  await prepararSecoesEntrega();\n  await ocultarDadosAteCarregamento();\n  blindarGaleriaPadrao();\n  await prepararRepeaterParaCarregamento();`,
  'Preparar seções no onReady'
);

fs.writeFileSync(FILE, code, 'utf8');
console.log('Orquestração por seções aplicada sem alterar tamanhos do Editor.');
