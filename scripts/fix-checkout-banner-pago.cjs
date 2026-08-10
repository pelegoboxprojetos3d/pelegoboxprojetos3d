const fs = require('fs');

const path = 'src/pages/checkout-projeto-pronto.i9aj1.js';
let text = fs.readFileSync(path, 'utf8');

const oldBlock = `  for (const etapa of secoes) {
    pintarAvisoEtapa(
      etapa.seletor,
      etapa.pago,
      !etapa.pago && etapa.tipo === tipoAtual
    );

    /*
      REGRA ÚNICA EM DESKTOP E MOBILE:
      etapa paga desaparece; etapa não paga permanece visível.
    */
    await mostrarSecaoEtapa(
      etapa.seletor,
      !etapa.pago
    );
  }
`;

const newBlock = `  for (const etapa of secoes) {
    /*
      No checkout de pagamento, etapas anteriores ao produto atual
      já são consideradas concluídas para fins VISUAIS.

      Exemplos:
      - checkout de GRAFICOS: MEDIDAS some imediatamente;
      - checkout de PROJETO_COMPLETO: MEDIDAS e GRAFICOS somem.

      A visibilidade continua sendo aplicada diretamente pelos IDs
      dos banners. Não depende de sessão/cache visual.
    */
    const concluidaPeloFluxo =
      (tipoAtual === "GRAFICOS" && etapa.tipo === "MEDIDAS") ||
      (tipoAtual === "PROJETO_COMPLETO" &&
        (etapa.tipo === "MEDIDAS" || etapa.tipo === "GRAFICOS"));

    const pagoEfetivo =
      etapa.pago === true ||
      concluidaPeloFluxo;

    pintarAvisoEtapa(
      etapa.seletor,
      pagoEfetivo,
      !pagoEfetivo && etapa.tipo === tipoAtual
    );

    /*
      REGRA DO /checkout-projeto-pronto EM DESKTOP E MOBILE:
      banner de etapa já paga/concluída some e recolhe espaço.
    */
    await mostrarSecaoEtapa(
      etapa.seletor,
      !pagoEfetivo
    );
  }
`;

if (text.includes(newBlock)) {
  console.log('Correção do checkout já aplicada.');
  process.exit(0);
}

if (!text.includes(oldBlock)) {
  throw new Error('Bloco esperado de banners do checkout não encontrado.');
}

text = text.replace(oldBlock, newBlock);
fs.writeFileSync(path, text);
console.log('Checkout atualizado: banners de etapas anteriores serão ocultados por ID.');
