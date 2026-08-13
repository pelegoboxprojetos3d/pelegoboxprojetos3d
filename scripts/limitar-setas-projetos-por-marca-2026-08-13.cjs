const fs = require("fs");

const CHECKOUT = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const VIDEOS = "src/pages/Videos dos projetos prontos.kn4pi.js";

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) {
    throw new Error(`${label}: trecho esperado não encontrado.`);
  }
  return code.replace(from, to);
}

function patchVideos() {
  let code = fs.readFileSync(VIDEOS, "utf8");

  const oldBlock = `  const code =\n    projectCode(itemData);\n\n  return code\n    ? (\n      "/checkoutprojetosprontos" +\n      \`?codigo=\${encodeURIComponent(code)}\`\n    )\n    : "";`;

  const newBlock = `  const code =\n    projectCode(itemData);\n\n  const brand =\n    normalizeBrand(\n      wixLocation.query.marca\n    ) ||\n    normalizeBrand(itemData?.marca_1) ||\n    normalizeBrand(itemData?.marca_2) ||\n    normalizeBrand(itemData?.marca_3);\n\n  if (!code) {\n    return "";\n  }\n\n  return (\n    "/checkoutprojetosprontos" +\n    \`?codigo=\${encodeURIComponent(code)}\` +\n    (brand\n      ? \`&marca=\${encodeURIComponent(brand)}\`\n      : "")\n  );`;

  code = replaceOnce(
    code,
    oldBlock,
    newBlock,
    "Videos: preservar marca no botão Comprar Projeto Pronto"
  );

  fs.writeFileSync(VIDEOS, code, "utf8");
}

function patchCheckout() {
  let code = fs.readFileSync(CHECKOUT, "utf8");

  const marker = `async function buscarProjetoVizinho(\n  direcao,\n  itemBase = projeto\n) {`;

  const helpers = `function normalizarMarcaNavegacao(value) {\n  try {\n    return decodeURIComponent(\n      safe(value)\n    )\n      .replace(/\\+/g, " ")\n      .trim();\n  } catch (_) {\n    return safe(value)\n      .replace(/\\+/g, " ")\n      .trim();\n  }\n}\n\nfunction marcaNavegacaoProjeto(\n  itemBase = projeto\n) {\n  /*\n    A marca escolhida na página de vídeos manda na navegação.\n    Isso é importante para projetos cadastrados em mais de uma marca: ao entrar\n    por JBL, as setas continuam em JBL, em vez de trocar para marca_1.\n  */\n  return (\n    normalizarMarcaNavegacao(\n      wixLocation.query.marca\n    ) ||\n    normalizarMarcaNavegacao(\n      itemBase?.marca_1\n    ) ||\n    normalizarMarcaNavegacao(\n      itemBase?.marca_2\n    ) ||\n    normalizarMarcaNavegacao(\n      itemBase?.marca_3\n    )\n  );\n}\n\nfunction consultaProjetosDaMarca(\n  itemBase = projeto\n) {\n  const marca =\n    marcaNavegacaoProjeto(\n      itemBase\n    );\n\n  if (!marca) {\n    return wixData.query(\n      COLLECTION\n    );\n  }\n\n  return wixData\n    .query(COLLECTION)\n    .eq("marca_1", marca)\n    .or(\n      wixData\n        .query(COLLECTION)\n        .eq("marca_2", marca)\n    )\n    .or(\n      wixData\n        .query(COLLECTION)\n        .eq("marca_3", marca)\n    );\n}\n\n${marker}`;

  if (!code.includes("function marcaNavegacaoProjeto(")) {
    code = replaceOnce(
      code,
      marker,
      helpers,
      "Checkout: inserir filtro de marca"
    );
  }

  code = replaceOnce(
    code,
    `    let consulta =\n      wixData.query(\n        COLLECTION\n      );`,
    `    let consulta =\n      consultaProjetosDaMarca(\n        itemBase\n      );`,
    "Checkout: limitar vizinho à marca"
  );

  code = replaceOnce(
    code,
    `    let consultaExtremo = wixData.query(COLLECTION);`,
    `    let consultaExtremo =\n      consultaProjetosDaMarca(\n        itemBase\n      );`,
    "Checkout: limitar loop circular à marca"
  );

  const oldUrl = `    wixLocation\n      .queryParams\n      .add({\n        codigo:\n          String(codigo)\n      });`;

  const newUrl = `    const params = {\n      codigo:\n        String(codigo)\n    };\n\n    const marca =\n      marcaNavegacaoProjeto(\n        projeto\n      );\n\n    if (marca) {\n      params.marca =\n        marca;\n    }\n\n    wixLocation\n      .queryParams\n      .add(params);`;

  code = replaceOnce(
    code,
    oldUrl,
    newUrl,
    "Checkout: preservar marca ao trocar projeto"
  );

  fs.writeFileSync(CHECKOUT, code, "utf8");
}

patchVideos();
patchCheckout();
console.log("Navegação por setas limitada à marca escolhida.");
