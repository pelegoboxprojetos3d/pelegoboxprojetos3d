const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = code.indexOf(startMarker);
  const end = code.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`${label}: trecho não encontrado`);
  }
  code = code.slice(0, start) + replacement + code.slice(end);
}

replaceBetween(
  "async function ocultarDadosAteCarregamento() {",
  "async function mostrarDadosCarregados() {",
  `async function ocultarDadosAteCarregamento() {\n  /*\n    O conteúdo real vive dentro do Repeater.\n    Não esconder/recolher filhos por $w aqui: isso altera o item-modelo e pode\n    impedir que imagem, título e botões voltem corretamente, sobretudo no mobile.\n    O Repeater inteiro é escondido por prepararRepeaterParaCarregamento().\n  */\n  return Promise.resolve();\n}\n\n`,
  "estado inicial do repeater"
);

const oldWait = `  repetidor.data = itens;\n  await esperar(120);\n  await esconderProcessamento();`;
const newWait = `  repetidor.data = itens;\n\n  /*\n    Dá um pequeno intervalo para onItemReady montar título, imagem e botões\n    enquanto o Repeater ainda está oculto. A impressora continua respeitando\n    seu mínimo de 5 segundos em esconderProcessamento().\n  */\n  await esperar(300);\n  await esconderProcessamento();`;
if (!code.includes(oldWait)) {
  throw new Error("tempo de preparação do repeater não encontrado");
}
code = code.replace(oldWait, newWait);

const oldShowBlock = `  await Promise.allSettled([\n    mostrarItem($item, IDS.medidas),\n    mostrarItem($item, IDS.valorMedidas),\n    mostrarItem($item, IDS.graficos),\n    mostrarItem($item, IDS.valorGraficos),\n    mostrarItem($item, IDS.projeto),\n    mostrarItem($item, IDS.valorProjeto),\n    mostrarItem($item, IDS.boxMedidas),\n    mostrarItem($item, IDS.boxGraficos),\n    mostrarItem($item, IDS.boxProjeto),\n    mostrarItem($item, IDS.avisosEtapas),\n    mostrarItem($item, IDS.avisoImportante),\n    mostrarItem($item, \"#box4\")\n  ]);`;
const newShowBlock = `  /* Primeiro prepara e mostra somente os controles principais do projeto. */\n  await Promise.allSettled([\n    mostrarItem($item, IDS.medidas),\n    mostrarItem($item, IDS.valorMedidas),\n    mostrarItem($item, IDS.graficos),\n    mostrarItem($item, IDS.valorGraficos),\n    mostrarItem($item, IDS.projeto),\n    mostrarItem($item, IDS.valorProjeto)\n  ]);`;
if (!code.includes(oldShowBlock)) {
  throw new Error("bloco de exibição de botões/banners não encontrado");
}
code = code.replace(oldShowBlock, newShowBlock);

const anchor = `  if (projetoPago) {\n    await definirComprado($item(IDS.projeto), \"BAIXAR PROJETO COMPLETO\");\n  } else if (graficosPaga) {\n    await definirDisponivel($item(IDS.projeto), \"COMPRAR PROJETO COMPLETO\");\n  } else {\n    await definirBloqueado($item(IDS.projeto), \"COMPRAR PROJETO COMPLETO\");\n  }\n}`;
const replacement = `  if (projetoPago) {\n    await definirComprado($item(IDS.projeto), \"BAIXAR PROJETO COMPLETO\");\n  } else if (graficosPaga) {\n    await definirDisponivel($item(IDS.projeto), \"COMPRAR PROJETO COMPLETO\");\n  } else {\n    await definirBloqueado($item(IDS.projeto), \"COMPRAR PROJETO COMPLETO\");\n  }\n\n  /*\n    Os banners entram por último. Assim nunca aparecem antes da imagem,\n    do título e dos botões principais durante a transição da impressora.\n  */\n  await Promise.allSettled([\n    mostrarItem($item, IDS.boxMedidas),\n    mostrarItem($item, IDS.boxGraficos),\n    mostrarItem($item, IDS.boxProjeto),\n    mostrarItem($item, IDS.avisosEtapas),\n    mostrarItem($item, IDS.avisoImportante),\n    mostrarItem($item, \"#box4\")\n  ]);\n}`;
if (!code.includes(anchor)) {
  throw new Error("final de renderizarBotoesItem não encontrado");
}
code = code.replace(anchor, replacement);

fs.writeFileSync(FILE, code, "utf8");
console.log("Repeater da entrega corrigido: filhos preservados e banners por último.");
