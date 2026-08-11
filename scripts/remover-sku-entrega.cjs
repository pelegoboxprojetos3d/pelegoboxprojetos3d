const fs = require("fs");

const caminho = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let codigo = fs.readFileSync(caminho, "utf8");
let alterou = false;

function removerTrecho(trecho, descricao) {
  if (!codigo.includes(trecho)) {
    return;
  }

  codigo = codigo.replace(trecho, "");
  alterou = true;
  console.log(`Removido: ${descricao}`);
}

function substituirTrecho(antigo, novo, descricao) {
  if (!codigo.includes(antigo)) {
    return;
  }

  codigo = codigo.replace(antigo, novo);
  alterou = true;
  console.log(`Ajustado: ${descricao}`);
}

removerTrecho(
  `  sku:\n    "#txtSku",\n\n`,
  "ID #txtSku"
);

substituirTrecho(
  "  padrão do Editor (TITULO DO PROJETO, sku, Small Title etc.) nem os\n",
  "  padrão do Editor (TITULO DO PROJETO, Small Title etc.) nem os\n",
  "comentário dos placeholders"
);

removerTrecho(
  `  IDS.sku,\n`,
  "SKU da lista de dados reais"
);

removerTrecho(
  `    $w(IDS.sku).text = "";\n`,
  "limpeza inicial do texto SKU"
);

removerTrecho(
  `  const sku =\n    safe(\n      projeto?.sku\n    ) ||\n    \`PP-${codigoProjeto}\`;\n\n`,
  "montagem do SKU para checkout"
);

removerTrecho(
  `    sku,\n\n`,
  "SKU do objeto de dados do checkout"
);

removerTrecho(
  `    sku:\n      dados.sku,\n\n`,
  "parâmetro SKU da URL do checkout"
);

substituirTrecho(
  "      título, SKU, galeria, botões ou entrega.\n",
  "      título, galeria, botões ou entrega.\n",
  "comentário do botão de vídeo"
);

removerTrecho(
  `  $w(\n    IDS.sku\n  ).text =\n    projeto?.sku\n      ? \`SKU: ${projeto.sku}\`\n      : "";\n\n`,
  "exibição do SKU na página"
);

const referenciasSku = codigo.match(/\bsku\b/gi) || [];

if (referenciasSku.length) {
  throw new Error(
    `Ainda existem ${referenciasSku.length} referência(s) a SKU na página de entrega.`
  );
}

if (alterou) {
  fs.writeFileSync(caminho, codigo, "utf8");
  console.log("SKU removido completamente da página de entrega.");
} else {
  console.log("Página de entrega já está sem SKU.");
}
