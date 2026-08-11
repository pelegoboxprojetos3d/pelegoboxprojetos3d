const fs = require("fs");

const caminho = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let codigo = fs.readFileSync(caminho, "utf8");
let alterou = false;

function substituirRegex(regex, novo, descricao) {
  const antes = codigo;
  codigo = codigo.replace(regex, novo);

  if (codigo !== antes) {
    alterou = true;
    console.log(`Ajustado: ${descricao}`);
  }
}

substituirRegex(
  /\n  sku:\n    "#txtSku",\n/,
  "",
  "ID #txtSku"
);

substituirRegex(
  /TITULO DO PROJETO, sku, Small Title etc\./,
  "TITULO DO PROJETO, Small Title etc.",
  "comentário dos placeholders"
);

substituirRegex(
  /\n  IDS\.sku,/,
  "",
  "SKU da lista de dados reais"
);

substituirRegex(
  /\n    \$w\(IDS\.sku\)\.text = "";/,
  "",
  "limpeza inicial do texto SKU"
);

substituirRegex(
  /\n  const sku =\n    safe\(\n      projeto\?\.sku\n    \) \|\|\n    `PP-\$\{codigoProjeto\}`;\n/,
  "",
  "montagem do SKU para checkout"
);

substituirRegex(
  /\n    sku,\n/,
  "",
  "SKU do objeto de dados do checkout"
);

substituirRegex(
  /\n    sku:\n      dados\.sku,\n/,
  "",
  "parâmetro SKU da URL do checkout"
);

substituirRegex(
  /título, SKU, galeria, botões ou entrega\./,
  "título, galeria, botões ou entrega.",
  "comentário do botão de vídeo"
);

substituirRegex(
  /\n  \$w\(\n    IDS\.sku\n  \)\.text =\n    projeto\?\.sku\n      \? `SKU: \$\{projeto\.sku\}`\n      : "";\n/,
  "",
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
