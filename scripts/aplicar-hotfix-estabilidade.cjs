const fs = require('fs');
const path = require('path');

function fail(message) {
  throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.resolve(rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.resolve(rel), content, 'utf8');
}

function replaceOnce(content, search, replacement, label) {
  const count = content.split(search).length - 1;
  if (count !== 1) {
    fail(`${label}: esperado 1 trecho, encontrado ${count}.`);
  }
  return content.replace(search, replacement);
}

function insertBeforeMarker(content, marker, block, label) {
  if (content.includes(block.trim())) return content;
  const count = content.split(marker).length - 1;
  if (count !== 1) {
    fail(`${label}: marcador inválido (${count}).`);
  }
  return content.replace(marker, `${block}\n\n${marker}`);
}

function hotfixEntrega() {
  const rel = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
  let s = read(rel);

  if (!s.includes('#htmlProcessandoEntrega')) {
    s = replaceOnce(
      s,
      '  galeria:\n    "#proGallery1",\n\n  video:',
      '  galeria:\n    "#proGallery1",\n\n  processando:\n    "#htmlProcessandoEntrega",\n\n  video:',
      'ENTREGA: ID do HTML'
    );
  }

  if (!s.includes('boxMedidas:')) {
    s = replaceOnce(
      s,
      '  medidas:\n    "#btnMedidas",\n\n  valorMedidas:',
      '  medidas:\n    "#btnMedidas",\n\n  boxMedidas:\n    "#box1",\n\n  valorMedidas:',
      'ENTREGA: box1'
    );
    s = replaceOnce(
      s,
      '  graficos:\n    "#btnGraficos",\n\n  valorGraficos:',
      '  graficos:\n    "#btnGraficos",\n\n  boxGraficos:\n    "#box2",\n\n  valorGraficos:',
      'ENTREGA: box2'
    );
    s = replaceOnce(
      s,
      '  projeto:\n    "#btnProjeto",\n\n  valorProjeto:',
      '  projeto:\n    "#btnProjeto",\n\n  boxProjeto:\n    "#box3",\n\n  valorProjeto:',
      'ENTREGA: box3'
    );
  }

  s = s.replace(/const MAX_TENTATIVAS =\s*\n\s*60;/, 'const MAX_TENTATIVAS =\n  150;');

  const processingBlock = `// ======================================================\n// PROCESSAMENTO VISUAL DA ENTREGA\n// ======================================================\n\nasync function mostrarProcessamento() {\n  try {\n    await $w(IDS.galeria).hide();\n    await $w(IDS.galeria).collapse();\n  } catch (erro) {\n    console.warn(\n      "Falha ao recolher a galeria durante o processamento:",\n      erro?.message || erro\n    );\n  }\n\n  try {\n    await $w(IDS.processando).expand();\n    await $w(IDS.processando).show();\n  } catch (erro) {\n    console.warn(\n      "Falha ao mostrar o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderProcessamento() {\n  try {\n    await $w(IDS.processando).hide();\n    await $w(IDS.processando).collapse();\n  } catch (erro) {\n    console.warn(\n      "Falha ao esconder o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}\n\nfunction entregaProcessada(resultado) {\n  const projeto = resultado?.project || {};\n  const tipo = safe(resultado?.session?.tipoProduto).toUpperCase();\n\n  if (tipo === "PROJETO_COMPLETO") {\n    return Boolean(safe(projeto.pdfProjeto));\n  }\n\n  if (tipo === "GRAFICOS") {\n    return Array.isArray(projeto.imagensGraficos) &&\n      projeto.imagensGraficos.filter(Boolean).length > 0;\n  }\n\n  return Boolean(safe(projeto.imagemMedidas));\n}`;

  s = insertBeforeMarker(
    s,
    '// ======================================================\n// ACESSOS LOCAIS',
    processingBlock,
    'ENTREGA: bloco de processamento'
  );

  if (!s.includes('.borderRadius =\n        "999px";')) {
    s = replaceOnce(
      s,
      '    botao.style\n      .borderColor =\n        borda;\n',
      '    botao.style\n      .borderColor =\n        borda;\n\n    botao.style\n      .borderRadius =\n        "999px";\n\n    botao.style\n      .borderWidth =\n        "1px";\n',
      'ENTREGA: arredondamento dos botões'
    );
  }

  const boxBlock = `function marcarBoxComprado(id) {\n  try {\n    const box = $w(id);\n    box.style.backgroundColor = "#E8F5ED";\n    box.style.borderColor = CORES.compradoBorda;\n    box.style.borderWidth = "2px";\n  } catch (erro) {\n    console.warn(\n      "Não foi possível marcar a caixa da etapa como comprada:",\n      erro?.message || erro\n    );\n  }\n}`;

  s = insertBeforeMarker(
    s,
    'async function definirComprado(',
    boxBlock,
    'ENTREGA: boxes compradas'
  );

  const oldNoImages = `  if (\n    !imagens.length\n  ) {\n    await $w(\n      IDS.galeria\n    ).hide();\n\n    return;\n  }`;
  const newNoImages = `  if (\n    !imagens.length\n  ) {\n    await $w(\n      IDS.galeria\n    ).hide();\n\n    await $w(\n      IDS.galeria\n    ).collapse();\n\n    return;\n  }`;
  if (!s.includes('IDS.galeria\n    ).collapse();\n\n    return;')) {
    s = replaceOnce(s, oldNoImages, newNoImages, 'ENTREGA: recolher galeria vazia');
  }

  const galleryShow = `  await $w(\n    IDS.galeria\n  ).show();`;
  const galleryExpandShow = `  await $w(\n    IDS.galeria\n  ).expand();\n\n  await $w(\n    IDS.galeria\n  ).show();`;
  if (!s.includes('IDS.galeria\n  ).expand();')) {
    s = replaceOnce(s, galleryShow, galleryExpandShow, 'ENTREGA: expandir galeria pronta');
  }

  const renderButtonsMarker = `  const projeto =\n    entrega.project || {};`;
  const renderButtonsExtra = `${renderButtonsMarker}\n\n  if (acessos.medidas) {\n    marcarBoxComprado(IDS.boxMedidas);\n  }\n\n  if (acessos.graficos) {\n    marcarBoxComprado(IDS.boxGraficos);\n  }\n\n  if (acessos.projeto) {\n    marcarBoxComprado(IDS.boxProjeto);\n  }`;
  if (!s.includes('marcarBoxComprado(IDS.boxMedidas)')) {
    s = replaceOnce(s, renderButtonsMarker, renderButtonsExtra, 'ENTREGA: sincronizar boxes verdes');
  }

  if (!s.includes('await esconderProcessamento();\n\n  /*\n    Somente depois procura o vídeo.')) {
    s = replaceOnce(
      s,
      '  await mostrarGaleria();\n\n  /*\n    Somente depois procura o vídeo.',
      '  await mostrarGaleria();\n\n  await esconderProcessamento();\n\n  /*\n    Somente depois procura o vídeo.',
      'ENTREGA: esconder loader após renderizar'
    );
  }

  const oldApproved = `      if (\n        resultado.approved\n      ) {\n        await renderizarEntrega(\n          resultado\n        );\n\n        return;\n      }`;
  const newApproved = `      if (\n        resultado.approved\n      ) {\n        if (\n          entregaProcessada(\n            resultado\n          )\n        ) {\n          await renderizarEntrega(\n            resultado\n          );\n\n          return;\n        }\n\n        alterarDescricao(\n          "Pagamento aprovado. Estamos preparando seus arquivos..."\n        );\n\n        await esperar(\n          INTERVALO\n        );\n\n        continue;\n      }`;
  if (!s.includes('entregaProcessada(\n            resultado')) {
    s = replaceOnce(s, oldApproved, newApproved, 'ENTREGA: aguardar arquivo real');
  }

  if (!s.includes('await mostrarProcessamento();\n\n    await carregarEntrega();')) {
    s = replaceOnce(
      s,
      '    await $w(\n      IDS.galeria\n    ).hide();\n\n    await carregarEntrega();',
      '    await mostrarProcessamento();\n\n    await carregarEntrega();',
      'ENTREGA: iniciar loader'
    );
  }

  write(rel, s);
  console.log('Hotfix aplicado em ENTREGA PROJETOS PRONTOS.');
}

function hotfixPixScope() {
  const rel = 'src/backend/validaPayPixProjetosProntos.jsw';
  let s = read(rel);

  if (!s.includes('"pix.cob/write"')) {
    s = replaceOnce(
      s,
      '  "pix.cob/read",\n',
      '  "pix.cob/read",\n  "pix.cob/write",\n',
      'PIX: escopo de escrita'
    );
    write(rel, s);
    console.log('Escopo pix.cob/write adicionado.');
  } else {
    console.log('Escopo pix.cob/write já estava presente.');
  }
}

hotfixEntrega();
hotfixPixScope();
