const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) {
    return text;
  }

  const count = text.split(search).length - 1;
  assert(count === 1, `${label}: esperado 1 trecho, encontrado ${count}.`);
  return text.replace(search, replacement);
}

function patchMainPage() {
  const path = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
  let s = read(path);

  const oldBlock = `  if (salva) {\n    identificacao = {\n      ...identificacao,\n      ...salva\n    };\n\n    identificado =\n      true;\n\n    identificarCliente(\n      salva\n    ).catch(\n      (\n        error\n      ) => {\n        console.error(\n          "Erro ao restaurar identificação:",\n          error?.message ||\n          error\n        );\n      }\n    );\n\n    return;\n  }`;

  const newBlock = `  if (salva) {\n    identificacao = {\n      ...identificacao,\n      ...salva\n    };\n\n    const confirmacaoAtualValida =\n      salva.whatsappConfirmado === true &&\n      Number(\n        salva.confirmacaoWhatsappVersao ||\n        0\n      ) === 2;\n\n    if (confirmacaoAtualValida) {\n      identificado =\n        true;\n\n      identificarCliente(\n        salva\n      ).catch(\n        (\n          error\n        ) => {\n          console.error(\n            "Erro ao restaurar identificação:",\n            error?.message ||\n            error\n          );\n        }\n      );\n\n      return;\n    }\n\n    /*\n      Registros antigos nunca passaram pela dupla\n      confirmação corrigida. Eles refazem o primeiro\n      popup uma única vez e, depois da confirmação no\n      checkout, deixam de ser incomodados novamente.\n    */\n    identificado =\n      false;\n\n    agendarPopupWhatsapp(\n      300\n    );\n\n    return;\n  }`;

  if (s.includes(oldBlock)) {
    s = s.replace(oldBlock, newBlock);
  } else {
    assert(
      s.includes('const confirmacaoAtualValida ='),
      'MAIN: bloco de revalidação não encontrado.'
    );
  }

  write(path, s);
}

function patchPopup() {
  const path = 'src/pages/pedir whatsapp.pl4d9.js';
  let s = read(path);

  s = s.replace(
    '    return /^\\d{11}$/.test(\n      whatsapp\n    );',
    '    return /^\\d{10,11}$/.test(\n      whatsapp\n    );'
  );

  write(path, s);
}

function patchValidaPay() {
  const path = 'src/backend/validaPayPixProjetosProntos.jsw';
  let s = read(path);

  if (!s.includes('const attempts = [\n      safe(projectCode)')) {
    const oldFunction = `async function findProductReferenceSession({\n  projectCode,\n  type,\n  amount\n}) {\n  try {\n    const result =\n      await wixData\n        .query(SESSIONS)\n        .eq(\n          "codigoProjeto",\n          safe(projectCode)\n        )\n        .descending(\n          "updatedAtDate"\n        )\n        .limit(30)\n        .find(DB_OPTS);\n\n    return (\n      result.items || []\n    ).find(\n      (item) =>\n        normalizeType(\n          item?.tipoProduto\n        ) === type &&\n        sameMoney(\n          item?.valor,\n          amount\n        ) &&\n        safe(\n          item?.validaPayProductId\n        ) &&\n        safe(\n          item?.validaPayPriceId\n        )\n    ) || null;\n\n  } catch (error) {\n    console.warn(\n      "Não foi possível reutilizar referência de produto da sessão:",\n      error?.message || error\n    );\n\n    return null;\n  }\n}`;

    const newFunction = `async function findProductReferenceSession({\n  projectCode,\n  type,\n  amount\n}) {\n  const code =\n    safe(projectCode);\n\n  const numericCode =\n    Number(code);\n\n  const attempts = [\n    code\n  ];\n\n  if (\n    code &&\n    Number.isSafeInteger(\n      numericCode\n    )\n  ) {\n    attempts.push(\n      numericCode\n    );\n  }\n\n  for (const codeValue of attempts) {\n    try {\n      const result =\n        await wixData\n          .query(SESSIONS)\n          .eq(\n            "codigoProjeto",\n            codeValue\n          )\n          .descending(\n            "updatedAtDate"\n          )\n          .limit(30)\n          .find(DB_OPTS);\n\n      const match =\n        (\n          result.items || []\n        ).find(\n          (item) =>\n            normalizeType(\n              item?.tipoProduto\n            ) === type &&\n            sameMoney(\n              item?.valor,\n              amount\n            ) &&\n            safe(\n              item?.validaPayProductId\n            ) &&\n            safe(\n              item?.validaPayPriceId\n            )\n        );\n\n      if (match) {\n        return match;\n      }\n\n    } catch (error) {\n      console.warn(\n        "Não foi possível reutilizar referência de produto da sessão:",\n        error?.message || error\n      );\n    }\n  }\n\n  return null;\n}`;

    s = replaceOnce(
      s,
      oldFunction,
      newFunction,
      'PIX: busca de referência por código'
    );
  }

  write(path, s);
}

function patchDeliveryBackend() {
  const path = 'src/backend/entregaProjetosProntos.jsw';
  let s = read(path);

  if (!s.includes('const currentProcessingPurchase =')) {
    const anchor = `  const pdfProject =\n    firstMediaFromPurchases(\n      purchases,\n      "arquivoProjeto",\n      "pdfProjeto"\n    ) ||\n    mediaSource(\n      project?.arquivoProjeto ||\n      project?.pdfProjeto\n    );\n\n  return {`;

    const replacement = `  const pdfProject =\n    firstMediaFromPurchases(\n      purchases,\n      "arquivoProjeto",\n      "pdfProjeto"\n    ) ||\n    mediaSource(\n      project?.arquivoProjeto ||\n      project?.pdfProjeto\n    );\n\n  const currentProcessingPurchase =\n    purchases.find(\n      (item) =>\n        purchaseMatchesPayment(\n          item,\n          safe(session?.paymentId)\n        )\n    ) ||\n    newestFirst(purchases)[0] ||\n    null;\n\n  const statusProcessamento =\n    safe(\n      currentProcessingPurchase\n        ?.statusProcessamento\n    ).toUpperCase();\n\n  return {`;

    s = replaceOnce(
      s,
      anchor,
      replacement,
      'ENTREGA BACKEND: status atual'
    );

    s = replaceOnce(
      s,
      `    pdfProjeto:\n      pdfProject,\n\n    valorMedidas:`,
      `    pdfProjeto:\n      pdfProject,\n\n    statusProcessamento,\n\n    valorMedidas:`,
      'ENTREGA BACKEND: expor status'
    );
  }

  write(path, s);
}

function patchDeliveryPage() {
  const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
  let s = read(path);

  if (!s.includes('const statusProcessamento =\n    safe(projeto.statusProcessamento)')) {
    const oldFunction = `function entregaProcessada(resultado) {\n  const projeto = resultado?.project || {};\n  const tipo = safe(resultado?.session?.tipoProduto).toUpperCase();\n\n  if (tipo === "PROJETO_COMPLETO") {\n    return Boolean(safe(projeto.pdfProjeto));\n  }\n\n  if (tipo === "GRAFICOS") {\n    return Array.isArray(projeto.imagensGraficos) &&\n      projeto.imagensGraficos.filter(Boolean).length > 0;\n  }\n\n  return Boolean(safe(projeto.imagemMedidas));\n}`;

    const newFunction = `function entregaProcessada(resultado) {\n  const projeto = resultado?.project || {};\n  const tipo = safe(resultado?.session?.tipoProduto).toUpperCase();\n\n  const statusProcessamento =\n    safe(projeto.statusProcessamento)\n      .toUpperCase();\n\n  /*\n    Quando o Make já iniciou o processamento, a galeria\n    só é liberada depois de PROCESSADO. Isso impede que\n    o primeiro gráfico apareça enquanto os demais ainda\n    estão sendo importados. Registros antigos sem status\n    continuam compatíveis pela existência do arquivo.\n  */\n  if (\n    statusProcessamento &&\n    statusProcessamento !== "PROCESSADO"\n  ) {\n    return false;\n  }\n\n  if (tipo === "PROJETO_COMPLETO") {\n    return Boolean(safe(projeto.pdfProjeto));\n  }\n\n  if (tipo === "GRAFICOS") {\n    return Array.isArray(projeto.imagensGraficos) &&\n      projeto.imagensGraficos.filter(Boolean).length > 0;\n  }\n\n  return Boolean(safe(projeto.imagemMedidas));\n}`;

    s = replaceOnce(
      s,
      oldFunction,
      newFunction,
      'ENTREGA PAGE: aguardar processamento final'
    );
  }

  write(path, s);
}

patchMainPage();
patchPopup();
patchValidaPay();
patchDeliveryBackend();
patchDeliveryPage();
console.log('Ajustes finais de lançamento 2 aplicados.');
