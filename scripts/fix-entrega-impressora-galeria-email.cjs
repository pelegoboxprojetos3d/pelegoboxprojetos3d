const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let text = fs.readFileSync(path, 'utf8');

if (text.includes('MIN_PROCESSAMENTO_VISIVEL')) {
  console.log('Correção da impressora/galeria já aplicada.');
  process.exit(0);
}

const oldInterval = `const INTERVALO =\n  2000;\n\nlet entrega =\n  null;`;
const newInterval = `const INTERVALO =\n  2000;\n\n/*\n  Mesmo quando a imagem já existe (por exemplo, acesso pelo botão do e-mail),\n  a impressora fica alguns segundos visível para comunicar processamento.\n*/\nconst MIN_PROCESSAMENTO_VISIVEL =\n  3000;\n\nlet processamentoVisivelDesde =\n  0;\n\nlet entrega =\n  null;`;

if (!text.includes(oldInterval)) {
  throw new Error('Ponto de inserção do tempo mínimo não encontrado.');
}
text = text.replace(oldInterval, newInterval);

const oldProcess = `async function mostrarProcessamento() {\n  /*\n    A impressora fica visível enquanto o Make ainda prepara a imagem.\n    Não escondemos nem recolhemos a galeria por código: quando o arquivo\n    chegar à coleção, mostrarGaleria() preenche e exibe a galeria.\n  */\n  try {\n    await $w(IDS.processando).expand();\n    await $w(IDS.processando).show();\n  } catch (erro) {\n    console.warn(\n      "Falha ao mostrar o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderProcessamento() {\n  try {\n    await $w(IDS.processando).hide();\n    await $w(IDS.processando).collapse();\n  } catch (erro) {\n    console.warn(\n      "Falha ao esconder o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}`;

const newProcess = `async function mostrarProcessamento() {\n  /*\n    O HTML da impressora fica sobre a galeria no Editor.\n    Enquanto ele estiver visível, a galeria fica apenas OCULTA, sem\n    recolher o espaço. Isso evita a imagem aparecendo por baixo.\n  */\n  try {\n    await $w(IDS.galeria).hide();\n  } catch (erro) {\n    console.warn(\n      "Falha ao ocultar a galeria durante o processamento:",\n      erro?.message || erro\n    );\n  }\n\n  if (!processamentoVisivelDesde) {\n    processamentoVisivelDesde = Date.now();\n  }\n\n  try {\n    await $w(IDS.processando).expand();\n    await $w(IDS.processando).show();\n  } catch (erro) {\n    console.warn(\n      "Falha ao mostrar o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}\n\nasync function esconderProcessamento() {\n  try {\n    if (processamentoVisivelDesde) {\n      const tempoVisivel =\n        Date.now() - processamentoVisivelDesde;\n\n      const restante =\n        MIN_PROCESSAMENTO_VISIVEL - tempoVisivel;\n\n      if (restante > 0) {\n        await esperar(restante);\n      }\n    }\n\n    await $w(IDS.processando).hide();\n    await $w(IDS.processando).collapse();\n    processamentoVisivelDesde = 0;\n  } catch (erro) {\n    console.warn(\n      "Falha ao esconder o HTML de processamento:",\n      erro?.message || erro\n    );\n  }\n}`;

if (!text.includes(oldProcess)) {
  throw new Error('Bloco mostrar/esconder processamento não encontrado.');
}
text = text.replace(oldProcess, newProcess);

const oldRender = `  await renderizarBotoes();\n\n  await mostrarGaleria();\n\n  await esconderProcessamento();\n\n  await mostrarAvisosEntrega();`;
const newRender = `  await renderizarBotoes();\n\n  /*\n    A impressora está sobre a galeria. Primeiro retiramos a impressora\n    (respeitando o tempo mínimo de 3 s) e só depois revelamos a imagem.\n  */\n  await esconderProcessamento();\n\n  await mostrarGaleria();\n\n  await mostrarAvisosEntrega();`;

if (!text.includes(oldRender)) {
  throw new Error('Ordem de renderização da entrega não encontrada.');
}
text = text.replace(oldRender, newRender);

const oldOnReadyComment = `      A impressora é exibida primeiro e imediatamente.\n      Depois disso começa a consulta da coleção/Make sem bloquear a\n      renderização da página. A galeria continua livre para receber a\n      imagem assim que ela aparecer na coleção.`;
const newOnReadyComment = `      A impressora é exibida primeiro e imediatamente.\n      A galeria fica oculta enquanto a impressora estiver por cima.\n      Depois começa a consulta da coleção/Make sem bloquear a página.\n      Mesmo se a imagem já existir (acesso pelo e-mail), a impressora\n      permanece visível por pelo menos 3 segundos antes da galeria.`;

if (text.includes(oldOnReadyComment)) {
  text = text.replace(oldOnReadyComment, newOnReadyComment);
}

fs.writeFileSync(path, text);
console.log('Entrega atualizada: galeria oculta sob impressora e mínimo de 3 s em qualquer entrada.');
