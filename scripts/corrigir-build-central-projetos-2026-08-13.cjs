const fs = require("fs");

const file = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const before = fs.readFileSync(file, "utf8");

const legacy = `  try {\n    $w(IDS.galeria).onItemClicked(\n      (event) => {\n        abrirProjetoDaCentral(event)\n          .catch(console.error);\n      }\n    );\n  } catch (erro) {\n    console.warn(\n      \"Não foi possível ligar a seleção da central de projetos:\",\n      erro?.message || erro\n    );\n  }\n\n`;

if (!before.includes(legacy)) {
  throw new Error("Bloco legado abrirProjetoDaCentral não encontrado.");
}

const after = before.replace(legacy, "");

if (after.includes("abrirProjetoDaCentral")) {
  throw new Error("Ainda existe referência a abrirProjetoDaCentral após a correção.");
}

fs.writeFileSync(file, after, "utf8");
console.log("Removido handler legado da galeria antiga. O repeater continua sendo a central ativa.");
