const fs = require('fs');

const path = 'src/backend/processarCompraProjetoPronto.js';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes('const arquivosFaltantes = [];')) {
  const start = s.indexOf('  salvo.statusProcessamento =');
  const end = s.indexOf('\n\n  salvo.dataProcessamento =', start);

  if (start < 0 || end < 0) {
    throw new Error('Bloco de status do processador não encontrado.');
  }

  const replacement = `  const arquivosFaltantes = [];

  if (
    tipoProduto === "MEDIDAS" &&
    !safe(salvo.imagemMedidas)
  ) {
    arquivosFaltantes.push({
      field:
        "imagemMedidas",
      error:
        "A imagem de medidas não foi recebida ou importada."
    });
  }

  if (tipoProduto === "GRAFICOS") {
    [
      "imagemGrafico1",
      "imagemGrafico2",
      "imagemGrafico3",
      "imagemGrafico4"
    ].forEach((field) => {
      if (!safe(salvo[field])) {
        arquivosFaltantes.push({
          field,
          error:
            \`O arquivo \${field} não foi recebido ou importado.\`
        });
      }
    });
  }

  if (
    tipoProduto === "PROJETO_COMPLETO" &&
    !safe(salvo.arquivoProjeto)
  ) {
    arquivosFaltantes.push({
      field:
        "arquivoProjeto",
      error:
        "O PDF do projeto completo não foi recebido."
    });
  }

  if (arquivosFaltantes.length) {
    falhas.push(
      ...arquivosFaltantes
    );
  }

  salvo.statusProcessamento =
    falhas.length
      ? "PARCIAL"
      : "PROCESSADO";`;

  s = s.slice(0, start) + replacement + s.slice(end);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Processador de compra validado.');
