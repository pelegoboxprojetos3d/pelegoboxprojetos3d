const fs = require("fs");

function replaceOrFail(path, before, after, label) {
  let text = fs.readFileSync(path, "utf8");
  if (!text.includes(before)) {
    if (text.includes(after)) {
      console.log(`${label}: já aplicado`);
      return;
    }
    throw new Error(`${label}: trecho não encontrado em ${path}`);
  }
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
  console.log(`${label}: aplicado`);
}

const processamento = "src/backend/processarCompraProjetoPronto.js";
const oldGraphics = [
  '  if (tipoProduto === "GRAFICOS") {',
  '    [',
  '      "imagemGrafico1",',
  '      "imagemGrafico2",',
  '      "imagemGrafico3",',
  '      "imagemGrafico4"',
  '    ].forEach((field) => {',
  '      if (!safe(salvo[field])) {',
  '        arquivosFaltantes.push({',
  '          field,',
  '          error: `O arquivo ${field} não foi recebido ou importado.`',
  '        });',
  '      }',
  '    });',
  '  }'
].join("\n");

const newGraphics = [
  '  if (tipoProduto === "GRAFICOS") {',
  '    /*',
  '      Um projeto pode possuir 1, 2, 3 ou 4 análises gráficas.',
  '      Não exigir quatro arquivos fixos: a etapa está completa quando',
  '      pelo menos um gráfico foi efetivamente recebido/importado.',
  '      Falhas reais de importação continuam registradas em "falhas".',
  '    */',
  '    const graficosDisponiveis = [',
  '      "imagemGrafico1",',
  '      "imagemGrafico2",',
  '      "imagemGrafico3",',
  '      "imagemGrafico4"',
  '    ].filter((field) => safe(salvo[field]));',
  '',
  '    if (!graficosDisponiveis.length) {',
  '      arquivosFaltantes.push({',
  '        field: "imagemGrafico1",',
  '        error: "Nenhuma análise gráfica foi recebida ou importada."',
  '      });',
  '    }',
  '  }'
].join("\n");
replaceOrFail(processamento, oldGraphics, newGraphics, "regra 1 a 4 gráficos");

const entrega = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const oldDeliveryStatus = [
  '  if (',
  '    statusProcessamento &&',
  '    statusProcessamento !== "PROCESSADO"',
  '  ) {',
  '    return false;',
  '  }'
].join("\n");
const newDeliveryStatus = [
  '  /*',
  '    PROCESSADO é o estado ideal. PARCIAL também pode representar um',
  '    registro antigo que exigia quatro gráficos mesmo quando o projeto',
  '    possuía legitimamente apenas 1, 2 ou 3. Nesses casos, a presença do',
  '    arquivo da etapa abaixo é a fonte da verdade para liberar a entrega.',
  '  */',
  '  if (',
  '    statusProcessamento &&',
  '    !["PROCESSADO", "PARCIAL"].includes(statusProcessamento)',
  '  ) {',
  '    return false;',
  '  }'
].join("\n");
replaceOrFail(entrega, oldDeliveryStatus, newDeliveryStatus, "liberar PARCIAL legado com arquivo");

const checkout = "src/pages/checkout-projeto-pronto.i9aj1.js";
const oldCheckoutStatus = '  if (status && status !== "PROCESSADO") return false;';
const newCheckoutStatus = '  if (status && !["PROCESSADO", "PARCIAL"].includes(status)) return false;';
replaceOrFail(checkout, oldCheckoutStatus, newCheckoutStatus, "polling cartão compatível com 1 a 4 gráficos");

console.log("Correção concluída: gráficos aceitam de 1 a 4 arquivos e entregas PARCIAL legadas podem liberar quando há arquivo real.");
